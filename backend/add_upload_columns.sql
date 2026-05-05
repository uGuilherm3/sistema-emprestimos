-- Script para garantir as colunas de comprovante e foto na tabela do MariaDB
-- Execute no servidor: mysql -u root -p dbSistemas < add_upload_columns.sql

-- Coluna de foto de perfil (users)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS foto_perfil VARCHAR(500) DEFAULT NULL;

-- Colunas de comprovante (emprestimo)
ALTER TABLE emprestimo
  ADD COLUMN IF NOT EXISTS comprovante_saida      VARCHAR(500) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS comprovante_devolucao  VARCHAR(500) DEFAULT NULL;
