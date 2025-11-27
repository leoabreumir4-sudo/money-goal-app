import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { ArrowDown, ArrowUp, TrendingUp, Target, Wallet } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { usePreferences } from "@/contexts/PreferencesContext";
import { t } from "@/lib/i18n";
import { formatCurrency } from "@/lib/currency";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, ReferenceLine } from 'recharts';

// Currency conversion helper
const convertToPreferredCurrency = (amount: number, fromCurrency: string, toCurrency: string, exchangeRate?: string | null): number => {
  if (fromCurrency === toCurrency) return amount;
  
  // Use historical exchange rate if available
  if (exchangeRate) {
    const rate = parseFloat(exchangeRate);
    return Math.round(amount / rate);
  }
  
  // Fallback exchange rates (approximate)
  const rates: Record<string, Record<string, number>> = {
    'BRL': { 'USD': 0.186, 'EUR': 0.17 },
    'USD': { 'BRL': 5.38, 'EUR': 0.92 },
    'EUR': { 'BRL': 5.85, 'USD': 1.09 },
  };
  
  const rate = rates[fromCurrency]?.[toCurrency] || 1;
  return Math.round(amount * rate);
};

// Custom Tooltip for Monthly Overview
const CustomMonthlyTooltip = ({ active, payload, label, curr, lang }: any) => {
  if (!active || !payload || !payload.length) return null;
  
  const income = payload.find((p: any) => p.dataKey === 'income')?.value || 0;
  const expense = payload.find((p: any) => p.dataKey === 'expenses')?.value || 0;
  const netSaving = income - expense;

  return (
    <div className="bg-background/95 backdrop-blur border border-border rounded-lg p-4 shadow-lg">
      <p className="font-semibold text-base mb-3">{label}</p>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-6 p-2 bg-primary/5 rounded">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-sm font-medium">{t('income', lang)}</span>
          </div>
          <span className="font-semibold text-primary">{formatCurrency(income, curr)}</span>
        </div>
        
        <div className="flex items-center justify-between gap-6 p-2 bg-destructive/5 rounded">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-destructive" />
            <span className="text-sm font-medium">{t('expense', lang)}</span>
          </div>
          <span className="font-semibold text-destructive">{formatCurrency(expense, curr)}</span>
        </div>
        
        <div className="border-t border-border pt-2 mt-2">
          <div className="flex items-center justify-between gap-6 p-2 bg-muted/30 rounded">
            <span className="text-sm font-medium">{t('netSaving', lang)}</span>
            <span className={`font-bold ${netSaving >= 0 ? 'text-green-500' : 'text-destructive'}`}>
              {formatCurrency(netSaving, curr)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Custom Tooltip Component
const CustomProjectionTooltip = ({ 
  active, 
  payload, 
  label,
  activeGoal,
  monthsToGoalAvg,
  monthsToGoalTarget,
  curr,
  lang
}: any) => {
  if (!active || !payload || !payload.length || !activeGoal) return null;
  
  const data = payload[0].payload;
  const avgVal = data.average !== null ? data.average : activeGoal.targetAmount;
  const targetVal = data.target !== null ? data.target : activeGoal.targetAmount;
  const monthIdx = data.monthIndex;

  // Check if at least one reached, but show progress of both
  const anyReached = data.avgReached || data.targetReached;

  return (
    <div className="bg-background/95 backdrop-blur border border-border rounded-lg p-4 shadow-lg min-w-[300px]">
      <p className="font-semibold text-base mb-3">{label} {anyReached ? '🎉' : ''}</p>
      <p className="text-xs text-muted-foreground mb-3">
        {monthIdx === 0 ? t('todayCurrentMonth', lang) : t('inMonthsFromNow', lang).replace('{0}', monthIdx.toString()).replace('{1}', monthIdx === 1 ? t('months', lang).slice(0, -1) : t('months', lang))}
      </p>
      
      <div className="space-y-2 mb-3">
        <div className="flex items-center justify-between p-2 bg-primary/5 rounded">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-sm font-medium">{t('expected', lang)} {data.targetReached && '✓'}</span>
          </div>
          <span className="font-semibold">{formatCurrency(targetVal, curr)}</span>
        </div>
        <div className="flex items-center justify-between p-2 bg-blue-500/5 rounded">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-sm font-medium">{t('actual', lang)} {data.avgReached && '✓'}</span>
          </div>
          <span className="font-semibold">{formatCurrency(avgVal, curr)}</span>
        </div>
      </div>

      {anyReached && (
        <div className="border-t border-border pt-3 mb-3 space-y-2">
          {data.targetReached && monthsToGoalTarget && (
            <div className="flex items-start gap-2 bg-primary/10 p-2 rounded">
              <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
              <div className="text-xs">
                <p className="font-medium text-primary">{t('expectedReachedIn', lang).replace('{0}', monthsToGoalTarget.toString())}</p>
              </div>
            </div>
          )}
          {data.avgReached && monthsToGoalAvg && (
            <div className="flex items-start gap-2 bg-blue-500/10 p-2 rounded">
              <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
              <div className="text-xs">
                <p className="font-medium text-blue-500">{t('actualReachedIn', lang).replace('{0}', monthsToGoalAvg.toString())}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {!anyReached && (() => {
        // Calculate which projection reaches goal first
        const targetReachesFirst = monthsToGoalTarget && monthsToGoalAvg && monthsToGoalTarget < monthsToGoalAvg;
        const fastestProjection = targetReachesFirst ? targetVal : avgVal;
        const remaining = activeGoal.targetAmount - fastestProjection;
        const monthsLeft = targetReachesFirst 
          ? (monthsToGoalTarget || 0) - monthIdx 
          : (monthsToGoalAvg || 0) - monthIdx;

        return remaining > 0 && monthsLeft > 0 && (
          <div className="border-t border-border pt-3 text-sm">
            <div className="bg-muted/30 p-2 rounded space-y-1">
              <p className="text-xs text-muted-foreground">
                {targetReachesFirst ? `🎯 ${t('targetPace', lang)}` : `📊 ${t('averagePace', lang)}`} {t('toReachGoal', lang)}
              </p>
              <p className="font-medium">
                {formatCurrency(remaining, curr)} {t('remaining', lang)}
              </p>
              <p className="text-xs text-muted-foreground">
                ⏱️ {t('aboutMonthsLeft', lang).replace('{0}', monthsLeft.toString()).replace('{1}', monthsLeft === 1 ? t('months', lang).slice(0, -1) : t('months', lang))}
              </p>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default function Analytics() {
  const { preferences } = usePreferences();
  const lang = preferences?.language || 'en';
  const curr = preferences?.currency || 'USD';
  const numberFormat = preferences?.numberFormat || 'en-US';
  
  const [savingTarget, setSavingTarget] = useState("");
  const [projectionPeriod, setProjectionPeriod] = useState<'3M' | '6M' | '12M' | 'GOAL'>('GOAL');
  
  const utils = trpc.useUtils();
  const { data: transactions = [], isLoading: transactionsLoading } = trpc.transactions.getAll.useQuery();
  const { data: settings, isLoading: settingsLoading } = trpc.settings.get.useQuery();
  const { data: activeGoal, isLoading: goalLoading } = trpc.goals.getActive.useQuery();
  
  const isLoading = transactionsLoading || settingsLoading || goalLoading;

  const updateSettingsMutation = trpc.settings.update.useMutation({
    onSuccess: () => {
      utils.settings.get.invalidate();
      toast.success(t("savingTargetUpdated", lang));
    },
  });

  const handleSaveSavingTarget = () => {
    // Remove formatting (commas and handle decimal point)
    const numericValue = parseFloat(savingTarget.replace(/,/g, ''));
    const target = Math.round(numericValue * 100);
    
    if (isNaN(target) || target <= 0) {
      toast.error(t("pleaseEnterValidAmount", lang));
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
        .reduce((sum, t) => {
          const convertedAmount = convertToPreferredCurrency(
            t.amount,
            t.currency || "USD",
            curr || "USD",
            t.exchangeRate
          );
          return sum + convertedAmount;
        }, 0);
      
      const expenses = monthTransactions
        .filter(t => t.type === "expense")
        .reduce((sum, t) => {
          const convertedAmount = convertToPreferredCurrency(
            t.amount,
            t.currency || "USD",
            curr || "USD",
            t.exchangeRate
          );
          return sum + convertedAmount;
        }, 0);

      return { name, income, expenses };
    });
  }, [transactions, last6Months, curr]);

  const totalIncome = useMemo(() => {
    return monthlyData.reduce((sum, m) => sum + m.income, 0);
  }, [monthlyData]);

  const totalExpenses = useMemo(() => {
    return monthlyData.reduce((sum, m) => sum + m.expenses, 0);
  }, [monthlyData]);

  const netFlow = totalIncome - totalExpenses;

  const averageMonthlySaving = useMemo(() => {
    // Only count months with actual transactions (income OR expense)
    const monthsWithTransactions = monthlyData.filter(m => m.income > 0 || m.expenses > 0);
    
    if (monthsWithTransactions.length === 0) return 0;
    
    const monthlySavings = monthsWithTransactions.map(m => m.income - m.expenses);
    const total = monthlySavings.reduce((sum, s) => sum + s, 0);
    return Math.round(total / monthsWithTransactions.length);
  }, [monthlyData]);

  const currentTarget = settings?.monthlySavingTarget || 0;

  // Initialize savingTarget when settings load
  useEffect(() => {
    if (settings?.monthlySavingTarget) {
      const formatted = (settings.monthlySavingTarget / 100).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      setSavingTarget(formatted);
    }
  }, [settings?.monthlySavingTarget]);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-primary to-primary/80 rounded-xl shadow-lg">
              <TrendingUp className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">{t("analytics", lang)}</h1>
              <p className="text-muted-foreground">{t("trackFinancialPerformance", lang)}</p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="bg-gradient-to-br from-card to-card/80 border-border/50 hover:shadow-xl transition-all duration-300">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-12 w-12 rounded-xl" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-8 w-32" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-3 w-28" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-6">
              <Card className="bg-gradient-to-br from-card to-card/80 border-border/50">
                <CardHeader>
                  <Skeleton className="h-6 w-52" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-[350px] w-full rounded-lg" />
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-card to-card/80 border-border/50">
                <CardHeader>
                  <Skeleton className="h-6 w-64" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-9 w-32" />
                  </div>
                  <Skeleton className="h-[350px] w-full rounded-lg" />
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20 hover:shadow-xl hover:shadow-primary/10 transition-all duration-300 group">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-primary/10 rounded-xl group-hover:scale-110 transition-transform duration-300">
                      <ArrowUp className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-sm text-muted-foreground font-semibold uppercase tracking-wider">{t("income", lang)}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-primary mb-1">{formatCurrency(totalIncome, curr)}</p>
                  <p className="text-sm text-muted-foreground">{t("last6Months", lang)}</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-destructive/10 via-destructive/5 to-transparent border-destructive/20 hover:shadow-xl hover:shadow-destructive/10 transition-all duration-300 group">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-destructive/10 rounded-xl group-hover:scale-110 transition-transform duration-300">
                      <ArrowDown className="h-6 w-6 text-destructive" />
                    </div>
                    <CardTitle className="text-sm text-muted-foreground font-semibold uppercase tracking-wider">{t("expense", lang)}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-destructive mb-1">{formatCurrency(totalExpenses, curr)}</p>
                  <p className="text-sm text-muted-foreground">{t("last6Months", lang)}</p>
                </CardContent>
              </Card>

          <Card className="bg-gradient-to-br from-green-500/10 via-green-500/5 to-transparent border-green-500/20 hover:shadow-xl hover:shadow-green-500/10 transition-all duration-300 group">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-green-500/10 rounded-xl group-hover:scale-110 transition-transform duration-300">
                  <TrendingUp className="h-6 w-6 text-green-500" />
                </div>
                <CardTitle className="text-sm text-muted-foreground font-semibold uppercase tracking-wider">{t("netSavings", lang)}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className={`text-3xl font-bold mb-1 ${netFlow >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                {formatCurrency(netFlow, curr)}
              </p>
              <p className="text-sm text-muted-foreground">{t("positiveFlow", lang)}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-gradient-to-br from-card to-card/80 border-border/50 hover:shadow-xl transition-all duration-300">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-foreground">{t("monthlyOverview", lang)}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={monthlyData} key={`monthly-${monthlyData.length}`}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis 
                  dataKey="name" 
                  stroke="#9ca3af" 
                  tick={{ fill: '#9ca3af' }}
                  tickLine={false}
                />
                <YAxis 
                  stroke="#9ca3af" 
                  tick={{ fill: '#9ca3af' }}
                  tickLine={false}
                  tickFormatter={(value) => formatCurrency(value, curr)}
                />
                <Tooltip content={<CustomMonthlyTooltip curr={curr} lang={lang} />} />
                <Area 
                  type="monotone" 
                  dataKey="income" 
                  stroke="#8b5cf6" 
                  strokeWidth={3}
                  fill="url(#colorIncome)"
                  name={t("income", lang)}
                  isAnimationActive={true}
                  animationDuration={600}
                />
                <Area 
                  type="monotone" 
                  dataKey="expenses" 
                  stroke="#ef4444" 
                  strokeWidth={3}
                  fill="url(#colorExpense)"
                  name={t("expense", lang)}
                  isAnimationActive={true}
                  animationDuration={600}
                />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-6 mt-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-primary" />
                <span className="text-muted-foreground">{t("income", lang)}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-destructive" />
                <span className="text-muted-foreground">{t("expense", lang)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-card/80 border-border/50 hover:shadow-xl transition-all duration-300">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-foreground">{t('monthlySavingTargetTitle', lang)}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="saving-target">{t('howMuchExpectToSave', lang)}</Label>
              <div className="flex gap-2 items-center">
                <div className="relative max-w-xs">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {curr === "BRL" ? "R$" : curr === "USD" ? "$" : "€"}
                  </span>
                  <Input
                    id="saving-target"
                    type="text"
                    placeholder="1100"
                    value={savingTarget}
                    onChange={(e) => {
                      const rawValue = e.target.value.replace(/[^\d]/g, '');
                      if (rawValue === '' || rawValue === '0') {
                        setSavingTarget('');
                        return;
                      }
                      const numericValue = parseInt(rawValue, 10);
                      const formatted = (numericValue / 100).toLocaleString(numberFormat, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      });
                      setSavingTarget(formatted);
                    }}
                    className="pl-9"
                  />
                </div>
                <Button onClick={handleSaveSavingTarget} disabled={updateSettingsMutation.isPending}>
                  {t("save", lang)}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                <span className="inline-flex items-center gap-1.5 bg-primary/10 px-2.5 py-1 rounded-full text-primary font-medium">
                  💡 {t('yourActualAverageSaving', lang)} <span className="font-bold">{formatCurrency(averageMonthlySaving, curr)}{t('perMonth', lang)}</span>
                </span>
                <span className="block text-xs mt-2 text-muted-foreground/70">{t('incomeMinusExpensesLast6Months', lang)}</span>
              </p>
            </div>

            {activeGoal && (() => {
              // Inclui saldo Wise no valor inicial
              const wiseBalance = activeGoal.wiseBalance || 0;
              const avgSaving = averageMonthlySaving;
              // Use currentTarget if available, otherwise use avgSaving as fallback
              const targetSaving = currentTarget > 0 ? currentTarget : avgSaving;
              const initialAmount = activeGoal.currentAmount + wiseBalance;
              const remaining = activeGoal.targetAmount - initialAmount;

              const monthsToGoalAvg = avgSaving > 0 ? Math.ceil(remaining / avgSaving) : null;
              const monthsToGoalTarget = targetSaving > 0 ? Math.ceil(remaining / targetSaving) : null;

              const maxMonths = projectionPeriod === '3M' ? 3 : 
                                projectionPeriod === '6M' ? 6 : 
                                projectionPeriod === '12M' ? 12 : 
                                Math.max(monthsToGoalAvg || 12, monthsToGoalTarget || 12);

              const projectionData = [];
              let avgAccumulated = initialAmount;
              let targetAccumulated = initialAmount;
              const now = new Date();

              for (let i = 0; i <= maxMonths; i++) {
                const futureDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
                const monthLabel = futureDate.toLocaleString('en-US', { month: 'short', year: 'numeric' });

                // Keep showing the line even after one reaches the goal
                // Only set to null when BOTH have reached the goal
                const bothReached = avgAccumulated >= activeGoal.targetAmount && targetAccumulated >= activeGoal.targetAmount;
                
                const avgValue = bothReached ? null : avgAccumulated;
                const targetValue = bothReached ? null : targetAccumulated;

                projectionData.push({
                  month: monthLabel,
                  monthIndex: i,
                  average: avgValue,
                  target: targetValue,
                  avgReached: avgAccumulated >= activeGoal.targetAmount && i > 0,
                  targetReached: targetAccumulated >= activeGoal.targetAmount && i > 0,
                });

                avgAccumulated = Math.min(avgAccumulated + avgSaving, activeGoal.targetAmount);
                targetAccumulated = Math.min(targetAccumulated + targetSaving, activeGoal.targetAmount);
              }

              return (
                <>
                  {/* Compact Summary Card */}
                  <Card className="bg-gradient-to-br from-primary/15 via-primary/10 to-primary/5 border-primary/30 shadow-lg shadow-primary/5">
                    <CardContent className="py-6 px-6">
                      <div className="grid grid-cols-2 gap-6 mb-5">
                        {/* Goal Section */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="p-2 bg-primary/20 rounded-xl shadow-sm">
                              <Target className="h-5 w-5 text-primary" />
                            </div>
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('yourGoal', lang)}</span>
                          </div>
                          <p className="text-3xl font-bold text-foreground">{formatCurrency(activeGoal.targetAmount, curr)}</p>
                        </div>
                        
                        {/* Current Progress Section */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="p-2 bg-primary/20 rounded-xl shadow-sm">
                              <Wallet className="h-5 w-5 text-primary" />
                            </div>
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('progress', lang)}</span>
                          </div>
                          <div className="flex items-baseline gap-2">
                            <p className="text-3xl font-bold text-primary">
                              {formatCurrency(initialAmount, curr)}
                            </p>
                            <span className="text-xl font-semibold text-primary/70">
                              {Math.round((initialAmount / activeGoal.targetAmount) * 100)}%
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {wiseBalance > 0 && (
                        <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400 bg-green-500/15 border border-green-500/30 px-3 py-2 rounded-lg mb-4 shadow-sm">
                          <Wallet className="h-4 w-4" />
                          <span className="font-medium">{t('includesWiseBalance', lang)} {formatCurrency(wiseBalance, curr)}</span>
                        </div>
                      )}
                      
                      <div className="border-t border-primary/20 pt-5 space-y-4">
                        <div className="text-sm font-bold text-foreground flex items-center gap-2">
                          <div className="h-1 w-1 bg-primary rounded-full"></div>
                          {t('timeToReachGoal', lang)}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl p-4 border border-primary/30 shadow-sm hover:shadow-md transition-all">
                            <div className="text-xs text-muted-foreground mb-2 font-semibold uppercase tracking-wide">{t('expectedTarget', lang)}</div>
                            <div className="text-2xl font-bold text-primary mb-1">{monthsToGoalTarget} {t('months', lang)}</div>
                            <div className="text-xs text-muted-foreground">({new Date(now.getFullYear(), now.getMonth() + (monthsToGoalTarget || 0), 1).toLocaleString('en-US', { month: 'short', year: 'numeric' })})</div>
                          </div>
                          <div className="bg-gradient-to-br from-blue-500/20 to-blue-500/10 rounded-xl p-4 border border-blue-500/30 shadow-sm hover:shadow-md transition-all">
                            <div className="text-xs text-muted-foreground mb-2 font-semibold uppercase tracking-wide">{t('actualAverage', lang)}</div>
                            <div className="text-2xl font-bold text-blue-500 mb-1">{monthsToGoalAvg} {t('months', lang)}</div>
                            <div className="text-xs text-muted-foreground">({new Date(now.getFullYear(), now.getMonth() + (monthsToGoalAvg || 0), 1).toLocaleString('en-US', { month: 'short', year: 'numeric' })})</div>
                          </div>
                        </div>
                        {monthsToGoalTarget && monthsToGoalAvg && monthsToGoalTarget !== monthsToGoalAvg && (
                          <div className="text-xs text-center py-2 px-3 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-lg font-medium">
                            {monthsToGoalTarget < monthsToGoalAvg 
                              ? `⚡ ${t('yourTargetPlanFaster', lang).replace('{0}', Math.abs(monthsToGoalAvg - monthsToGoalTarget).toString())}`
                              : `⏳ ${t('averagePaceFaster', lang).replace('{0}', Math.abs(monthsToGoalAvg - monthsToGoalTarget).toString())}`
                            }
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Period Controls */}
                  <div className="flex justify-end gap-2">
                    {(['3M', '6M', '12M', 'GOAL'] as const).map((period) => (
                      <Button
                        key={period}
                        variant={projectionPeriod === period ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setProjectionPeriod(period)}
                      >
                        {period === 'GOAL' ? t('untilGoal', lang) : period}
                      </Button>
                    ))}
                  </div>

                  {/* Chart */}
                  <div className="mt-6">
                    <ResponsiveContainer width="100%" height={350}>
                      <AreaChart data={projectionData} key={`projection-${projectionData.length}-${projectionPeriod}`}>
                        <defs>
                          <linearGradient id="colorAverage" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05}/>
                          </linearGradient>
                          <linearGradient id="colorTarget" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.05}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                        <XAxis 
                          dataKey="month" 
                          stroke="#9ca3af" 
                          tick={{ fill: '#9ca3af', fontSize: 12 }}
                          tickLine={false}
                        />
                        <YAxis 
                          stroke="#9ca3af" 
                          tick={{ fill: '#9ca3af', fontSize: 12 }}
                          tickLine={false}
                          tickFormatter={(value) => `$${(value / 100).toFixed(0)}`}
                        />
                        <Tooltip content={<CustomProjectionTooltip activeGoal={activeGoal} monthsToGoalAvg={monthsToGoalAvg} monthsToGoalTarget={monthsToGoalTarget} curr={curr} lang={lang} />} />
                        
                        {/* Horizontal line showing the goal amount */}
                        <ReferenceLine 
                          y={activeGoal.targetAmount} 
                          stroke="#10b981" 
                          strokeDasharray="5 5" 
                          strokeWidth={2}
                          label={{ 
                            value: `${t('goal', lang)}: ${formatCurrency(activeGoal.targetAmount, curr)}`, 
                            position: 'insideTopLeft', 
                            fill: '#10b981', 
                            fontSize: 11, 
                            fontWeight: 600,
                            offset: 10
                          }}
                        />
                        
                        {/* Vertical line for when expected projection reaches goal */}
                        {monthsToGoalTarget && monthsToGoalTarget <= projectionData.length && (
                          <ReferenceLine 
                            x={projectionData[monthsToGoalTarget - 1]?.name} 
                            stroke="#8b5cf6" 
                            strokeDasharray="3 3"
                            strokeWidth={2}
                            label={{ 
                              value: `🎯 ${t('expected', lang)} (${monthsToGoalTarget}mo)`, 
                              position: 'top',
                              fill: '#8b5cf6', 
                              fontSize: 11,
                              fontWeight: 600,
                              offset: 10
                            }}
                          />
                        )}
                        
                        {/* Vertical line for when actual average projection reaches goal */}
                        {monthsToGoalAvg && monthsToGoalAvg <= projectionData.length && monthsToGoalAvg !== monthsToGoalTarget && (
                          <ReferenceLine 
                            x={projectionData[monthsToGoalAvg - 1]?.name} 
                            stroke="#3b82f6" 
                            strokeDasharray="3 3"
                            strokeWidth={2}
                            label={{ 
                              value: `📊 ${t('actual', lang)} (${monthsToGoalAvg}mo)`, 
                              position: 'top',
                              fill: '#3b82f6', 
                              fontSize: 11,
                              fontWeight: 600,
                              offset: 10
                            }}
                          />
                        )}
                        
                        <Area 
                          type="monotone" 
                          dataKey="average" 
                          stroke="#3b82f6" 
                          strokeWidth={3}
                          fill="url(#colorAverage)"
                          name="Actual Average"
                          dot={{ fill: '#3b82f6', r: 3 }}
                          activeDot={{ r: 6 }}
                          connectNulls={false}
                          isAnimationActive={true}
                          animationDuration={600}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="target" 
                          stroke="#8b5cf6" 
                          strokeWidth={3}
                          fill="url(#colorTarget)"
                          name="Expected Target"
                          dot={{ fill: '#8b5cf6', r: 3 }}
                          activeDot={{ r: 6 }}
                          connectNulls={false}
                          isAnimationActive={true}
                          animationDuration={600}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                    
                    <div className="flex justify-center gap-6 mt-4 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-blue-500" />
                        <span className="text-muted-foreground">Actual Average</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-primary" />
                        <span className="text-muted-foreground">Expected Target</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-1 bg-green-500" />
                        <span className="text-muted-foreground">Goal Line</span>
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </CardContent>
        </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
