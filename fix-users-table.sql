-- CORRIGIR TABELA USERS - Adicionar coluna role que está faltando
-- Execute este SQL no Neon

-- 1. Verificar estrutura atual da tabela users
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;

-- 2. Adicionar a coluna role que está faltando
ALTER TABLE users ADD COLUMN IF NOT EXISTS "role" "user_role" DEFAULT 'user' NOT NULL;

-- 3. Verificar se foi adicionada
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;

-- 4. Testar inserção agora
INSERT INTO users (
    "openId", 
    "email", 
    "name", 
    "passwordHash", 
    "role"
) VALUES (
    'test@example.com',
    'test@example.com', 
    'Test User',
    '$2a$10$test.hash.example',
    'user'
);

-- 5. Verificar se funcionou
SELECT "id", "openId", "email", "name", "role" 
FROM users 
WHERE "email" = 'test@example.com';

-- 6. Limpar teste
DELETE FROM users WHERE "email" = 'test@example.com';