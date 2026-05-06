-- Criação da tabela agenda_eventos no MariaDB
-- Execute no banco dbSistemas:
--   mysql -u root -p dbSistemas < create_agenda_eventos.sql

CREATE TABLE IF NOT EXISTS agenda_eventos (
  id              VARCHAR(36)   NOT NULL PRIMARY KEY,
  titulo          VARCHAR(255)  NOT NULL,
  categoria       VARCHAR(50)   NOT NULL DEFAULT 'Tarefa',
  cor             VARCHAR(20)   NOT NULL DEFAULT '#EAE4E4',
  inicio          DATETIME      NOT NULL,
  fim             DATETIME      NOT NULL,
  tecnico         VARCHAR(100)  NOT NULL,
  descricao       JSON,
  detalhes        TEXT,
  link            VARCHAR(500),
  fixado          TINYINT(1)    NOT NULL DEFAULT 0,
  banner          VARCHAR(500),
  apresentacao    VARCHAR(500),
  lembrete        TINYINT(1)    NOT NULL DEFAULT 0,
  lembrete_enviado DATETIME     DEFAULT NULL,
  participantes   JSON,
  likes           INT           NOT NULL DEFAULT 0,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_tecnico (tecnico),
  INDEX idx_inicio  (inicio),
  INDEX idx_fixado  (fixado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
