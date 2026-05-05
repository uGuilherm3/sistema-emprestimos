// src/utils/estoqueService.js
// Serviço de Estoque — Migrado de Supabase para API REST MariaDB
import { api } from './apiClient';

/**
 * Verifica se um item está disponível em um período.
 * Agora faz o cálculo no cliente com base nos empréstimos ativos do MariaDB.
 */
export async function checarDisponibilidade(itemId, dataInicio, dataFim, qtdDesejada, excluirEmpId = null) {
  const inicio = dataInicio instanceof Date ? dataInicio.toISOString() : dataInicio;
  const fim    = dataFim    instanceof Date ? dataFim.toISOString()    : dataFim;

  // Busca item e seus empréstimos no período
  const [{ data: item }, { data: emps }] = await Promise.all([
    api.items.get(itemId),
    api.emprestimos.list({ status: 'Aberto' })
  ]);

  if (!item) throw new Error('Item não encontrado');

  // Filtra empréstimos desse item no período (com sobreposição de datas)
  const conflitos = (emps || []).filter(e => {
    if (e.item_id !== itemId) return false;
    if (excluirEmpId && e.id === excluirEmpId) return false;
    const eInicio = new Date(e.data_inicio_prevista || e.created_at);
    const eFim    = new Date(e.data_devolucao_prevista || new Date(9999, 0));
    return new Date(inicio) < eFim && eInicio < new Date(fim);
  });

  const qtdReservada  = conflitos.reduce((acc, e) => acc + (Number(e.quantidade_emprestada) || 1), 0);
  const qtdTotal      = Number(item.quantidade) || 0;
  const qtdDisponivel = Math.max(0, qtdTotal - qtdReservada);

  return {
    disponivel:    qtdDisponivel >= qtdDesejada,
    qtdTotal,
    qtdReservada,
    qtdDisponivel,
    conflitos
  };
}

/**
 * Busca todos os itens do inventário.
 */
export async function listarInventario({ busca = '' } = {}) {
  const { data, error } = await api.items.list();
  if (error) throw new Error(error);

  let resultado = data || [];
  if (busca) {
    const b = busca.toLowerCase();
    resultado = resultado.filter(i =>
      (i.nome_equipamento || '').toLowerCase().includes(b) ||
      (i.modelo_detalhes  || '').toLowerCase().includes(b) ||
      (i.numero_serie     || '').toLowerCase().includes(b)
    );
  }
  return resultado;
}

/**
 * Atualiza campos de um item do inventário.
 */
export async function atualizarItemLocal(id, campos) {
  const { data, error } = await api.items.update(id, campos);
  if (error) throw new Error(error);
  return data;
}

/**
 * Stub mantido por compatibilidade — não é mais necessário no MariaDB.
 */
export async function recalcularEstoqueGlobal() {
  console.log('[ESTOQUE] recalcularEstoqueGlobal não necessário no MariaDB');
}
