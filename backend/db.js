// backend/db.js
// Cliente MariaDB para o TI LEND
//
// Usa um pool de conexões (mysql2/promise) — thread-safe e eficiente.
// Exporta:
//   db.query(sql, params)  → executa uma query e retorna [rows, fields]
//   db.execute(sql, params) → alias de query (prepared statements)
//   db.getConnection()     → conexão bruta do pool (para transações)
//   db.pool                → pool raw, caso necessário

import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host:     process.env.DB_HOST     || '192.168.0.253',
  port:     Number(process.env.DB_PORT) || 3010,
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASS     || '',
  database: process.env.DB_NAME     || 'dbSistemas',
  charset:  'utf8mb4',

  // Pool settings
  connectionLimit:    10,
  waitForConnections: true,
  queueLimit:         0,

  // Converte automaticamente tipos MySQL para JS nativos
  // (números viram number, datas viram Date, etc.)
  typeCast: (field, next) => {
    // TINYINT(1) → Boolean
    if (field.type === 'TINY' && field.length === 1) {
      return field.string() === '1';
    }
    // JSON columns → objeto JS
    if (field.type === 'JSON') {
      const val = field.string();
      try { return val ? JSON.parse(val) : null; }
      catch { return val; }
    }
    return next();
  },

  // Keep-alive para evitar desconexão por idle
  enableKeepAlive:    true,
  keepAliveInitialDelay: 10000,
});

// Testa a conexão na inicialização e loga resultado
pool.getConnection()
  .then(conn => {
    console.log(`✅ [DB] MariaDB conectado → ${process.env.DB_HOST || '192.168.0.253'}:${process.env.DB_PORT || 3010}/${process.env.DB_NAME || 'dbSistemas'}`);
    conn.release();
  })
  .catch(err => {
    console.error('❌ [DB] Falha ao conectar no MariaDB:', err.message);
  });

export const db = {
  pool,

  /**
   * Executa uma query SQL com parâmetros (prepared statement).
   * @param {string} sql  - Query SQL com placeholders `?`
   * @param {Array}  params - Valores para os placeholders
   * @returns {Promise<[rows, fields]>}
   */
  async query(sql, params = []) {
    return pool.execute(sql, params);
  },

  /**
   * Alias de query — interface consistente com mysql2.
   */
  async execute(sql, params = []) {
    return pool.execute(sql, params);
  },

  /**
   * Retorna uma conexão do pool para uso em transações manuais.
   * IMPORTANTE: Sempre faça conn.release() após o uso!
   * @returns {Promise<mysql.PoolConnection>}
   */
  async getConnection() {
    return pool.getConnection();
  },

  /**
   * Executa um bloco de código dentro de uma transação.
   * Faz rollback automático em caso de erro.
   * @param {function} fn - Função assíncrona que recebe a conexão
   * @example
   *   await db.transaction(async (conn) => {
   *     await conn.execute('UPDATE item SET quantidade = ? WHERE id = ?', [5, id]);
   *     await conn.execute('INSERT INTO log_auditoria ...', [...]);
   *   });
   */
  async transaction(fn) {
    const conn = await pool.getConnection();
    await conn.beginTransaction();
    try {
      const result = await fn(conn);
      await conn.commit();
      return result;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
};
