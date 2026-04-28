// backend/emailService.js
// Serviço de E-mail GLPI — Fluxo "Anexar e Deletar"
//
// FLUXO:
// 1. Download da foto/comprovante do Supabase Storage (Buffer)
// 2. Anexa nativamente no e-mail via Nodemailer
// 3. Envia via SMTP para o GLPI Mailgate
// 4. Após sucesso: deleta a imagem do Storage para preservar cota
//
// EXECUÇÃO: node backend/emailService.js (standalone) ou importado como módulo
// DEPENDÊNCIAS: npm install nodemailer @supabase/supabase-js

import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

// ─── Configuração ──────────────────────────────────────────────
const SMTP_CONFIG = {
  host: process.env.SMTP_HOST || 'smtp.oabce.org.br',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
};

const GLPI_MAILGATE = process.env.GLPI_EMAIL || 'chamados@oabce.org.br';
const FROM_ADDRESS = `"TI LEND" <${SMTP_CONFIG.auth.user}>`;

// Supabase com service_role key (necessário para deletar do Storage)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dtdybgimiecwsudofbpl.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const transporter = nodemailer.createTransport(SMTP_CONFIG);

// ─── Funções Utilitárias ────────────────────────────────────────

/**
 * Baixa um arquivo do Supabase Storage e retorna como Buffer.
 * @param {string} bucket - Nome do bucket (ex: 'comprovantes')
 * @param {string} filePath - Caminho do arquivo no bucket (ex: '2026/protocolo-001.jpg')
 * @returns {{ buffer: Buffer, contentType: string, fileName: string }}
 */
async function downloadFromStorage(bucket, filePath) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .download(filePath);

  if (error) {
    throw new Error(`Erro ao baixar do Storage: ${error.message}`);
  }

  // Converte o Blob para Buffer (Node.js)
  const arrayBuffer = await data.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const fileName = filePath.split('/').pop();
  const contentType = data.type || 'application/octet-stream';

  console.log(`[STORAGE] Download OK: ${filePath} (${buffer.length} bytes)`);
  return { buffer, contentType, fileName };
}

/**
 * Deleta um arquivo do Supabase Storage permanentemente.
 * @param {string} bucket - Nome do bucket
 * @param {string} filePath - Caminho do arquivo no bucket
 */
async function deleteFromStorage(bucket, filePath) {
  const { error } = await supabase.storage
    .from(bucket)
    .remove([filePath]);

  if (error) {
    console.error(`[STORAGE] Erro ao deletar ${filePath}:`, error.message);
    throw error;
  }
  console.log(`[STORAGE] Arquivo deletado: ${filePath}`);
}

// ─── Funções Principais ─────────────────────────────────────────

/**
 * 📧 Envia e-mail de EMPRÉSTIMO para o GLPI Mailgate.
 * 
 * Fluxo completo: Download → Anexar → Enviar → Deletar
 *
 * @param {object} dados - Dados do empréstimo
 * @param {string} dados.protocolo - Protocolo do empréstimo
 * @param {string} dados.solicitante - Nome do solicitante
 * @param {string} dados.setor - Setor do solicitante
 * @param {Array} dados.itens - Lista de itens [{ nome, quantidade, serial }]
 * @param {string} dados.tecnico - Nome do técnico
 * @param {string} dados.dataDevolucao - Data de devolução prevista (string formatada)
 * @param {string} dados.observacoes - Observações adicionais
 * @param {string} dados.assinatura - Texto da assinatura eletrônica
 * @param {object|null} dados.comprovante - Info do comprovante no Storage
 * @param {string} dados.comprovante.bucket - Bucket do Storage
 * @param {string} dados.comprovante.path - Caminho no bucket
 */
export async function enviarEmailEmprestimo(dados) {
  const {
    protocolo,
    solicitante,
    setor,
    itens,
    tecnico,
    dataDevolucao,
    observacoes,
    assinatura,
    comprovante
  } = dados;

  const listaItens = itens
    .map(i => `- ${i.nome} (Qtd: ${i.quantidade}) | SN: ${i.serial || 'N/I'}`)
    .join('\n');

  const assunto = `[EMPRÉSTIMO] PROTOCOLO #${protocolo} - ${solicitante.toUpperCase()}`;

  const corpo = `
SISTEMA DE EMPRÉSTIMOS OAB-CE (AUTOMÁTICO)
-----------------------------------------
SOLICITANTE: ${solicitante.toUpperCase()}
SETOR: ${setor.toUpperCase()}
PROTOCOLO: ${protocolo}
DATA/HORA: ${new Date().toLocaleString('pt-BR')}
TÉCNICO: ${tecnico.toUpperCase()}
-----------------------------------------
DETALHES DA ASSINATURA:
${assinatura || 'Assinatura digital não registrada.'}
-----------------------------------------
ITENS RETIRADOS:
${listaItens}

OBSERVAÇÕES:
${observacoes || 'Nenhuma registrada.'}
-----------------------------------------
DEVOLUÇÃO PREVISTA: ${dataDevolucao || 'N/A'}
  `.trim();

  // Monta os anexos do e-mail
  const attachments = [];

  // PASSO 1: Download do comprovante do Supabase Storage (se existir)
  let comprovanteDownloaded = null;
  if (comprovante?.bucket && comprovante?.path) {
    try {
      comprovanteDownloaded = await downloadFromStorage(
        comprovante.bucket,
        comprovante.path
      );

      attachments.push({
        filename: comprovanteDownloaded.fileName,
        content: comprovanteDownloaded.buffer,
        contentType: comprovanteDownloaded.contentType,
      });

      console.log(`[EMAIL] Comprovante anexado: ${comprovanteDownloaded.fileName}`);
    } catch (dlErr) {
      console.error('[EMAIL] Falha no download do comprovante:', dlErr.message);
      // Continua sem anexo — o chamado deve ser criado mesmo assim
    }
  }

  // PASSO 2 + 3: Envia o e-mail via SMTP
  const info = await transporter.sendMail({
    from: FROM_ADDRESS,
    to: GLPI_MAILGATE,
    subject: assunto,
    text: corpo,
    attachments,
  });

  console.log(`[EMAIL] Enviado com sucesso: ${info.messageId}`);

  // PASSO 4: Deleta a imagem do Storage APÓS envio bem-sucedido
  if (comprovanteDownloaded && comprovante?.bucket && comprovante?.path) {
    try {
      await deleteFromStorage(comprovante.bucket, comprovante.path);
      console.log(`[STORAGE] Comprovante limpo do Storage após envio.`);
    } catch (delErr) {
      // Loga mas não falha — o e-mail já foi enviado
      console.error('[STORAGE] Falha ao deletar comprovante:', delErr.message);
    }
  }

  return {
    messageId: info.messageId,
    comprovanteAnexado: !!comprovanteDownloaded,
    comprovanteRemovido: !!comprovanteDownloaded, // será false se deu erro no delete
  };
}

/**
 * 📧 Envia e-mail de DEVOLUÇÃO para o GLPI Mailgate.
 * 
 * Fluxo: Download comprovante devolução → Anexar → Enviar → Deletar
 *
 * @param {object} dados - Dados da devolução
 * @param {string} dados.protocolo
 * @param {string} dados.solicitante
 * @param {string} dados.tecnico - Técnico que recebeu a devolução
 * @param {number|null} dados.glpiTicketId - ID do chamado GLPI original (para reply)
 * @param {string} dados.assinatura - Texto da assinatura de devolução
 * @param {object|null} dados.comprovante - { bucket, path } do Storage
 */
export async function enviarEmailDevolucao(dados) {
  const {
    protocolo,
    solicitante,
    tecnico,
    glpiTicketId,
    assinatura,
    comprovante
  } = dados;

  // Se temos o ticket ID, fazemos reply para encerrar o chamado
  const assunto = glpiTicketId
    ? `Re: [GLPI #${glpiTicketId}] Devolução - Protocolo #${protocolo}`
    : `[DEVOLUÇÃO] PROTOCOLO #${protocolo} - ${solicitante.toUpperCase()}`;

  const corpo = `
DEVOLUÇÃO REGISTRADA - SISTEMA TI LEND
-----------------------------------------
Protocolo: ${protocolo}
Devolvido por: ${solicitante.toUpperCase()}
Técnico receptor: ${tecnico.toUpperCase()}
Data/Hora: ${new Date().toLocaleString('pt-BR')}
-----------------------------------------
DETALHES DA ASSINATURA:
${assinatura || 'Assinatura digital não registrada.'}
-----------------------------------------
Todos os equipamentos foram recebidos e verificados.
Chamado pode ser encerrado.
  `.trim();

  const attachments = [];
  let comprovanteDownloaded = null;

  // Download do comprovante de devolução (se existir)
  if (comprovante?.bucket && comprovante?.path) {
    try {
      comprovanteDownloaded = await downloadFromStorage(
        comprovante.bucket,
        comprovante.path
      );
      attachments.push({
        filename: comprovanteDownloaded.fileName,
        content: comprovanteDownloaded.buffer,
        contentType: comprovanteDownloaded.contentType,
      });
    } catch (dlErr) {
      console.error('[EMAIL] Falha no download do comprovante de devolução:', dlErr.message);
    }
  }

  const info = await transporter.sendMail({
    from: FROM_ADDRESS,
    to: GLPI_MAILGATE,
    subject: assunto,
    text: corpo,
    attachments,
  });

  console.log(`[EMAIL-DEV] Enviado: ${info.messageId}`);

  // Deleta comprovante do Storage após envio
  if (comprovanteDownloaded && comprovante?.bucket && comprovante?.path) {
    try {
      await deleteFromStorage(comprovante.bucket, comprovante.path);
    } catch (delErr) {
      console.error('[STORAGE] Falha ao deletar comprovante de devolução:', delErr.message);
    }
  }

  return {
    messageId: info.messageId,
    comprovanteAnexado: !!comprovanteDownloaded,
  };
}

/**
 * 🧹 Limpa TODOS os comprovantes do Storage de um determinado protocolo.
 * Útil para limpeza manual ou em caso de erro.
 *
 * @param {string} bucket - Nome do bucket
 * @param {string} protocoloPrefix - Prefixo do caminho (ex: 'emprestimos/2026-0001')
 */
export async function limparComprovantesProtocolo(bucket, protocoloPrefix) {
  const { data: files, error } = await supabase.storage
    .from(bucket)
    .list(protocoloPrefix);

  if (error) {
    console.error('[LIMPEZA] Erro ao listar arquivos:', error.message);
    return { removidos: 0 };
  }

  if (!files || files.length === 0) {
    console.log(`[LIMPEZA] Nenhum arquivo encontrado em ${protocoloPrefix}`);
    return { removidos: 0 };
  }

  const filePaths = files.map(f => `${protocoloPrefix}/${f.name}`);
  const { error: delError } = await supabase.storage
    .from(bucket)
    .remove(filePaths);

  if (delError) {
    console.error('[LIMPEZA] Erro ao remover arquivos:', delError.message);
    return { removidos: 0 };
  }

  console.log(`[LIMPEZA] ${filePaths.length} arquivo(s) removidos de ${protocoloPrefix}`);
  return { removidos: filePaths.length };
}

/**
 * 📧 Envia e-mail de LEMBRETE DE TAREFA para o técnico.
 * 
 * @param {object} dados
 * @param {string} dados.email - E-mail do técnico
 * @param {string} dados.tecnico - Username do técnico
 * @param {string} dados.titulo - Título da tarefa
 * @param {string} dados.horario - Horário de início
 * @param {string} dados.data - Data da tarefa
 * @param {string} dados.categoria - Categoria (Tarefa, Evento, etc)
 */
export async function enviarEmailLembrete(dados) {
  const { email, tecnico, titulo, horario, data, categoria } = dados;

  const assunto = `⏰ LEMBRETE: Sua tarefa "${titulo}" começa em 30 minutos!`;

  const corpo = `
Olá, ${tecnico}!

Este é um lembrete automático do sistema TI LEND. 
Sua tarefa "${titulo}" está agendada para hoje.

DETALHES:
-----------------------------------------
Tarefa: ${titulo}
Horário: ${horario}
Data: ${data}
Categoria: ${categoria}
-----------------------------------------

Por favor, não esqueça de conferir os equipamentos ou detalhes necessários.

Atenciosamente,
Equipe de TI | TI LEND
  `.trim();

  try {
    const info = await transporter.sendMail({
      from: FROM_ADDRESS,
      to: email,
      subject: assunto,
      text: corpo,
    });
    return info;
  } catch (error) {
    console.error(`[EMAIL-LEMBRETE] Falha ao enviar para ${email}:`, error.message);
    throw error;
  }
}
