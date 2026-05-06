// backend/routes/agenda.js
import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

// Helper: parse JSON fields
const parse = (rows) =>
  rows.map(r => ({
    ...r,
    descricao:    typeof r.descricao    === 'string' ? tryParse(r.descricao)    : (r.descricao    || []),
    participantes: typeof r.participantes === 'string' ? tryParse(r.participantes) : (r.participantes || [])
  }));

const tryParse = (v) => { try { return JSON.parse(v); } catch { return v; } };

// Converte ISO 8601 (ex: "2026-05-07T10:30:00.000Z") para formato MySQL ("2026-05-07 10:30:00")
const toMysqlDatetime = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace('T', ' ');
};

// GET /api/agenda — lista eventos (filtro por tecnico + participantes)
router.get('/', async (req, res) => {
  try {
    const { tecnico, lembrete, gte_inicio } = req.query;
    let where = [];
    let params = [];

    if (tecnico) {
      // Busca eventos onde o usuário é dono OU participante
      where.push(`(tecnico = ? OR JSON_CONTAINS(participantes, JSON_QUOTE(?)))`);
      params.push(tecnico, tecnico);
    }
    if (lembrete === 'true') { where.push('lembrete = 1'); }
    if (gte_inicio)          { where.push('inicio >= ?'); params.push(gte_inicio); }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [rows] = await db.query(
      `SELECT * FROM agenda_eventos ${whereClause} ORDER BY inicio ASC`,
      params
    );
    res.json({ data: parse(rows), error: null });
  } catch (err) {
    // Fallback sem JSON_CONTAINS (MariaDB antigo)
    try {
      const { tecnico } = req.query;
      const [rows] = await db.query(
        `SELECT * FROM agenda_eventos WHERE tecnico = ? ORDER BY inicio ASC`,
        [tecnico]
      );
      res.json({ data: parse(rows), error: null });
    } catch (e) {
      res.status(500).json({ data: null, error: err.message });
    }
  }
});

// GET /api/agenda/perfis — retorna username e foto_perfil de todos os técnicos
router.get('/perfis', async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT username, foto_perfil FROM users`);
    res.json({ data: rows, error: null });
  } catch (err) {
    res.status(500).json({ data: null, error: err.message });
  }
});

// POST /api/agenda — cria evento
router.post('/', async (req, res) => {
  try {
    const body = req.body;
    const id = body.id || crypto.randomUUID();
    const { titulo, categoria, cor, inicio, fim, tecnico, descricao, detalhes, link, fixado, banner, apresentacao, lembrete, participantes } = body;
    await db.query(
      `INSERT INTO agenda_eventos (id, titulo, categoria, cor, inicio, fim, tecnico, descricao, detalhes, link, fixado, banner, apresentacao, lembrete, participantes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, titulo, categoria, cor, toMysqlDatetime(inicio), toMysqlDatetime(fim), tecnico,
        JSON.stringify(Array.isArray(descricao) ? descricao : []),
        detalhes || null, link || null, fixado ? 1 : 0,
        banner || null, apresentacao || null, lembrete ? 1 : 0,
        JSON.stringify(Array.isArray(participantes) ? participantes : [])
      ]
    );
    const [rows] = await db.query(`SELECT * FROM agenda_eventos WHERE id = ?`, [id]);
    res.status(201).json({ data: parse(rows)[0], error: null });
  } catch (err) {
    res.status(500).json({ data: null, error: err.message });
  }
});

// PUT /api/agenda/:id — atualiza evento
router.put('/:id', async (req, res) => {
  try {
    const body = req.body;
    // Serializa arrays para JSON
    if (Array.isArray(body.descricao))     body.descricao     = JSON.stringify(body.descricao);
    if (Array.isArray(body.participantes)) body.participantes = JSON.stringify(body.participantes);
    // Converte datas ISO para formato MySQL
    if (body.inicio) body.inicio = toMysqlDatetime(body.inicio);
    if (body.fim)    body.fim    = toMysqlDatetime(body.fim);
    const sets = Object.keys(body).map(k => `${k} = ?`);
    const vals = Object.values(body);
    await db.query(
      `UPDATE agenda_eventos SET ${sets.join(', ')} WHERE id = ?`,
      [...vals, req.params.id]
    );
    const [rows] = await db.query(`SELECT * FROM agenda_eventos WHERE id = ?`, [req.params.id]);
    res.json({ data: parse(rows)[0], error: null });
  } catch (err) {
    res.status(500).json({ data: null, error: err.message });
  }
});

// DELETE /api/agenda/:id — remove evento
router.delete('/:id', async (req, res) => {
  try {
    await db.query(`DELETE FROM agenda_eventos WHERE id = ?`, [req.params.id]);
    res.json({ data: null, error: null });
  } catch (err) {
    res.status(500).json({ data: null, error: err.message });
  }
});

export default router;
