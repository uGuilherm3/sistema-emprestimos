// backend/routes/logs.js
import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

// GET /api/logs — lista logs de auditoria
router.get('/', async (req, res) => {
  try {
    const { limit = 100, gte_created_at } = req.query;
    let where = [];
    let params = [];
    if (gte_created_at) { where.push('created_at >= ?'); params.push(gte_created_at); }
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [rows] = await db.query(
      `SELECT * FROM log_auditoria ${whereClause} ORDER BY created_at DESC LIMIT ${parseInt(limit)}`,
      params
    );
    res.json({ data: rows, error: null });
  } catch (err) {
    res.status(500).json({ data: null, error: err.message });
  }
});

// POST /api/logs — insere log de auditoria
router.post('/', async (req, res) => {
  try {
    const { acao, item_nome, detalhes, tecnico } = req.body;
    const id = crypto.randomUUID();
    await db.query(
      `INSERT INTO log_auditoria (id, acao, item_nome, detalhes, tecnico) VALUES (?, ?, ?, ?, ?)`,
      [id, acao, item_nome, detalhes, tecnico]
    );
    res.status(201).json({ data: { id }, error: null });
  } catch (err) {
    res.status(500).json({ data: null, error: err.message });
  }
});

export default router;
