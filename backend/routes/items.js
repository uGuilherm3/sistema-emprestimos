// backend/routes/items.js
import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

// GET /api/items — lista todos os itens
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, nome_equipamento, quantidade, modelo_detalhes, numero_serie, bloqueado_insumo,
              glpi_id, glpi_type, glpi_ref, created_at, updated_at
         FROM item
        ORDER BY nome_equipamento ASC`
    );
    res.json({ data: rows, error: null });
  } catch (err) {
    res.status(500).json({ data: null, error: err.message });
  }
});

// GET /api/items/:id — busca um item por ID
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM item WHERE id = ? LIMIT 1`, [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ data: null, error: 'Item não encontrado' });
    res.json({ data: rows[0], error: null });
  } catch (err) {
    res.status(500).json({ data: null, error: err.message });
  }
});

// POST /api/items — cria um novo item
router.post('/', async (req, res) => {
  try {
    const { id, nome_equipamento, modelo_detalhes, numero_serie, quantidade, bloqueado_insumo } = req.body;
    const itemId = id || crypto.randomUUID();
    await db.query(
      `INSERT INTO item (id, nome_equipamento, modelo_detalhes, numero_serie, quantidade, bloqueado_insumo)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [itemId, nome_equipamento, modelo_detalhes || null, numero_serie || null, quantidade ?? 1, bloqueado_insumo ? 1 : 0]
    );
    const [rows] = await db.query(`SELECT * FROM item WHERE id = ?`, [itemId]);
    res.status(201).json({ data: rows[0], error: null });
  } catch (err) {
    res.status(500).json({ data: null, error: err.message });
  }
});

// PUT /api/items/:id — atualiza um item
router.put('/:id', async (req, res) => {
  try {
    const { nome_equipamento, modelo_detalhes, numero_serie, quantidade, bloqueado_insumo } = req.body;
    await db.query(
      `UPDATE item SET nome_equipamento=?, modelo_detalhes=?, numero_serie=?, quantidade=?, bloqueado_insumo=?, updated_at=NOW()
       WHERE id=?`,
      [nome_equipamento, modelo_detalhes ?? null, numero_serie ?? null, quantidade, bloqueado_insumo ? 1 : 0, req.params.id]
    );
    const [rows] = await db.query(`SELECT * FROM item WHERE id = ?`, [req.params.id]);
    res.json({ data: rows[0], error: null });
  } catch (err) {
    res.status(500).json({ data: null, error: err.message });
  }
});

// POST /api/items/upsert — insere ou atualiza itens por glpi_id (sync GLPI)
router.post('/upsert', async (req, res) => {
  try {
    const lote = Array.isArray(req.body) ? req.body : [req.body];
    for (const item of lote) {
      const { glpi_id, glpi_type, nome_equipamento, modelo_detalhes, numero_serie, quantidade, ultima_sync } = item;
      await db.query(
        `INSERT INTO item (id, nome_equipamento, modelo_detalhes, numero_serie, quantidade, glpi_id, glpi_type, updated_at)
         VALUES (UUID(), ?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
           nome_equipamento = VALUES(nome_equipamento),
           modelo_detalhes  = VALUES(modelo_detalhes),
           numero_serie     = VALUES(numero_serie),
           quantidade       = VALUES(quantidade),
           glpi_type        = VALUES(glpi_type),
           updated_at       = NOW()`,
        [nome_equipamento, modelo_detalhes || null, numero_serie || null, quantidade ?? 1, glpi_id || null, glpi_type || null]
      );
    }
    res.json({ data: null, error: null });
  } catch (err) {
    res.status(500).json({ data: null, error: err.message });
  }
});

// DELETE /api/items/:id — remove um item
router.delete('/:id', async (req, res) => {
  try {
    await db.query(`DELETE FROM item WHERE id = ?`, [req.params.id]);
    res.json({ data: null, error: null });
  } catch (err) {
    res.status(500).json({ data: null, error: err.message });
  }
});

export default router;
