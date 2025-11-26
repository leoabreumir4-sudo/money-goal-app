import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { ArrowDown, ArrowUp, TrendingUp, Target } from "lucide-react";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { usePreferences } from "@/contexts/PreferencesContext";
import { t } from "@/lib/i18n";
import { formatCurrency } from "@/lib/currency";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, ReferenceLine } from 'recharts';

export default function Analytics() {
  const { preferences } = usePreferences();
  const [savingTarget, setSavingTarget] = useState("");
  const [projectionPeriod, setProjectionPeriod] = useState<'3M' | '6M' | '12M' | 'GOAL'>('GOAL');
  
  const utils = trpc.useUtils();
  const { data: transactions = [] } = trpc.transactions.getAll.useQuery();
  const { data: settings } = trpc.settings.get.useQuery();
  const { data: activeGoal } = trpc.goals.getActive.useQuery();

  const updateSettingsMutation = trpc.settings.update.useMutation({
    onSuccess: (_, variables) => {
      utils.settings.get.invalidate();
      setSavingTarget((variables.monthlySavingTarget / 100).toString()); // Mantém valor salvo
      toast.success(t("savingTargetUpdated", preferences.language));
    },
  });

  const handleSaveSavingTarget = () => {
    const target = Math.round(parseFloat(savingTarget) * 100);
    if (isNaN(target) || target <= 0) {
      toast.error(t("pleaseEnterValidAmount", preferences.language));
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
    // Only count months with actual transactions (income OR expense)
    const monthsWithTransactions = monthlyData.filter(m => m.income > 0 || m.expenses > 0);
    
    if (monthsWithTransactions.length === 0) return 0;
    
    const monthlySavings = monthsWithTransactions.map(m => m.income - m.expenses);
    const total = monthlySavings.reduce((sum, s) => sum + s, 0);
    return Math.round(total / monthsWithTransactions.length);
  }, [monthlyData]);

  const currentTarget = settings?.monthlySavingTarget || 0;

  return (
    <DashboardLayout>
      <div className="p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t("analytics", preferences.language)}</h1>
          <p className="text-muted-foreground">{t("trackFinancialPerformance", preferences.language)}</p>
        </div>

        {/* Loader para gráfico/card enquanto carrega */}
        {(!activeGoal || !settings) && (
          <div className="animate-pulse bg-card border border-border rounded-lg h-32 w-full mb-4" />
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-primary/20 to-primary/5 border-primary/20">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <ArrowUp className="h-5 w-5 text-primary" />
                <CardTitle className="text-sm text-muted-foreground">{t("income", preferences.language).toUpperCase()}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{formatCurrency(totalIncome, preferences.currency)}</p>
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
              <p className="text-3xl font-bold text-foreground">{formatCurrency(totalExpenses, preferences.currency)}</p>
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
                {formatCurrency(netFlow, preferences.currency)}
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
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={monthlyData}>
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
                  tickFormatter={(value) => `$${(value / 100).toFixed(0)}`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1f2937', 
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    padding: '12px'
                  }}
                  formatter={(value: number) => formatCurrency(value / 100, preferences.currency)}
                  labelStyle={{ color: '#f3f4f6', fontWeight: 'bold', marginBottom: '8px' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="income" 
                  stroke="#8b5cf6" 
                  strokeWidth={3}
                  fill="url(#colorIncome)"
                  name={t("income", preferences.language)}
                />
                <Area 
                  type="monotone" 
                  dataKey="expenses" 
                  stroke="#ef4444" 
                  strokeWidth={3}
                  fill="url(#colorExpense)"
                  name={t("expense", preferences.language)}
                />
              </AreaChart>
            </ResponsiveContainer>
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
              <Label htmlFor="saving-target">Monthly Saving Goal</Label>
              <div className="flex gap-2 items-center">
                <div className="relative max-w-xs">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="saving-target"
                    type="text"
                    placeholder="500"
                    value={savingTarget}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9.]/g, '');
                      setSavingTarget(value);
                    }}
                    className="pl-7"
                  />
                </div>
                <Button onClick={handleSaveSavingTarget} disabled={updateSettingsMutation.isPending}>
                  {t("save", preferences.language)}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Based on your average: {formatCurrency(averageMonthlySaving, preferences.currency)}/month
              </p>
            </div>

            {activeGoal && (() => {
              // Inclui saldo Wise no valor inicial
              const wiseBalance = activeGoal.wiseBalance || 0;
              const avgSaving = averageMonthlySaving;
              const targetSaving = currentTarget;
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

                const avgValue = avgAccumulated >= activeGoal.targetAmount ? null : avgAccumulated;
                const targetValue = targetAccumulated >= activeGoal.targetAmount ? null : targetAccumulated;

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

              const CustomTooltip = ({ active, payload, label }: any) => {
                if (!active || !payload || !payload.length) return null;
                
                const data = payload[0].payload;
                const avgVal = data.average !== null ? data.average : activeGoal.targetAmount;
                const targetVal = data.target !== null ? data.target : activeGoal.targetAmount;
                const monthIdx = data.monthIndex;
                const remaining = activeGoal.targetAmount - Math.max(avgVal, targetVal);
                const monthsRemaining = Math.max(
                  monthsToGoalAvg ? monthsToGoalAvg - monthIdx : 0,
                  monthsToGoalTarget ? monthsToGoalTarget - monthIdx : 0
                );

                if (data.avgReached || data.targetReached) {
                  return (
                    <div className="bg-background/95 backdrop-blur border border-border rounded-lg p-4 shadow-lg">
                      <p className="font-semibold text-lg mb-3">{label} - Goal Reached! 🎉</p>
                      <div className="space-y-2 text-sm">
                        {monthsToGoalTarget && (
                          <div className="flex items-start gap-2">
                            <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                            <div>
                              <p className="font-medium">Target Saving: Reaches goal</p>
                              <p className="text-muted-foreground">in {monthsToGoalTarget} months ({formatCurrency(activeGoal.targetAmount, preferences.currency)})</p>
                            </div>
                          </div>
                        )}
                        {monthsToGoalAvg && (
                          <div className="flex items-start gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5" />
                            <div>
                              <p className="font-medium">Average Saving: Takes {monthsToGoalAvg} months</p>
                              {monthsToGoalTarget && monthsToGoalAvg > monthsToGoalTarget && (
                                <p className="text-yellow-500">({monthsToGoalAvg - monthsToGoalTarget} months slower)</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="bg-background/95 backdrop-blur border border-border rounded-lg p-4 shadow-lg min-w-[280px]">
                    <p className="font-semibold text-base mb-3">{label} (Month {monthIdx})</p>
                    
                    <div className="space-y-2 mb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-primary" />
                          <span className="text-sm">Target Saving:</span>
                        </div>
                        <span className="font-semibold">{formatCurrency(targetVal, preferences.currency)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-blue-500" />
                          <span className="text-sm">Average Saving:</span>
                        </div>
                        <span className="font-semibold">{formatCurrency(avgVal, preferences.currency)}</span>
                      </div>
                    </div>

                    {remaining > 0 && (
                      <div className="border-t border-border pt-3 text-sm text-muted-foreground">
                        <p>Still {formatCurrency(remaining, preferences.currency)} to reach your {formatCurrency(activeGoal.targetAmount, preferences.currency)} goal</p>
                        {monthsRemaining > 0 && (
                          <p className="mt-1">Estimated: {monthsRemaining} months remaining</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              };

              return (
                <>
                  {/* Compact Summary Card */}
                  <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 p-2">
                    <CardContent className="py-3 px-4 space-y-2">
                      <div className="flex items-center gap-2 text-base font-semibold">
                        <Target className="h-4 w-4 text-primary" />
                        <span>Goal: {formatCurrency(activeGoal.targetAmount, preferences.currency)}</span>
                        <span className="ml-auto text-xs text-muted-foreground">Current: <span className="font-bold">
                          <AnimatePresence mode="wait">
                            <motion.span
                              key={initialAmount}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              transition={{ duration: 0.5 }}
                            >
                              {formatCurrency(initialAmount, preferences.currency)}
                            </motion.span>
                          </AnimatePresence>
                        </span> ({
                          <AnimatePresence mode="wait">
                            <motion.span
                              key={Math.round((initialAmount / activeGoal.targetAmount) * 100)}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              transition={{ duration: 0.5 }}
                            >
                              {Math.round((initialAmount / activeGoal.targetAmount) * 100)}%
                            </motion.span>
                          </AnimatePresence>
                        })</span>
                      </div>
                      {wiseBalance > 0 && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Wallet className="h-3 w-3 text-green-500" />
                          Includes Wise balance: {formatCurrency(wiseBalance, preferences.currency)}
                        </div>
                      )}
                      <div className="border-t border-border/50 pt-2 flex flex-col gap-1">
                        <div className="flex gap-4 text-xs">
                          <span className="font-medium">Target:</span> <span className="text-primary">{monthsToGoalTarget}m</span> ({new Date(now.getFullYear(), now.getMonth() + monthsToGoalTarget, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' })})
                          <span className="font-medium">Average:</span> <span className="text-blue-500">{monthsToGoalAvg}m</span> ({new Date(now.getFullYear(), now.getMonth() + monthsToGoalAvg, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' })})
                        </div>
                        {monthsToGoalTarget && monthsToGoalAvg && (
                          <span className="text-xs font-medium text-primary">Difference: Target is {Math.abs(monthsToGoalAvg - monthsToGoalTarget)} months {monthsToGoalTarget < monthsToGoalAvg ? 'faster' : 'slower'}</span>
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
                        {period === 'GOAL' ? 'Until Goal' : period}
                      </Button>
                    ))}
                  </div>

                  {/* Chart */}
                  <div className="mt-6">
                    <ResponsiveContainer width="100%" height={350}>
                      <AreaChart data={projectionData}>
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
                        <Tooltip content={<CustomTooltip />} />
                        <ReferenceLine 
                          y={activeGoal.targetAmount} 
                          stroke="#10b981" 
                          strokeDasharray="5 5" 
                          strokeWidth={2}
                          label={{ value: 'Goal', position: 'insideTopRight', fill: '#10b981', fontSize: 12 }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="average" 
                          stroke="#3b82f6" 
                          strokeWidth={3}
                          fill="url(#colorAverage)"
                          name="Average Saving"
                          dot={{ fill: '#3b82f6', r: 3 }}
                          activeDot={{ r: 6 }}
                          connectNulls={false}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="target" 
                          stroke="#8b5cf6" 
                          strokeWidth={3}
                          fill="url(#colorTarget)"
                          name="Target Saving"
                          dot={{ fill: '#8b5cf6', r: 3 }}
                          activeDot={{ r: 6 }}
                          connectNulls={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                    
                    <div className="flex justify-center gap-6 mt-4 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-blue-500" />
                        <span className="text-muted-foreground">Average Saving</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-primary" />
                        <span className="text-muted-foreground">Target Saving</span>
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
      </div>
    </DashboardLayout>
  );
}
