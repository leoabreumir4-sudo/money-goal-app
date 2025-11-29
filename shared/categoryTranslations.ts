/**
 * Category name translations
 * Maps category names to their translations in different languages
 */

export type SupportedLanguage = "en" | "pt" | "es";

export const categoryTranslations: Record<string, Record<SupportedLanguage, string>> = {
  // Food & Dining
  "Food": {
    en: "Food",
    pt: "Alimentação",
    es: "Comida",
  },
  "Groceries": {
    en: "Groceries",
    pt: "Supermercado",
    es: "Comestibles",
  },
  "Restaurants": {
    en: "Restaurants",
    pt: "Restaurantes",
    es: "Restaurantes",
  },
  "Coffee": {
    en: "Coffee",
    pt: "Café",
    es: "Café",
  },

  // Transportation
  "Gas": {
    en: "Gas",
    pt: "Combustível",
    es: "Gasolina",
  },
  "Public Transit": {
    en: "Public Transit",
    pt: "Transporte Público",
    es: "Transporte Público",
  },
  "Uber/Taxi": {
    en: "Uber/Taxi",
    pt: "Uber/Táxi",
    es: "Uber/Taxi",
  },
  "Transportation": {
    en: "Transportation",
    pt: "Transporte",
    es: "Transporte",
  },

  // Housing
  "Rent": {
    en: "Rent",
    pt: "Aluguel",
    es: "Alquiler",
  },
  "Utilities": {
    en: "Utilities",
    pt: "Contas",
    es: "Servicios",
  },
  "Home Maintenance": {
    en: "Home Maintenance",
    pt: "Manutenção",
    es: "Mantenimiento",
  },
  "Housing": {
    en: "Housing",
    pt: "Moradia",
    es: "Vivienda",
  },

  // Entertainment
  "Movies": {
    en: "Movies",
    pt: "Cinema",
    es: "Cine",
  },
  "Games": {
    en: "Games",
    pt: "Jogos",
    es: "Juegos",
  },
  "Music": {
    en: "Music",
    pt: "Música",
    es: "Música",
  },
  "Entertainment": {
    en: "Entertainment",
    pt: "Entretenimento",
    es: "Entretenimiento",
  },

  // Shopping
  "Clothing": {
    en: "Clothing",
    pt: "Roupas",
    es: "Ropa",
  },
  "Electronics": {
    en: "Electronics",
    pt: "Eletrônicos",
    es: "Electrónicos",
  },
  "Books": {
    en: "Books",
    pt: "Livros",
    es: "Libros",
  },
  "Shopping": {
    en: "Shopping",
    pt: "Compras",
    es: "Compras",
  },

  // Healthcare
  "Pharmacy": {
    en: "Pharmacy",
    pt: "Farmácia",
    es: "Farmacia",
  },
  "Doctor": {
    en: "Doctor",
    pt: "Médico",
    es: "Médico",
  },
  "Gym": {
    en: "Gym",
    pt: "Academia",
    es: "Gimnasio",
  },
  "Healthcare": {
    en: "Healthcare",
    pt: "Saúde",
    es: "Salud",
  },

  // Education
  "Tuition": {
    en: "Tuition",
    pt: "Mensalidade",
    es: "Matrícula",
  },
  "Courses": {
    en: "Courses",
    pt: "Cursos",
    es: "Cursos",
  },
  "Education": {
    en: "Education",
    pt: "Educação",
    es: "Educación",
  },

  // Financial Services
  "Bank Fees": {
    en: "Bank Fees",
    pt: "Taxas Bancárias",
    es: "Tarifas Bancarias",
  },
  "Insurance": {
    en: "Insurance",
    pt: "Seguros",
    es: "Seguros",
  },
  "Investments": {
    en: "Investments",
    pt: "Investimentos",
    es: "Inversiones",
  },
  "Financial": {
    en: "Financial",
    pt: "Financeiro",
    es: "Financiero",
  },

  // Travel
  "Hotels": {
    en: "Hotels",
    pt: "Hotéis",
    es: "Hoteles",
  },
  "Flights": {
    en: "Flights",
    pt: "Passagens",
    es: "Vuelos",
  },
  "Travel": {
    en: "Travel",
    pt: "Viagens",
    es: "Viajes",
  },

  // Income
  "Salary": {
    en: "Salary",
    pt: "Salário",
    es: "Salario",
  },
  "Freelance": {
    en: "Freelance",
    pt: "Freelance",
    es: "Freelance",
  },
  "Investment Income": {
    en: "Investment Income",
    pt: "Renda de Investimentos",
    es: "Ingresos por Inversiones",
  },
  "Other Income": {
    en: "Other Income",
    pt: "Outras Receitas",
    es: "Otros Ingresos",
  },

  // Other
  "Gifts": {
    en: "Gifts",
    pt: "Presentes",
    es: "Regalos",
  },
  "Donations": {
    en: "Donations",
    pt: "Doações",
    es: "Donaciones",
  },
  "Subscriptions": {
    en: "Subscriptions",
    pt: "Assinaturas",
    es: "Suscripciones",
  },
  "Other": {
    en: "Other",
    pt: "Outros",
    es: "Otros",
  },
  "Uncategorized": {
    en: "Uncategorized",
    pt: "Sem Categoria",
    es: "Sin Categoría",
  },
};

/**
 * Translate a category name based on user's language preference
 * @param categoryName - The category name to translate
 * @param language - The target language
 * @returns Translated category name, or original if no translation found
 */
export function translateCategory(categoryName: string, language: SupportedLanguage = "en"): string {
  const translation = categoryTranslations[categoryName];
  if (translation && translation[language]) {
    return translation[language];
  }
  // Return original name if no translation found (for user-created categories)
  return categoryName;
}
