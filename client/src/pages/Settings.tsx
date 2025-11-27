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
import { CheckCircle, HelpCircle, MessageSquare, Smartphone } from "lucide-react";

export default function Settings() {
  const utils = trpc.useUtils();
  const { data: settings } = trpc.settings.get.useQuery();
  const { preferences, updatePreferences } = usePreferences();
  
  const [language, setLanguage] = useState("en");
  const [currency, setCurrency] = useState("USD");
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
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Smartphone className="w-6 h-6" />
                      Como funciona o WhatsApp
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                      Instruções de uso da integração WhatsApp
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-6 text-sm">
                    {/* O que é */}
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        💬 O que é?
                      </h4>
                      <p className="text-muted-foreground">
                        Registre seus gastos diretamente pelo WhatsApp de forma rápida e prática, sem precisar abrir o aplicativo!
                      </p>
                    </div>

                    {/* Como usar */}
                    <div>
                      <h4 className="font-semibold mb-2">📱 Como usar:</h4>
                      <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                        <li>Clique em "Conectar via WhatsApp" abaixo</li>
                        <li>O WhatsApp abrirá automaticamente com a mensagem pronta</li>
                        <li>Aperte ENVIAR para ativar</li>
                        <li>Pronto! Agora você pode mandar seus gastos</li>
                      </ol>
                    </div>

                    {/* Exemplos */}
                    <div>
                      <h4 className="font-semibold mb-2">✍️ Exemplos de mensagens:</h4>
                      <div className="bg-secondary/50 p-4 rounded-lg space-y-3">
                        <div>
                          <p className="font-mono text-xs">• "Mercado 350 reais"</p>
                          <p className="text-xs text-muted-foreground ml-4">→ Registra R$ 350,00 em Alimentação</p>
                        </div>
                        <div>
                          <p className="font-mono text-xs">• "Uber 25"</p>
                          <p className="text-xs text-muted-foreground ml-4">→ Registra R$ 25,00 em Transporte</p>
                        </div>
                        <div>
                          <p className="font-mono text-xs">• "20 garrafas de água por 2 reais cada"</p>
                          <p className="text-xs text-muted-foreground ml-4">→ Registra R$ 40,00 em Alimentação</p>
                        </div>
                        <div>
                          <p className="font-mono text-xs">• "Academia 120 mensalidade"</p>
                          <p className="text-xs text-muted-foreground ml-4">→ Registra R$ 120,00 em Saúde</p>
                        </div>
                      </div>
                    </div>

                    {/* Comandos */}
                    <div>
                      <h4 className="font-semibold mb-2">🤖 Comandos úteis:</h4>
                      <div className="bg-secondary/50 p-4 rounded-lg space-y-2">
                        <div className="flex items-start gap-2">
                          <span className="font-mono text-xs">•</span>
                          <div>
                            <p className="font-mono text-xs">"hoje"</p>
                            <p className="text-xs text-muted-foreground">Ver gastos de hoje</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="font-mono text-xs">•</span>
                          <div>
                            <p className="font-mono text-xs">"ajuda"</p>
                            <p className="text-xs text-muted-foreground">Ver todos os comandos</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Resposta */}
                    <div>
                      <h4 className="font-semibold mb-2">✅ O que você recebe:</h4>
                      <div className="bg-secondary/50 p-4 rounded-lg">
                        <p className="text-xs font-semibold mb-1">✅ Gasto registrado!</p>
                        <p className="text-xs">📝 Mercado</p>
                        <p className="text-xs">💰 R$ 350,00</p>
                        <p className="text-xs">🏷️ Alimentação</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          💎 Economias totais: R$ 1.253,00
                        </p>
                      </div>
                    </div>

                    {/* Importante */}
                    <div className="border-l-4 border-primary pl-4">
                      <h4 className="font-semibold mb-2 text-primary">⚡ Importante:</h4>
                      <ul className="space-y-1 text-muted-foreground text-xs">
                        <li>• As transações aparecem instantaneamente no app</li>
                        <li>• O número é compartilhado (para testes)</li>
                        <li>• 100% gratuito para uso pessoal</li>
                        <li>• Funciona 24/7</li>
                      </ul>
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
                  className="w-full"
                >
                  🚀 Conectar via WhatsApp
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
