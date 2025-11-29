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
import { Plus, Trash, Edit, TrendingDown, DollarSign, Calendar, BarChart3, Sparkles } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, Sector } from 'recharts';
import { usePreferences } from "@/contexts/PreferencesContext";
import { t, translateCategory } from "@/lib/i18n";
import { formatCurrency } from "@/lib/currency";
import { useIsMobile } from "@/hooks/useMobile";

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
  const isMobile = useIsMobile();
  const { preferences } = usePreferences();
  const [selectedPeriod, setSelectedPeriod] = useState("This Month");
  const [filterType, setFilterType] = useState("All");
  
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
  const isLoading = transactionsLoading || categoriesLoading;
  
  // Remove duplicates (keep only unique categories by ID)
  const categories = useMemo(() => {
    const seen = new Set<number>();
    return categoriesRaw.filter(cat => {
      if (seen.has(cat.id)) return false;
      seen.add(cat.id);
      return true;
    });
  }, [categoriesRaw]);

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
    return expenseTransactions.reduce((sum, t) => {
      const convertedAmount = convertToPreferredCurrency(
        t.amount,
        t.currency || "USD",
        preferences.currency || "USD",
        t.exchangeRate
      );
      return sum + convertedAmount;
    }, 0);
  }, [expenseTransactions, preferences.currency]);

  const expensesByCategory = useMemo(() => {
    const grouped: Record<number, { name: string; value: number; emoji: string; color: string }> = {};
    
    expenseTransactions.forEach(t => {
      // Pula transações sem categoria
      if (!t.categoryId) return;
      
      const category = categories.find(c => c.id === t.categoryId);
      if (!category) return; // Pula se categoria não existe
      
      const categoryId = t.categoryId;
      const categoryName = category.name;
      const categoryEmoji = category.emoji;
      const categoryColor = category.color;
      
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
    
    return Object.entries(grouped)
      .map(([id, data]) => ({ categoryId: Number(id), ...data }))
      .sort((a, b) => b.value - a.value);
  }, [expenseTransactions, categories, preferences.currency]);

  const chartData = expensesByCategory.map((category, index) => ({
    name: translateCategory(category.name, preferences.language),
    value: category.value,
    emoji: category.emoji,
    color: category.color || COLORS[index % COLORS.length],
    categoryId: category.categoryId,
  }));

  // Filter transactions by category for modal
  const filteredTransactions = useMemo(() => {
    if (!selectedCategoryDetails) return [];
    
    return expenseTransactions.filter(t => t.categoryId === selectedCategoryDetails.categoryId);
  }, [expenseTransactions, selectedCategoryDetails]);

  const handleCategoryClick = (entry: any) => {
    const category = expensesByCategory.find(c => c.name === entry.name);
    if (category) {
      setSelectedCategoryDetails(category);
      setIsCategoryDetailsOpen(true);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight">Spending</h1>
            <div className="flex gap-2">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-20" />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
          
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-96" />
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className={`max-w-7xl mx-auto ${isMobile ? 'p-3 space-y-3 pb-4' : 'p-6 space-y-6'}`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <h1 className={`font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent ${isMobile ? 'text-xl' : 'text-3xl'}`}>
            {t("spending", preferences.language)}
          </h1>
          <div className="flex gap-2 w-full sm:w-auto">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="This Month">{t("thisMonth", preferences.language)}</SelectItem>
                <SelectItem value="Last Month">{t("lastMonth", preferences.language)}</SelectItem>
                <SelectItem value="Last 3 Months">{t("last3Months", preferences.language)}</SelectItem>
                <SelectItem value="This Year">{t("thisYear", preferences.language)}</SelectItem>
                <SelectItem value="All Time">{t("allTime", preferences.language)}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="overflow-hidden relative bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 border-red-200 dark:border-red-800">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-red-400/20 to-red-600/20 rounded-full -translate-y-16 translate-x-16" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
              <CardTitle className="text-sm font-medium text-red-700 dark:text-red-300">
                {t("totalSpending", preferences.language)}
              </CardTitle>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent className="relative z-10 pb-3 md:pb-4">
              <div className="text-xl md:text-2xl font-bold text-red-900 dark:text-red-100 truncate">
                {formatCurrency(totalSpending / 100, preferences.currency)}
              </div>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                {selectedPeriod}
              </p>
            </CardContent>
          </Card>

          <Card className="overflow-hidden relative bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-400/20 to-blue-600/20 rounded-full -translate-y-16 translate-x-16" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
              <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
                {t("categories", preferences.language)}
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent className="relative z-10 pb-3 md:pb-4">
              <div className="text-xl md:text-2xl font-bold text-blue-900 dark:text-blue-100">
                {expensesByCategory.length}
              </div>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                {expensesByCategory.length === 1 ? "categoria ativa" : "categorias ativas"}
              </p>
            </CardContent>
          </Card>

          <Card className="overflow-hidden relative bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-400/20 to-green-600/20 rounded-full -translate-y-16 translate-x-16" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
              <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
                {t("avgPerCategory", preferences.language)}
              </CardTitle>
              <DollarSign className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent className="relative z-10 pb-3 md:pb-4">
              <div className="text-xl md:text-2xl font-bold text-green-900 dark:text-green-100">
                {expensesByCategory.length > 0 
                  ? formatCurrency((totalSpending / expensesByCategory.length) / 100, preferences.currency)
                  : formatCurrency(0, preferences.currency)
                }
              </div>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                por categoria
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Spending by Category Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              {t("spendingByCategory", preferences.language)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <div className={isMobile ? "h-64" : "h-96"}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={isMobile ? 50 : 80}
                      outerRadius={isMobile ? 100 : 160}
                      paddingAngle={5}
                      dataKey="value"
                      onClick={handleCategoryClick}
                      className="cursor-pointer"
                    >
                      {chartData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.color}
                          className="hover:opacity-80 transition-opacity"
                        />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => [
                        formatCurrency(value / 100, preferences.currency), 
                        t("amount", preferences.language)
                      ]}
                      labelFormatter={(label) => `${chartData.find(d => d.name === label)?.emoji} ${label}`}
                    />
                    <Legend 
                      formatter={(value) => {
                        const item = chartData.find(d => d.name === value);
                        return `${item?.emoji} ${value}`;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-96 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{t("noDataAvailable", preferences.language)}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Category Details Modal */}
        <Dialog open={isCategoryDetailsOpen} onOpenChange={setIsCategoryDetailsOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="text-2xl">{selectedCategoryDetails?.emoji}</span>
                {selectedCategoryDetails?.name}
                <span className="text-muted-foreground">
                  ({formatCurrency((selectedCategoryDetails?.value || 0) / 100, preferences.currency)})
                </span>
              </DialogTitle>
              <DialogDescription>
                {t("transactionsInCategory", preferences.language)} • {selectedPeriod}
              </DialogDescription>
            </DialogHeader>

            <div className="max-h-96 overflow-y-auto">
              {filteredTransactions.length > 0 ? (
                <div className="space-y-2">
                  {filteredTransactions.map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedCategoryDetails?.color }} />
                        <div>
                          <div className="font-medium">{transaction.description}</div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(transaction.createdDate).toLocaleDateString(preferences.language === 'pt' ? 'pt-BR' : 'en-US')}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-red-600">
                          -{formatCurrency(
                            convertToPreferredCurrency(
                              transaction.amount,
                              transaction.currency || "USD", 
                              preferences.currency || "USD",
                              transaction.exchangeRate
                            ) / 100, 
                            preferences.currency
                          )}
                        </div>
                        {transaction.currency !== preferences.currency && (
                          <div className="text-xs text-muted-foreground">
                            {formatCurrency(transaction.amount / 100, transaction.currency || "USD")}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>{t("noTransactionsInCategory", preferences.language)}</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}