// backend/routes/uploads.js
// Rotas de upload de arquivos (substitui o Supabase Storage).
// Usa multer para salvar em disco local; MariaDB armazena apenas a URL.
//
// ROTAS:
//   POST /api/uploads/foto/:userId        → Upload de foto de perfil
//   POST /api/uploads/comprovante/:empId  → Upload de comprovante de empréstimo
//   DELETE /api/uploads/foto/:userId      → Remove foto de perfil
//   DELETE /api/uploads/comprovante/:empId → Remove comprovante

import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { db } from '../db.js';

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Diretórios base ──────────────────────────────────────────
const UPLOADS_ROOT = path.join(__dirname, '..', 'uploads');
const FOTOS_DIR    = path.join(UPLOADS_ROOT, 'fotos');
const COMP_DIR     = path.join(UPLOADS_ROOT, 'comprovantes');

// Cria as pastas se não existirem
[FOTOS_DIR, COMP_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

// ─── Helpers ──────────────────────────────────────────────────
const BASE_URL = process.env.API_BASE_URL || `http://${process.env.DB_HOST || '192.168.0.253'}:${process.env.PORT || 3001}`;

const mkStorage = (dest) => multer.diskStorage({
  destination: (req, file, cb) => cb(null, dest),
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase() || '.jpg';
    const id   = req.params.userId || req.params.empId || Date.now();
    cb(null, `${id}-${Date.now()}${ext}`);
  }
});

const fotoUpload = multer({
  storage: mkStorage(FOTOS_DIR),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Apenas imagens são permitidas.'), false);
    }
    cb(null, true);
  }
});

const compUpload = multer({
  storage: mkStorage(COMP_DIR),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Formato não suportado. Use JPG, PNG, WebP ou PDF.'), false);
    }
    cb(null, true);
  }
});

// ─── FOTO DE PERFIL ───────────────────────────────────────────

/**
 * POST /api/uploads/foto/:userId
 * Body: multipart/form-data  campo: "foto"
 * Salva a imagem em disk, remove foto anterior e atualiza users.foto_perfil
 */
router.post('/foto/:userId', fotoUpload.single('foto'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ data: null, error: 'Nenhum arquivo enviado.' });

    const userId  = req.params.userId;
    const fileUrl = `${BASE_URL}/uploads/fotos/${req.file.filename}`;

    // Remove foto anterior (se existir)
    const [rows] = await db.query('SELECT foto_perfil FROM users WHERE id = ? LIMIT 1', [userId]);
    const fotoAntiga = rows[0]?.foto_perfil;
    if (fotoAntiga) {
      const nomeArquivo = path.basename(new URL(fotoAntiga).pathname);
      const caminhoAntigo = path.join(FOTOS_DIR, nomeArquivo);
      if (fs.existsSync(caminhoAntigo)) fs.unlinkSync(caminhoAntigo);
    }

    // Salva a URL no banco
    await db.query('UPDATE users SET foto_perfil = ?, updated_at = NOW() WHERE id = ?', [fileUrl, userId]);

    res.json({ data: { url: fileUrl }, error: null });
  } catch (err) {
    res.status(500).json({ data: null, error: err.message });
  }
});

/**
 * DELETE /api/uploads/foto/:userId
 * Remove a foto do disco e limpa o campo no banco.
 */
router.delete('/foto/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const [rows] = await db.query('SELECT foto_perfil FROM users WHERE id = ? LIMIT 1', [userId]);
    const fotoUrl = rows[0]?.foto_perfil;

    if (fotoUrl) {
      const nomeArquivo = path.basename(new URL(fotoUrl).pathname);
      const caminho = path.join(FOTOS_DIR, nomeArquivo);
      if (fs.existsSync(caminho)) fs.unlinkSync(caminho);
      await db.query('UPDATE users SET foto_perfil = NULL, updated_at = NOW() WHERE id = ?', [userId]);
    }

    res.json({ data: null, error: null });
  } catch (err) {
    res.status(500).json({ data: null, error: err.message });
  }
});

// ─── COMPROVANTE DE EMPRÉSTIMO ────────────────────────────────

/**
 * POST /api/uploads/comprovante/:empId
 * Body: multipart/form-data  campo: "comprovante"
 * Salva o arquivo e atualiza emprestimo.comprovante_saida com a URL.
 */
router.post('/comprovante/:empId', compUpload.single('comprovante'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ data: null, error: 'Nenhum arquivo enviado.' });

    const empId  = req.params.empId;
    const campo  = req.query.campo || 'comprovante_saida'; // comprovante_saida | comprovante_devolucao
    const campos = ['comprovante_saida', 'comprovante_devolucao'];
    if (!campos.includes(campo)) return res.status(400).json({ data: null, error: 'Campo inválido.' });

    const fileUrl = `${BASE_URL}/uploads/comprovantes/${req.file.filename}`;

    // Remove comprovante anterior se existir
    const [rows] = await db.query(`SELECT ${campo} FROM emprestimo WHERE id = ? LIMIT 1`, [empId]);
    const urlAntiga = rows[0]?.[campo];
    if (urlAntiga) {
      try {
        const nomeArquivo = path.basename(new URL(urlAntiga).pathname);
        const caminhoAntigo = path.join(COMP_DIR, nomeArquivo);
        if (fs.existsSync(caminhoAntigo)) fs.unlinkSync(caminhoAntigo);
      } catch (_) { /* URL inválida ou arquivo já removido */ }
    }

    await db.query(`UPDATE emprestimo SET ${campo} = ?, updated_at = NOW() WHERE id = ?`, [fileUrl, empId]);

    res.json({ data: { url: fileUrl, campo }, error: null });
  } catch (err) {
    res.status(500).json({ data: null, error: err.message });
  }
});

/**
 * DELETE /api/uploads/comprovante/:empId
 * Query param: ?campo=comprovante_saida | comprovante_devolucao
 */
router.delete('/comprovante/:empId', async (req, res) => {
  try {
    const empId = req.params.empId;
    const campo = req.query.campo || 'comprovante_saida';
    const campos = ['comprovante_saida', 'comprovante_devolucao'];
    if (!campos.includes(campo)) return res.status(400).json({ data: null, error: 'Campo inválido.' });

    const [rows] = await db.query(`SELECT ${campo} FROM emprestimo WHERE id = ? LIMIT 1`, [empId]);
    const urlAntiga = rows[0]?.[campo];
    if (urlAntiga) {
      try {
        const nomeArquivo = path.basename(new URL(urlAntiga).pathname);
        const caminho = path.join(COMP_DIR, nomeArquivo);
        if (fs.existsSync(caminho)) fs.unlinkSync(caminho);
      } catch (_) { /* seguro */ }
      await db.query(`UPDATE emprestimo SET ${campo} = NULL, updated_at = NOW() WHERE id = ?`, [empId]);
    }

    res.json({ data: null, error: null });
  } catch (err) {
    res.status(500).json({ data: null, error: err.message });
  }
});

export default router;
