import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Building2, ChevronDown, ChevronUp, Upload, RefreshCw } from "lucide-react";
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
      toast.success(`Successfully imported ${data.importedCount} of ${data.totalTransactions} Wise transactions`);
      setWiseSyncDialogOpen(false);
      utils.transactions.getAll.invalidate();
      utils.goals.getActive.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to sync Wise transactions");
    },
  });

  // CSV import mutation
  const csvImportMutation = trpc.csv.importNubankCSV.useMutation({
    onSuccess: (data) => {
      toast.success(`Imported ${data.importedCount} transactions (${data.skippedCount} duplicates skipped)`);
      utils.transactions.getAll.invalidate();
      utils.goals.getActive.invalidate();
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    onError: (error) => {
      toast.error(error.message || "Failed to import CSV");
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
                    <CardTitle className="text-lg">Bank Synchronization</CardTitle>
                    <CardDescription className="text-sm">
                      Sync Wise or import Nubank CSV
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
                        ? "Token not configured. Go to Settings." 
                        : `${balances.length} currency balances available`}
                    </p>
                  </div>
                  <Button
                    onClick={handleWiseSync}
                    disabled={isWiseNotConfigured}
                    size="sm"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Sync Wise
                  </Button>
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
                    <h3 className="font-semibold">Nubank CSV</h3>
                    <p className="text-sm text-muted-foreground">
                      Import transactions from CSV file
                    </p>
                  </div>
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    size="sm"
                    variant="outline"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload CSV
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
                  Expected format: date, description, amount (e.g., "2025-01-15,Compra iFood,-45.50")
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
            <DialogTitle>Sync Wise Transactions</DialogTitle>
            <DialogDescription>
              Select currency and date range to import transactions from Wise
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="currency">Currency</Label>
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
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="endDate">End Date</Label>
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
              Cancel
            </Button>
            <Button onClick={handleWiseSyncConfirm} disabled={wiseSyncMutation.isPending}>
              {wiseSyncMutation.isPending ? "Syncing..." : "Sync"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
