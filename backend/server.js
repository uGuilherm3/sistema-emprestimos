// backend/server.js
// API Backend para o serviço de e-mail do TI LEND
// 
// ROTAS:
//   POST /api/email/emprestimo  → Envia e-mail de empréstimo + comprovante
//   POST /api/email/devolucao   → Envia e-mail de devolução + comprovante
//   POST /api/email/limpar      → Limpa comprovantes de um protocolo
//   GET  /api/health            → Health check
//
// EXECUÇÃO:
//   node backend/server.js
//
// ENV NECESSÁRIAS:
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
//   GLPI_EMAIL
//   SUPABASE_URL, SUPABASE_SERVICE_KEY
//   PORT (padrão: 3001)
//   API_SECRET (token de autenticação interna)

import express from 'express';
import cors from 'cors';
import {
  enviarEmailEmprestimo,
  enviarEmailDevolucao,
  enviarEmailLembrete,
  limparComprovantesProtocolo
} from './emailService.js';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const app = express();
const PORT = process.env.PORT || 3001;
const API_SECRET = process.env.API_SECRET || 'tilend-secret-key';

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Middleware de autenticação simples
const authMiddleware = (req, res, next) => {
  const token = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  if (token !== API_SECRET) {
    return res.status(401).json({ error: 'Não autorizado. Forneça x-api-key válida.' });
  }
  next();
};

// ─── Rotas ───────────────────────────────────────────────────

/**
 * Health check
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'TI LEND Email Service',
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /api/email/emprestimo
 * 
 * Body:
 * {
 *   protocolo: "2026/0001",
 *   solicitante: "João Silva",
 *   setor: "ADMINISTRATIVO",
 *   itens: [{ nome: "NOTEBOOK", quantidade: 1, serial: "SN123" }],
 *   tecnico: "admin",
 *   dataDevolucao: "27/04/2026 18:00",
 *   observacoes: "Evento externo",
 *   assinatura: "TERMO DE RETIRADA...",
 *   comprovante: {
 *     bucket: "comprovantes",
 *     path: "emprestimos/2026-0001/foto.jpg"
 *   }
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
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/email/devolucao
 * 
 * Body:
 * {
 *   protocolo: "2026/0001",
 *   solicitante: "João Silva",
 *   tecnico: "admin",
 *   glpiTicketId: 1234,        // opcional — para reply no chamado
 *   assinatura: "TERMO DE DEVOLUÇÃO...",
 *   comprovante: {             // opcional
 *     bucket: "comprovantes",
 *     path: "devolucoes/2026-0001/foto.jpg"
 *   }
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
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/email/limpar
 * 
 * Body:
 * {
 *   bucket: "comprovantes",
 *   protocoloPrefix: "emprestimos/2026-0001"
 * }
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

// ─── Motor de Lembretes (Check a cada minuto) ────────────────
const rodarMotorLembretes = async () => {
  try {
    const agora = new Date();
    const em30Minutos = new Date(agora.getTime() + 30 * 60 * 1000);
    const em31Minutos = new Date(agora.getTime() + 31 * 60 * 1000);

    // 1. Buscar eventos com lembrete ativo no intervalo de 30-31 min a partir de agora
    const { data: eventos, error: errEv } = await supabase
      .from('agenda_eventos')
      .select('*')
      .eq('lembrete', true)
      .is('lembrete_enviado', null) // Apenas os não enviados
      .gte('inicio', em30Minutos.toISOString())
      .lt('inicio', em31Minutos.toISOString());

    if (errEv) throw errEv;

    if (eventos && eventos.length > 0) {
      console.log(`[LEMBRETE] Processando ${eventos.length} tarefas próximas...`);
      
      for (const ev of eventos) {
        // 2. Buscar e-mail do técnico
        const { data: perfil } = await supabase
          .from('perfil')
          .select('email, username')
          .eq('username', ev.tecnico)
          .single();

        if (perfil && perfil.email) {
          await enviarEmailLembrete({
            email: perfil.email,
            tecnico: perfil.username,
            titulo: ev.titulo,
            horario: new Date(ev.inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            data: new Date(ev.inicio).toLocaleDateString('pt-BR'),
            categoria: ev.categoria
          });

          // 3. Marcar como enviado para não repetir
          await supabase
            .from('agenda_eventos')
            .update({ lembrete_enviado: new Date().toISOString() })
            .eq('id', ev.id);
          
          console.log(`[LEMBRETE] E-mail enviado para ${perfil.username} (Tarefa: ${ev.titulo})`);
        }
      }
    }
  } catch (err) {
    console.error('[MOTOR-LEMBRETES] Erro:', err.message);
  }
};

// Inicia o motor após 10 segundos e repete a cada 60s
setTimeout(() => {
  rodarMotorLembretes();
  setInterval(rodarMotorLembretes, 60000);
}, 10000);

// ─── Start Server ────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 TI LEND Email Service rodando na porta ${PORT}`);
  console.log(`   Motor de Lembretes: ATIVO (Janela 30min)`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
  console.log(`   SMTP:   ${process.env.SMTP_HOST || 'NÃO CONFIGURADO'}`);
  console.log(`   GLPI:   ${process.env.GLPI_EMAIL || 'NÃO CONFIGURADO'}\n`);
});

export default app;
