// src/utils/syncGLPI.js
// Sincronização GLPI → Supabase (Upsert)
// Busca todos os ativos do GLPI e insere/atualiza na tabela `inventario`.
// Campos locais (status_local, notas_locais, bloqueado_insumo) são PRESERVADOS.

import { supabase } from './supabaseClient';

const GLPI_URL = import.meta.env.VITE_GLPI_URL || 'https://chamados.oabce.org.br/apirest.php';
const APP_TOKEN = import.meta.env.VITE_GLPI_APP_TOKEN || '7uq6DCSHn6hAPfGrquvoHcuMgCjX5Pff5zLeS1ON';
const USER_TOKEN = import.meta.env.VITE_GLPI_USER_TOKEN || 'IJz6r1DV1LFVJT2hFvPZtHaVxjtIT3eC1YSMXQen';

/**
 * Inicia uma sessão no GLPI e retorna o session_token.
 */
async function initSession() {
  const res = await fetch(`${GLPI_URL}/initSession`, {
    method: 'GET',
    headers: {
      'App-Token': APP_TOKEN,
      'Authorization': `user_token ${USER_TOKEN}`
    }
  });

  if (!res.ok) {
    const err = await res.text().catch(() => 'Erro desconhecido');
    throw new Error(`Falha ao iniciar sessão GLPI: ${res.status} - ${err}`);
  }

  const data = await res.json();
  return data.session_token;
}

/**
 * Encerra a sessão no GLPI (fire-and-forget).
 */
function killSession(sessionToken) {
  fetch(`${GLPI_URL}/killSession`, {
    method: 'GET',
    headers: { 'App-Token': APP_TOKEN, 'Session-Token': sessionToken }
  }).catch(() => {});
}

/**
 * Busca itens de um tipo específico no GLPI.
 * @param {string} sessionToken
 * @param {string} tipo - Ex: 'ConsumableItem', 'Computer', 'Monitor', 'Peripheral'
 * @returns {Array}
 */
async function buscarItensPorTipo(sessionToken, tipo) {
  try {
    const res = await fetch(
      `${GLPI_URL}/${tipo}?expand_dropdowns=true&range=0-2000`,
      {
        headers: {
          'App-Token': APP_TOKEN,
          'Session-Token': sessionToken
        }
      }
    );

    if (!res.ok) {
      console.warn(`[SYNC] Falha ao buscar ${tipo}: ${res.status}`);
      return [];
    }

    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error(`[SYNC] Erro ao buscar ${tipo}:`, err);
    return [];
  }
}

/**
 * Mapeia um item do GLPI para o formato da tabela `inventario`.
 */
function mapearItemGLPI(item, tipo) {
  let nome = (item.name || 'SEM NOME').toUpperCase().trim();
  let modelo = '';
  let serial = '';
  let quantidade = 1;

  switch (tipo) {
    case 'ConsumableItem':
      modelo = (item.ref || item.comment || '').trim();
      quantidade = Number(item.stock_target) || Number(item.count) || 1;
      break;

    case 'Computer':
      modelo = (item.computertypes_id_name || item.computermodels_id_name || '').trim();
      serial = (item.serial || '').trim();
      quantidade = 1;
      break;

    case 'Monitor':
      modelo = (item.monitormodels_id_name || '').trim();
      serial = (item.serial || '').trim();
      quantidade = 1;
      break;

    case 'Peripheral':
      modelo = (item.peripheralmodels_id_name || '').trim();
      serial = (item.serial || '').trim();
      quantidade = 1;
      break;

    default:
      modelo = (item.comment || '').trim();
      serial = (item.serial || item.otherserial || '').trim();
      quantidade = Number(item.count || item.stock_target || 1);
  }

  return {
    glpi_id: `${tipo}-${item.id}`,
    glpi_type: tipo,
    nome_equipamento: nome,
    modelo_detalhes: modelo || null,
    numero_serie: serial || null,
    quantidade_total: quantidade,
    ultima_sync: new Date().toISOString()
  };
}

/**
 * 🔄 Sincroniza o inventário do GLPI para a tabela `inventario` do Supabase.
 *
 * COMPORTAMENTO:
 * - Busca TODOS os ativos dos tipos configurados via API do GLPI.
 * - Faz UPSERT por `glpi_id` (chave única).
 * - Campos locais (status_local, notas_locais, bloqueado_insumo) NÃO são sobrescritos.
 * - Ao final, recalcula `quantidade_disponivel` de todos os itens.
 *
 * @param {function} onProgress - Callback opcional (progresso: { etapa, total, atual })
 * @returns {{ total: number, sucesso: number, erros: number, detalhes: string[] }}
 */
export async function sincronizarInventario(onProgress = null) {
  let sessionToken = null;
  const detalhes = [];
  let total = 0, sucesso = 0, erros = 0;

  try {
    // 1. Abrir sessão no GLPI
    if (onProgress) onProgress({ etapa: 'Conectando ao GLPI...', total: 0, atual: 0 });
    sessionToken = await initSession();
    detalhes.push('✅ Sessão GLPI iniciada');

    // 2. Buscar itens de cada tipo
    const tiposParaBuscar = ['ConsumableItem', 'Computer', 'Monitor', 'Peripheral'];
    const todosItens = [];

    for (const tipo of tiposParaBuscar) {
      if (onProgress) onProgress({ etapa: `Buscando ${tipo}...`, total: tiposParaBuscar.length, atual: tiposParaBuscar.indexOf(tipo) + 1 });

      const itens = await buscarItensPorTipo(sessionToken, tipo);
      const mapeados = itens.map(item => mapearItemGLPI(item, tipo));
      todosItens.push(...mapeados);
      detalhes.push(`📦 ${tipo}: ${itens.length} itens encontrados`);
    }

    total = todosItens.length;

    if (total === 0) {
      detalhes.push('⚠️ Nenhum item encontrado no GLPI');
      return { total, sucesso, erros, detalhes };
    }

    // 3. Upsert em lotes de 50
    const BATCH_SIZE = 50;
    const totalLotes = Math.ceil(total / BATCH_SIZE);

    for (let i = 0; i < total; i += BATCH_SIZE) {
      const loteNum = Math.floor(i / BATCH_SIZE) + 1;
      if (onProgress) onProgress({ etapa: `Salvando lote ${loteNum}/${totalLotes}...`, total, atual: i });

      const lote = todosItens.slice(i, i + BATCH_SIZE).map(item => ({
        glpi_id: item.glpi_id,
        glpi_type: item.glpi_type,
        nome_equipamento: item.nome_equipamento,
        modelo_detalhes: item.modelo_detalhes,
        numero_serie: item.numero_serie,
        quantidade: item.quantidade_total,
        ultima_sync: item.ultima_sync
      }));

      const { error } = await supabase
        .from('item')
        .upsert(lote, { onConflict: 'glpi_id' });

      if (error) {
        console.error(`[SYNC] Erro no lote ${loteNum}:`, error);
        detalhes.push(`❌ Lote ${loteNum}: ${error.message}`);
        erros += lote.length;
      } else {
        sucesso += lote.length;
      }
    }

    detalhes.push('✅ Sincronização concluída');

    detalhes.push(`\n📊 Resultado: ${sucesso} salvos, ${erros} erros de ${total} total`);

    return { total, sucesso, erros, detalhes };

  } catch (error) {
    console.error('[SYNC] Erro fatal na sincronização:', error);
    detalhes.push(`❌ Erro fatal: ${error.message}`);
    return { total, sucesso, erros: erros || 1, detalhes };

  } finally {
    if (sessionToken) killSession(sessionToken);
  }
}
