import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Building2, ChevronDown, ChevronUp, Upload, RefreshCw, Settings } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { usePreferences } from "@/contexts/PreferencesContext";
import { t } from "@/lib/i18n";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

interface BankSyncProps {
  goalId: number;
}

export function BankSync({ goalId }: BankSyncProps) {
  const { preferences } = usePreferences();
  const [isOpen, setIsOpen] = useState(false);
  const [wiseSyncDialogOpen, setWiseSyncDialogOpen] = useState(false);
  const [currency, setCurrency] = useState("");
  const [startDate, setStartDate] = useState(format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  // Get user settings to check if Wise token exists
  const { data: settings } = trpc.settings.get.useQuery();
  const hasWiseToken = !!settings?.wiseApiToken;

  // Get Wise balances only if token exists
  const { data: balances = [], error: wiseError } = trpc.wise.getBalances.useQuery(undefined, {
    enabled: hasWiseToken, // Only run query if token exists
  });
  
  // Get converted balances with user's preferred currency
  const { data: convertedBalances = [] } = trpc.wise.getBalancesConverted.useQuery(undefined, {
    enabled: hasWiseToken,
  });
  
  const isWiseNotConfigured = !hasWiseToken || wiseError?.data?.code === "PRECONDITION_FAILED";

  // Auto-select first available currency with balance when balances load
  useEffect(() => {
    if (balances.length > 0 && !currency) {
      // Try to find user's preferred currency first
      const preferredCurrency = settings?.currency || "USD";
      const hasPreferredCurrency = balances.find((b: any) => b.currency === preferredCurrency);
      
      if (hasPreferredCurrency) {
        setCurrency(preferredCurrency);
      } else {
        // Otherwise select first currency with positive balance
        const firstBalance = balances.find((b: any) => b.amount > 0);
        if (firstBalance) {
          setCurrency(firstBalance.currency);
        }
      }
    }
  }, [balances, currency, settings?.currency]);

  // Wise sync mutation
  const wiseSyncMutation = trpc.wise.syncTransactions.useMutation({
    onSuccess: (data: any) => {
      toast.success(t('wiseImportSuccess', preferences.language).replace('{0}', data.importedCount.toString()).replace('{1}', data.totalTransactions.toString()));
      setWiseSyncDialogOpen(false);
      utils.transactions.getAll.invalidate();
      utils.goals.getActive.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message || t('wiseSyncFailed', preferences.language));
    },
  });

  // Clear Wise transactions mutation
  const clearWiseMutation = trpc.csv.clearWiseTransactions.useMutation({
    onSuccess: () => {
      toast.success(t('wiseTransactionsRemoved', preferences.language));
      utils.transactions.getAll.invalidate();
      utils.goals.getActive.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || t('errorRemovingWiseTransactions', preferences.language));
    },
  });

  // CSV import mutations
  const wiseCSVImportMutation = trpc.csv.importWiseCSV.useMutation({
    onSuccess: (data) => {
      toast.success(t('csvImportSuccess', preferences.language).replace('{0}', data.importedCount.toString()).replace('{1}', data.skippedCount.toString()));
      utils.transactions.getAll.invalidate();
      utils.goals.getActive.invalidate();
      utils.wise.getTotalBalanceConverted.invalidate();
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    onError: (error) => {
      toast.error(error.message || t('csvImportFailed', preferences.language));
    },
  });

  const nubankCSVImportMutation = trpc.csv.importNubankCSV.useMutation({
    onSuccess: (data) => {
      toast.success(t('csvImportSuccess', preferences.language).replace('{0}', data.importedCount.toString()).replace('{1}', data.skippedCount.toString()));
      utils.transactions.getAll.invalidate();
      utils.goals.getActive.invalidate();
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    onError: (error) => {
      toast.error(error.message || t('csvImportFailed', preferences.language));
    },
  });

  const handleWiseSync = () => {
    setWiseSyncDialogOpen(true);
  };

  const handleWiseSyncConfirm = () => {
    // Check if selected currency has balance
    const selectedBalance = balances.find((b: any) => b.currency === currency);
    if (selectedBalance && selectedBalance.amount === 0) {
      toast.warning(t('warningZeroBalance', preferences.language).replace('{0}', currency));
    }
    
    wiseSyncMutation.mutate({
      goalId,
      currency,
      startDate,
      endDate,
    });
  };

  const handleCsvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      
      // Detect if it's Wise CSV (has specific header columns)
      const isWiseCSV = content.toLowerCase().includes('source amount (after fees)') && 
                        content.toLowerCase().includes('target amount (after fees)');
      
      if (isWiseCSV) {
        wiseCSVImportMutation.mutate({
          goalId,
          csvContent: content,
        });
      } else {
        nubankCSVImportMutation.mutate({
          goalId,
          csvContent: content,
        });
      }
    };
    reader.readAsText(file);
  };

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card className="border border-border/50 bg-gradient-to-br from-background to-secondary/20 transition-all duration-300">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-secondary/30 transition-colors rounded-t-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#9fe870]/20 to-[#9fe870]/10 flex items-center justify-center border border-[#9fe870]/30">
                    <Building2 className="h-6 w-6 text-[#9fe870]" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-semibold">{t('bankSynchronization', preferences.language)}</CardTitle>
                    <CardDescription className="text-sm mt-1">
                      {t('syncWiseOrImportBankCSV', preferences.language)}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!isWiseNotConfigured && convertedBalances.length > 0 && (
                    <div className="text-right mr-2">
                      <div className="text-xs text-muted-foreground">{balances.filter((b: any) => b.amount > 0).length} {t('balances', preferences.language)}</div>
                    </div>
                  )}
                  {isOpen ? (
                    <ChevronUp className="h-5 w-5 text-primary transition-transform duration-200" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200" />
                  )}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-4">
              {/* Wise Integration */}
              <div className="border border-border/50 rounded-xl p-5 space-y-4 bg-background/50 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
                      <RefreshCw className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base">Wise</h3>
                      <p className="text-sm text-muted-foreground">
                        {isWiseNotConfigured 
                          ? t('tokenNotConfigured', preferences.language)
                          : `${balances.filter((b: any) => b.amount > 0).length} ${t('wiseBalances', preferences.language)}`}
                      </p>
                    </div>
                  </div>
                  {isWiseNotConfigured ? (
                    <Link href="/settings">
                      <Button size="sm" variant="outline" className="gap-2">
                        <Settings className="h-4 w-4" />
                        {t('goToSettings', preferences.language)}
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      onClick={handleWiseSync}
                      size="sm"
                      className="gap-2 bg-green-600 hover:bg-green-700"
                    >
                      <RefreshCw className="h-4 w-4" />
                      {t('syncWise', preferences.language)}
                    </Button>
                  )}
                </div>
                {!isWiseNotConfigured && convertedBalances.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    {convertedBalances.filter((b: any) => b.originalAmount > 0).map((balance: any) => (
                      <div key={balance.currency} className="p-4 bg-gradient-to-br from-secondary/80 to-secondary/50 rounded-lg border border-border/30 hover:border-primary/30 transition-colors">
                        <div className="flex items-baseline gap-2">
                          <div className="font-semibold text-sm text-muted-foreground">{balance.currency}</div>
                          <div className="text-lg font-bold text-foreground">
                            {(balance.originalAmount / 100).toFixed(2)}
                          </div>
                        </div>
                        {balance.currency !== balance.targetCurrency && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1.5">
                            <span>≈</span>
                            <span className="text-purple-400 font-medium">
                              {balance.targetCurrency} {(balance.convertedAmount / 100).toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* CSV Import */}
              <div className="border border-border/50 rounded-xl p-5 space-y-4 bg-background/50 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center">
                      <Upload className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base">{t('bankCSV', preferences.language)}</h3>
                      <p className="text-sm text-muted-foreground">
                        {t('importFromCSV', preferences.language)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => clearWiseMutation.mutate({ goalId })}
                      size="sm"
                      variant="destructive"
                      disabled={clearWiseMutation.isPending}
                      className="gap-2"
                    >
                      {t('clearWise', preferences.language)}
                    </Button>
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      size="sm"
                      variant="outline"
                      className="gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      {t('uploadCSV', preferences.language)}
                    </Button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleCsvUpload}
                  />
                </div>
                <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 border border-border/30">
                  {t('csvExpectedFormat', preferences.language)}
                </p>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Wise Sync Dialog */}
      <Dialog open={wiseSyncDialogOpen} onOpenChange={setWiseSyncDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('syncTransactions', preferences.language)}</DialogTitle>
            <DialogDescription>
              {t('selectDateRange', preferences.language)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="currency">{t('currency', preferences.language)}</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {balances.map((balance: any) => (
                    <SelectItem key={balance.currency} value={balance.currency}>
                      {balance.currency} ({balance.amount.toFixed(2)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="startDate">{t('startDate', preferences.language)}</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="endDate">{t('endDate', preferences.language)}</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWiseSyncDialogOpen(false)}>
              {t('cancel', preferences.language)}
            </Button>
            <Button onClick={handleWiseSyncConfirm} disabled={wiseSyncMutation.isPending}>
              {wiseSyncMutation.isPending ? t('syncing', preferences.language) : t('sync', preferences.language)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
