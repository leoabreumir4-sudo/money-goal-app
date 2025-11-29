-- Categorias Padrão para MoneyGoal App
-- Execute este SQL para criar as categorias iniciais

INSERT INTO categories (user_id, name, emoji, color, created_date) VALUES
-- Alimentação e Bebidas
('system', 'Food & Dining', '🍔', '#ef4444', NOW()),
('system', 'Groceries', '🛒', '#f97316', NOW()),
('system', 'Restaurants', '🍽️', '#fb923c', NOW()),
('system', 'Coffee & Cafes', '☕', '#fdba74', NOW()),

-- Transporte
('system', 'Transportation', '🚗', '#3b82f6', NOW()),
('system', 'Gas & Fuel', '⛽', '#60a5fa', NOW()),
('system', 'Public Transit', '🚌', '#93c5fd', NOW()),
('system', 'Uber & Taxi', '🚕', '#bfdbfe', NOW()),

-- Moradia
('system', 'Housing', '🏠', '#8b5cf6', NOW()),
('system', 'Rent', '🔑', '#a78bfa', NOW()),
('system', 'Utilities', '💡', '#c4b5fd', NOW()),
('system', 'Maintenance', '🔧', '#ddd6fe', NOW()),

-- Entretenimento
('system', 'Entertainment', '🎬', '#ec4899', NOW()),
('system', 'Movies & Shows', '🎞️', '#f472b6', NOW()),
('system', 'Games', '🎮', '#f9a8d4', NOW()),
('system', 'Music & Streaming', '🎵', '#fbcfe8', NOW()),

-- Compras
('system', 'Shopping', '🛍️', '#14b8a6', NOW()),
('system', 'Clothing', '👕', '#2dd4bf', NOW()),
('system', 'Electronics', '💻', '#5eead4', NOW()),
('system', 'Home & Garden', '🏡', '#99f6e4', NOW()),

-- Saúde e Bem-estar
('system', 'Healthcare', '⚕️', '#22c55e', NOW()),
('system', 'Pharmacy', '💊', '#4ade80', NOW()),
('system', 'Gym & Fitness', '💪', '#86efac', NOW()),
('system', 'Beauty & Personal Care', '💄', '#bbf7d0', NOW()),

-- Educação
('system', 'Education', '📚', '#f59e0b', NOW()),
('system', 'Books', '📖', '#fbbf24', NOW()),
('system', 'Courses & Training', '🎓', '#fcd34d', NOW()),

-- Serviços Financeiros
('system', 'Financial Services', '💳', '#6366f1', NOW()),
('system', 'Bank Fees', '🏦', '#818cf8', NOW()),
('system', 'Insurance', '🛡️', '#a5b4fc', NOW()),
('system', 'Investments', '📈', '#c7d2fe', NOW()),

-- Viagens
('system', 'Travel', '✈️', '#06b6d4', NOW()),
('system', 'Hotels', '🏨', '#22d3ee', NOW()),
('system', 'Vacation', '🏖️', '#67e8f9', NOW()),

-- Receitas/Rendimentos
('system', 'Salary', '💰', '#10b981', NOW()),
('system', 'Freelance', '💼', '#34d399', NOW()),
('system', 'Investments Income', '📊', '#6ee7b7', NOW()),
('system', 'Gift Received', '🎁', '#a7f3d0', NOW()),

-- Outros
('system', 'Other', '📦', '#94a3b8', NOW()),
('system', 'Gifts & Donations', '🎁', '#cbd5e1', NOW()),
('system', 'Pets', '🐾', '#e2e8f0', NOW()),
('system', 'Subscriptions', '📱', '#f1f5f9', NOW());

-- Nota: user_id 'system' indica categorias padrão do sistema
-- Para criar categorias específicas do usuário, substitua 'system' pelo openId do usuário
