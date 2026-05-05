// backend/routes/emprestimos.js
import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

// ─── SELECT base com JOIN em item ───────────────────────────
const BASE_SELECT = `
  SELECT e.*,
         JSON_OBJECT(
           'id',               i.id,
           'nome_equipamento', i.nome_equipamento,
           'modelo_detalhes',  i.modelo_detalhes,
           'quantidade',       i.quantidade,
           'numero_serie',     i.numero_serie
         ) AS item
    FROM emprestimo e
    LEFT JOIN item i ON i.id = e.item_id
`;

// Converte o campo item de string JSON para objeto
const parse = (rows) =>
  rows.map(r => ({ ...r, item: typeof r.item === 'string' ? JSON.parse(r.item) : r.item }));

// GET /api/emprestimos — lista com filtros opcionais
// Query params: status, nome_solicitante, protocolo, limit, gte_created_at, gte_data_hora_retorno
router.get('/', async (req, res) => {
  try {
    const { status, nome_solicitante, protocolo, limit, gte_created_at, gte_data_hora_retorno, in_status, item_id, id_eq } = req.query;
    let where = [];
    let params = [];

    if (status)              { where.push('e.status_emprestimo = ?');         params.push(status); }
    if (in_status)           { const s = in_status.split(','); where.push(`e.status_emprestimo IN (${s.map(() => '?').join(',')})`); params.push(...s); }
    if (nome_solicitante)    { where.push('e.nome_solicitante LIKE ?');        params.push(`%${nome_solicitante}%`); }
    if (protocolo)           { where.push('e.protocolo = ?');                  params.push(protocolo); }
    if (gte_created_at)      { where.push('e.created_at >= ?');                params.push(gte_created_at); }
    if (gte_data_hora_retorno){ where.push('e.data_hora_retorno >= ?');        params.push(gte_data_hora_retorno); }
    if (item_id)             { where.push('e.item_id = ?');                    params.push(item_id); }
    if (id_eq)               { where.push('e.id = ?');                         params.push(id_eq); }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const limitClause = limit ? `LIMIT ${parseInt(limit)}` : 'LIMIT 500';

    const [rows] = await db.query(
      `${BASE_SELECT} ${whereClause} ORDER BY e.created_at DESC ${limitClause}`,
      params
    );
    res.json({ data: parse(rows), error: null });
  } catch (err) {
    res.status(500).json({ data: null, error: err.message });
  }
});

// GET /api/emprestimos/protocolo-count — conta protocolos no ano para gerar sequência
router.get('/protocolo-count', async (req, res) => {
  try {
    const ano = new Date().getFullYear();
    const [rows] = await db.query(
      `SELECT protocolo FROM emprestimo
       WHERE created_at >= ? ORDER BY protocolo DESC LIMIT 100`,
      [`${ano}-01-01`]
    );
    res.json({ data: rows, error: null });
  } catch (err) {
    res.status(500).json({ data: null, error: err.message });
  }
});

// GET /api/emprestimos/:id — busca um empréstimo
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(`${BASE_SELECT} WHERE e.id = ? LIMIT 1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ data: null, error: 'Empréstimo não encontrado' });
    res.json({ data: parse(rows)[0], error: null });
  } catch (err) {
    res.status(500).json({ data: null, error: err.message });
  }
});

// POST /api/emprestimos — cria novo empréstimo
router.post('/', async (req, res) => {
  try {
    const body = req.body;
    const id = body.id || crypto.randomUUID();
    const cols = Object.keys(body).filter(k => k !== 'id');
    const vals = cols.map(k => body[k]);
    await db.query(
      `INSERT INTO emprestimo (id, ${cols.join(', ')}) VALUES (?, ${cols.map(() => '?').join(', ')})`,
      [id, ...vals]
    );
    const [rows] = await db.query(`${BASE_SELECT} WHERE e.id = ? LIMIT 1`, [id]);
    res.status(201).json({ data: parse(rows)[0], error: null });
  } catch (err) {
    res.status(500).json({ data: null, error: err.message });
  }
});

// PUT /api/emprestimos/:id — atualiza empréstimo
router.put('/:id', async (req, res) => {
  try {
    const body = req.body;
    const sets = Object.keys(body).map(k => `${k} = ?`);
    const vals = Object.values(body);
    await db.query(
      `UPDATE emprestimo SET ${sets.join(', ')}, updated_at = NOW() WHERE id = ?`,
      [...vals, req.params.id]
    );
    const [rows] = await db.query(`${BASE_SELECT} WHERE e.id = ? LIMIT 1`, [req.params.id]);
    res.json({ data: parse(rows)[0], error: null });
  } catch (err) {
    res.status(500).json({ data: null, error: err.message });
  }
});

// PUT /api/emprestimos — atualiza múltiplos por IDs (body: { ids: [], ...campos })
router.put('/', async (req, res) => {
  try {
    const { ids, ...campos } = req.body;
    if (!ids?.length) return res.status(400).json({ error: 'ids[] é obrigatório' });
    const sets = Object.keys(campos).map(k => `${k} = ?`);
    const vals = Object.values(campos);
    await db.query(
      `UPDATE emprestimo SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id IN (${ids.map(() => '?').join(',')})`,
      [...vals, ...ids]
    );
    res.json({ data: null, error: null });
  } catch (err) {
    res.status(500).json({ data: null, error: err.message });
  }
});

// DELETE /api/emprestimos — deleta múltiplos por IDs (body: { ids: [] })
router.delete('/', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids?.length) return res.status(400).json({ error: 'ids[] é obrigatório' });
    await db.query(
      `DELETE FROM emprestimo WHERE id IN (${ids.map(() => '?').join(',')})`, ids
    );
    res.json({ data: null, error: null });
  } catch (err) {
    res.status(500).json({ data: null, error: err.message });
  }
});

export default router;
