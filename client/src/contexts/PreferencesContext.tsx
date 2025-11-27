import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { trpc } from "@/lib/trpc";
import { Language } from "@/lib/i18n";

interface UserPreferences {
  language: Language;
  currency: string;
  numberFormat: "en-US" | "pt-BR";
  theme: "dark" | "light";
}

interface PreferencesContextType {
  preferences: UserPreferences;
  isLoading: boolean;
  updatePreferences: (prefs: Partial<UserPreferences>) => void;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export const PreferencesProvider = ({ children }: { children: ReactNode }) => {
  const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('sessionToken');
  const { data: settings, isLoading } = trpc.settings.get.useQuery(undefined, {
    enabled: hasToken, // Only fetch settings if user is authenticated
  });
  const [preferences, setPreferences] = useState<UserPreferences>({
    language: "en",
    currency: "USD",
    numberFormat: "pt-BR",
    theme: "dark",
  });

  useEffect(() => {
    if (settings) {
      setPreferences({
        language: settings.language as Language,
        currency: settings.currency,
        numberFormat: (settings.numberFormat as "en-US" | "pt-BR") || "pt-BR",
        theme: settings.theme,
      });
      
      // Apply theme
      document.documentElement.classList.toggle("light", settings.theme === "light");
      document.documentElement.classList.toggle("dark", settings.theme === "dark");
    }
  }, [settings]);

  const updatePreferences = (prefs: Partial<UserPreferences>) => {
    setPreferences(prev => ({ ...prev, ...prefs }));
    
    // Apply theme immediately
    if (prefs.theme) {
      document.documentElement.classList.toggle("light", prefs.theme === "light");
      document.documentElement.classList.toggle("dark", prefs.theme === "dark");
    }
  };

  return (
    <PreferencesContext.Provider value={{ preferences, isLoading, updatePreferences }}>
      {children}
    </PreferencesContext.Provider>
  );
};

export const usePreferences = () => {
  const context = useContext(PreferencesContext);
  if (!context) {
    // Fallback seguro: retorna valores padrão e avisa no console
    if (typeof window !== "undefined") {
      console.error("usePreferences: PreferencesProvider não encontrado! Retornando valores padrão.");
    }
    return {
      preferences: {
        language: "en",
        currency: "USD",
        numberFormat: "pt-BR",
        theme: "dark",
      },
      isLoading: true,
      updatePreferences: () => {},
    };
  }
  return context;
};
