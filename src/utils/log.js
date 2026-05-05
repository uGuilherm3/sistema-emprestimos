// src/utils/log.js
import { api } from './apiClient';

/**
 * Registra uma ação na tabela log_auditoria via API REST.
 */
export const logAction = async (action, details = {}) => {
  const acaoFormatada = (action || 'AÇÃO').toUpperCase();

  // Converte detalhes em string amigável
  let detalhesStr = '';
  if (typeof details === 'string') {
    detalhesStr = details;
  } else {
    const { item_nome, nome_equipamento, itemNome, ...resto } = details;
    detalhesStr = Object.entries(resto)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' | ');
  }

  const itemNomeFormatado = (details.item_nome || details.nome_equipamento || details.itemNome || '-').toString().toUpperCase();

  // Identifica o técnico logado
  let username = 'SISTEMA/AUTO';
  const userId = localStorage.getItem('tilend_user_id');

  if (userId) {
    if (userId.startsWith('GLPI-')) {
      username = `GLPI_USER_${userId.replace('GLPI-', '')}`;
    } else {
      const { data: profile } = await api.users.get(userId);
      if (profile) username = profile.username;
    }
  }

  console.log(`[AUDITORIA] ${acaoFormatada} | ${username}`, details);

  try {
    await api.logs.insert({
      acao: acaoFormatada,
      item_nome: itemNomeFormatado,
      detalhes: detalhesStr || 'Sem detalhes.',
      tecnico: username
    });
  } catch (error) {
    console.error('Erro ao salvar log:', error);
  }
};
