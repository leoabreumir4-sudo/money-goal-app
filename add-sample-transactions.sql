-- Add sample transactions for user alvarowise1999@gmail.com
-- User ID: a8b2132a-fd1d-43ad-8c35-8350ecc79f67
-- Goal ID: Assuming goal ID 1 (adjust if needed)

-- First, let's verify the user and get a default goal
DO $$
DECLARE
    v_user_id uuid := 'a8b2132a-fd1d-43ad-8c35-8350ecc79f67';
    v_goal_id integer;
BEGIN
    -- Get the first active goal for this user
    SELECT id INTO v_goal_id FROM goals WHERE "userId" = v_user_id AND status = 'active' LIMIT 1;
    
    -- If no goal exists, we'll insert transactions with goalId = 1 (adjust manually if needed)
    IF v_goal_id IS NULL THEN
        v_goal_id := 1;
    END IF;

    -- Income transactions (Artix Entertainment salary and freelance)
    INSERT INTO transactions ("userId", "goalId", "categoryId", type, amount, reason, "createdDate") VALUES
    (v_user_id, v_goal_id, 1, 'income', 450000, 'Artix Entertainment - Salary', NOW() - INTERVAL '25 days'),
    (v_user_id, v_goal_id, 1, 'income', 120000, 'Freelance Web Dev Project', NOW() - INTERVAL '20 days'),
    (v_user_id, v_goal_id, 1, 'income', 450000, 'Artix Entertainment - Salary', NOW() - INTERVAL '10 days'),
    (v_user_id, v_goal_id, 1, 'income', 85000, 'Freelance Design Work', NOW() - INTERVAL '5 days'),
    (v_user_id, v_goal_id, 1, 'income', 50000, 'Consulting Fee', NOW() - INTERVAL '2 days');

    -- Expense transactions - Food & Groceries
    INSERT INTO transactions ("userId", "goalId", "categoryId", type, amount, reason, "createdDate") VALUES
    (v_user_id, v_goal_id, 2, 'expense', 15000, 'Mercado - Compras do mês', NOW() - INTERVAL '24 days'),
    (v_user_id, v_goal_id, 2, 'expense', 4500, 'iFood - Jantar', NOW() - INTERVAL '23 days'),
    (v_user_id, v_goal_id, 2, 'expense', 8500, 'Mercado - Compras da semana', NOW() - INTERVAL '18 days'),
    (v_user_id, v_goal_id, 2, 'expense', 3200, 'iFood - Almoço', NOW() - INTERVAL '16 days'),
    (v_user_id, v_goal_id, 2, 'expense', 6700, 'Restaurante - Jantar com amigos', NOW() - INTERVAL '14 days'),
    (v_user_id, v_goal_id, 2, 'expense', 4100, 'iFood - Pizza', NOW() - INTERVAL '12 days'),
    (v_user_id, v_goal_id, 2, 'expense', 9200, 'Mercado - Compras da semana', NOW() - INTERVAL '10 days'),
    (v_user_id, v_goal_id, 2, 'expense', 3800, 'iFood - Lanche', NOW() - INTERVAL '7 days'),
    (v_user_id, v_goal_id, 2, 'expense', 5400, 'Padaria - Café da manhã', NOW() - INTERVAL '5 days'),
    (v_user_id, v_goal_id, 2, 'expense', 3900, 'iFood - Burger', NOW() - INTERVAL '3 days');

    -- Expense transactions - Transportation
    INSERT INTO transactions ("userId", "goalId", "categoryId", type, amount, reason, "createdDate") VALUES
    (v_user_id, v_goal_id, 3, 'expense', 1800, 'Uber - Casa para trabalho', NOW() - INTERVAL '22 days'),
    (v_user_id, v_goal_id, 3, 'expense', 2200, 'Uber - Centro', NOW() - INTERVAL '19 days'),
    (v_user_id, v_goal_id, 3, 'expense', 1500, 'Uber - Academia', NOW() - INTERVAL '15 days'),
    (v_user_id, v_goal_id, 3, 'expense', 2800, 'Uber - Aeroporto', NOW() - INTERVAL '11 days'),
    (v_user_id, v_goal_id, 3, 'expense', 1600, 'Uber - Shopping', NOW() - INTERVAL '6 days'),
    (v_user_id, v_goal_id, 3, 'expense', 1900, 'Uber - Jantar', NOW() - INTERVAL '4 days');

    -- Expense transactions - Subscriptions & Entertainment
    INSERT INTO transactions ("userId", "goalId", "categoryId", type, amount, reason, "createdDate") VALUES
    (v_user_id, v_goal_id, 4, 'expense', 5500, 'Netflix - Assinatura mensal', NOW() - INTERVAL '26 days'),
    (v_user_id, v_goal_id, 4, 'expense', 2199, 'Spotify Premium', NOW() - INTERVAL '26 days'),
    (v_user_id, v_goal_id, 4, 'expense', 1299, 'ChatGPT Plus', NOW() - INTERVAL '25 days'),
    (v_user_id, v_goal_id, 4, 'expense', 3500, 'Amazon Prime', NOW() - INTERVAL '24 days');

    -- Expense transactions - Fitness
    INSERT INTO transactions ("userId", "goalId", "categoryId", type, amount, reason, "createdDate") VALUES
    (v_user_id, v_goal_id, 5, 'expense', 15000, 'Academia - Mensalidade', NOW() - INTERVAL '27 days'),
    (v_user_id, v_goal_id, 5, 'expense', 8000, 'Whey Protein', NOW() - INTERVAL '20 days'),
    (v_user_id, v_goal_id, 5, 'expense', 4500, 'Creatina', NOW() - INTERVAL '18 days');

    RAISE NOTICE 'Successfully inserted 30 sample transactions for user %', v_user_id;
END $$;

-- Verify the inserted transactions
SELECT 
    t.id,
    t.type,
    t.amount / 100.0 as amount_dollars,
    t.reason,
    t."createdDate",
    c.name as category
FROM transactions t
LEFT JOIN categories c ON t."categoryId" = c.id
WHERE t."userId" = 'a8b2132a-fd1d-43ad-8c35-8350ecc79f67'
ORDER BY t."createdDate" DESC
LIMIT 35;
