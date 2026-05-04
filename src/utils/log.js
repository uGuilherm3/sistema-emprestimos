// src/utils/log.js
import { supabase } from './supabaseClient';

/**
 * Registra uma ação na tabela log_auditoria do Supabase.
 */
export const logAction = async (action, details = {}) => {
  const timestamp = new Date().toISOString();
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
       // Se tivermos salvo o nome no login, poderíamos usar. 
       // Por enquanto, usamos o ID ou um marcador.
    } else {
       const { data: profile } = await supabase.from('users').select('username').eq('id', userId).single();
       if (profile) username = profile.username;
    }
  }

  console.log(`[AUDITORIA] ${acaoFormatada} | ${username}`, details);

  try {
    await supabase.from('log_auditoria').insert({
      id: crypto.randomUUID(),
      acao: acaoFormatada,
      item_nome: itemNomeFormatado,
      detalhes: detalhesStr || 'Sem detalhes.',
      tecnico: username
    });
  } catch (error) {
    console.error('Erro ao salvar log no Supabase:', error);
  }
};
