-- Verificação completa das novas funcionalidades no banco de dados
-- Execute este script para verificar se tudo está configurado corretamente

-- 1. Verificar enums criados
SELECT 
    'ENUMS' as category,
    typname as name,
    CASE 
        WHEN typname IN ('goal_type', 'budget_period', 'bill_status', 'insight_type') 
        THEN '✅ OK' 
        ELSE '❌ Missing' 
    END as status
FROM pg_type 
WHERE typname IN ('goal_type', 'budget_period', 'bill_status', 'insight_type')
ORDER BY typname;

-- 2. Verificar tabelas criadas
SELECT 
    'TABLES' as category,
    tablename as name,
    CASE 
        WHEN tablename IN ('budgets', 'billReminders', 'aiInsights', 'categoryLearning') 
        THEN '✅ OK' 
        ELSE '❌ Missing' 
    END as status
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('budgets', 'billReminders', 'aiInsights', 'categoryLearning')
ORDER BY tablename;

-- 3. Verificar colunas adicionadas em goals
SELECT 
    'GOALS COLUMNS' as category,
    column_name as name,
    data_type,
    CASE 
        WHEN column_name IN ('goalType', 'priority', 'monthlyContribution', 'targetDate') 
        THEN '✅ OK' 
        ELSE '❌ Missing' 
    END as status
FROM information_schema.columns
WHERE table_name = 'goals'
  AND column_name IN ('goalType', 'priority', 'monthlyContribution', 'targetDate')
ORDER BY column_name;

-- 4. Verificar indexes de budgets
SELECT 
    'BUDGETS INDEXES' as category,
    indexname as name,
    '✅ OK' as status
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename = 'budgets'
ORDER BY indexname;

-- 5. Verificar indexes de billReminders
SELECT 
    'BILLREMINDERS INDEXES' as category,
    indexname as name,
    '✅ OK' as status
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename = 'billReminders'
ORDER BY indexname;

-- 6. Verificar indexes de aiInsights
SELECT 
    'AIINSIGHTS INDEXES' as category,
    indexname as name,
    '✅ OK' as status
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename = 'aiInsights'
ORDER BY indexname;

-- 7. Verificar indexes de categoryLearning
SELECT 
    'CATEGORYLEARNING INDEXES' as category,
    indexname as name,
    '✅ OK' as status
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename = 'categoryLearning'
ORDER BY indexname;

-- 8. Contagem de registros (opcional)
SELECT 
    'RECORD COUNT' as category,
    'budgets' as name,
    COUNT(*)::text as status
FROM budgets
UNION ALL
SELECT 
    'RECORD COUNT' as category,
    'billReminders' as name,
    COUNT(*)::text as status
FROM "billReminders"
UNION ALL
SELECT 
    'RECORD COUNT' as category,
    'aiInsights' as name,
    COUNT(*)::text as status
FROM "aiInsights"
UNION ALL
SELECT 
    'RECORD COUNT' as category,
    'categoryLearning' as name,
    COUNT(*)::text as status
FROM "categoryLearning";

-- 9. Resumo final
SELECT 
    'SUMMARY' as category,
    'Total enums esperados' as name,
    '4' as status
UNION ALL
SELECT 
    'SUMMARY',
    'Total tabelas esperadas',
    '4'
UNION ALL
SELECT 
    'SUMMARY',
    'Total colunas em goals',
    '4'
UNION ALL
SELECT 
    'SUMMARY',
    'Total indexes esperados',
    '13';
