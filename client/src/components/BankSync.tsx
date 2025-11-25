import { useState, useRef } from "react";
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
  const [currency, setCurrency] = useState("USD");
  const [startDate, setStartDate] = useState(format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  // Get Wise balances
  const { data: balances = [], error: wiseError } = trpc.wise.getBalances.useQuery();
  const isWiseNotConfigured = wiseError?.data?.code === "PRECONDITION_FAILED";

  // Wise sync mutation
  const wiseSyncMutation = trpc.wise.syncTransactions.useMutation({
    onSuccess: (data) => {
      toast.success(t('wiseImportSuccess', preferences.language).replace('{0}', data.importedCount.toString()).replace('{1}', data.totalTransactions.toString()));
      setWiseSyncDialogOpen(false);
      utils.transactions.getAll.invalidate();
      utils.goals.getActive.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || t('wiseSyncFailed', preferences.language));
    },
  });

  // CSV import mutation
  const csvImportMutation = trpc.csv.importNubankCSV.useMutation({
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
      csvImportMutation.mutate({
        goalId,
        csvContent: content,
      });
    };
    reader.readAsText(file);
  };

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{t('bankSynchronization', preferences.language)}</CardTitle>
                    <CardDescription className="text-sm">
                      {t('syncWiseOrImportBankCSV', preferences.language)}
                    </CardDescription>
                  </div>
                </div>
                {isOpen ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
              {/* Wise Integration */}
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Wise</h3>
                    <p className="text-sm text-muted-foreground">
                      {isWiseNotConfigured 
                        ? t('tokenNotConfigured', preferences.language)
                        : `${balances.length} ${t('wiseBalances', preferences.language)}`}
                    </p>
                  </div>
                  {isWiseNotConfigured ? (
                    <Link href="/settings">
                      <Button size="sm" variant="outline">
                        <Settings className="h-4 w-4 mr-2" />
                        {t('goToSettings', preferences.language)}
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      onClick={handleWiseSync}
                      size="sm"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      {t('syncWise', preferences.language)}
                    </Button>
                  )}
                </div>
                {!isWiseNotConfigured && balances.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {balances.map((balance) => (
                      <div key={balance.currency} className="text-sm p-2 bg-secondary/50 rounded">
                        <div className="font-medium">{balance.currency}</div>
                        <div className="text-muted-foreground">{balance.amount.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* CSV Import */}
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{t('bankCSV', preferences.language)}</h3>
                    <p className="text-sm text-muted-foreground">
                      {t('importFromCSV', preferences.language)}
                    </p>
                  </div>
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    size="sm"
                    variant="outline"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {t('uploadCSV', preferences.language)}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleCsvUpload}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
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
                  {balances.map((balance) => (
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
