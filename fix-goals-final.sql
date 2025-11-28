-- CORREÇÃO FINAL - Adicionar colunas que podem estar faltando na tabela goals
-- Execute este SQL no Neon para garantir que todas as colunas existem

-- Verificar e adicionar colunas que podem estar faltando
ALTER TABLE goals ADD COLUMN IF NOT EXISTS "archivedDate" timestamp;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS "completedDate" timestamp;

-- Testar uma query de goals para ver se funciona agora
SELECT "id", "userId", "name", "goalType", "targetAmount", "currentAmount", "priority"
FROM goals 
WHERE "userId" = 'test' 
LIMIT 1;