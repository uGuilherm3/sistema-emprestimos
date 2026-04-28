// src/utils/emailClient.js
// Cliente frontend para o serviço de e-mail backend.
// Envia requisições para o backend/server.js que processa SMTP + Storage.

const EMAIL_API_URL = import.meta.env.VITE_EMAIL_API_URL || 'http://localhost:3001';
const EMAIL_API_KEY = import.meta.env.VITE_EMAIL_API_KEY || 'tilend-secret-key';

/**
 * Helper genérico para chamadas ao serviço de e-mail.
 */
async function callEmailAPI(endpoint, body) {
  const res = await fetch(`${EMAIL_API_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': EMAIL_API_KEY,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data.error || `Erro na API de e-mail (${res.status})`);
  }

  return data;
}

/**
 * Envia e-mail de empréstimo para o GLPI via backend.
 * O backend faz: Download do comprovante → Anexa no e-mail → Envia SMTP → Deleta do Storage.
 *
 * @param {object} dados
 * @param {string} dados.protocolo
 * @param {string} dados.solicitante
 * @param {string} dados.setor
 * @param {Array}  dados.itens - [{ nome, quantidade, serial }]
 * @param {string} dados.tecnico
 * @param {string} dados.dataDevolucao
 * @param {string} dados.observacoes
 * @param {string} dados.assinatura
 * @param {{ bucket: string, path: string }|null} dados.comprovante
 */
export async function enviarEmailEmprestimoAPI(dados) {
  try {
    const result = await callEmailAPI('/api/email/emprestimo', dados);
    console.log('[EMAIL-CLIENT] Empréstimo enviado:', result.messageId);
    return result;
  } catch (err) {
    console.error('[EMAIL-CLIENT] Falha ao enviar e-mail de empréstimo:', err.message);
    throw err;
  }
}

/**
 * Envia e-mail de devolução para o GLPI via backend.
 *
 * @param {object} dados
 * @param {string} dados.protocolo
 * @param {string} dados.solicitante
 * @param {string} dados.tecnico
 * @param {number|null} dados.glpiTicketId
 * @param {string} dados.assinatura
 * @param {{ bucket: string, path: string }|null} dados.comprovante
 */
export async function enviarEmailDevolucaoAPI(dados) {
  try {
    const result = await callEmailAPI('/api/email/devolucao', dados);
    console.log('[EMAIL-CLIENT] Devolução enviada:', result.messageId);
    return result;
  } catch (err) {
    console.error('[EMAIL-CLIENT] Falha ao enviar e-mail de devolução:', err.message);
    throw err;
  }
}

/**
 * Limpa comprovantes de um protocolo do Storage via backend.
 */
export async function limparComprovantesAPI(bucket, protocoloPrefix) {
  return callEmailAPI('/api/email/limpar', { bucket, protocoloPrefix });
}
