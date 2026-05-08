// backend/create_user.js
import { db } from './db.js';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
  const username = 'guilherme';
  const pin = '1234';
  const email = 'guilherme@oabce.org.br';
  const nome = 'Guilherme Pontes';
  const setor = 'TI';
  const tipo_usuario = 'adm';

  try {
    const [rows] = await db.query('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    
    if (rows.length > 0) {
      console.log(`Usuário "${username}" já existe com ID: ${rows[0].id}. Atualizando PIN para "${pin}"...`);
      await db.query('UPDATE users SET pin = ? WHERE id = ?', [pin, rows[0].id]);
      console.log('PIN atualizado com sucesso.');
    } else {
      const userId = crypto.randomUUID();
      await db.query(
        `INSERT INTO users (id, username, email, pin, nome, setor, tipo_usuario)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, username, email, pin, nome, setor, tipo_usuario]
      );
      console.log(`Usuário "${username}" criado com sucesso! ID: ${userId}`);
    }
  } catch (err) {
    console.error('Erro ao gerenciar usuário:', err.message);
  } finally {
    process.exit();
  }
}

run();
