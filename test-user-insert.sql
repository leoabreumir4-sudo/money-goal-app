-- TESTE DE INSERÇÃO DE USUÁRIO
-- Execute este SQL no Neon para testar se a tabela users aceita inserções

-- 1. Verificar estrutura da tabela users
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;

-- 2. Tentar inserir um usuário de teste
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

-- 3. Verificar se foi inserido
SELECT "id", "openId", "email", "name", "role" 
FROM users 
WHERE "email" = 'test@example.com';

-- 4. Limpar o teste
DELETE FROM users WHERE "email" = 'test@example.com';