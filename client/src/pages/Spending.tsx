import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { Plus, Trash, Edit, TrendingDown, DollarSign, Calendar, BarChart3 } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, Sector } from 'recharts';
import { usePreferences } from "@/contexts/PreferencesContext";
import { t } from "@/lib/i18n";
import { formatCurrency } from "@/lib/currency";
import { useCurrencyInput } from "@/hooks/useCurrencyInput";

const COLORS = ['#3b82f6', '#22c55e', '#14b8a6', '#ec4899', '#8b5cf6', '#f59e0b', '#06b6d4', '#f97316'];

// Simple currency conversion helper (uses rough estimates)
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

export default function Spending() {
  const { preferences } = usePreferences();
  const [isAddRecurringModalOpen, setIsAddRecurringModalOpen] = useState(false);
  const [isEditRecurringModalOpen, setIsEditRecurringModalOpen] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<any>(null);
  const [selectedPeriod, setSelectedPeriod] = useState("This Month");
  const [recurringName, setRecurringName] = useState("");
  const recurringAmountInput = useCurrencyInput('', preferences.numberFormat);
  const [recurringFrequency, setRecurringFrequency] = useState<"monthly" | "daily" | "weekly" | "yearly">("monthly");
  const [recurringDayOfMonth, setRecurringDayOfMonth] = useState(1);
  const [recurringCategoryId, setRecurringCategoryId] = useState<number>(1);
  const [recurringCurrency, setRecurringCurrency] = useState("USD");
  const [recurringIsActive, setRecurringIsActive] = useState(true);
  const [filterType, setFilterType] = useState("All");
  const [showOnlyRecurring, setShowOnlyRecurring] = useState(false);
  
  // Category details modal
  const [isCategoryDetailsOpen, setIsCategoryDetailsOpen] = useState(false);
  const [selectedCategoryDetails, setSelectedCategoryDetails] = useState<{
    name: string;
    emoji: string;
    color: string;
    value: number;
    categoryId: number;
  } | null>(null);

  const utils = trpc.useUtils();
  const { data: transactions = [], isLoading: transactionsLoading } = trpc.transactions.getAll.useQuery();
  const { data: categoriesRaw = [], isLoading: categoriesLoading } = trpc.categories.getAll.useQuery();
  const { data: recurringExpenses = [], isLoading: recurringLoading } = trpc.recurringExpenses.getAll.useQuery();
  
  const isLoading = transactionsLoading || categoriesLoading || recurringLoading;
  
  // Remove duplicates (keep only unique categories by ID)
  const categories = useMemo(() => {
    const seen = new Set<number>();
    return categoriesRaw.filter(cat => {
      if (seen.has(cat.id)) return false;
      seen.add(cat.id);
      return true;
    });
  }, [categoriesRaw]);

  const createRecurringMutation = trpc.recurringExpenses.create.useMutation({
    onSuccess: () => {
      utils.recurringExpenses.getAll.invalidate();
      setIsAddRecurringModalOpen(false);
      setRecurringName("");
      recurringAmountInput.reset();
      setRecurringFrequency("monthly");
      setRecurringDayOfMonth(1);
      setRecurringCategoryId(categories[0]?.id || 1);
      setRecurringCurrency("USD");
      setRecurringIsActive(true);
      toast.success(t("recurringExpenseAdded", preferences.language));
    },
  });

  const updateRecurringMutation = trpc.recurringExpenses.update.useMutation({
    onSuccess: () => {
      utils.recurringExpenses.getAll.invalidate();
      setIsEditRecurringModalOpen(false);
      setEditingRecurring(null);
      setRecurringName("");
      recurringAmountInput.reset();
      setRecurringFrequency("monthly");
      setRecurringDayOfMonth(1);
      setRecurringCategoryId(categories[0]?.id || 1);
      setRecurringCurrency("USD");
      setRecurringIsActive(true);
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
    recurringAmountInput.setValue((expense.amount / 100).toString());
    setRecurringFrequency(expense.frequency);
    setRecurringDayOfMonth(expense.dayOfMonth || 1);
    setRecurringCategoryId(expense.categoryId);
    setRecurringCurrency(expense.currency || "USD");
    setRecurringIsActive(expense.isActive ?? true);
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
    const amount = Math.round(recurringAmountInput.getNumericValue() * 100);
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
      currency: recurringCurrency,
      frequency: recurringFrequency,
      dayOfMonth: recurringDayOfMonth,
      categoryId: recurringCategoryId,
      isActive: recurringIsActive,
    });
  };

  const handleAddRecurring = () => {
    const amount = Math.round(recurringAmountInput.getNumericValue() * 100);
    if (isNaN(amount) || amount <= 0) {
      toast.error(t("pleaseEnterValidAmount", preferences.language));
      return;
    }
    
    if (!recurringName.trim()) {
      toast.error(t("pleaseEnterName", preferences.language));
      return;
    }

    createRecurringMutation.mutate({
      categoryId: recurringCategoryId,
      name: recurringName,
      amount,
      currency: recurringCurrency,
      frequency: recurringFrequency,
      dayOfMonth: recurringDayOfMonth,
      isActive: recurringIsActive,
    });
  };

  const expenseTransactions = useMemo(() => {
    const now = new Date();
    const expenses = transactions.filter(t => t.type === "expense");
    
    if (selectedPeriod === "All Time") {
      return expenses;
    }
    
    return expenses.filter(t => {
      const txDate = new Date(t.createdDate);
      
      switch (selectedPeriod) {
        case "This Month":
          return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
        case "Last Month":
          const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          return txDate.getMonth() === lastMonth.getMonth() && txDate.getFullYear() === lastMonth.getFullYear();
        case "Last 3 Months":
          const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
          return txDate >= threeMonthsAgo;
        case "This Year":
          return txDate.getFullYear() === now.getFullYear();
        default:
          return true;
      }
    });
  }, [transactions, selectedPeriod]);

  const totalSpending = useMemo(() => {
    // Convert all transactions to user's preferred currency
    const transactionsTotal = expenseTransactions.reduce((sum, t) => {
      const convertedAmount = convertToPreferredCurrency(
        t.amount,
        t.currency || "USD",
        preferences.currency || "USD",
        t.exchangeRate
      );
      return sum + convertedAmount;
    }, 0);
    
    // Add monthly recurring to total (only active ones, already in user's preferred currency)
    const recurringTotal = recurringExpenses
      .filter(expense => expense.isActive !== false)
      .reduce((sum, expense) => {
        const monthlyAmount = expense.frequency === 'monthly' ? expense.amount :
                            expense.frequency === 'yearly' ? expense.amount / 12 :
                            expense.frequency === 'weekly' ? expense.amount * 4.33 :
                            expense.frequency === 'daily' ? expense.amount * 30 : 0;
        return sum + monthlyAmount;
      }, 0);
    return transactionsTotal + recurringTotal;
  }, [expenseTransactions, recurringExpenses, preferences.currency]);

  // Calculate total monthly recurring expenses (only active ones)
  const totalMonthlyRecurring = useMemo(() => {
    return recurringExpenses
      .filter(expense => expense.isActive !== false) // Include active expenses (undefined counts as active for backwards compatibility)
      .reduce((sum, expense) => {
        // Convert all to monthly amount
        const monthlyAmount = expense.frequency === 'monthly' ? expense.amount :
                            expense.frequency === 'yearly' ? expense.amount / 12 :
                            expense.frequency === 'weekly' ? expense.amount * 4.33 :
                            expense.frequency === 'daily' ? expense.amount * 30 : 0;
        
        // Convert to user's preferred currency
        const convertedAmount = convertToPreferredCurrency(
          monthlyAmount,
          expense.currency || "USD",
          preferences.currency || "USD",
          null
        );
        
        return sum + convertedAmount;
      }, 0);
  }, [recurringExpenses, preferences.currency]);

  // Group expenses by category (using real categories from database)
  const expensesByCategory = useMemo(() => {
    const grouped: Record<number, { name: string; value: number; emoji: string; color: string }> = {};
    
    // Add real transactions if not filtering to only recurring
    if (!showOnlyRecurring) {
      expenseTransactions.forEach(t => {
        const category = categories.find(c => c.id === t.categoryId);
        // Use actual categoryId from transaction, or find "Other" category as fallback
        const categoryId = t.categoryId || categories.find(c => c.name === "Other")?.id || 0;
        const categoryName = category?.name || "Other";
        const categoryEmoji = category?.emoji || "📦";
        const categoryColor = category?.color || "#94a3b8";
        
        // Convert to user's preferred currency
        const convertedAmount = convertToPreferredCurrency(
          t.amount,
          t.currency || "USD",
          preferences.currency || "USD",
          t.exchangeRate
        );
        
        if (!grouped[categoryId]) {
          grouped[categoryId] = { name: categoryName, value: 0, emoji: categoryEmoji, color: categoryColor };
        }
        grouped[categoryId].value += convertedAmount;
      });
    }
    
    // Add recurring expenses (converted to monthly, only active ones)
    recurringExpenses
      .filter(expense => expense.isActive !== false)
      .forEach(expense => {
        const monthlyAmount = expense.frequency === 'monthly' ? expense.amount :
                            expense.frequency === 'yearly' ? expense.amount / 12 :
                            expense.frequency === 'weekly' ? expense.amount * 4.33 :
                            expense.frequency === 'daily' ? expense.amount * 30 : 0;
        
        const category = categories.find(c => c.id === expense.categoryId);
        const categoryId = expense.categoryId;
        const categoryName = category?.name || "Other";
        const categoryEmoji = category?.emoji || "📦";
        const categoryColor = category?.color || "#94a3b8";
        
        if (!grouped[categoryId]) {
          grouped[categoryId] = { name: categoryName, value: 0, emoji: categoryEmoji, color: categoryColor };
        }
        grouped[categoryId].value += monthlyAmount;
      });
    
    return Object.values(grouped)
      .sort((a, b) => b.value - a.value);
  }, [expenseTransactions, recurringExpenses, showOnlyRecurring, categories]);

  // Prepare data for pie chart
  const pieChartData = useMemo(() => {
    return expensesByCategory.map(item => ({
      name: item.name,
      value: item.value / 100, // Convert cents to dollars
      color: item.color,
    }));
  }, [expensesByCategory]);

  // Get transactions for selected category
  const categoryTransactions = useMemo(() => {
    if (!selectedCategoryDetails) return [];
    
    return expenseTransactions.filter(t => {
      const category = categories.find(c => c.id === t.categoryId);
      const categoryId = t.categoryId || categories.find(c => c.name === "Other")?.id || 0;
      return categoryId === selectedCategoryDetails.categoryId;
    }).sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime());
  }, [expenseTransactions, selectedCategoryDetails, categories]);

  const handleCategoryClick = (categoryName: string, categoryEmoji: string, categoryColor: string, categoryValue: number) => {
    // Find the categoryId from expensesByCategory
    const categoryData = expensesByCategory.find(c => c.name === categoryName);
    if (!categoryData) return;
    
    // Find the actual category to get the ID
    const category = categories.find(c => c.name === categoryName);
    const categoryId = category?.id || categories.find(c => c.name === "Other")?.id || 0;
    
    setSelectedCategoryDetails({
      name: categoryName,
      emoji: categoryEmoji,
      color: categoryColor,
      value: categoryValue,
      categoryId: categoryId,
    });
    setIsCategoryDetailsOpen(true);
  };

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
        {isLoading ? (
          <Card className="bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/20">
            <CardContent className="py-4">
              <div className="flex items-center justify-between h-full">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-48" />
                    <Skeleton className="h-10 w-32" />
                  </div>
                </div>
                <div className="text-right space-y-2">
                  <Skeleton className="h-4 w-24 ml-auto" />
                  <Skeleton className="h-5 w-32 ml-auto" />
                </div>
              </div>
            </CardContent>
          </Card>
        ) : recurringExpenses.length > 0 && (
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
          <CardContent className="py-2">
            <div className="flex flex-wrap gap-2 items-center">
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
                  <SelectItem value="All Time">All Time</SelectItem>
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
                            fill={entry.color || COLORS[index % COLORS.length]} 
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
                    const color = item.color || COLORS[index % COLORS.length];
                    
                    return (
                      <div 
                        key={item.name} 
                        className="space-y-2 cursor-pointer hover:bg-secondary/30 p-3 rounded-lg transition-colors"
                        onClick={() => handleCategoryClick(item.name, item.emoji, color, item.value)}
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full flex-shrink-0" 
                              style={{ backgroundColor: color }}
                            />
                            <span className="text-lg mr-1">{item.emoji}</span>
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
                  
                  const isActive = expense.isActive !== false; // Default to true for backwards compatibility
                  const category = categories.find(c => c.id === expense.categoryId);
                  const expenseCurrency = expense.currency || "USD";
                  
                  return (
                    <div 
                      key={expense.id} 
                      onClick={() => handleEditRecurring(expense)}
                      className={`flex items-center justify-between p-4 rounded-lg border transition-all hover:shadow-md bg-card cursor-pointer ${
                        isActive 
                          ? 'border-border hover:border-destructive/50' 
                          : 'border-muted opacity-60 hover:opacity-100'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          {category && <span className="text-lg">{category.emoji}</span>}
                          <div className="font-semibold text-lg text-foreground">{expense.name}</div>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium capitalize">
                            {expense.frequency}
                          </span>
                          {!isActive && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                              Inactive
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">{formatCurrency(monthlyEquivalent, expenseCurrency)}</span> per month
                          {expense.dayOfMonth && <span className="ml-2">• Day {expense.dayOfMonth}</span>}
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
                <Label htmlFor="recurringCategory">Category</Label>
                <Select 
                  value={recurringCategoryId.toString()} 
                  onValueChange={(v) => setRecurringCategoryId(parseInt(v))}
                >
                  <SelectTrigger id="recurringCategory">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(category => (
                      <SelectItem key={category.id} value={category.id.toString()}>
                        {category.emoji} {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="recurringAmount">{t("amount", preferences.language)}</Label>
                <Input
                  id="recurringAmount"
                  type="text"
                  inputMode="decimal"
                  value={recurringAmountInput.displayValue}
                  onChange={(e) => recurringAmountInput.handleChange(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="recurringCurrency">Currency</Label>
                <Select value={recurringCurrency} onValueChange={setRecurringCurrency}>
                  <SelectTrigger id="recurringCurrency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">🇺🇸 USD</SelectItem>
                    <SelectItem value="BRL">🇧🇷 BRL</SelectItem>
                    <SelectItem value="EUR">🇪🇺 EUR</SelectItem>
                  </SelectContent>
                </Select>
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

              <div className="space-y-2">
                <Label htmlFor="recurringDayOfMonth">Day of Month (1-31)</Label>
                <Input
                  id="recurringDayOfMonth"
                  type="number"
                  min="1"
                  max="31"
                  value={recurringDayOfMonth}
                  onChange={(e) => setRecurringDayOfMonth(parseInt(e.target.value) || 1)}
                  placeholder="1"
                />
              </div>

              <div className="flex items-center justify-between space-x-2 py-2">
                <div className="space-y-0.5">
                  <Label htmlFor="recurringActive">Active</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically create transactions on the specified day
                  </p>
                </div>
                <Switch
                  id="recurringActive"
                  checked={recurringIsActive}
                  onCheckedChange={setRecurringIsActive}
                />
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
                <Label htmlFor="editRecurringCategory">Category</Label>
                <Select 
                  value={recurringCategoryId.toString()} 
                  onValueChange={(v) => setRecurringCategoryId(parseInt(v))}
                >
                  <SelectTrigger id="editRecurringCategory">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(category => (
                      <SelectItem key={category.id} value={category.id.toString()}>
                        {category.emoji} {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="editRecurringAmount">{t("amount", preferences.language)}</Label>
                <Input
                  id="editRecurringAmount"
                  type="text"
                  inputMode="decimal"
                  value={recurringAmountInput.displayValue}
                  onChange={(e) => recurringAmountInput.handleChange(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editRecurringCurrency">Currency</Label>
                <Select value={recurringCurrency} onValueChange={setRecurringCurrency}>
                  <SelectTrigger id="editRecurringCurrency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">🇺🇸 USD</SelectItem>
                    <SelectItem value="BRL">🇧🇷 BRL</SelectItem>
                    <SelectItem value="EUR">🇪🇺 EUR</SelectItem>
                  </SelectContent>
                </Select>
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

              <div className="space-y-2">
                <Label htmlFor="editRecurringDayOfMonth">Day of Month (1-31)</Label>
                <Input
                  id="editRecurringDayOfMonth"
                  type="number"
                  min="1"
                  max="31"
                  value={recurringDayOfMonth}
                  onChange={(e) => setRecurringDayOfMonth(parseInt(e.target.value) || 1)}
                  placeholder="1"
                />
              </div>

              <div className="flex items-center justify-between space-x-2 py-2">
                <div className="space-y-0.5">
                  <Label htmlFor="editRecurringActive">Active</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically create transactions on the specified day
                  </p>
                </div>
                <Switch
                  id="editRecurringActive"
                  checked={recurringIsActive}
                  onCheckedChange={setRecurringIsActive}
                />
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

        {/* Category Details Modal */}
        <Dialog open={isCategoryDetailsOpen} onOpenChange={setIsCategoryDetailsOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <span className="text-3xl">{selectedCategoryDetails?.emoji}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span>{selectedCategoryDetails?.name}</span>
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: selectedCategoryDetails?.color }}
                    />
                  </div>
                  <div className="text-sm font-normal text-muted-foreground mt-1">
                    {formatCurrency(selectedCategoryDetails?.value || 0, preferences.currency)} • {categoryTransactions.length} {categoryTransactions.length === 1 ? 'transaction' : 'transactions'}
                  </div>
                </div>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-4">
              {categoryTransactions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No transactions in this category</p>
              ) : (
                categoryTransactions.map((transaction) => {
                  const convertedAmount = convertToPreferredCurrency(
                    transaction.amount,
                    transaction.currency || "USD",
                    preferences.currency || "USD",
                    transaction.exchangeRate
                  );
                  
                  return (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 hover:bg-secondary/70 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-foreground">{transaction.reason}</p>
                          {transaction.source && (
                            <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                              transaction.source === 'wise' 
                                ? 'bg-[#9fe870]/20 text-[#9fe870]' 
                                : transaction.source === 'recurring'
                                ? 'bg-purple-500/20 text-purple-400'
                                : 'bg-blue-500/20 text-blue-400'
                            }`}>
                              {transaction.source === 'wise' ? 'Wise' : transaction.source === 'recurring' ? 'Auto' : 'CSV'}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {new Date(transaction.createdDate).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-foreground">
                          {formatCurrency(convertedAmount, preferences.currency)}
                        </p>
                        {transaction.currency !== preferences.currency && (
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(transaction.amount, transaction.currency)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
