import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { PlaidLinkButton } from "./PlaidLinkButton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Calendar, RefreshCw, Trash2, Building2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
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
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState(format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const utils = trpc.useUtils();

  // Get connected accounts
  const { data: accounts = [], isLoading } = trpc.plaid.getConnectedAccounts.useQuery();

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

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Bank Synchronization</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Bank Synchronization
          </CardTitle>
          <CardDescription>
            Connect your bank accounts to automatically import transactions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {accounts.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground mb-4">No bank accounts connected</p>
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
                        Sync
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
      </Card>

      <Dialog open={syncDialogOpen} onOpenChange={setSyncDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sync Transactions</DialogTitle>
            <DialogDescription>
              Select the date range for importing transactions from your bank
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                max={endDate}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
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
              Cancel
            </Button>
            <Button onClick={handleSyncConfirm} disabled={syncTransactions.isPending}>
              {syncTransactions.isPending ? "Syncing..." : "Sync Transactions"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
