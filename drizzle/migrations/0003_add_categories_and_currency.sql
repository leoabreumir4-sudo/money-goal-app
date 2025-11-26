-- Add multi-currency and smart categorization support

-- Update categories table
ALTER TABLE categories 
  ALTER COLUMN "userId" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS keywords TEXT[],
  ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN DEFAULT FALSE NOT NULL,
  ADD COLUMN IF NOT EXISTS "createdDate" TIMESTAMP DEFAULT NOW() NOT NULL;

-- Update transactions table
ALTER TABLE transactions
  ALTER COLUMN currency SET DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS "exchangeRate" TEXT;

-- Insert default categories with keywords for auto-categorization
INSERT INTO categories ("userId", name, emoji, color, keywords, "isDefault", "createdDate")
VALUES
  -- Food & Dining
  (NULL, 'Food & Dining', '🍔', '#ef4444', ARRAY['mcdonalds', 'ifood', 'rappi', 'uber eats', 'burguer', 'burger', 'pizza', 'restaurant', 'restaurante', 'padaria', 'cafe', 'coffee', 'lanchonete', 'delivery', 'subway', 'kfc', 'wendys', 'taco bell', 'chipotle', 'starbucks', 'dunkin'], TRUE, NOW()),
  
  -- Groceries
  (NULL, 'Groceries', '🛒', '#10b981', ARRAY['mercado', 'supermercado', 'carrefour', 'extra', 'pao de acucar', 'walmart', 'lidl', 'aldi', 'whole foods', 'trader joes', 'costco', 'target', 'safeway', 'kroger'], TRUE, NOW()),
  
  -- Health & Fitness
  (NULL, 'Health & Fitness', '💪', '#8b5cf6', ARRAY['growth', 'supplements', 'whey', 'creatina', 'protein', 'gym', 'academia', 'smartfit', 'crossfit', 'fitness', 'farmacia', 'drogaria', 'pharmacy', 'cvs', 'walgreens', 'doctor', 'hospital', 'clinic'], TRUE, NOW()),
  
  -- Transportation
  (NULL, 'Transportation', '🚗', '#f59e0b', ARRAY['uber', '99', '99pop', 'taxi', 'gas', 'gasolina', 'gasoline', 'shell', 'ipiranga', 'chevron', 'exxon', 'bp', 'parking', 'metro', 'subway', 'bus', 'train', 'lyft'], TRUE, NOW()),
  
  -- Entertainment
  (NULL, 'Entertainment', '🎮', '#ec4899', ARRAY['netflix', 'spotify', 'disney', 'hbo', 'prime video', 'youtube', 'cinema', 'movie', 'ingresso', 'steam', 'playstation', 'xbox', 'nintendo', 'twitch', 'apple music', 'concert', 'show'], TRUE, NOW()),
  
  -- Shopping
  (NULL, 'Shopping', '🛍️', '#3b82f6', ARRAY['amazon', 'mercado livre', 'shopee', 'shein', 'zara', 'nike', 'adidas', 'h&m', 'forever 21', 'aliexpress', 'ebay', 'etsy', 'asos', 'uniqlo', 'clothing', 'clothes'], TRUE, NOW()),
  
  -- Bills & Utilities
  (NULL, 'Bills & Utilities', '📄', '#6366f1', ARRAY['luz', 'energia', 'eletrica', 'water', 'agua', 'internet', 'telefone', 'phone', 'vivo', 'claro', 'tim', 'oi', 'verizon', 'att', 't-mobile', 'comcast', 'rent', 'aluguel', 'mortgage', 'insurance'], TRUE, NOW()),
  
  -- Tech & Software
  (NULL, 'Tech & Software', '💻', '#14b8a6', ARRAY['github', 'microsoft', 'adobe', 'notion', 'figma', 'slack', 'zoom', 'dropbox', 'google', 'apple', 'icloud', 'chatgpt', 'openai', 'hosting', 'domain', 'vercel', 'aws', 'azure'], TRUE, NOW()),
  
  -- Education
  (NULL, 'Education', '📚', '#a855f7', ARRAY['udemy', 'coursera', 'skillshare', 'linkedin learning', 'masterclass', 'pluralsight', 'books', 'livro', 'school', 'university', 'course', 'tutorial', 'education'], TRUE, NOW()),
  
  -- Income
  (NULL, 'Income', '💰', '#22c55e', ARRAY['salary', 'salario', 'payment', 'pagamento', 'freelance', 'bonus', 'refund', 'cashback', 'dividend', 'interest', 'reward', 'artix'], TRUE, NOW()),
  
  -- Transfer
  (NULL, 'Transfer', '↔️', '#64748b', ARRAY['transfer', 'transferencia', 'transferred', 'bank transfer', 'wire', 'p2p', 'pix'], TRUE, NOW()),
  
  -- Other
  (NULL, 'Other', '📦', '#94a3b8', ARRAY[]::TEXT[], TRUE, NOW())
ON CONFLICT DO NOTHING;

-- Create index for faster category keyword lookups
CREATE INDEX IF NOT EXISTS idx_categories_keywords ON categories USING GIN (keywords);

-- Create index for currency on transactions
CREATE INDEX IF NOT EXISTS idx_transactions_currency ON transactions (currency);
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions (categoryId);
