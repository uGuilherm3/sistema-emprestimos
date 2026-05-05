// backend/server.js
// API Backend para o TI LEND
// Migrado de Supabase → MariaDB (mysql2)
//
// ROTAS:
//   POST /api/email/emprestimo        → Envia e-mail de empréstimo + comprovante
//   POST /api/email/devolucao         → Envia e-mail de devolução + comprovante
//   POST /api/email/limpar            → Limpa comprovantes de um protocolo
//   GET  /api/health                  → Health check (testa DB + SMTP)
//   POST /api/uploads/foto/:userId    → Upload de foto de perfil
//   POST /api/uploads/comprovante/:id → Upload de comprovante de empréstimo
//   GET  /uploads/...                 → Serve arquivos estáticos
//
// ENV NECESSÁRIAS (ver .env.example):
//   DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
//   GLPI_EMAIL
//   PORT (padrão: 3001)
//   API_SECRET (token de autenticação interna)

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import {
  enviarEmailEmprestimo,
  enviarEmailDevolucao,
  enviarEmailLembrete,
  limparComprovantesProtocolo
} from './emailService.js';
import { db } from './db.js';
import itemsRouter      from './routes/items.js';
import emprestimosRouter from './routes/emprestimos.js';
import usersRouter      from './routes/users.js';
import logsRouter       from './routes/logs.js';
import agendaRouter     from './routes/agenda.js';
import uploadsRouter    from './routes/uploads.js';

const app = express();
const PORT = process.env.PORT || 3001;
const API_SECRET = process.env.API_SECRET || 'tilend-secret-key';

// ─── Middlewares ─────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve arquivos de upload como estáticos em /uploads/...
// Ex: http://192.168.0.253:3001/uploads/fotos/user-123.jpg
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Middleware de autenticação simples via x-api-key
const authMiddleware = (req, res, next) => {
  const token = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  if (token !== API_SECRET) {
    return res.status(401).json({ error: 'Não autorizado. Forneça x-api-key válida.' });
  }
  next();
};

// ─── Rotas REST (MariaDB) ─────────────────────────────────────
app.use('/api/items',       itemsRouter);
app.use('/api/emprestimos', emprestimosRouter);
app.use('/api/users',       usersRouter);
app.use('/api/logs',        logsRouter);
app.use('/api/agenda',      agendaRouter);
app.use('/api/uploads',     uploadsRouter);

// ─── Rotas de Email / Health ──────────────────────────────────

/**
 * GET /api/health
 * Verifica status do serviço, conexão com DB e SMTP.
 */
app.get('/api/health', async (req, res) => {
  let dbStatus = 'ok';
  let dbVersion = null;

  try {
    const [rows] = await db.query('SELECT VERSION() AS version');
    dbVersion = rows[0]?.version;
  } catch (err) {
    dbStatus = 'error: ' + err.message;
  }

  res.json({
    status: 'ok',
    service: 'TI LEND Email Service',
    timestamp: new Date().toISOString(),
    database: {
      status: dbStatus,
      host: `${process.env.DB_HOST}:${process.env.DB_PORT}`,
      name: process.env.DB_NAME,
      version: dbVersion,
    },
    smtp: process.env.SMTP_HOST || 'NÃO CONFIGURADO',
  });
});

/**
 * POST /api/email/emprestimo
 * Envia e-mail de empréstimo para o GLPI Mailgate.
 *
 * Body:
 * {
 *   protocolo, solicitante, setor,
 *   itens: [{ nome, quantidade, serial }],
 *   tecnico, dataDevolucao, observacoes, assinatura,
 *   comprovante?: { bucket, path }
 * }
 */
app.post('/api/email/emprestimo', authMiddleware, async (req, res) => {
  try {
    const resultado = await enviarEmailEmprestimo(req.body);
    res.json({
      success: true,
      messageId: resultado.messageId,
      comprovanteAnexado: resultado.comprovanteAnexado,
      comprovanteRemovido: resultado.comprovanteRemovido,
    });
  } catch (error) {
    console.error('[API] Erro ao enviar e-mail de empréstimo:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/email/devolucao
 * Envia e-mail de devolução para o GLPI Mailgate.
 *
 * Body:
 * {
 *   protocolo, solicitante, tecnico,
 *   glpiTicketId?, assinatura,
 *   comprovante?: { bucket, path }
 * }
 */
app.post('/api/email/devolucao', authMiddleware, async (req, res) => {
  try {
    const resultado = await enviarEmailDevolucao(req.body);
    res.json({
      success: true,
      messageId: resultado.messageId,
      comprovanteAnexado: resultado.comprovanteAnexado,
    });
  } catch (error) {
    console.error('[API] Erro ao enviar e-mail de devolução:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/email/limpar
 * Remove comprovantes de um protocolo do storage local.
 *
 * Body: { bucket, protocoloPrefix }
 */
app.post('/api/email/limpar', authMiddleware, async (req, res) => {
  try {
    const { bucket, protocoloPrefix } = req.body;
    const resultado = await limparComprovantesProtocolo(bucket, protocoloPrefix);
    res.json({ success: true, ...resultado });
  } catch (error) {
    console.error('[API] Erro ao limpar comprovantes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Motor de Lembretes ──────────────────────────────────────
// Verifica a cada minuto se há eventos com lembrete ativo
// que iniciam em 30-31 minutos a partir de agora.
// Migrado de Supabase → MariaDB.

const rodarMotorLembretes = async () => {
  try {
    const agora = new Date();
    const em30min = new Date(agora.getTime() + 30 * 60 * 1000);
    const em31min = new Date(agora.getTime() + 31 * 60 * 1000);

    // 1. Busca eventos com lembrete ativo na janela de 30-31 min à frente
    const [eventos] = await db.query(
      `SELECT *
         FROM agenda_eventos
        WHERE lembrete = 1
          AND lembrete_enviado IS NULL
          AND inicio >= ?
          AND inicio <  ?`,
      [em30min, em31min]
    );

    if (!eventos || eventos.length === 0) return;

    console.log(`[LEMBRETE] Processando ${eventos.length} tarefa(s) próxima(s)...`);

    for (const ev of eventos) {
      // 2. Busca e-mail do técnico responsável pelo evento
      const [perfilRows] = await db.query(
        `SELECT email, username FROM users WHERE username = ? LIMIT 1`,
        [ev.tecnico]
      );

      const perfil = perfilRows[0];

      if (perfil?.email) {
        await enviarEmailLembrete({
          email: perfil.email,
          tecnico: perfil.username,
          titulo: ev.titulo,
          horario: new Date(ev.inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          data: new Date(ev.inicio).toLocaleDateString('pt-BR'),
          categoria: ev.categoria,
        });

        // 3. Marca como enviado para não repetir
        await db.query(
          `UPDATE agenda_eventos SET lembrete_enviado = NOW() WHERE id = ?`,
          [ev.id]
        );

        console.log(`[LEMBRETE] E-mail enviado para ${perfil.username} (Tarefa: ${ev.titulo})`);
      }
    }
  } catch (err) {
    console.error('[MOTOR-LEMBRETES] Erro:', err.message);
  }
};

// Inicia o motor após 10s e repete a cada 60s
setTimeout(() => {
  rodarMotorLembretes();
  setInterval(rodarMotorLembretes, 60_000);
}, 10_000);

// ─── Start Server ────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 TI LEND Email Service rodando na porta ${PORT}`);
  console.log(`   Motor de Lembretes: ATIVO (Janela 30min)`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
  console.log(`   DB:     ${process.env.DB_HOST || '192.168.0.253'}:${process.env.DB_PORT || 3010}/${process.env.DB_NAME || 'dbSistemas'}`);
  console.log(`   SMTP:   ${process.env.SMTP_HOST || 'NÃO CONFIGURADO'}\n`);
});

export default app;
