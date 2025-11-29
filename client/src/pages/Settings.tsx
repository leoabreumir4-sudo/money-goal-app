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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CheckCircle, HelpCircle, MessageSquare, Smartphone, MessageCircle } from "lucide-react";
import { useIsMobile } from "@/hooks/useMobile";

export default function Settings() {
  const isMobile = useIsMobile();
  const utils = trpc.useUtils();
  const { data: settings } = trpc.settings.get.useQuery();
  const { preferences, updatePreferences } = usePreferences();
  
  const [language, setLanguage] = useState("en");
  const [currency, setCurrency] = useState("USD");
  const [numberFormat, setNumberFormat] = useState<"en-US" | "pt-BR">("pt-BR");
  const [theme, setTheme] = useState("dark");
  const [wiseToken, setWiseToken] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);

  // WhatsApp queries and mutations
  const { data: whatsappStatus } = trpc.whatsapp.getPhoneStatus.useQuery();
  const linkPhoneMutation = trpc.whatsapp.linkPhone.useMutation({
    onSuccess: () => {
      toast.success(t('whatsappLinkedSuccess', preferences.language));
      utils.whatsapp.getPhoneStatus.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || t('errorLinkingWhatsApp', preferences.language));
    },
  });
  const unlinkPhoneMutation = trpc.whatsapp.unlinkPhone.useMutation({
    onSuccess: () => {
      toast.success(t('whatsappUnlinked', preferences.language));
      setPhoneNumber("");
      utils.whatsapp.getPhoneStatus.invalidate();
    },
  });

  // Update state when settings are loaded
  useEffect(() => {
    if (settings) {
      setLanguage(settings.language);
      setCurrency(settings.currency);
      setNumberFormat((settings.numberFormat as "en-US" | "pt-BR") || "pt-BR");
      setTheme(settings.theme);
      setWiseToken(settings.wiseApiToken || "");
      setWebhookSecret(settings.wiseWebhookSecret || "");
    }
  }, [settings]);

  const updateSettingsMutation = trpc.settings.update.useMutation({
    onSuccess: () => {
      utils.settings.get.invalidate();
      // Update context immediately
      updatePreferences({
        language: language as any,
        currency,
        numberFormat,
        theme: theme as "dark" | "light",
      });
      toast.success(t('saveChanges', preferences.language) + '!');
    },
    onError: (error) => {
      console.error('Settings update error:', error);
      toast.error(error.message || 'Failed to save settings');
    },
  });
  const handleSaveChanges = () => {
    updateSettingsMutation.mutate({
      language,
      currency,
      numberFormat,
      theme: theme as "dark" | "light",
    });
  };

  return (
    <DashboardLayout>
      <div className={`max-w-4xl mx-auto ${isMobile ? 'p-3 space-y-3' : 'p-6 space-y-6'}`}>
        {/* Header */}
        <div className="space-y-1">
          <h1 className={`font-bold text-foreground ${isMobile ? 'text-xl' : 'text-4xl'}`}>{t('settings', preferences.language)}</h1>
          <p className={`text-muted-foreground ${isMobile ? 'text-xs' : 'text-lg'}`}>{t('customizeExperience', preferences.language)}</p>
        </div>

        {/* Settings Card */}
        <Card className="bg-gradient-to-br from-card to-card/80 border-border shadow-lg">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-foreground text-xl flex items-center gap-2">
              <span className="text-2xl">⚙️</span>
              {t('preferences', preferences.language)}
            </CardTitle>
          </CardHeader>
          <CardContent className={isMobile ? 'space-y-5 pt-4' : 'space-y-8 pt-6'}>
            {/* Language */}
            <div className={`space-y-3 bg-muted/30 rounded-lg hover:bg-muted/40 transition-colors ${isMobile ? 'p-3' : 'p-4'}`}>
              <div className="flex items-center gap-2">
                <span className="text-xl">🌍</span>
                <Label htmlFor="language" className="text-base font-semibold">{t('language', preferences.language)}</Label>
              </div>
              <p className="text-sm text-muted-foreground pl-7">{t('chooseLanguage', preferences.language)}</p>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger id="language" className="bg-background">
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
            <div className="space-y-3 p-4 bg-muted/30 rounded-lg hover:bg-muted/40 transition-colors">
              <div className="flex items-center gap-2">
                <span className="text-xl">💰</span>
                <Label htmlFor="currency" className="text-base font-semibold">{t('currency', preferences.language)}</Label>
              </div>
              <p className="text-sm text-muted-foreground pl-7">{t('preferredCurrency', preferences.language)}</p>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="currency" className="bg-background">
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

            {/* Number Format */}
            <div className="space-y-3 p-4 bg-muted/30 rounded-lg hover:bg-muted/40 transition-colors">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔢</span>
                <Label htmlFor="numberFormat" className="text-base font-semibold">{t('numberFormat', preferences.language)}</Label>
              </div>
              <p className="text-sm text-muted-foreground pl-7">{t('numberFormatDescription', preferences.language)}</p>
              <Select value={numberFormat} onValueChange={(v: "en-US" | "pt-BR") => setNumberFormat(v)}>
                <SelectTrigger id="numberFormat" className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pt-BR">
                    <div className="flex flex-col items-start py-1">
                      <span className="font-medium">🇧🇷 {t('brazilian', preferences.language)}</span>
                      <span className="text-xs text-muted-foreground">R$ 1.550,50</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="en-US">
                    <div className="flex flex-col items-start py-1">
                      <span className="font-medium">🇺🇸 {t('american', preferences.language)}</span>
                      <span className="text-xs text-muted-foreground">$ 1,550.50</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Theme */}
            <div className="space-y-3 p-4 bg-muted/30 rounded-lg hover:bg-muted/40 transition-colors">
              <div className="flex items-center gap-2">
                <span className="text-xl">🎨</span>
                <Label htmlFor="theme" className="text-base font-semibold">{t('theme', preferences.language)}</Label>
              </div>
              <p className="text-sm text-muted-foreground pl-7">{t('chooseTheme', preferences.language)}</p>
              <Select value={theme} onValueChange={(v: any) => setTheme(v)}>
                <SelectTrigger id="theme" className="bg-background">
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
              className="w-full h-11 md:h-12 text-base font-semibold bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-lg hover:shadow-xl transition-all"
            >
              {updateSettingsMutation.isPending ? t('saving', preferences.language) : t('saveChanges', preferences.language)}
            </Button>
          </CardContent>
        </Card>

        {/* Wise API Integration */}
        <Card className="bg-gradient-to-br from-card to-card/80 border-border shadow-lg">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-foreground text-xl flex items-center gap-2">
              <span className="text-2xl">🏦</span>
              Wise Integration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            {/* API Token */}
            <div className="space-y-2">
              <Label htmlFor="wiseToken">{t('wiseApiToken', preferences.language)}</Label>
              <p className="text-sm text-muted-foreground">
                {t('wiseTokenDescription', preferences.language)}{" "}
                <a
                  href="https://wise.com/help/articles/2958229"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Wise
                </a>
              </p>
              <Input
                id="wiseToken"
                type="password"
                placeholder={t('wiseTokenPlaceholder', preferences.language)}
                value={wiseToken}
                onChange={(e) => setWiseToken(e.target.value)}
              />
            </div>
            
            {/* Webhook Secret */}
            <div className="space-y-2">
              <Label htmlFor="webhookSecret">{t('webhookSecret', preferences.language)}</Label>
              <p className="text-sm text-muted-foreground">
                {t('webhookSecretDescription', preferences.language)}
              </p>
              <Input
                id="webhookSecret"
                type="password"
                placeholder={t('enterWiseSecret', preferences.language)}
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
              />
              <div className="mt-2 p-3 bg-secondary/50 rounded-lg">
                <p className="text-xs font-mono break-all">
                  {window.location.origin}/api/webhooks/wise/{settings?.userId}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('pasteUrlInWise', preferences.language)}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => {
                  updateSettingsMutation.mutate(
                    { 
                      wiseApiToken: wiseToken || undefined,
                      wiseWebhookSecret: webhookSecret || null,
                    },
                    {
                      onSuccess: () => {
                        toast.success(t('tokenSaved', preferences.language));
                      },
                    }
                  );
                }}
                disabled={updateSettingsMutation.isPending || (!wiseToken && !webhookSecret)}
                className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
              >
                {t('saveToken', preferences.language)}
              </Button>
              {(settings?.wiseApiToken || settings?.wiseWebhookSecret) && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setWiseToken("");
                    setWebhookSecret("");
                    updateSettingsMutation.mutate(
                      { wiseApiToken: null, wiseWebhookSecret: null },
                      {
                        onSuccess: () => {
                          toast.success(t('tokenRemoved', preferences.language));
                        },
                      }
                    );
                  }}
                  disabled={updateSettingsMutation.isPending}
                  className="border-red-500/50 text-red-500 hover:bg-red-500/10"
                >
                  {t('removeToken', preferences.language)}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* WhatsApp Integration */}
        <Card className="bg-gradient-to-br from-card to-card/80 border-border shadow-lg">
          <CardHeader className="border-b border-border/50 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-foreground text-xl flex items-center gap-2">
                <span className="text-2xl">💬</span>
                {t('whatsappIntegration', preferences.language)}
              </CardTitle>
              <Dialog open={isWhatsAppModalOpen} onOpenChange={setIsWhatsAppModalOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-3 text-2xl">
                      <div className="bg-gradient-to-br from-green-500 to-green-600 p-2 rounded-xl">
                        <MessageSquare className="w-6 h-6 text-white" />
                      </div>
                      {t('howWhatsAppWorks', preferences.language)}
                    </DialogTitle>
                    <DialogDescription className="text-base mt-2">
                      {t('manageFinances', preferences.language)}
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-6">
                    {/* Quick Start */}
                    <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-6 rounded-xl border border-primary/20">
                      <h4 className="font-bold text-lg mb-4 flex items-center gap-2">
                        🚀 {t('quickStart', preferences.language)}
                      </h4>
                      <div className="grid gap-4">
                        <div className="flex gap-3">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center font-bold text-sm">1</div>
                          <div>
                            <p className="font-medium">{t('enterYourNumber', preferences.language)}</p>
                            <p className="text-sm text-muted-foreground">{t('withDDD', preferences.language)}</p>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center font-bold text-sm">2</div>
                          <div>
                            <p className="font-medium">{t('clickConnect', preferences.language)}</p>
                            <p className="text-sm text-muted-foreground">{t('whatsappWillOpen', preferences.language)}</p>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center font-bold text-sm">3</div>
                          <div>
                            <p className="font-medium">{t('sendReadyMessage', preferences.language)}</p>
                            <p className="text-sm text-muted-foreground">{t('pressSendDone', preferences.language)}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Examples Grid */}
                    <div>
                      <h4 className="font-bold text-lg mb-4">💬 {t('usageExamples', preferences.language)}</h4>
                      <div className="grid md:grid-cols-2 gap-3">
                        <div className="bg-secondary/30 p-4 rounded-lg border border-border hover:border-primary/50 transition-colors">
                          <p className="font-mono text-sm mb-2 text-primary">"Mercado 350 reais"</p>
                          <div className="text-xs space-y-1 text-muted-foreground">
                            <p>✓ Descrição: Mercado</p>
                            <p>✓ Valor: R$ 350,00</p>
                            <p>✓ Categoria: Alimentação</p>
                          </div>
                        </div>
                        
                        <div className="bg-secondary/30 p-4 rounded-lg border border-border hover:border-primary/50 transition-colors">
                          <p className="font-mono text-sm mb-2 text-primary">"Uber 25"</p>
                          <div className="text-xs space-y-1 text-muted-foreground">
                            <p>✓ Descrição: Uber</p>
                            <p>✓ Valor: R$ 25,00</p>
                            <p>✓ Categoria: Transporte</p>
                          </div>
                        </div>
                        
                        <div className="bg-secondary/30 p-4 rounded-lg border border-border hover:border-primary/50 transition-colors">
                          <p className="font-mono text-sm mb-2 text-primary">"Academia 120"</p>
                          <div className="text-xs space-y-1 text-muted-foreground">
                            <p>✓ Descrição: Academia</p>
                            <p>✓ Valor: R$ 120,00</p>
                            <p>✓ Categoria: Saúde</p>
                          </div>
                        </div>
                        
                        <div className="bg-secondary/30 p-4 rounded-lg border border-border hover:border-primary/50 transition-colors">
                          <p className="font-mono text-sm mb-2 text-primary">"20 águas por 2 reais"</p>
                          <div className="text-xs space-y-1 text-muted-foreground">
                            <p>✓ Descrição: 20 águas</p>
                            <p>✓ Valor: R$ 40,00</p>
                            <p>✓ Categoria: Alimentação</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Commands */}
                    <div>
                      <h4 className="font-bold text-lg mb-4">⚡ {t('usefulCommands', preferences.language)}</h4>
                      <div className="space-y-3">
                        <div className="flex items-start gap-3 p-3 bg-secondary/30 rounded-lg">
                          <div className="text-2xl">📊</div>
                          <div className="flex-1">
                            <p className="font-mono text-sm font-medium">"hoje"</p>
                            <p className="text-sm text-muted-foreground">{t('viewAllExpensesToday', preferences.language)}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-start gap-3 p-3 bg-secondary/30 rounded-lg">
                          <div className="text-2xl">❓</div>
                          <div className="flex-1">
                            <p className="font-mono text-sm font-medium">"ajuda"</p>
                            <p className="text-sm text-muted-foreground">{t('viewCompleteCommandList', preferences.language)}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Response Example */}
                    <div>
                      <h4 className="font-bold text-lg mb-4">✅ {t('automaticResponse', preferences.language)}</h4>
                      <div className="bg-green-500/10 border-2 border-green-500/30 p-5 rounded-xl space-y-2">
                        <p className="font-bold flex items-center gap-2 text-green-600 dark:text-green-400">
                          <CheckCircle className="w-5 h-5" />
                          {t('expenseRegistered', preferences.language)}
                        </p>
                        <div className="pl-7 space-y-1 text-sm">
                          <p>📝 <span className="font-medium">Mercado</span></p>
                          <p>💰 <span className="font-medium">R$ 350,00</span></p>
                          <p>🏷️ <span className="font-medium">Alimentação</span></p>
                          <p className="text-muted-foreground mt-3 pt-3 border-t border-green-500/20">
                            💎 {t('totalSavings', preferences.language)}: R$ 1.253,00
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Features */}
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-secondary/20 rounded-lg">
                        <div className="text-3xl mb-2">⚡</div>
                        <p className="font-semibold text-sm">{t('instantaneous', preferences.language)}</p>
                        <p className="text-xs text-muted-foreground mt-1">{t('appearsInAppImmediately', preferences.language)}</p>
                      </div>
                      
                      <div className="text-center p-4 bg-secondary/20 rounded-lg">
                        <div className="text-3xl mb-2">🔓</div>
                        <p className="font-semibold text-sm">{t('freeHundredPercent', preferences.language)}</p>
                        <p className="text-xs text-muted-foreground mt-1">{t('noUsageLimits', preferences.language)}</p>
                      </div>
                      
                      <div className="text-center p-4 bg-secondary/20 rounded-lg">
                        <div className="text-3xl mb-2">🤖</div>
                        <p className="font-semibold text-sm">{t('intelligentAI', preferences.language)}</p>
                        <p className="text-xs text-muted-foreground mt-1">{t('understandsNaturalLanguage', preferences.language)}</p>
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!whatsappStatus?.phoneNumber ? (
              <>
                <p className="text-sm text-muted-foreground">
                  {t('registerExpensesViaWhatsApp', preferences.language)}
                </p>
                
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">{t('phoneNumber', preferences.language)}</Label>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    placeholder="+55 11 99999-9999"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                  />
                </div>
                
                <Button
                  onClick={() => {
                    if (!phoneNumber) {
                      toast.error(t('enterPhoneNumber', preferences.language));
                      return;
                    }
                    
                    linkPhoneMutation.mutate({ phoneNumber });
                    
                    // Open WhatsApp with pre-filled message
                    const sandboxNumber = "14155238886";
                    const joinCode = "join money-goal";
                    const whatsappLink = `https://wa.me/${sandboxNumber}?text=${encodeURIComponent(joinCode)}`;
                    window.open(whatsappLink, '_blank');
                  }}
                  disabled={linkPhoneMutation.isPending}
                  className="w-full h-12 text-base font-semibold bg-[#25D366] hover:bg-[#20BD5A] text-white shadow-lg hover:shadow-xl transition-all"
                >
                  <MessageCircle className="w-5 h-5 mr-2" />
                  {linkPhoneMutation.isPending ? t('connecting', preferences.language) : t('connectViaWhatsApp', preferences.language)}
                </Button>
                
                <p className="text-xs text-muted-foreground">
                  {t('whatsappWillOpenWithMessage', preferences.language)}
                </p>
              </>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <CheckCircle className="text-green-500 w-5 h-5" />
                  <div>
                    <p className="font-semibold">{t('whatsappConnected', preferences.language)}</p>
                    <p className="text-sm text-muted-foreground">{whatsappStatus.phoneNumber}</p>
                  </div>
                </div>
                
                <div className="bg-secondary/50 p-4 rounded-lg space-y-2">
                  <p className="text-sm font-semibold">✅ {t('allReady', preferences.language)}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('sendMessagesLike', preferences.language)}
                  </p>
                  <p className="text-xs font-mono">• Mercado 350 reais</p>
                  <p className="text-xs font-mono">• Uber 25</p>
                  <p className="text-xs font-mono">• hoje (para ver gastos)</p>
                </div>
                
                <Button
                  variant="outline"
                  onClick={() => unlinkPhoneMutation.mutate()}
                  disabled={unlinkPhoneMutation.isPending}
                  className="w-full"
                >
                  {t('unlinkWhatsApp', preferences.language)}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* About Settings */}
        <Card className="bg-gradient-to-br from-muted/50 to-muted/30 border-border">
          <CardHeader>
            <CardTitle className="text-foreground text-lg flex items-center gap-2">
              <span className="text-xl">ℹ️</span>
              {t('aboutSettings', preferences.language)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('settingsDescription', preferences.language)}
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
