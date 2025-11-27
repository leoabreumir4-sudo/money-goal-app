import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import type { Category } from "@shared/types";
import { ArrowDown, ArrowUp, Pencil, Sparkles, Wallet, Target } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { BankSync } from "@/components/BankSync";
import { usePreferences } from "@/contexts/PreferencesContext";
import { t } from "@/lib/i18n";
import { formatCurrency } from "@/lib/currency";
import { useCurrencyInput } from "@/hooks/useCurrencyInput";

export default function Dashboard() {
  const { preferences } = usePreferences();
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isNewGoalModalOpen, setIsNewGoalModalOpen] = useState(false);
  const [isEditGoalModalOpen, setIsEditGoalModalOpen] = useState(false);
  const [isCongratulationsModalOpen, setIsCongratulationsModalOpen] = useState(false);
  
  // Currency inputs
  const incomeAmountInput = useCurrencyInput();
  const expenseAmountInput = useCurrencyInput();
  const newGoalTargetInput = useCurrencyInput();
  const editGoalTargetInput = useCurrencyInput();
  const editTransactionAmountInput = useCurrencyInput();
  
  const [incomeReason, setIncomeReason] = useState("");
  const [incomeCategory, setIncomeCategory] = useState<string>("");
  const [expenseReason, setExpenseReason] = useState("");
  const [expenseCategory, setExpenseCategory] = useState<string>("");
  const [newGoalName, setNewGoalName] = useState("");
  const [editGoalName, setEditGoalName] = useState("");
  
  // Transaction filters
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Edit transaction modal
  const [isEditTransactionModalOpen, setIsEditTransactionModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [editTransactionReason, setEditTransactionReason] = useState("");
  const [editTransactionCategory, setEditTransactionCategory] = useState<string>("");

  const utils = trpc.useUtils();
  const { data: activeGoal, isLoading: goalLoading } = trpc.goals.getActive.useQuery();
  const { data: transactions = [] } = trpc.transactions.getAll.useQuery();
  const { data: wiseBalance = 0 } = trpc.wise.getTotalBalanceConverted.useQuery();
  const { data: categoriesRaw = [] } = trpc.categories.getAll.useQuery();
  
  // Remove duplicates (keep only unique categories by ID)
  const categories = useMemo(() => {
    const seen = new Set<number>();
    return categoriesRaw.filter(cat => {
      if (seen.has(cat.id)) return false;
      seen.add(cat.id);
      return true;
    });
  }, [categoriesRaw]);

  const createGoalMutation = trpc.goals.create.useMutation({
    onSuccess: () => {
      utils.goals.getActive.invalidate();
      setIsNewGoalModalOpen(false);
      setNewGoalName("");
      setNewGoalTarget("");
      toast.success("Goal created successfully!");
    },
  });

  const updateGoalMutation = trpc.goals.update.useMutation({
    onSuccess: () => {
      utils.goals.getActive.invalidate();
      setIsEditGoalModalOpen(false);
      toast.success(t("goalUpdatedSuccess", preferences.language));
    },
  });

  const updateTransactionMutation = trpc.transactions.update.useMutation({
    onSuccess: () => {
      utils.transactions.getAll.invalidate();
      utils.goals.getActive.invalidate();
      setIsEditTransactionModalOpen(false);
      setEditingTransaction(null);
      editTransactionAmountInput.reset();
      setEditTransactionReason("");
      setEditTransactionCategory("");
      toast.success("Transaction updated successfully!");
    },
  });

  const deleteTransactionMutation = trpc.transactions.delete.useMutation({
    onSuccess: () => {
      utils.transactions.getAll.invalidate();
      utils.goals.getActive.invalidate();
      setIsEditTransactionModalOpen(false);
      setEditingTransaction(null);
      toast.success("Transaction deleted successfully!");
    },
  });

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
      
      // Check if goal is completed after adding income
      if (variables.type === "income" && activeGoal) {
        const newAmount = activeGoal.currentAmount + variables.amount;
        if (newAmount >= activeGoal.targetAmount) {
          setIsCongratulationsModalOpen(true);
          // Archive the goal
          updateGoalMutation.mutate({
            id: activeGoal.id,
            status: "archived",
            archivedDate: new Date(),
            completedDate: new Date(),
          });
        }
      }
    },
  });

  const handleAddIncome = () => {
    if (!activeGoal) {
      toast.error("Please create a goal first!");
      return;
    }
    
    const amount = Math.round(incomeAmountInput.getNumericValue() * 100);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    
    if (!incomeReason.trim()) {
      toast.error("Please enter a reason");
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
      toast.error("Please create a goal first!");
      return;
    }
    
    const amount = Math.round(expenseAmountInput.getNumericValue() * 100);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    
    if (!expenseReason.trim()) {
      toast.error("Please enter a reason");
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

  const handleCreateGoal = () => {
    const targetAmount = Math.round(newGoalTargetInput.getNumericValue() * 100);
    if (isNaN(targetAmount) || targetAmount <= 0) {
      toast.error(t("pleaseEnterValidTarget", preferences.language));
      return;
    }
    
    if (!newGoalName.trim()) {
      toast.error(t("pleaseEnterGoalName", preferences.language));
      return;
    }

    createGoalMutation.mutate({
      name: newGoalName,
      targetAmount,
    });
  };

  const handleEditTransaction = (transaction: any) => {
    setEditingTransaction(transaction);
    editTransactionAmountInput.setValue((transaction.amount / 100).toString());
    setEditTransactionReason(transaction.reason);
    setEditTransactionCategory(transaction.categoryId?.toString() || "");
    setIsEditTransactionModalOpen(true);
  };

  const handleUpdateTransaction = () => {
    if (!editingTransaction) return;

    const amount = Math.round(editTransactionAmountInput.getNumericValue() * 100);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (!editTransactionReason.trim()) {
      toast.error("Please enter a reason");
      return;
    }

    updateTransactionMutation.mutate({
      id: editingTransaction.id,
      amount,
      reason: editTransactionReason,
      categoryId: editTransactionCategory ? parseInt(editTransactionCategory) : undefined,
    });
  };

  const handleDeleteTransaction = () => {
    if (!editingTransaction) return;
    
    if (confirm("Are you sure you want to delete this transaction?")) {
      deleteTransactionMutation.mutate({ id: editingTransaction.id });
    }
  };

  const handleEditGoal = () => {
    if (!activeGoal) return;
    
    const targetAmount = Math.round(editGoalTargetInput.getNumericValue() * 100);
    if (isNaN(targetAmount) || targetAmount <= 0) {
      toast.error("Please enter a valid target amount");
      return;
    }
    
    if (!editGoalName.trim()) {
      toast.error("Please enter a goal name");
      return;
    }

    updateGoalMutation.mutate({
      id: activeGoal.id,
      name: editGoalName,
      targetAmount,
    });
  };

  const openEditGoalModal = () => {
    if (activeGoal) {
      setEditGoalName(activeGoal.name);
      editGoalTargetInput.setValue((activeGoal.targetAmount / 100).toString());
      setIsEditGoalModalOpen(true);
    }
  };

  // Filter categories to only show those with transactions
  const categoriesWithTransactions = useMemo(() => {
    if (!activeGoal) return [];
    const categoryIds = new Set(
      transactions
        .filter(t => t.goalId === activeGoal.id && t.categoryId)
        .map(t => t.categoryId)
    );
    return categories.filter(cat => categoryIds.has(cat.id));
  }, [transactions, categories, activeGoal]);

  const recentTransactions = useMemo(() => {
    if (!activeGoal) return [];
    
    let filtered = transactions.filter(t => t.goalId === activeGoal.id);
    
    // Filter by month
    if (filterMonth !== "all") {
      const now = new Date();
      filtered = filtered.filter(t => {
        const txDate = new Date(t.createdDate);
        
        switch (filterMonth) {
          case "this-month":
            return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
          case "last-month":
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            return txDate.getMonth() === lastMonth.getMonth() && txDate.getFullYear() === lastMonth.getFullYear();
          case "last-3-months":
            const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
            return txDate >= threeMonthsAgo;
          default:
            return true;
        }
      });
    }
    
    // Filter by category
    if (filterCategory !== "all") {
      filtered = filtered.filter(t => t.categoryId?.toString() === filterCategory);
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t => t.reason.toLowerCase().includes(query));
    }
    
    return filtered;
  }, [transactions, activeGoal, filterMonth, filterCategory, searchQuery]);

  const progressPercentage = activeGoal 
    ? Math.min(Math.round((activeGoal.currentAmount / activeGoal.targetAmount) * 100), 100)
    : 0;

  if (goalLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8 space-y-6">
        {/* Header with Action Buttons */}
        <div className="flex justify-end items-center gap-4">
          <div className="flex flex-wrap gap-3">
            <Dialog open={isIncomeModalOpen} onOpenChange={setIsIncomeModalOpen}>
              <DialogTrigger asChild>
                <Button className="bg-green-600 hover:bg-green-700 text-white font-medium">
                  <ArrowUp className="mr-2 h-4 w-4" />
                  {t('addIncome', preferences.language)}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Income</DialogTitle>
                  <DialogDescription>Record a new income transaction for your goal.</DialogDescription>
                </DialogHeader>
                <div className="space-y-5 px-6">
                  <div className="space-y-2">
                    <Label htmlFor="income-amount">Amount ($)</Label>
                    <Input
                      id="income-amount"
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={incomeAmountInput.displayValue}
                      onChange={(e) => incomeAmountInput.handleChange(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="income-reason">Reason</Label>
                    <Input
                      id="income-reason"
                      placeholder="e.g., Salary, Freelance work"
                      value={incomeReason}
                      onChange={(e) => setIncomeReason(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="income-category">Category (optional)</Label>
                    <Select value={incomeCategory} onValueChange={setIncomeCategory}>
                      <SelectTrigger id="income-category">
                        <SelectValue placeholder="Auto-detect or select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id.toString()}>
                            {cat.emoji} {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsIncomeModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddIncome} disabled={createTransactionMutation.isPending}>
                    Add Income
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={isExpenseModalOpen} onOpenChange={setIsExpenseModalOpen}>
              <DialogTrigger asChild>
                <Button className="bg-red-600 hover:bg-red-700 text-white font-medium">
                  <ArrowDown className="mr-2 h-4 w-4" />
                  {t('addExpense', preferences.language)}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Expense</DialogTitle>
                  <DialogDescription>Record a new expense transaction for your goal.</DialogDescription>
                </DialogHeader>
                <div className="space-y-5 px-6">
                  <div className="space-y-2">
                    <Label htmlFor="expense-amount">Amount ($)</Label>
                    <Input
                      id="expense-amount"
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={expenseAmountInput.displayValue}
                      onChange={(e) => expenseAmountInput.handleChange(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expense-reason">Reason</Label>
                    <Input
                      id="expense-reason"
                      placeholder="e.g., Shopping, Bills"
                      value={expenseReason}
                      onChange={(e) => setExpenseReason(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expense-category">Category (optional)</Label>
                    <Select value={expenseCategory} onValueChange={setExpenseCategory}>
                      <SelectTrigger id="expense-category">
                        <SelectValue placeholder="Auto-detect or select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id.toString()}>
                            {cat.emoji} {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsExpenseModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddExpense} disabled={createTransactionMutation.isPending}>
                    Add Expense
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Bank Synchronization Section */}
        {activeGoal && (
          <BankSync goalId={activeGoal.id} />
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Transactions */}
          <div className="lg:col-span-2">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">{t('recentTransactions', preferences.language)}</CardTitle>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Input
                    placeholder="Search transactions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="max-w-xs"
                  />
                  <Select value={filterMonth} onValueChange={setFilterMonth}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Filter by month" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="this-month">This Month</SelectItem>
                      <SelectItem value="last-month">Last Month</SelectItem>
                      <SelectItem value="last-3-months">Last 3 Months</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Filter by category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categoriesWithTransactions.map(category => (
                        <SelectItem key={category.id} value={category.id.toString()}>
                          {category.emoji} {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {recentTransactions.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">{t('noTransactions', preferences.language)}</p>
                ) : (
                  <div className="space-y-3 max-h-[calc(20*4rem)] overflow-y-auto pr-2">
                    {(() => {
                      const groupedTransactions: Record<string, typeof recentTransactions> = {};
                      const today = new Date();
                      const yesterday = new Date(today);
                      yesterday.setDate(yesterday.getDate() - 1);

                      recentTransactions.forEach(transaction => {
                        const transactionDate = new Date(transaction.createdDate);
                        let dateLabel: string;

                        if (transactionDate.toDateString() === today.toDateString()) {
                          dateLabel = 'Today';
                        } else if (transactionDate.toDateString() === yesterday.toDateString()) {
                          dateLabel = 'Yesterday';
                        } else {
                          dateLabel = transactionDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
                        }

                        if (!groupedTransactions[dateLabel]) {
                          groupedTransactions[dateLabel] = [];
                        }
                        groupedTransactions[dateLabel].push(transaction);
                      });

                      return Object.entries(groupedTransactions).map(([dateLabel, transactions]) => (
                        <div key={dateLabel}>
                          <h3 className="text-sm font-semibold text-muted-foreground mb-2 mt-4 first:mt-0">
                            {dateLabel}
                          </h3>
                          <div className="space-y-2">
                            {transactions.map((transaction) => (
                              <div
                                key={transaction.id}
                                className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 hover:bg-secondary/70 cursor-pointer transition-colors"
                                onClick={() => handleEditTransaction(transaction)}
                              >
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`p-2 rounded-full ${
                                      transaction.type === "income"
                                        ? "bg-primary/20 text-primary"
                                        : "bg-accent/20 text-accent"
                                    }`}
                                  >
                                    {transaction.type === "income" ? (
                                      <ArrowUp className="h-4 w-4" />
                                    ) : (
                                      <ArrowDown className="h-4 w-4" />
                                    )}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <p className="font-medium text-foreground">{transaction.reason}</p>
                                      {transaction.categoryId && (() => {
                                        const category = categories.find(c => c.id === transaction.categoryId);
                                        return category ? (
                                          <span 
                                            className="px-2 py-0.5 text-xs rounded-full font-medium flex items-center gap-1"
                                            style={{ 
                                              backgroundColor: `${category.color}20`,
                                              color: category.color
                                            }}
                                          >
                                            <span>{category.emoji}</span>
                                            <span>{category.name}</span>
                                          </span>
                                        ) : null;
                                      })()}
                                      {transaction.source && (
                                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                                          transaction.source === 'wise' 
                                            ? 'bg-[#9fe870]/20 text-[#9fe870]' 
                                            : 'bg-purple-500/20 text-purple-400'
                                        }`}>
                                          {transaction.source === 'wise' ? 'Wise' : 'CSV'}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                      {new Date(transaction.createdDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                  </div>
                                </div>
                                <p
                                  className={`font-semibold ${
                                    transaction.type === "income" ? "text-primary" : "text-accent"
                                  }`}
                                >
                                  {transaction.type === "income" ? "+" : "-"}
                                  {formatCurrency(transaction.amount, transaction.currency || preferences.currency)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Goal Progress */}
          <div className="space-y-4">
            {activeGoal ? (
              <>
                {/* Modern Goal Card */}
                <Card className="border-0 bg-gradient-to-br from-primary/5 via-background to-purple-500/5 shadow-xl">
                  <CardContent className="p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex-1">
                        <h3 className="text-2xl font-bold text-foreground mb-1">{activeGoal.name}</h3>
                        <p className="text-sm text-muted-foreground">Saving for your dream</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={openEditGoalModal}
                        className="h-9 w-9 hover:bg-primary/10 rounded-xl"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Progress Circle */}
                    <div className="flex items-center justify-center mb-6">
                      <div className="relative w-40 h-40">
                        {/* Glow Effect */}
                        <div className="absolute inset-0 blur-xl opacity-50">
                          <svg className="w-full h-full transform -rotate-90">
                            <circle
                              cx="80"
                              cy="80"
                              r="70"
                              stroke="url(#gradient)"
                              strokeWidth="12"
                              fill="none"
                              strokeLinecap="round"
                              strokeDasharray={`${2 * Math.PI * 70}`}
                              strokeDashoffset={`${2 * Math.PI * 70 * (1 - progressPercentage / 100)}`}
                            />
                          </svg>
                        </div>
                        
                        {/* Background Circle */}
                        <svg className="w-full h-full transform -rotate-90 relative">
                          <circle
                            cx="80"
                            cy="80"
                            r="70"
                            stroke="currentColor"
                            strokeWidth="12"
                            fill="none"
                            className="text-secondary"
                          />
                          {/* Progress Circle */}
                          <circle
                            cx="80"
                            cy="80"
                            r="70"
                            stroke="url(#gradient)"
                            strokeWidth="12"
                            fill="none"
                            strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 70}`}
                            strokeDashoffset={`${2 * Math.PI * 70 * (1 - progressPercentage / 100)}`}
                            className="transition-all duration-1000 ease-out drop-shadow-lg"
                          />
                          <defs>
                            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#8056D4" />
                              <stop offset="100%" stopColor="#8056D4" />
                            </linearGradient>
                          </defs>
                        </svg>
                        
                        {/* Center Text */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-4xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
                            {progressPercentage}%
                          </span>
                          <span className="text-xs text-muted-foreground mt-1">complete</span>
                        </div>
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      {/* Current Amount */}
                      <div className="bg-background/80 backdrop-blur rounded-2xl p-4 border border-border/50">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Sparkles className="h-4 w-4 text-primary" />
                          </div>
                          <span className="text-xs font-medium text-muted-foreground">Current</span>
                        </div>
                        <p className="text-xl font-bold text-foreground mb-1">
                          {formatCurrency(activeGoal.currentAmount, preferences.currency)}
                        </p>
                        {wiseBalance > 0 && (
                          <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                            <Wallet className="h-3 w-3" />
                            <span>+{formatCurrency(wiseBalance, preferences.currency)}</span>
                            <span className="text-muted-foreground">• Wise Balance</span>
                          </div>
                        )}
                      </div>

                      {/* Target Amount */}
                      <div className="bg-background/80 backdrop-blur rounded-2xl p-4 border border-border/50">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                            <Target className="h-4 w-4 text-purple-500" />
                          </div>
                          <span className="text-xs font-medium text-muted-foreground">Target</span>
                        </div>
                        <p className="text-xl font-bold text-foreground mb-1">
                          {formatCurrency(activeGoal.targetAmount, preferences.currency)}
                        </p>
                        <p className="text-xs text-primary font-medium">
                          {formatCurrency(Math.max(0, activeGoal.targetAmount - activeGoal.currentAmount), preferences.currency)} left
                        </p>
                      </div>
                    </div>

                    {/* Achievement Badge */}
                    {progressPercentage >= 100 && (
                      <div className="mt-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-2xl p-3 text-center">
                        <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                          🎉 Goal Achieved! Congratulations!
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="bg-card border-border">
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground mb-4">No active goal</p>
                  <Dialog open={isNewGoalModalOpen} onOpenChange={setIsNewGoalModalOpen}>
                    <DialogTrigger asChild>
                      <Button>Create Goal</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create New Goal</DialogTitle>
                        <DialogDescription>Set a new financial goal to start tracking your progress.</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-5 px-6">
                        <div className="space-y-2">
                          <Label htmlFor="goal-name">Goal Name</Label>
                          <Input
                            id="goal-name"
                            placeholder="e.g., Ohio Trip 2026"
                            value={newGoalName}
                            onChange={(e) => setNewGoalName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="goal-target">Target Amount ($)</Label>
                          <Input
                            id="goal-target"
                            type="text"
                            inputMode="decimal"
                            placeholder="0.00"
                            value={newGoalTargetInput.displayValue}
                            onChange={(e) => newGoalTargetInput.handleChange(e.target.value)}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsNewGoalModalOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleCreateGoal} disabled={createGoalMutation.isPending}>
                          Create Goal
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Edit Goal Modal */}
        <Dialog open={isEditGoalModalOpen} onOpenChange={setIsEditGoalModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Goal</DialogTitle>
              <DialogDescription>Update your goal name and target amount.</DialogDescription>
            </DialogHeader>
            <div className="space-y-5 px-6">
              <div className="space-y-2">
                <Label htmlFor="edit-goal-name">Goal Name</Label>
                <Input
                  id="edit-goal-name"
                  placeholder="e.g., Ohio Trip 2026"
                  value={editGoalName}
                  onChange={(e) => setEditGoalName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-goal-target">Target Amount ($)</Label>
                <Input
                  id="edit-goal-target"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={editGoalTargetInput.displayValue}
                  onChange={(e) => editGoalTargetInput.handleChange(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditGoalModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditGoal} disabled={updateGoalMutation.isPending}>
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Congratulations Modal */}
        <Dialog open={isCongratulationsModalOpen} onOpenChange={setIsCongratulationsModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-2xl text-center">🎉 Congratulations!</DialogTitle>
              <DialogDescription className="text-center pt-4">
                You've reached your goal! Your goal has been archived.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => setIsCongratulationsModalOpen(false)} className="w-full">
                Create New Goal
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Transaction Modal */}
        <Dialog open={isEditTransactionModalOpen} onOpenChange={setIsEditTransactionModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Transaction</DialogTitle>
              <DialogDescription>Update transaction details or delete it.</DialogDescription>
            </DialogHeader>
            <div className="space-y-5 px-6">
              <div className="space-y-2">
                <Label htmlFor="edit-transaction-amount">Amount ({editingTransaction?.currency || preferences.currency})</Label>
                <Input
                  id="edit-transaction-amount"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={editTransactionAmountInput.displayValue}
                  onChange={(e) => editTransactionAmountInput.handleChange(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-transaction-reason">Description</Label>
                <Input
                  id="edit-transaction-reason"
                  placeholder="e.g., Shopping, Bills"
                  value={editTransactionReason}
                  onChange={(e) => setEditTransactionReason(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-transaction-category">Category</Label>
                <Select value={editTransactionCategory} onValueChange={setEditTransactionCategory}>
                  <SelectTrigger id="edit-transaction-category">
                    <SelectValue placeholder="Select category..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {cat.emoji} {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="flex gap-2">
              <Button 
                variant="destructive" 
                onClick={handleDeleteTransaction}
                disabled={deleteTransactionMutation.isPending}
              >
                Delete
              </Button>
              <div className="flex-1" />
              <Button variant="outline" onClick={() => setIsEditTransactionModalOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleUpdateTransaction} 
                disabled={updateTransactionMutation.isPending}
              >
                Update
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
