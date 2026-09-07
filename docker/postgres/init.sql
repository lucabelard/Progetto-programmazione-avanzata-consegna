-- Script di inizializzazione del database PostgreSQL
-- Viene eseguito automaticamente al primo avvio del container

-- Crea il database se non esiste (di solito già creato dall'env POSTGRES_DB)
-- CREATE DATABASE progetto_db;

-- Estensioni utili
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";    -- Generazione UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";      -- Funzioni crittografiche

-- Commento di log
DO $$
BEGIN
  RAISE NOTICE 'Database inizializzato correttamente.';
END $$;
