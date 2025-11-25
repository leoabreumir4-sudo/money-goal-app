import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { trpc } from "@/lib/trpc";
import { Language } from "@/lib/i18n";

interface UserPreferences {
  language: Language;
  currency: string;
  theme: "dark" | "light";
}

interface PreferencesContextType {
  preferences: UserPreferences;
  isLoading: boolean;
  updatePreferences: (prefs: Partial<UserPreferences>) => void;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export const PreferencesProvider = ({ children }: { children: ReactNode }) => {
  const { data: settings, isLoading } = trpc.settings.get.useQuery();
  const [preferences, setPreferences] = useState<UserPreferences>({
    language: "en",
    currency: "USD",
    theme: "dark",
  });

  useEffect(() => {
    if (settings) {
      setPreferences({
        language: settings.language as Language,
        currency: settings.currency,
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
    throw new Error("usePreferences must be used within PreferencesProvider");
  }
  return context;
};
