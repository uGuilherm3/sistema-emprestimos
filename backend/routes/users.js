// backend/routes/users.js
import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

// GET /api/users — lista usuários (exceto solicitantes por padrão)
router.get('/', async (req, res) => {
  try {
    const { neq_tipo, limit = 200, order = 'nome' } = req.query;
    let where = [];
    let params = [];
    if (neq_tipo) { where.push('tipo_usuario != ?'); params.push(neq_tipo); }
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [rows] = await db.query(
      `SELECT id, username, nome, email, setor, tipo_usuario, atribuicao, foto_perfil, updated_at, created_at
         FROM users ${whereClause} ORDER BY ${order} ASC LIMIT ${parseInt(limit)}`,
      params
    );
    res.json({ data: rows, error: null });
  } catch (err) {
    res.status(500).json({ data: null, error: err.message });
  }
});

// GET /api/users/:id — busca usuário por ID
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, username, nome, email, setor, tipo_usuario, atribuicao, foto_perfil, updated_at, created_at, pin
         FROM users WHERE id = ? LIMIT 1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ data: null, error: 'Usuário não encontrado' });
    res.json({ data: rows[0], error: null });
  } catch (err) {
    res.status(500).json({ data: null, error: err.message });
  }
});

// POST /api/users/login — autenticação por username/email + pin
router.post('/login', async (req, res) => {
  try {
    const { login, pin } = req.body;
    const [rows] = await db.query(
      `SELECT * FROM users WHERE (username = ? OR email = ?) AND pin = ? LIMIT 1`,
      [login, login, pin]
    );
    if (!rows[0]) return res.status(401).json({ data: null, error: 'Credenciais inválidas' });
    res.json({ data: rows[0], error: null });
  } catch (err) {
    res.status(500).json({ data: null, error: err.message });
  }
});

// POST /api/users/check-exists — verifica se username/email já existe
router.post('/check-exists', async (req, res) => {
  try {
    const { username, email } = req.body;
    const [rows] = await db.query(
      `SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1`,
      [username, email]
    );
    res.json({ data: rows[0] || null, error: null });
  } catch (err) {
    res.status(500).json({ data: null, error: err.message });
  }
});

// POST /api/users — cria novo usuário
router.post('/', async (req, res) => {
  try {
    const { id, username, email, pin, nome, setor, tipo_usuario = 'default' } = req.body;
    const userId = id || crypto.randomUUID();
    await db.query(
      `INSERT INTO users (id, username, email, pin, nome, setor, tipo_usuario)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, username, email, pin, nome, setor, tipo_usuario]
    );
    const [rows] = await db.query(`SELECT * FROM users WHERE id = ?`, [userId]);
    res.status(201).json({ data: rows[0], error: null });
  } catch (err) {
    res.status(500).json({ data: null, error: err.message });
  }
});

// PUT /api/users/:id — atualiza dados do usuário (perfil, heartbeat)
router.put('/:id', async (req, res) => {
  try {
    const body = req.body;
    const sets = Object.keys(body).map(k => `${k} = ?`);
    const vals = Object.values(body);
    await db.query(
      `UPDATE users SET ${sets.join(', ')} WHERE id = ?`,
      [...vals, req.params.id]
    );
    const [rows] = await db.query(
      `SELECT id, username, nome, email, setor, tipo_usuario, atribuicao, foto_perfil, updated_at FROM users WHERE id = ?`,
      [req.params.id]
    );
    res.json({ data: rows[0], error: null });
  } catch (err) {
    res.status(500).json({ data: null, error: err.message });
  }
});

// DELETE /api/users/:id — remove usuário
router.delete('/:id', async (req, res) => {
  try {
    await db.query(`DELETE FROM users WHERE id = ?`, [req.params.id]);
    res.json({ data: null, error: null });
  } catch (err) {
    res.status(500).json({ data: null, error: err.message });
  }
});

export default router;
