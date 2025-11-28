-- ============================================================================
-- DATABASE VERIFICATION SCRIPT - Money Goal App
-- Execute este script para verificar se tudo está criado corretamente
-- ============================================================================

-- 1. VERIFICAR SE TODOS OS ENUMS EXISTEM
SELECT 
    'ENUMS CHECK' as check_type,
    typname as enum_name,
    array_agg(enumlabel ORDER BY enumsortorder) as values,
    CASE 
        WHEN typname IN ('user_role', 'goal_status', 'goal_type', 'transaction_type', 'theme', 'frequency', 'chat_role', 'budget_period', 'bill_status', 'insight_type') 
        THEN '✅ OK' 
        ELSE '❌ MISSING' 
    END as status
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname IN (
    'user_role', 'goal_status', 'goal_type', 'transaction_type', 
    'theme', 'frequency', 'chat_role', 'budget_period', 
    'bill_status', 'insight_type'
)
GROUP BY typname
ORDER BY typname;

-- 2. VERIFICAR SE TODAS AS TABELAS EXISTEM
WITH required_tables AS (
    SELECT unnest(ARRAY[
        'users', 'goals', 'categories', 'transactions', 'userSettings',
        'recurringExpenses', 'projects', 'events', 'chatMessages', 
        'monthlyPayments', 'budgets', 'billReminders', 'aiInsights', 
        'categoryLearning'
    ]) as table_name
),
existing_tables AS (
    SELECT tablename as table_name
    FROM pg_tables 
    WHERE schemaname = 'public'
)
SELECT 
    'TABLES CHECK' as check_type,
    rt.table_name,
    CASE 
        WHEN et.table_name IS NOT NULL THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END as status
FROM required_tables rt
LEFT JOIN existing_tables et ON rt.table_name = et.table_name
ORDER BY rt.table_name;

-- 3. VERIFICAR COLUNAS CRÍTICAS EM CADA TABELA
SELECT 
    'COLUMNS CHECK' as check_type,
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name IN (
        'users', 'goals', 'categories', 'transactions', 'userSettings',
        'recurringExpenses', 'projects', 'events', 'chatMessages', 
        'monthlyPayments', 'budgets', 'billReminders', 'aiInsights', 
        'categoryLearning'
    )
ORDER BY table_name, ordinal_position;

-- 4. VERIFICAR INDEXES IMPORTANTES
SELECT 
    'INDEXES CHECK' as check_type,
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public'
    AND tablename IN (
        'users', 'goals', 'categories', 'transactions', 'userSettings',
        'recurringExpenses', 'projects', 'events', 'chatMessages', 
        'monthlyPayments', 'budgets', 'billReminders', 'aiInsights', 
        'categoryLearning'
    )
ORDER BY tablename, indexname;

-- 5. CONTAGEM RESUMIDA
SELECT 
    'SUMMARY' as check_type,
    (SELECT COUNT(*) FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname IN ('user_role', 'goal_status', 'goal_type', 'transaction_type', 'theme', 'frequency', 'chat_role', 'budget_period', 'bill_status', 'insight_type')) as enums_count,
    (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('users', 'goals', 'categories', 'transactions', 'userSettings', 'recurringExpenses', 'projects', 'events', 'chatMessages', 'monthlyPayments', 'budgets', 'billReminders', 'aiInsights', 'categoryLearning')) as tables_count,
    (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public' AND tablename IN ('users', 'goals', 'categories', 'transactions', 'userSettings', 'recurringExpenses', 'projects', 'events', 'chatMessages', 'monthlyPayments', 'budgets', 'billReminders', 'aiInsights', 'categoryLearning')) as indexes_count;

-- 6. VERIFICAR SE HÁ DADOS NAS TABELAS PRINCIPAIS
SELECT 
    'DATA CHECK' as check_type,
    'users' as table_name,
    COUNT(*) as record_count
FROM users
UNION ALL
SELECT 
    'DATA CHECK' as check_type,
    'goals' as table_name,
    COUNT(*) as record_count
FROM goals
UNION ALL
SELECT 
    'DATA CHECK' as check_type,
    'categories' as table_name,
    COUNT(*) as record_count
FROM categories
UNION ALL
SELECT 
    'DATA CHECK' as check_type,
    'transactions' as table_name,
    COUNT(*) as record_count
FROM transactions
UNION ALL
SELECT 
    'DATA CHECK' as check_type,
    'budgets' as table_name,
    COUNT(*) as record_count
FROM budgets;

-- 7. RESULTADO FINAL
SELECT 
    '🎯 DATABASE STATUS' as final_check,
    CASE 
        WHEN (
            (SELECT COUNT(DISTINCT typname) FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname IN ('user_role', 'goal_status', 'goal_type', 'transaction_type', 'theme', 'frequency', 'chat_role', 'budget_period', 'bill_status', 'insight_type')) = 10
            AND 
            (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('users', 'goals', 'categories', 'transactions', 'userSettings', 'recurringExpenses', 'projects', 'events', 'chatMessages', 'monthlyPayments', 'budgets', 'billReminders', 'aiInsights', 'categoryLearning')) = 14
        ) THEN '✅ DATABASE IS COMPLETE - ALL GOOD!'
        ELSE '❌ DATABASE INCOMPLETE - SOME ITEMS MISSING'
    END as status;