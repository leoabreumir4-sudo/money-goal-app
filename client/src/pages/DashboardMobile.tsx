import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { ArrowDown, ArrowUp, Pencil, Sparkles, Target, Wallet, Plus } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { usePreferences } from "@/contexts/PreferencesContext";
import { t, translateCategory } from "@/lib/i18n";
import { formatCurrency } from "@/lib/currency";
import { useCurrencyInput } from "@/hooks/useCurrencyInput";

export default function DashboardMobile() {
  const { preferences } = usePreferences();
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  
  const incomeAmountInput = useCurrencyInput('', preferences.numberFormat as "en-US" | "pt-BR");
  const expenseAmountInput = useCurrencyInput('', preferences.numberFormat as "en-US" | "pt-BR");
  
  const [incomeReason, setIncomeReason] = useState("");
  const [incomeCategory, setIncomeCategory] = useState<string>("");
  const [expenseReason, setExpenseReason] = useState("");
  const [expenseCategory, setExpenseCategory] = useState<string>("");

  const utils = trpc.useUtils();
  const { data: activeGoal, isLoading: goalLoading } = trpc.goals.getActive.useQuery();
  const { data: transactions = [], isLoading: transactionsLoading } = trpc.transactions.getAll.useQuery();
  const { data: wiseBalance = 0 } = trpc.wise.getTotalBalanceConverted.useQuery();
  const { data: categoriesRaw = [] } = trpc.categories.getAll.useQuery();
  
  const categories = useMemo(() => {
    const seen = new Set<number>();
    return categoriesRaw.filter(cat => {
      if (seen.has(cat.id)) return false;
      seen.add(cat.id);
      return true;
    });
  }, [categoriesRaw]);

  const createTransactionMutation = trpc.transactions.create.useMutation({
    onSuccess: (_, variables) => {
      utils.transactions.getAll.invalidate();
      utils.goals.getActive.invalidate();
      
      if (variables.type === "income") {
        setIsIncomeModalOpen(false);
        incomeAmountInput.reset();
        setIncomeReason("");
        setIncomeCategory("");
      } else {
        setIsExpenseModalOpen(false);
        expenseAmountInput.reset();
        setExpenseReason("");
        setExpenseCategory("");
      }
      
      toast.success(`${variables.type === "income" ? "Income" : "Expense"} added successfully!`);
    },
  });

  const handleAddIncome = () => {
    if (!activeGoal) {
      toast.error(t("pleaseCreateGoalFirst", preferences.language as "en" | "pt" | "es"));
      return;
    }
    
    const amount = Math.round(incomeAmountInput.getNumericValue() * 100);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    
    if (!incomeReason.trim()) {
      toast.error(t("pleaseEnterReason", preferences.language as "en" | "pt" | "es"));
      return;
    }

    createTransactionMutation.mutate({
      goalId: activeGoal.id,
      type: "income",
      amount,
      reason: incomeReason,
      categoryId: incomeCategory ? parseInt(incomeCategory) : undefined,
    });
  };

  const handleAddExpense = () => {
    if (!activeGoal) {
      toast.error(t("pleaseCreateGoalFirst", preferences.language as "en" | "pt" | "es"));
      return;
    }
    
    const amount = Math.round(expenseAmountInput.getNumericValue() * 100);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    
    if (!expenseReason.trim()) {
      toast.error(t("pleaseEnterReason", preferences.language as "en" | "pt" | "es"));
      return;
    }

    createTransactionMutation.mutate({
      goalId: activeGoal.id,
      type: "expense",
      amount,
      reason: expenseReason,
      categoryId: expenseCategory ? parseInt(expenseCategory) : undefined,
    });
  };

  const recentTransactions = useMemo(() => {
    if (!activeGoal) return [];
    return transactions
      .filter(t => t.goalId === activeGoal.id)
      .slice(0, 5);
  }, [transactions, activeGoal]);

  const progressPercentage = activeGoal 
    ? Math.min(Math.round((activeGoal.currentAmount / activeGoal.targetAmount) * 100), 100)
    : 0;

  if (goalLoading || transactionsLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="pb-20">
        {/* Floating Action Buttons */}
        <div className="fixed bottom-4 left-4 right-4 z-50 flex gap-2">
          <Button 
            onClick={() => setIsIncomeModalOpen(true)}
            className="flex-1 h-14 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white shadow-lg"
            disabled={!activeGoal}
          >
            <ArrowUp className="mr-2 h-5 w-5" />
            Income
          </Button>
          <Button 
            onClick={() => setIsExpenseModalOpen(true)}
            className="flex-1 h-14 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-lg"
            disabled={!activeGoal}
          >
            <ArrowDown className="mr-2 h-5 w-5" />
            Expense
          </Button>
        </div>

        {activeGoal ? (
          <>
            {/* Goal Card - Mobile Optimized */}
            <Card className="border-0 bg-gradient-to-br from-primary/10 via-background to-purple-500/10 shadow-lg mb-4">
              <CardContent className="p-4">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0 pr-2">
                    <h2 className="text-lg font-bold text-foreground truncate mb-1">{activeGoal.name}</h2>
                    <p className="text-xs text-muted-foreground">{t('savingForDream', preferences.language as "en" | "pt" | "es")}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>

                {/* Progress Circle - Compact */}
                <div className="flex items-center justify-center mb-4">
                  <div className="relative w-28 h-28">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="56"
                        cy="56"
                        r="50"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="none"
                        className="text-secondary"
                      />
                      <circle
                        cx="56"
                        cy="56"
                        r="50"
                        stroke="url(#gradient)"
                        strokeWidth="8"
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 50}`}
                        strokeDashoffset={`${2 * Math.PI * 50 * (1 - progressPercentage / 100)}`}
                        className="transition-all duration-1000"
                      />
                      <defs>
                        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#8056D4" />
                          <stop offset="100%" stopColor="#8056D4" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
                        {progressPercentage}%
                      </span>
                      <span className="text-[10px] text-muted-foreground">{t('complete', preferences.language as "en" | "pt" | "es")}</span>
                    </div>
                  </div>
                </div>

                {/* Stats - Compact Grid */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-background/80 backdrop-blur rounded-xl p-3 border border-border/50">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Sparkles className="h-3 w-3 text-primary" />
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Current</span>
                    </div>
                    <p className="text-sm font-bold text-foreground truncate">
                      {formatCurrency(activeGoal.currentAmount, preferences.currency)}
                    </p>
                    {wiseBalance > 0 && (
                      <div className="flex items-center gap-1 text-[9px] text-green-600 dark:text-green-400 mt-1">
                        <Wallet className="h-2.5 w-2.5" />
                        <span className="truncate">+{formatCurrency(wiseBalance, preferences.currency)}</span>
                      </div>
                    )}
                  </div>

                  <div className="bg-background/80 backdrop-blur rounded-xl p-3 border border-border/50">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Target className="h-3 w-3 text-purple-500" />
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Target</span>
                    </div>
                    <p className="text-sm font-bold text-foreground truncate">
                      {formatCurrency(activeGoal.targetAmount, preferences.currency)}
                    </p>
                    <p className="text-[9px] text-primary font-medium truncate mt-1">
                      {formatCurrency(Math.max(0, activeGoal.targetAmount - activeGoal.currentAmount), preferences.currency)} left
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Transactions - Mobile Optimized */}
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3 flex items-center justify-between">
                  <span>Recent</span>
                  <span className="text-xs text-muted-foreground">{recentTransactions.length} transactions</span>
                </h3>
                {recentTransactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No transactions yet</p>
                ) : (
                  <div className="space-y-2">
                    {recentTransactions.map((transaction) => (
                      <div
                        key={transaction.id}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30 active:bg-secondary/50 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div
                            className={`p-1.5 rounded-full shrink-0 ${
                              transaction.type === "income"
                                ? "bg-primary/20 text-primary"
                                : "bg-accent/20 text-accent"
                            }`}
                          >
                            {transaction.type === "income" ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowDown className="h-3 w-3" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground truncate">{transaction.reason}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(transaction.createdDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                        <p
                          className={`text-sm font-semibold shrink-0 ml-2 ${
                            transaction.type === "income" ? "text-primary" : "text-accent"
                          }`}
                        >
                          {transaction.type === "income" ? "+" : "-"}
                          {formatCurrency(transaction.amount, transaction.currency || preferences.currency)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="bg-card border-border">
            <CardContent className="py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Plus className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">No Active Goal</h3>
              <p className="text-sm text-muted-foreground mb-4">Create your first financial goal to start tracking</p>
              <Button>Create Goal</Button>
            </CardContent>
          </Card>
        )}

        {/* Income Modal */}
        <Dialog open={isIncomeModalOpen} onOpenChange={setIsIncomeModalOpen}>
          <DialogContent className="w-[calc(100vw-2rem)]">
            <DialogHeader>
              <DialogTitle>Add Income</DialogTitle>
              <DialogDescription>Record a new income transaction</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Amount ({preferences.currency})</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={incomeAmountInput.displayValue}
                  onChange={(e) => incomeAmountInput.handleChange(e.target.value)}
                  className="text-lg h-12"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  placeholder="Salary, Freelance, etc."
                  value={incomeReason}
                  onChange={(e) => setIncomeReason(e.target.value)}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label>Category (Optional)</Label>
                <Select value={incomeCategory} onValueChange={setIncomeCategory}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {cat.emoji} {translateCategory(cat.name, preferences.language)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="gap-2 flex-col sm:flex-row">
              <Button variant="outline" onClick={() => setIsIncomeModalOpen(false)} className="w-full sm:w-auto h-12">
                Cancel
              </Button>
              <Button onClick={handleAddIncome} disabled={createTransactionMutation.isPending} className="w-full sm:w-auto h-12 bg-green-600 hover:bg-green-700">
                Add Income
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Expense Modal */}
        <Dialog open={isExpenseModalOpen} onOpenChange={setIsExpenseModalOpen}>
          <DialogContent className="w-[calc(100vw-2rem)]">
            <DialogHeader>
              <DialogTitle>Add Expense</DialogTitle>
              <DialogDescription>Record a new expense transaction</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Amount ({preferences.currency})</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={expenseAmountInput.displayValue}
                  onChange={(e) => expenseAmountInput.handleChange(e.target.value)}
                  className="text-lg h-12"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  placeholder="Food, Transport, etc."
                  value={expenseReason}
                  onChange={(e) => setExpenseReason(e.target.value)}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label>Category (Optional)</Label>
                <Select value={expenseCategory} onValueChange={setExpenseCategory}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {cat.emoji} {translateCategory(cat.name, preferences.language)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="gap-2 flex-col sm:flex-row">
              <Button variant="outline" onClick={() => setIsExpenseModalOpen(false)} className="w-full sm:w-auto h-12">
                Cancel
              </Button>
              <Button onClick={handleAddExpense} disabled={createTransactionMutation.isPending} className="w-full sm:w-auto h-12 bg-red-600 hover:bg-red-700">
                Add Expense
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
