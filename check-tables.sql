-- Verificar se as novas tabelas existem
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('budgets', 'billReminders', 'aiInsights', 'categoryLearning')
ORDER BY tablename;

-- Verificar se os novos enums existem
SELECT typname 
FROM pg_type 
WHERE typname IN ('budget_period', 'bill_status', 'insight_type', 'goal_type')
ORDER BY typname;

-- Verificar estrutura da tabela goals
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'goals'
  AND column_name IN ('goalType', 'priority', 'monthlyContribution', 'targetDate')
ORDER BY column_name;
