-- Default Categories for MoneyGoal App
-- Execute this SQL to create default categories
-- Categories are stored in English but display names will be translated based on user language preferences
-- Keywords include terms in English, Portuguese, and Spanish for auto-categorization

INSERT INTO categories (name, emoji, color, "isDefault", keywords) VALUES
-- Food & Dining
('Food', '🍔', '#ef4444', true, ARRAY['food', 'meal', 'lunch', 'dinner', 'breakfast', 'alimentação', 'comida', 'refeição', 'almoço', 'jantar', 'café da manhã']),
('Groceries', '🛒', '#f97316', true, ARRAY['grocery', 'groceries', 'supermarket', 'market', 'supermercado', 'mercado', 'compras']),
('Restaurants', '🍽️', '#fb923c', true, ARRAY['restaurant', 'dining', 'eat out', 'restaurante', 'comer fora']),
('Coffee', '☕', '#fdba74', true, ARRAY['coffee', 'cafe', 'starbucks', 'café', 'cafeteria']),

-- Transportation
('Transportation', '🚗', '#3b82f6', true, ARRAY['transport', 'travel', 'commute', 'transporte', 'viagem', 'deslocamento']),
('Gas', '⛽', '#60a5fa', true, ARRAY['gas', 'fuel', 'petrol', 'gasoline', 'combustível', 'gasolina', 'posto']),
('Public Transit', '🚌', '#93c5fd', true, ARRAY['transit', 'subway', 'bus', 'train', 'metro', 'transporte público', 'metrô', 'ônibus', 'trem']),
('Uber/Taxi', '🚕', '#bfdbfe', true, ARRAY['uber', 'taxi', 'lyft', 'ride', 'táxi', 'corrida', '99']),

-- Housing
('Housing', '🏠', '#8b5cf6', true, ARRAY['housing', 'home', 'property', 'moradia', 'casa', 'imóvel']),
('Rent', '🔑', '#a78bfa', true, ARRAY['rent', 'rental', 'lease', 'aluguel', 'locação']),
('Utilities', '💡', '#c4b5fd', true, ARRAY['utilities', 'electric', 'water', 'gas', 'internet', 'phone', 'contas', 'luz', 'água', 'telefone']),
('Home Maintenance', '🔧', '#ddd6fe', true, ARRAY['maintenance', 'repair', 'home improvement', 'manutenção', 'reparo', 'conserto']),

-- Entertainment
('Entertainment', '🎬', '#ec4899', true, ARRAY['entertainment', 'fun', 'leisure', 'entretenimento', 'diversão', 'lazer']),
('Movies', '🎞️', '#f472b6', true, ARRAY['movie', 'cinema', 'film', 'theater', 'filme', 'teatro']),
('Games', '🎮', '#f9a8d4', true, ARRAY['game', 'gaming', 'video game', 'steam', 'jogo', 'jogos', 'videogame']),
('Music', '🎵', '#fbcfe8', true, ARRAY['music', 'spotify', 'concert', 'streaming', 'música', 'show', 'concerto']),

-- Shopping
('Shopping', '🛍️', '#14b8a6', true, ARRAY['shopping', 'purchase', 'buy', 'compras', 'compra']),
('Clothing', '👕', '#2dd4bf', true, ARRAY['clothing', 'clothes', 'fashion', 'apparel', 'roupa', 'roupas', 'moda', 'vestuário']),
('Electronics', '💻', '#5eead4', true, ARRAY['electronics', 'gadget', 'tech', 'computer', 'eletrônicos', 'tecnologia', 'computador']),
('Books', '📖', '#99f6e4', true, ARRAY['book', 'books', 'reading', 'amazon', 'livro', 'livros', 'leitura']),

-- Healthcare
('Healthcare', '⚕️', '#22c55e', true, ARRAY['healthcare', 'health', 'medical', 'saúde', 'médico']),
('Pharmacy', '💊', '#4ade80', true, ARRAY['pharmacy', 'medicine', 'drug', 'prescription', 'farmácia', 'remédio', 'medicamento']),
('Gym', '💪', '#86efac', true, ARRAY['gym', 'fitness', 'workout', 'exercise', 'academia', 'treino', 'exercício']),
('Doctor', '🩺', '#bbf7d0', true, ARRAY['doctor', 'medical', 'health', 'clinic', 'hospital', 'médico', 'saúde', 'clínica']),

-- Education
('Education', '📚', '#f59e0b', true, ARRAY['education', 'learning', 'study', 'educação', 'aprendizado', 'estudo']),
('Tuition', '🎓', '#fbbf24', true, ARRAY['tuition', 'school', 'college', 'university', 'mensalidade', 'escola', 'faculdade', 'universidade']),
('Courses', '📝', '#fcd34d', true, ARRAY['course', 'class', 'training', 'education', 'curso', 'aula', 'treinamento']),

-- Financial Services
('Financial', '💳', '#6366f1', true, ARRAY['financial', 'finance', 'money', 'financeiro', 'finanças', 'dinheiro']),
('Bank Fees', '🏦', '#818cf8', true, ARRAY['bank', 'fee', 'charge', 'atm', 'banco', 'taxa', 'tarifa']),
('Insurance', '🛡️', '#a5b4fc', true, ARRAY['insurance', 'premium', 'policy', 'seguro', 'apólice']),
('Investments', '📈', '#c7d2fe', true, ARRAY['investment', 'stock', 'trading', 'crypto', 'investimento', 'ações', 'bolsa']),

-- Travel
('Travel', '✈️', '#06b6d4', true, ARRAY['travel', 'trip', 'vacation', 'tourism', 'viagem', 'férias', 'turismo']),
('Hotels', '🏨', '#22d3ee', true, ARRAY['hotel', 'accommodation', 'lodging', 'airbnb', 'hospedagem', 'acomodação']),
('Flights', '🛫', '#67e8f9', true, ARRAY['flight', 'airline', 'plane', 'ticket', 'voo', 'passagem', 'avião']),

-- Income
('Salary', '💰', '#10b981', true, ARRAY['salary', 'wage', 'paycheck', 'income', 'salário', 'pagamento', 'receita']),
('Freelance', '💼', '#34d399', true, ARRAY['freelance', 'contract', 'gig', 'freela', 'contrato', 'autônomo']),
('Investment Income', '📊', '#6ee7b7', true, ARRAY['dividend', 'interest', 'profit', 'return', 'dividendo', 'juros', 'lucro', 'rendimento']),
('Other Income', '🎁', '#a7f3d0', true, ARRAY['income', 'revenue', 'earning', 'gift', 'receita', 'renda', 'ganho', 'presente']),

-- Other
('Other', '📦', '#94a3b8', true, ARRAY['other', 'misc', 'miscellaneous', 'outros', 'diversos']),
('Gifts', '🎁', '#cbd5e1', true, ARRAY['gift', 'present', 'donation', 'presente', 'doação']),
('Donations', '❤️', '#e2e8f0', true, ARRAY['donation', 'charity', 'contribution', 'doação', 'caridade', 'contribuição']),
('Subscriptions', '📱', '#f1f5f9', true, ARRAY['subscription', 'membership', 'recurring', 'assinatura', 'recorrente']);

-- Note: Categories are stored in English but will display translated names based on user's language preference
-- Supported languages: English (en), Portuguese (pt), Spanish (es)
-- User-created custom categories will always display their original name
