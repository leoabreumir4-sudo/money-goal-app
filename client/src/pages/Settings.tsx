import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function Settings() {
  const utils = trpc.useUtils();
  const { data: settings } = trpc.settings.get.useQuery();
  
  const [language, setLanguage] = useState(\"en\");
  const [currency, setCurrency] = useState(\"USD\");
  const [theme, setTheme] = useState(\"dark\");

  // Update state when settings are loaded
  useEffect(() => {
    if (settings) {
      setLanguage(settings.language);
      setCurrency(settings.currency);
      setTheme(settings.theme);
    }
  }, [settings]);

  const updateSettingsMutation = trpc.settings.update.useMutation({
    onSuccess: () => {
      utils.settings.get.invalidate();
      toast.success("Settings saved successfully!");
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
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">Customize your MoneyGoal experience</p>
        </div>

        {/* Settings Card */}
        <Card className="bg-card border-border max-w-2xl">
          <CardHeader>
            <CardTitle className="text-foreground">Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Language */}
            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <p className="text-sm text-muted-foreground">Choose your preferred language</p>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger id="language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">🇺🇸 us English</SelectItem>
                  <SelectItem value="pt">🇧🇷 pt Português</SelectItem>
                  <SelectItem value="es">🇪🇸 es Español</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Currency */}
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <p className="text-sm text-muted-foreground">Select your preferred currency</p>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">💵 USD - US Dollar</SelectItem>
                  <SelectItem value="BRL">💰 BRL - Brazilian Real</SelectItem>
                  <SelectItem value="EUR">💶 EUR - Euro</SelectItem>
                  <SelectItem value="GBP">💷 GBP - British Pound</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Theme */}
            <div className="space-y-2">
              <Label htmlFor="theme">Theme</Label>
              <p className="text-sm text-muted-foreground">Choose your color theme</p>
              <Select value={theme} onValueChange={(v: any) => setTheme(v)}>
                <SelectTrigger id="theme">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dark">🌙 Dark Mode</SelectItem>
                  <SelectItem value="light">☀️ Light Mode</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Save Button */}
            <Button 
              onClick={handleSaveChanges} 
              disabled={updateSettingsMutation.isPending}
              className="w-full"
            >
              Save Changes
            </Button>
          </CardContent>
        </Card>

        {/* About Settings */}
        <Card className="bg-card border-border max-w-2xl">
          <CardHeader>
            <CardTitle className="text-foreground">About Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Your settings are saved automatically and will apply across all your devices. Changes to currency will affect how amounts are displayed throughout the app.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
