import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { ArrowDown, ArrowUp, TrendingUp } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { usePreferences } from "@/contexts/PreferencesContext";
import { t } from "@/lib/i18n";
import { formatCurrency } from "@/lib/currency";

export default function Analytics() {
  const { preferences } = usePreferences();
  const [savingTarget, setSavingTarget] = useState("");
  
  const utils = trpc.useUtils();
  const { data: transactions = [] } = trpc.transactions.getAll.useQuery();
  const { data: settings } = trpc.settings.get.useQuery();

  const updateSettingsMutation = trpc.settings.update.useMutation({
    onSuccess: () => {
      utils.settings.get.invalidate();
      toast.success(t("savingTargetUpdated", preferences.language));
    },
  });

  const handleSaveTarget = () => {
    const target = Math.round(parseFloat(savingTarget) * 100);
    if (isNaN(target) || target < 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    updateSettingsMutation.mutate({
      monthlySavingTarget: target,
    });
  };

  const last6Months = useMemo(() => {
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        name: date.toLocaleString('en-US', { month: 'short' }),
        month: date.getMonth(),
        year: date.getFullYear(),
      });
    }
    return months;
  }, []);

  const monthlyData = useMemo(() => {
    return last6Months.map(({ name, month, year }) => {
      const monthTransactions = transactions.filter(t => {
        const date = new Date(t.createdDate);
        return date.getMonth() === month && date.getFullYear() === year;
      });

      const income = monthTransactions
        .filter(t => t.type === "income")
        .reduce((sum, t) => sum + t.amount, 0);
      
      const expenses = monthTransactions
        .filter(t => t.type === "expense")
        .reduce((sum, t) => sum + t.amount, 0);

      return { name, income, expenses };
    });
  }, [transactions, last6Months]);

  const totalIncome = useMemo(() => {
    return monthlyData.reduce((sum, m) => sum + m.income, 0);
  }, [monthlyData]);

  const totalExpenses = useMemo(() => {
    return monthlyData.reduce((sum, m) => sum + m.expenses, 0);
  }, [monthlyData]);

  const netFlow = totalIncome - totalExpenses;

  const averageMonthlySaving = useMemo(() => {
    const monthlySavings = monthlyData.map(m => m.income - m.expenses);
    const total = monthlySavings.reduce((sum, s) => sum + s, 0);
    return monthlyData.length > 0 ? Math.round(total / monthlyData.length) : 0;
  }, [monthlyData]);

  const currentTarget = settings?.monthlySavingTarget || 0;

  return (
    <DashboardLayout>
      <div className="p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t("analytics", preferences.language)}</h1>
          <p className="text-muted-foreground">{t("trackFinancialPerformance", preferences.language)}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-primary/20 to-primary/5 border-primary/20">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <ArrowUp className="h-5 w-5 text-primary" />
                <CardTitle className="text-sm text-muted-foreground">{t("income", preferences.language).toUpperCase()}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{formatCurrency(totalIncome / 100, preferences.currency)}</p>
              <p className="text-sm text-muted-foreground">{t("last6Months", preferences.language)}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-destructive/20 to-destructive/5 border-destructive/20">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <ArrowDown className="h-5 w-5 text-destructive" />
                <CardTitle className="text-sm text-muted-foreground">{t("expense", preferences.language).toUpperCase()}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{formatCurrency(totalExpenses / 100, preferences.currency)}</p>
              <p className="text-sm text-muted-foreground">{t("last6Months", preferences.language)}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-accent/20 to-accent/5 border-accent/20">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-accent" />
                <CardTitle className="text-sm text-muted-foreground">{t("netSavings", preferences.language).toUpperCase()}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className={`text-3xl font-bold ${netFlow >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {formatCurrency(netFlow / 100, preferences.currency)}
              </p>
              <p className="text-sm text-muted-foreground">{t("positiveFlow", preferences.language)}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">{t("monthlyOverview", preferences.language)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {monthlyData.map((data) => {
                const maxValue = Math.max(...monthlyData.map(m => Math.max(m.income, m.expenses)));
                const incomeWidth = maxValue > 0 ? (data.income / maxValue) * 100 : 0;
                const expensesWidth = maxValue > 0 ? (data.expenses / maxValue) * 100 : 0;

                return (
                  <div key={data.name} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">{data.name}</span>
                      <div className="flex gap-4">
                        <span className="text-primary">{formatCurrency(data.income / 100, preferences.currency)}</span>
                        <span className="text-destructive">{formatCurrency(data.expenses / 100, preferences.currency)}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1 bg-secondary rounded-full h-6 overflow-hidden">
                        <div
                          className="bg-primary h-full rounded-full"
                          style={{ width: `${incomeWidth}%` }}
                        />
                      </div>
                      <div className="flex-1 bg-secondary rounded-full h-6 overflow-hidden">
                        <div
                          className="bg-destructive h-full rounded-full"
                          style={{ width: `${expensesWidth}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-center gap-6 mt-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-primary" />
                <span className="text-muted-foreground">{t("income", preferences.language)}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-destructive" />
                <span className="text-muted-foreground">{t("expense", preferences.language)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">{t("monthlySavingTargetTitle", preferences.language)}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="saving-target">{t("targetAmountUSD", preferences.language)}</Label>
              <div className="flex gap-2">
                <Input
                  id="saving-target"
                  type="number"
                  step="0.01"
                  placeholder={(currentTarget / 100).toFixed(2)}
                  value={savingTarget}
                  onChange={(e) => setSavingTarget(e.target.value)}
                />
                <Button onClick={handleSaveTarget} disabled={updateSettingsMutation.isPending}>
                  {t("save", preferences.language)}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-secondary/50 border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-muted-foreground">{t("averageMonthlySaving", preferences.language)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(averageMonthlySaving / 100, preferences.currency)}</p>
                  <p className="text-sm text-muted-foreground">{t("basedOnLast6Months", preferences.language)}</p>
                </CardContent>
              </Card>

              <Card className="bg-secondary/50 border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-muted-foreground">{t("yourTargetSaving", preferences.language)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(currentTarget / 100, preferences.currency)}</p>
                  <p className="text-sm text-muted-foreground">{t("setTargetAbove", preferences.language)}</p>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
