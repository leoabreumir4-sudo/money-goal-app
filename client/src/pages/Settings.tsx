import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { usePreferences } from "@/contexts/PreferencesContext";
import { t } from "@/lib/i18n";

export default function Settings() {
  const utils = trpc.useUtils();
  const { data: settings } = trpc.settings.get.useQuery();
  const { preferences, updatePreferences } = usePreferences();
  
  const [language, setLanguage] = useState("en");
  const [currency, setCurrency] = useState("USD");
  const [theme, setTheme] = useState("dark");
  const [wiseToken, setWiseToken] = useState("");

  // Update state when settings are loaded
  useEffect(() => {
    if (settings) {
      setLanguage(settings.language);
      setCurrency(settings.currency);
      setTheme(settings.theme);
      setWiseToken(settings.wiseApiToken || "");
    }
  }, [settings]);

  const updateSettingsMutation = trpc.settings.update.useMutation({
    onSuccess: () => {
      utils.settings.get.invalidate();
      // Update context immediately
      updatePreferences({
        language: language as any,
        currency,
        theme: theme as "dark" | "light",
      });
      toast.success(t('saveChanges', preferences.language) + '!');
    },
  });

  const handleSaveChanges = () => {
    updateSettingsMutation.mutate({
      language,
      currency,
      theme: theme as "dark" | "light",
    });
  };

  return (
    <DashboardLayout>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('settings', preferences.language)}</h1>
          <p className="text-muted-foreground">{t('customizeExperience', preferences.language)}</p>
        </div>

        {/* Settings Card */}
        <Card className="bg-card border-border max-w-2xl">
          <CardHeader>
            <CardTitle className="text-foreground">{t('preferences', preferences.language)}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Language */}
            <div className="space-y-2">
              <Label htmlFor="language">{t('language', preferences.language)}</Label>
              <p className="text-sm text-muted-foreground">{t('chooseLanguage', preferences.language)}</p>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger id="language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">🇺🇸 {t('usEnglish', preferences.language)}</SelectItem>
                  <SelectItem value="pt">🇧🇷 {t('ptPortuguese', preferences.language)}</SelectItem>
                  <SelectItem value="es">🇪🇸 {t('esSpanish', preferences.language)}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Currency */}
            <div className="space-y-2">
              <Label htmlFor="currency">{t('currency', preferences.language)}</Label>
              <p className="text-sm text-muted-foreground">{t('selectCurrency', preferences.language)}</p>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">💵 USD - {t('usDollar', preferences.language)}</SelectItem>
                  <SelectItem value="BRL">💰 BRL - {t('brazilianReal', preferences.language)}</SelectItem>
                  <SelectItem value="EUR">💶 EUR - {t('euro', preferences.language)}</SelectItem>
                  <SelectItem value="GBP">💷 GBP - {t('britishPound', preferences.language)}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Theme */}
            <div className="space-y-2">
              <Label htmlFor="theme">{t('theme', preferences.language)}</Label>
              <p className="text-sm text-muted-foreground">{t('chooseTheme', preferences.language)}</p>
              <Select value={theme} onValueChange={(v: any) => setTheme(v)}>
                <SelectTrigger id="theme">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dark">🌙 {t('darkMode', preferences.language)}</SelectItem>
                  <SelectItem value="light">☀️ {t('lightMode', preferences.language)}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Save Button */}
            <Button 
              onClick={handleSaveChanges} 
              disabled={updateSettingsMutation.isPending}
              className="w-full"
            >
              {t('saveChanges', preferences.language)}
            </Button>
          </CardContent>
        </Card>

        {/* About Settings */}
        <Card className="bg-card border-border max-w-2xl">
          <CardHeader>
            <CardTitle className="text-foreground">{t('aboutSettings', preferences.language)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t('settingsDescription', preferences.language)}
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
