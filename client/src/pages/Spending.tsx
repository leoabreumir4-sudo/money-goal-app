import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Plus, Trash, Edit, TrendingDown, DollarSign, Calendar, BarChart3 } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, Sector } from 'recharts';
import { usePreferences } from "@/contexts/PreferencesContext";
import { t } from "@/lib/i18n";
import { formatCurrency } from "@/lib/currency";

const COLORS = ['#3b82f6', '#22c55e', '#14b8a6', '#ec4899', '#8b5cf6', '#f59e0b', '#06b6d4', '#f97316'];

export default function Spending() {
  const { preferences } = usePreferences();
  const [isAddRecurringModalOpen, setIsAddRecurringModalOpen] = useState(false);
  const [isEditRecurringModalOpen, setIsEditRecurringModalOpen] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<any>(null);
  const [selectedPeriod, setSelectedPeriod] = useState("This Month");
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

  const updateRecurringMutation = trpc.recurringExpenses.update.useMutation({
    onSuccess: () => {
      utils.recurringExpenses.getAll.invalidate();
      setIsEditRecurringModalOpen(false);
      setEditingRecurring(null);
      setRecurringName("");
      setRecurringAmount("");
      setRecurringFrequency("monthly");
      toast.success("Recurring expense updated!");
    },
  });

  const deleteRecurringMutation = trpc.recurringExpenses.delete.useMutation({
    onSuccess: () => {
      utils.recurringExpenses.getAll.invalidate();
      toast.success(t("recurringExpenseDeleted", preferences.language));
    },
  });

  const handleEditRecurring = (expense: any) => {
    setEditingRecurring(expense);
    setRecurringName(expense.name);
    setRecurringAmount((expense.amount / 100).toString());
    setRecurringFrequency(expense.frequency);
    setIsEditRecurringModalOpen(true);
  };

  const handleDeleteRecurring = () => {
    if (editingRecurring && confirm(t("deleteRecurringConfirm", preferences.language))) {
      deleteRecurringMutation.mutate({ id: editingRecurring.id });
      setIsEditRecurringModalOpen(false);
      setEditingRecurring(null);
    }
  };

  const handleUpdateRecurring = () => {
    const amount = Math.round(parseFloat(recurringAmount.replace(',', '.')) * 100);
    if (isNaN(amount) || amount <= 0) {
      toast.error(t("pleaseEnterValidAmount", preferences.language));
      return;
    }
    
    if (!recurringName.trim()) {
      toast.error(t("pleaseEnterName", preferences.language));
      return;
    }

    updateRecurringMutation.mutate({
      id: editingRecurring.id,
      name: recurringName,
      amount,
      frequency: recurringFrequency,
    });
  };

  const handleAddRecurring = () => {
    const amount = Math.round(parseFloat(recurringAmount.replace(',', '.')) * 100);
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
      amount: amount * 100,
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
    
    // Add real transactions if not filtering to only recurring
    if (!showOnlyRecurring) {
      expenseTransactions.forEach(t => {
        const category = t.reason || "Uncategorized";
        grouped[category] = (grouped[category] || 0) + t.amount;
      });
    }
    
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
  }, [expenseTransactions, recurringExpenses, showOnlyRecurring]);

  // Prepare data for pie chart
  const pieChartData = useMemo(() => {
    return expensesByCategory.map(item => ({
      name: item.name,
      value: item.value / 100, // Convert cents to dollars
    }));
  }, [expensesByCategory]);

  return (
    <DashboardLayout>
      <div className="p-8 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t("spendingAnalysis", preferences.language)}</h1>
            <p className="text-muted-foreground">{t("seeWhereMoney", preferences.language)}</p>
          </div>
          <Button onClick={() => setIsAddRecurringModalOpen(true)} className="bg-destructive hover:bg-destructive/90 flex items-center gap-2">
            <Plus className="h-4 w-4" />
            <span>{t("recurringExpense", preferences.language)}</span>
          </Button>
        </div>

        {/* Recurring Expenses Summary Card */}
        {recurringExpenses.length > 0 && (
          <Card className="bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/20">
            <CardContent className="py-4">
              <div className="flex items-center justify-between h-full">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-destructive/20 flex items-center justify-center flex-shrink-0">
                    <Calendar className="h-6 w-6 text-destructive" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                      Total Monthly Recurring Expenses
                    </p>
                    <div className="text-4xl font-bold text-destructive leading-none">{formatCurrency(totalMonthlyRecurring, preferences.currency)}</div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground mb-1">
                    {recurringExpenses.length} {recurringExpenses.length === 1 ? 'expense' : 'expenses'}
                  </p>
                  <p className="text-base font-semibold text-foreground">
                    Annual: {formatCurrency(totalMonthlyRecurring * 12, preferences.currency)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card className="bg-card border-border">
          <CardContent className="py-3">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex gap-2 items-center">
                <Button
                  variant={filterType === "All" ? "default" : "outline"}
                  onClick={() => setFilterType("All")}
                  size="sm"
                >
                  {t("all", preferences.language)}
                </Button>
                <Button
                  variant={filterType === "By Category" ? "default" : "outline"}
                  onClick={() => setFilterType("By Category")}
                  size="sm"
                >
                  {t("byCategory", preferences.language)}
                </Button>
                <Button
                  variant={filterType === "Fixed vs Variable" ? "default" : "outline"}
                  onClick={() => setFilterType("Fixed vs Variable")}
                  size="sm"
                >
                  {t("fixedVsVariable", preferences.language)}
                </Button>
              </div>

              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
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
                size="sm"
              >
                {t("showOnlyRecurring", preferences.language)}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Spending Distribution (Pie Chart) */}
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-purple-500" />
                </div>
                <CardTitle className="text-foreground">{t("spendingDistribution", preferences.language)}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {pieChartData.length === 0 ? (
                <div className="h-80 flex items-center justify-center text-muted-foreground">
                  {t("noSpendingData", preferences.language)}
                </div>
              ) : (
                <div className="relative">
                  <ResponsiveContainer width="100%" height={350}>
                    <PieChart onMouseEnter={() => {}} onMouseMove={() => {}} onClick={() => {}}>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={90}
                        outerRadius={130}
                        fill="#8884d8"
                        dataKey="value"
                        strokeWidth={0}
                        isAnimationActive={true}
                        animationDuration={600}
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={COLORS[index % COLORS.length]} 
                            stroke="none"
                          />
                        ))}
                      </Pie>
                      <Tooltip 
                        wrapperStyle={{ zIndex: 10000 }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0];
                            return (
                              <div className="bg-background border-2 border-border rounded-lg p-3 shadow-xl">
                                <p className="font-semibold text-sm mb-1" style={{ color: data.payload.fill }}>
                                  {data.name}
                                </p>
                                <p className="text-lg font-bold text-foreground">
                                  {formatCurrency(data.value as number, preferences.currency)}
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">{t("totalSpending", preferences.language)}</div>
                      <div className="text-3xl font-bold text-foreground">{formatCurrency(totalSpending, preferences.currency)}</div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* By Category */}
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <TrendingDown className="h-5 w-5 text-blue-500" />
                </div>
                <CardTitle className="text-foreground">{t("byCategory", preferences.language)}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2">
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
                              className="w-3 h-3 rounded-full flex-shrink-0" 
                              style={{ backgroundColor: color }}
                            />
                            <span className="font-medium text-sm">{item.name}</span>
                          </div>
                          <div className="text-right flex items-center gap-2">
                            <span className="font-bold text-foreground">{formatCurrency(item.value, preferences.currency)}</span>
                            <span className="text-xs text-muted-foreground">• {percentage.toFixed(1)}%</span>
                          </div>
                        </div>
                        <div className="w-full bg-secondary/50 rounded-full h-2">
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
        {recurringExpenses.length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-green-500" />
                </div>
                <CardTitle className="text-foreground">{t("recurringExpenses", preferences.language)}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recurringExpenses.map(expense => {
                  const monthlyEquivalent = expense.frequency === 'monthly' ? expense.amount :
                                          expense.frequency === 'yearly' ? expense.amount / 12 :
                                          expense.frequency === 'weekly' ? expense.amount * 4.33 :
                                          expense.frequency === 'daily' ? expense.amount * 30 : expense.amount;
                  
                  return (
                    <div 
                      key={expense.id} 
                      onClick={() => handleEditRecurring(expense)}
                      className="flex items-center justify-between p-4 rounded-lg border border-border hover:border-destructive/50 transition-all hover:shadow-md bg-card cursor-pointer"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <div className="font-semibold text-lg text-foreground">{expense.name}</div>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium capitalize">
                            {expense.frequency}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">{formatCurrency(monthlyEquivalent, preferences.currency)}</span> per month
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

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
              <div className="space-y-2">
                <Label htmlFor="recurringName">{t("name", preferences.language)}</Label>
                <Input
                  id="recurringName"
                  value={recurringName}
                  onChange={(e) => setRecurringName(e.target.value)}
                  placeholder="e.g., Netflix, Gym Membership"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="recurringAmount">{t("amount", preferences.language)}</Label>
                <Input
                  id="recurringAmount"
                  type="text"
                  value={recurringAmount}
                  onChange={(e) => setRecurringAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
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

        {/* Edit Recurring Expense Modal */}
        <Dialog open={isEditRecurringModalOpen} onOpenChange={setIsEditRecurringModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Recurring Expense</DialogTitle>
              <DialogDescription>
                Update the details of your recurring expense or delete it
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="editRecurringName">{t("name", preferences.language)}</Label>
                <Input
                  id="editRecurringName"
                  value={recurringName}
                  onChange={(e) => setRecurringName(e.target.value)}
                  placeholder="e.g., Netflix, Gym Membership"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editRecurringAmount">{t("amount", preferences.language)}</Label>
                <Input
                  id="editRecurringAmount"
                  type="text"
                  value={recurringAmount}
                  onChange={(e) => setRecurringAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editRecurringFrequency">{t("frequency", preferences.language)}</Label>
                <Select value={recurringFrequency} onValueChange={(v: any) => setRecurringFrequency(v)}>
                  <SelectTrigger id="editRecurringFrequency">
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
            <DialogFooter className="flex justify-between">
              <Button variant="destructive" onClick={handleDeleteRecurring}>
                <Trash className="mr-2 h-4 w-4" />
                Delete
              </Button>
              <Button onClick={handleUpdateRecurring}>Update</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
