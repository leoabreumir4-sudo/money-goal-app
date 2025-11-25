// Language translations
export const translations = {
  en: {
    // Dashboard
    dashboard: "Dashboard",
    addIncome: "Add Income",
    addExpense: "Add Expense",
    recentTransactions: "Recent Transactions",
    noTransactions: "No transactions yet",
    completed: "COMPLETED",
    currentAmount: "Current Amount",
    targetAmount: "Target Amount",
    noActiveGoal: "No active goal",
    createGoal: "Create Goal",
    editGoal: "Edit Goal",
    
    // Auth
    signIn: "Sign In",
    signUp: "Create Account",
    email: "Email",
    password: "Password",
    name: "Name",
    dontHaveAccount: "Don't have an account? Sign up.",
    alreadyHaveAccount: "Already have an account? Sign in.",
    
    // Settings
    settings: "Settings",
    preferences: "Preferences",
    language: "Language",
    currency: "Currency",
    theme: "Theme",
    saveChanges: "Save Changes",
    darkMode: "Dark Mode",
    lightMode: "Light Mode",
    
    // General
    income: "Income",
    expense: "Expense",
    amount: "Amount",
    reason: "Reason",
    cancel: "Cancel",
    save: "Save",
    delete: "Delete",
    edit: "Edit",
  },
  pt: {
    // Dashboard
    dashboard: "Painel",
    addIncome: "Adicionar Receita",
    addExpense: "Adicionar Despesa",
    recentTransactions: "Transações Recentes",
    noTransactions: "Nenhuma transação ainda",
    completed: "COMPLETO",
    currentAmount: "Valor Atual",
    targetAmount: "Valor Alvo",
    noActiveGoal: "Nenhuma meta ativa",
    createGoal: "Criar Meta",
    editGoal: "Editar Meta",
    
    // Auth
    signIn: "Entrar",
    signUp: "Criar Conta",
    email: "E-mail",
    password: "Senha",
    name: "Nome",
    dontHaveAccount: "Não tem uma conta? Cadastre-se.",
    alreadyHaveAccount: "Já tem uma conta? Entre.",
    
    // Settings
    settings: "Configurações",
    preferences: "Preferências",
    language: "Idioma",
    currency: "Moeda",
    theme: "Tema",
    saveChanges: "Salvar Alterações",
    darkMode: "Modo Escuro",
    lightMode: "Modo Claro",
    
    // General
    income: "Receita",
    expense: "Despesa",
    amount: "Valor",
    reason: "Motivo",
    cancel: "Cancelar",
    save: "Salvar",
    delete: "Excluir",
    edit: "Editar",
  },
  es: {
    // Dashboard
    dashboard: "Panel",
    addIncome: "Agregar Ingreso",
    addExpense: "Agregar Gasto",
    recentTransactions: "Transacciones Recientes",
    noTransactions: "No hay transacciones aún",
    completed: "COMPLETADO",
    currentAmount: "Cantidad Actual",
    targetAmount: "Cantidad Objetivo",
    noActiveGoal: "No hay meta activa",
    createGoal: "Crear Meta",
    editGoal: "Editar Meta",
    
    // Auth
    signIn: "Iniciar Sesión",
    signUp: "Crear Cuenta",
    email: "Correo",
    password: "Contraseña",
    name: "Nombre",
    dontHaveAccount: "¿No tienes cuenta? Regístrate.",
    alreadyHaveAccount: "¿Ya tienes cuenta? Inicia sesión.",
    
    // Settings
    settings: "Configuración",
    preferences: "Preferencias",
    language: "Idioma",
    currency: "Moneda",
    theme: "Tema",
    saveChanges: "Guardar Cambios",
    darkMode: "Modo Oscuro",
    lightMode: "Modo Claro",
    
    // General
    income: "Ingreso",
    expense: "Gasto",
    amount: "Cantidad",
    reason: "Razón",
    cancel: "Cancelar",
    save: "Guardar",
    delete: "Eliminar",
    edit: "Editar",
  },
};

export type Language = keyof typeof translations;
export type TranslationKey = keyof typeof translations.en;

export const t = (key: TranslationKey, lang: Language = "en"): string => {
  return translations[lang][key] || translations.en[key];
};
