// src/utils/estoqueService.js
// Serviço de Estoque — Interface com as funções SQL do Supabase
// Usa a tabela `inventario` como cache operacional do GLPI.

import { supabase } from './supabaseClient';

/**
 * Verifica se um item do inventário está disponível em um período.
 * Usa a função SQL `verificar_disponibilidade` que checa sobreposição de intervalos.
 *
 * @param {string} inventarioId - UUID do item na tabela `inventario`
 * @param {string|Date} dataInicio - Data/hora de início do empréstimo
 * @param {string|Date} dataFim - Data/hora de devolução prevista
 * @param {number} qtdDesejada - Quantidade que o usuário quer emprestar
 * @param {string|null} excluirEmpId - UUID de um empréstimo a ignorar (para edição)
 * @returns {{ disponivel: boolean, qtdTotal: number, qtdReservada: number, qtdDisponivel: number, conflitos: Array }}
 */
export async function checarDisponibilidade(inventarioId, dataInicio, dataFim, qtdDesejada, excluirEmpId = null) {
  const inicio = dataInicio instanceof Date ? dataInicio.toISOString() : dataInicio;
  const fim = dataFim instanceof Date ? dataFim.toISOString() : dataFim;

  const { data, error } = await supabase.rpc('verificar_disponibilidade', {
    p_inventario_id: inventarioId,
    p_data_inicio: inicio,
    p_data_fim: fim,
    p_excluir_emprestimo_id: excluirEmpId
  });

  if (error) {
    console.error('[ESTOQUE] Erro ao verificar disponibilidade:', error);
    throw new Error(error.message || 'Erro ao verificar disponibilidade');
  }

  const row = data?.[0];
  if (!row) throw new Error('Nenhum dado retornado pela verificação de disponibilidade');

  return {
    disponivel: row.quantidade_disponivel >= qtdDesejada,
    qtdTotal: row.quantidade_total,
    qtdReservada: row.quantidade_reservada,
    qtdDisponivel: row.quantidade_disponivel,
    conflitos: row.conflitos || []
  };
}

/**
 * Busca todos os itens do inventário (cache local do GLPI).
 * Retorna com `quantidade_disponivel` já calculada pelo trigger.
 *
 * @param {{ apenasAtivos?: boolean, busca?: string }} opcoes
 * @returns {Array} Lista de itens do inventário
 */
export async function listarInventario({ apenasAtivos = true, busca = '' } = {}) {
  let query = supabase.from('inventario')
    .select('*')
    .order('nome_equipamento', { ascending: true });

  if (apenasAtivos) {
    query = query.eq('status_local', 'ativo');
  }

  if (busca) {
    query = query.or(`nome_equipamento.ilike.%${busca}%,modelo_detalhes.ilike.%${busca}%,numero_serie.ilike.%${busca}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[ESTOQUE] Erro ao listar inventário:', error);
    throw error;
  }

  return data || [];
}

/**
 * Atualiza campos editáveis localmente de um item do inventário.
 * Campos do GLPI (nome, quantidade_total) são preservados e só mudam via sync.
 *
 * @param {string} id - UUID do item
 * @param {object} campos - Campos editáveis: { status_local, notas_locais, bloqueado_insumo }
 */
export async function atualizarItemLocal(id, campos) {
  const camposPermitidos = {};
  if ('status_local' in campos) camposPermitidos.status_local = campos.status_local;
  if ('notas_locais' in campos) camposPermitidos.notas_locais = campos.notas_locais;
  if ('bloqueado_insumo' in campos) camposPermitidos.bloqueado_insumo = campos.bloqueado_insumo;

  camposPermitidos.updated_at = new Date().toISOString();

  const { data, error } = await supabase.from('inventario')
    .update(camposPermitidos)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[ESTOQUE] Erro ao atualizar item:', error);
    throw error;
  }

  return data;
}

/**
 * Dispara o recálculo global de disponibilidade.
 * Útil após sincronização com o GLPI.
 */
export async function recalcularEstoqueGlobal() {
  const { error } = await supabase.rpc('recalcular_disponibilidade_global');
  if (error) {
    console.error('[ESTOQUE] Erro ao recalcular estoque global:', error);
    throw error;
  }
}
