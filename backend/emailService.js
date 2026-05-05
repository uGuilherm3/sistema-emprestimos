// backend/emailService.js
// Serviço de E-mail GLPI — Fluxo "Anexar e Deletar"
//
// FLUXO:
// 1. Lê o comprovante do sistema de arquivos local (pasta ./uploads/)
// 2. Anexa nativamente no e-mail via Nodemailer
// 3. Envia via SMTP para o GLPI Mailgate
// 4. Após sucesso: deleta o arquivo local para liberar espaço
//
// EXECUÇÃO: node backend/emailService.js (standalone) ou importado como módulo
// DEPENDÊNCIAS: npm install nodemailer mysql2

import nodemailer from 'nodemailer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Diretório base para uploads locais (equivalente aos buckets do Supabase)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Garante que a pasta de uploads existe ao iniciar
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

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

const transporter = nodemailer.createTransport(SMTP_CONFIG);

// ─── Funções Utilitárias ────────────────────────────────────────

/**
 * Lê um arquivo do sistema de arquivos local (pasta uploads/).
 * O `bucket` é tratado como subpasta dentro de UPLOADS_DIR.
 * Ex: bucket='comprovantes', filePath='emprestimos/2026-0001/foto.jpg'
 *
 * @param {string} bucket   - Subpasta (ex: 'comprovantes')
 * @param {string} filePath - Caminho relativo do arquivo dentro do bucket
 * @returns {{ buffer: Buffer, contentType: string, fileName: string }}
 */
function downloadFromStorage(bucket, filePath) {
  const fullPath = path.join(UPLOADS_DIR, bucket, filePath);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`Arquivo não encontrado no storage local: ${fullPath}`);
  }

  const buffer = fs.readFileSync(fullPath);
  const fileName = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = ext === '.pdf' ? 'application/pdf'
    : ext === '.png' ? 'image/png'
    : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
    : 'application/octet-stream';

  console.log(`[STORAGE] Lido: ${fullPath} (${buffer.length} bytes)`);
  return { buffer, contentType, fileName };
}

/**
 * Deleta um arquivo do storage local permanentemente.
 * @param {string} bucket   - Subpasta
 * @param {string} filePath - Caminho relativo do arquivo
 */
function deleteFromStorage(bucket, filePath) {
  const fullPath = path.join(UPLOADS_DIR, bucket, filePath);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
    console.log(`[STORAGE] Arquivo deletado: ${fullPath}`);
  }
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
export function limparComprovantesProtocolo(bucket, protocoloPrefix) {
  const dirPath = path.join(UPLOADS_DIR, bucket, protocoloPrefix);

  if (!fs.existsSync(dirPath)) {
    console.log(`[LIMPEZA] Pasta não encontrada: ${dirPath}`);
    return { removidos: 0 };
  }

  const files = fs.readdirSync(dirPath);

  if (files.length === 0) {
    console.log(`[LIMPEZA] Nenhum arquivo em ${dirPath}`);
    return { removidos: 0 };
  }

  let removidos = 0;
  for (const file of files) {
    try {
      fs.unlinkSync(path.join(dirPath, file));
      removidos++;
    } catch (e) {
      console.error(`[LIMPEZA] Falha ao remover ${file}:`, e.message);
    }
  }

  // Remove a pasta se ficou vazia
  try { fs.rmdirSync(dirPath); } catch (_) { /* ignora */ }

  console.log(`[LIMPEZA] ${removidos} arquivo(s) removidos de ${dirPath}`);
  return { removidos };
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
