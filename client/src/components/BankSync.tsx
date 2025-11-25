import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { PlaidLinkButton } from "./PlaidLinkButton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Calendar, RefreshCw, Trash2, Building2, ChevronDown, ChevronUp } from "lucide-react";
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

interface BankSyncProps {
  goalId: number;
}

export function BankSync({ goalId }: BankSyncProps) {
  const { preferences } = usePreferences();
  const [isOpen, setIsOpen] = useState(false);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState(format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const utils = trpc.useUtils();

  // Get connected accounts
  const { data: accounts = [], isLoading, error } = trpc.plaid.getConnectedAccounts.useQuery();
  
  // Check if Plaid is not configured
  const isPlaidUnavailable = error?.data?.code === "PRECONDITION_FAILED";

  // Disconnect mutation
  const disconnect = trpc.plaid.disconnectAccount.useMutation({
    onSuccess: () => {
      toast.success("Bank account disconnected");
      utils.plaid.getConnectedAccounts.invalidate();
    },
    onError: () => {
      toast.error("Failed to disconnect account");
    },
  });

  // Sync mutation
  const syncTransactions = trpc.plaid.syncTransactions.useMutation({
    onSuccess: (data) => {
      toast.success(`Successfully imported ${data.importedCount} transactions`);
      setSyncDialogOpen(false);
      utils.transactions.getAll.invalidate();
      utils.goals.getActive.invalidate();
    },
    onError: () => {
      toast.error("Failed to sync transactions");
    },
  });

  const handleSync = (bankId: number) => {
    setSelectedBankId(bankId);
    setSyncDialogOpen(true);
  };

  const handleSyncConfirm = () => {
    if (!selectedBankId) return;
    syncTransactions.mutate({
      bankAccountId: selectedBankId,
      goalId,
      startDate,
      endDate,
    });
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
                      {accounts.length > 0 
                        ? `${accounts.length} ${t(accounts.length === 1 ? 'account' : 'accounts', preferences.language)} ${t('connected', preferences.language)}` 
                        : t('connectBankAccounts', preferences.language)}
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
          {isPlaidUnavailable ? (
            <div className="text-center py-6 px-4">
              <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-4 mb-4">
                <p className="text-sm text-yellow-600 dark:text-yellow-500 font-medium mb-2">
                  ⚠️ Bank Sync Unavailable
                </p>
                <p className="text-xs text-muted-foreground">
                  Bank synchronization is currently not configured. Contact the administrator to enable this feature.
                </p>
              </div>
            </div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground mb-4">{t('noBankAccounts', preferences.language)}</p>
              <PlaidLinkButton onSuccess={() => utils.plaid.getConnectedAccounts.invalidate()} />
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{account.institutionName}</h4>
                        <Badge variant="secondary" className="text-xs">
                          Active
                        </Badge>
                      </div>
                      {account.lastSyncDate && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Last synced: {format(new Date(account.lastSyncDate), "MMM d, yyyy")}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSync(account.id)}
                        disabled={syncTransactions.isPending}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        {t('sync', preferences.language)}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => disconnect.mutate({ bankAccountId: account.id })}
                        disabled={disconnect.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="pt-4 border-t">
                <PlaidLinkButton onSuccess={() => utils.plaid.getConnectedAccounts.invalidate()} />
              </div>
            </>
          )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Dialog open={syncDialogOpen} onOpenChange={setSyncDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('syncTransactions', preferences.language)}</DialogTitle>
            <DialogDescription>
              {t('selectDateRange', preferences.language)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">{t('startDate', preferences.language)}</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                max={endDate}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">{t('endDate', preferences.language)}</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                max={format(new Date(), "yyyy-MM-dd")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSyncDialogOpen(false)}>
              {t('cancel', preferences.language)}
            </Button>
            <Button onClick={handleSyncConfirm} disabled={syncTransactions.isPending}>
              {syncTransactions.isPending ? t('syncing', preferences.language) : t('syncTransactions', preferences.language)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
