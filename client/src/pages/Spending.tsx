import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Plus, Trash } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { usePreferences } from "@/contexts/PreferencesContext";
import { t } from "@/lib/i18n";
import { formatCurrency } from "@/lib/currency";

const COLORS = ['#3b82f6', '#22c55e', '#14b8a6', '#ec4899', '#8b5cf6', '#f59e0b', '#06b6d4', '#f97316'];

export default function Spending() {
  const { preferences } = usePreferences();
  const [isAddRecurringModalOpen, setIsAddRecurringModalOpen] = useState(false);
  const [recurringName, setRecurringName] = useState("");
  const [recurringAmount, setRecurringAmount] = useState("");
  const [recurringFrequency, setRecurringFrequency] = useState<"monthly" | "daily" | "weekly" | "yearly">("monthly");
  const [filterType, setFilterType] = useState("All");
  const [showOnlyRecurring, setShowOnlyRecurring] = useState(false);

  const utils = trpc.useUtils();
  const { data: transactions = [] } = trpc.transactions.getAll.useQuery();
  const { data: categories = [] } = trpc.categories.getAll.useQuery();
  const { data: recurringExpenses = [] } = trpc.recurringExpenses.getAll.useQuery();

  const createRecurringMutation = trpc.recurringExpenses.create.useMutation({
    onSuccess: () => {
      utils.recurringExpenses.getAll.invalidate();
      setIsAddRecurringModalOpen(false);
      setRecurringName("");
      setRecurringAmount("");
      setRecurringFrequency("monthly");
      toast.success(t("recurringExpenseAdded", preferences.language));
    },
  });

  const deleteRecurringMutation = trpc.recurringExpenses.delete.useMutation({
    onSuccess: () => {
      utils.recurringExpenses.getAll.invalidate();
      toast.success(t("recurringExpenseDeleted", preferences.language));
    },
  });

  const handleAddRecurring = () => {
    const amount = Math.round(parseFloat(recurringAmount) * 100);
    if (isNaN(amount) || amount <= 0) {
      toast.error(t("pleaseEnterValidAmount", preferences.language));
      return;
    }
    
    if (!recurringName.trim()) {
      toast.error(t("pleaseEnterName", preferences.language));
      return;
    }

    // Use first category or create a default one
    const categoryId = categories[0]?.id || 1;

    createRecurringMutation.mutate({
      categoryId,
      name: recurringName,
      amount,
      frequency: recurringFrequency,
    });
  };

  const expenseTransactions = useMemo(() => {
    return transactions.filter(t => t.type === "expense");
  }, [transactions]);

  const totalSpending = useMemo(() => {
    const transactionsTotal = expenseTransactions.reduce((sum, t) => sum + t.amount, 0);
    // Add monthly recurring to total
    const recurringTotal = recurringExpenses.reduce((sum, expense) => {
      const monthlyAmount = expense.frequency === 'monthly' ? expense.amount :
                          expense.frequency === 'yearly' ? expense.amount / 12 :
                          expense.frequency === 'weekly' ? expense.amount * 4.33 :
                          expense.frequency === 'daily' ? expense.amount * 30 : 0;
      return sum + monthlyAmount;
    }, 0);
    return transactionsTotal + recurringTotal;
  }, [expenseTransactions, recurringExpenses]);

  // Calculate total monthly recurring expenses
  const totalMonthlyRecurring = useMemo(() => {
    return recurringExpenses.reduce((sum, expense) => {
      // Convert all to monthly amount
      const monthlyAmount = expense.frequency === 'monthly' ? expense.amount :
                          expense.frequency === 'yearly' ? expense.amount / 12 :
                          expense.frequency === 'weekly' ? expense.amount * 4.33 :
                          expense.frequency === 'daily' ? expense.amount * 30 : 0;
      return sum + monthlyAmount;
    }, 0);
  }, [recurringExpenses]);

  // Group expenses by category (using reason as category for now)
  const expensesByCategory = useMemo(() => {
    const grouped: Record<string, number> = {};
    
    // Add real transactions
    expenseTransactions.forEach(t => {
      const category = t.reason || "Uncategorized";
      grouped[category] = (grouped[category] || 0) + t.amount;
    });
    
    // Add recurring expenses (converted to monthly)
    recurringExpenses.forEach(expense => {
      const monthlyAmount = expense.frequency === 'monthly' ? expense.amount :
                          expense.frequency === 'yearly' ? expense.amount / 12 :
                          expense.frequency === 'weekly' ? expense.amount * 4.33 :
                          expense.frequency === 'daily' ? expense.amount * 30 : 0;
      const category = `${expense.name} (Recurring)`;
      grouped[category] = (grouped[category] || 0) + monthlyAmount;
    });
    
    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [expenseTransactions, recurringExpenses]);

  // Prepare data for pie chart
  const pieChartData = useMemo(() => {
    return expensesByCategory.map(item => ({
      name: item.name,
      value: item.value / 100, // Convert cents to dollars
    }));
  }, [expensesByCategory]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">{t("spendingAnalysis", preferences.language)}</h1>
            <p className="text-muted-foreground">{t("seeWhereMoney", preferences.language)}</p>
          </div>
          <Button onClick={() => setIsAddRecurringModalOpen(true)} className="bg-purple-600 hover:bg-purple-700">
            <Plus className="mr-2 h-4 w-4" />
            {t("recurringExpense", preferences.language)}
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-4 items-center">
          <div className="flex gap-2">
            <Button
              variant={filterType === "All" ? "default" : "outline"}
              onClick={() => setFilterType("All")}
            >
              {t("all", preferences.language)}
            </Button>
            <Button
              variant={filterType === "By Category" ? "default" : "outline"}
              onClick={() => setFilterType("By Category")}
            >
              {t("byCategory", preferences.language)}
            </Button>
            <Button
              variant={filterType === "Fixed vs Variable" ? "default" : "outline"}
              onClick={() => setFilterType("Fixed vs Variable")}
            >
              {t("fixedVsVariable", preferences.language)}
            </Button>
          </div>

          <Select defaultValue="This Month">
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="This Month">{t("thisMonth", preferences.language)}</SelectItem>
              <SelectItem value="Last Month">{t("lastMonth", preferences.language)}</SelectItem>
              <SelectItem value="Last 3 Months">{t("last3Months", preferences.language)}</SelectItem>
              <SelectItem value="This Year">{t("thisYear", preferences.language)}</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant={showOnlyRecurring ? "default" : "outline"}
            onClick={() => setShowOnlyRecurring(!showOnlyRecurring)}
          >
            {t("showOnlyRecurring", preferences.language)}
          </Button>
        </div>

        {/* Recurring Expenses Summary */}
        {recurringExpenses.length > 0 && (
          <Card className="bg-purple-500/10 border-purple-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Monthly Recurring Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-500">{formatCurrency(totalMonthlyRecurring / 100, preferences.currency)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {recurringExpenses.length} {recurringExpenses.length === 1 ? 'recurring expense' : 'recurring expenses'} • Annual: {formatCurrency(totalMonthlyRecurring * 12 / 100, preferences.currency)}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Spending Distribution (Pie Chart) */}
          <Card>
            <CardHeader>
              <CardTitle>{t("spendingDistribution", preferences.language)}</CardTitle>
            </CardHeader>
            <CardContent>
              {pieChartData.length === 0 ? (
                <div className="h-80 flex items-center justify-center text-muted-foreground">
                  {t("noSpendingData", preferences.language)}
                </div>
              ) : (
                <div className="relative">
                  <ResponsiveContainer width="100%" height={350}>
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={90}
                        outerRadius={130}
                        fill="#8884d8"
                        dataKey="value"
                        paddingAngle={3}
                        strokeWidth={0}
                        isAnimationActive={false}
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value, preferences.currency)}
                        contentStyle={{ 
                          backgroundColor: '#1f2937', 
                          border: '1px solid #374151',
                          borderRadius: '8px',
                          padding: '8px 12px'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center">
                      <div className="text-sm text-muted-foreground mb-1">{t("totalSpending", preferences.language)}</div>
                      <div className="text-2xl font-bold">{formatCurrency(totalSpending / 100, preferences.currency)}</div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* By Category */}
          <Card>
            <CardHeader>
              <CardTitle>{t("byCategory", preferences.language)}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {expensesByCategory.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    {t("noExpensesYet", preferences.language)}
                  </div>
                ) : (
                  expensesByCategory.map((item, index) => {
                    const percentage = totalSpending > 0 ? (item.value / totalSpending) * 100 : 0;
                    const color = COLORS[index % COLORS.length];
                    
                    return (
                      <div key={item.name} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: color }}
                            />
                            <span className="font-medium">{item.name}</span>
                          </div>
                          <div className="text-right">
                            <div className="font-bold">{formatCurrency(item.value, preferences.currency)} • {percentage.toFixed(1)}%</div>
                          </div>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-2">
                          <div
                            className="h-2 rounded-full transition-all"
                            style={{ 
                              width: `${percentage}%`,
                              backgroundColor: color
                            }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recurring Expenses */}
        <Card>
          <CardHeader>
            <CardTitle>{t("recurringExpenses", preferences.language)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recurringExpenses.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">{t("noRecurringExpenses", preferences.language)}</p>
              ) : (
                recurringExpenses.map(expense => (
                  <div key={expense.id} className="flex justify-between items-center p-4 rounded-lg border">
                    <div>
                      <div className="font-medium">{expense.name}</div>
                      <div className="text-sm text-muted-foreground capitalize">{expense.frequency}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-lg font-bold text-red-500">
                        {formatCurrency(expense.amount / 100, preferences.currency)}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm(t("deleteRecurringConfirm", preferences.language))) {
                            deleteRecurringMutation.mutate({ id: expense.id });
                          }
                        }}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Insights */}
        <Card>
          <CardHeader>
            <CardTitle>{t("insightsRecommendations", preferences.language)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <div className="font-semibold text-blue-500">{t("spendingTip", preferences.language)}</div>
                <p className="text-sm mt-1">
                  {t("largestExpenseCategory", preferences.language)} {expensesByCategory[0]?.name || "N/A"}. 
                  {t("reviewExpenses", preferences.language)}
                </p>
              </div>
              
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="font-semibold text-green-500">{t("goodJob", preferences.language)}</div>
                <p className="text-sm mt-1">
                  {t("trackingConsistently", preferences.language)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Add Recurring Expense Modal */}
        <Dialog open={isAddRecurringModalOpen} onOpenChange={setIsAddRecurringModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("addRecurringExpenseTitle", preferences.language)}</DialogTitle>
              <DialogDescription>
                {t("addRecurringExpenseDesc", preferences.language)}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="recurringName">{t("name", preferences.language)}</Label>
                <Input
                  id="recurringName"
                  value={recurringName}
                  onChange={(e) => setRecurringName(e.target.value)}
                  placeholder="e.g., Netflix, Gym Membership"
                />
              </div>

              <div>
                <Label htmlFor="recurringAmount">{t("amount", preferences.language)}</Label>
                <Input
                  id="recurringAmount"
                  type="number"
                  step="0.01"
                  value={recurringAmount}
                  onChange={(e) => setRecurringAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div>
                <Label htmlFor="recurringFrequency">{t("frequency", preferences.language)}</Label>
                <Select value={recurringFrequency} onValueChange={(v: any) => setRecurringFrequency(v)}>
                  <SelectTrigger id="recurringFrequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">{t("daily", preferences.language)}</SelectItem>
                    <SelectItem value="weekly">{t("weekly", preferences.language)}</SelectItem>
                    <SelectItem value="monthly">{t("monthly", preferences.language)}</SelectItem>
                    <SelectItem value="yearly">{t("yearly", preferences.language)}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddRecurringModalOpen(false)}>{t("cancel", preferences.language)}</Button>
              <Button onClick={handleAddRecurring}>{t("addExpense", preferences.language)}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
