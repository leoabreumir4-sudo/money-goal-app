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

export default function Settings() {
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
      toast.success("WhatsApp vinculado com sucesso!");
      utils.whatsapp.getPhoneStatus.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao vincular WhatsApp");
    },
  });
  const unlinkPhoneMutation = trpc.whatsapp.unlinkPhone.useMutation({
    onSuccess: () => {
      toast.success("WhatsApp desvinculado");
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
  };});
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
              <p className="text-sm text-muted-foreground">{t('preferredCurrency', preferences.language)}</p>
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

            {/* Number Format */}
            <div className="space-y-2">
              <Label htmlFor="numberFormat">Formato de Números</Label>
              <p className="text-sm text-muted-foreground">Como você quer visualizar valores monetários</p>
              <Select value={numberFormat} onValueChange={(v: "en-US" | "pt-BR") => setNumberFormat(v)}>
                <SelectTrigger id="numberFormat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pt-BR">
                    <div className="flex flex-col items-start">
                      <span>🇧🇷 Brasileiro</span>
                      <span className="text-xs text-muted-foreground">R$ 1.550,50</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="en-US">
                    <div className="flex flex-col items-start">
                      <span>🇺🇸 Americano</span>
                      <span className="text-xs text-muted-foreground">$ 1,550.50</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Theme */}
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

        {/* Wise API Integration */}
        <Card className="bg-card border-border max-w-2xl">
          <CardHeader>
            <CardTitle className="text-foreground">Wise Integration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
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
              <Label htmlFor="webhookSecret">Webhook Secret (opcional)</Label>
              <p className="text-sm text-muted-foreground">
                Para sincronização automática via webhooks. Configure o webhook na Wise com a URL abaixo.
              </p>
              <Input
                id="webhookSecret"
                type="password"
                placeholder="Digite o secret gerado pela Wise"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
              />
              <div className="mt-2 p-3 bg-secondary/50 rounded-lg">
                <p className="text-xs font-mono break-all">
                  {window.location.origin}/api/webhooks/wise/{settings?.userId}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Cole esta URL na Wise (Settings → Webhooks). Selecione "Account deposit events".
                </p>
              </div>
            </div>

            <div className="flex gap-2">
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
                >
                  {t('removeToken', preferences.language)}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* WhatsApp Integration */}
        <Card className="bg-card border-border max-w-2xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-foreground flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                WhatsApp Integration
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
                      Como funciona o WhatsApp
                    </DialogTitle>
                    <DialogDescription className="text-base mt-2">
                      Gerencie suas finanças de forma rápida e natural, sem precisar abrir o app!
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-6">
                    {/* Quick Start */}
                    <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-6 rounded-xl border border-primary/20">
                      <h4 className="font-bold text-lg mb-4 flex items-center gap-2">
                        🚀 Início Rápido
                      </h4>
                      <div className="grid gap-4">
                        <div className="flex gap-3">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center font-bold text-sm">1</div>
                          <div>
                            <p className="font-medium">Digite seu número</p>
                            <p className="text-sm text-muted-foreground">Com DDD, ex: 5511999999999</p>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center font-bold text-sm">2</div>
                          <div>
                            <p className="font-medium">Clique em "Conectar"</p>
                            <p className="text-sm text-muted-foreground">O WhatsApp abrirá automaticamente</p>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center font-bold text-sm">3</div>
                          <div>
                            <p className="font-medium">Envie a mensagem pronta</p>
                            <p className="text-sm text-muted-foreground">Aperte "Enviar" e pronto! ✅</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Examples Grid */}
                    <div>
                      <h4 className="font-bold text-lg mb-4">💬 Exemplos de uso</h4>
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
                      <h4 className="font-bold text-lg mb-4">⚡ Comandos úteis</h4>
                      <div className="space-y-3">
                        <div className="flex items-start gap-3 p-3 bg-secondary/30 rounded-lg">
                          <div className="text-2xl">📊</div>
                          <div className="flex-1">
                            <p className="font-mono text-sm font-medium">"hoje"</p>
                            <p className="text-sm text-muted-foreground">Ver todos os gastos de hoje</p>
                          </div>
                        </div>
                        
                        <div className="flex items-start gap-3 p-3 bg-secondary/30 rounded-lg">
                          <div className="text-2xl">❓</div>
                          <div className="flex-1">
                            <p className="font-mono text-sm font-medium">"ajuda"</p>
                            <p className="text-sm text-muted-foreground">Ver lista completa de comandos</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Response Example */}
                    <div>
                      <h4 className="font-bold text-lg mb-4">✅ Resposta automática</h4>
                      <div className="bg-green-500/10 border-2 border-green-500/30 p-5 rounded-xl space-y-2">
                        <p className="font-bold flex items-center gap-2 text-green-600 dark:text-green-400">
                          <CheckCircle className="w-5 h-5" />
                          Gasto registrado!
                        </p>
                        <div className="pl-7 space-y-1 text-sm">
                          <p>📝 <span className="font-medium">Mercado</span></p>
                          <p>💰 <span className="font-medium">R$ 350,00</span></p>
                          <p>🏷️ <span className="font-medium">Alimentação</span></p>
                          <p className="text-muted-foreground mt-3 pt-3 border-t border-green-500/20">
                            💎 Economias totais: R$ 1.253,00
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Features */}
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-secondary/20 rounded-lg">
                        <div className="text-3xl mb-2">⚡</div>
                        <p className="font-semibold text-sm">Instantâneo</p>
                        <p className="text-xs text-muted-foreground mt-1">Aparece no app na hora</p>
                      </div>
                      
                      <div className="text-center p-4 bg-secondary/20 rounded-lg">
                        <div className="text-3xl mb-2">🔓</div>
                        <p className="font-semibold text-sm">100% Gratuito</p>
                        <p className="text-xs text-muted-foreground mt-1">Sem limites de uso</p>
                      </div>
                      
                      <div className="text-center p-4 bg-secondary/20 rounded-lg">
                        <div className="text-3xl mb-2">🤖</div>
                        <p className="font-semibold text-sm">IA Inteligente</p>
                        <p className="text-xs text-muted-foreground mt-1">Entende linguagem natural</p>
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
                  Registre gastos pelo WhatsApp de forma rápida e prática
                </p>
                
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Número de telefone</Label>
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
                      toast.error("Digite seu número de telefone");
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
                  className="w-full bg-[#25D366] hover:bg-[#20BD5A] text-white"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Conectar via WhatsApp
                </Button>
                
                <p className="text-xs text-muted-foreground">
                  Ao clicar, o WhatsApp abrirá automaticamente com a mensagem pronta para enviar
                </p>
              </>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <CheckCircle className="text-green-500 w-5 h-5" />
                  <div>
                    <p className="font-semibold">WhatsApp conectado</p>
                    <p className="text-sm text-muted-foreground">{whatsappStatus.phoneNumber}</p>
                  </div>
                </div>
                
                <div className="bg-secondary/50 p-4 rounded-lg space-y-2">
                  <p className="text-sm font-semibold">✅ Tudo pronto!</p>
                  <p className="text-xs text-muted-foreground">
                    Envie mensagens como:
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
                  Desvincular WhatsApp
                </Button>
              </div>
            )}
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
