import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import type { Category } from "@shared/types";
import { ArrowDown, ArrowUp, Pencil, Sparkles, Wallet, Target, Plus } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { BankSync } from "@/components/BankSync";
import { usePreferences } from "@/contexts/PreferencesContext";
import { t } from "@/lib/i18n";
import { formatCurrency } from "@/lib/currency";
import { useCurrencyInput } from "@/hooks/useCurrencyInput";
import { useIsMobile } from "@/hooks/useMobile";

export default function Dashboard() {
  const isMobile = useIsMobile();
  const { preferences } = usePreferences();
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isNewGoalModalOpen, setIsNewGoalModalOpen] = useState(false);
  const [isEditGoalModalOpen, setIsEditGoalModalOpen] = useState(false);
  const [isCongratulationsModalOpen, setIsCongratulationsModalOpen] = useState(false);
  
  // Currency inputs
  const incomeAmountInput = useCurrencyInput('', preferences.numberFormat as "en-US" | "pt-BR");
  const expenseAmountInput = useCurrencyInput('', preferences.numberFormat as "en-US" | "pt-BR");
  const newGoalTargetInput = useCurrencyInput('', preferences.numberFormat as "en-US" | "pt-BR");
  const editGoalTargetInput = useCurrencyInput('', preferences.numberFormat as "en-US" | "pt-BR");
  const editTransactionAmountInput = useCurrencyInput('', preferences.numberFormat as "en-US" | "pt-BR");
  
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
  const { data: transactions = [], isLoading: transactionsLoading } = trpc.transactions.getAll.useQuery();
  const { data: wiseBalance = 0, isLoading: wiseLoading } = trpc.wise.getTotalBalanceConverted.useQuery();
  const { data: categoriesRaw = [], isLoading: categoriesLoading } = trpc.categories.getAll.useQuery();
  
  const isLoading = goalLoading || transactionsLoading || categoriesLoading;
  
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
      newGoalTargetInput.reset();
      toast.success(t("goalCreatedSuccess", preferences.language as "en" | "pt" | "es"));
    },
  });

  const updateGoalMutation = trpc.goals.update.useMutation({
    onSuccess: () => {
      utils.goals.getActive.invalidate();
      setIsEditGoalModalOpen(false);
      toast.success(t("goalUpdatedSuccess", preferences.language as "en" | "pt" | "es"));
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

  const handleCreateGoal = () => {
    const targetAmount = Math.round(newGoalTargetInput.getNumericValue() * 100);
    if (isNaN(targetAmount) || targetAmount <= 0) {
      toast.error(t("pleaseEnterValidTarget", preferences.language as "en" | "pt" | "es"));
      return;
    }
    
    if (!newGoalName.trim()) {
      toast.error(t("pleaseEnterGoalName", preferences.language as "en" | "pt" | "es"));
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
      toast.error(t("pleaseEnterReason", preferences.language as "en" | "pt" | "es"));
      return;
    }    updateTransactionMutation.mutate({
      id: editingTransaction.id,
      amount,
      reason: editTransactionReason,
      categoryId: editTransactionCategory ? parseInt(editTransactionCategory) : undefined,
    });
  };

  const handleDeleteTransaction = () => {
    if (!editingTransaction) return;
    
    const amount = formatCurrency(editingTransaction.amount, editingTransaction.currency || preferences.currency);
    const message = `Are you sure you want to delete this transaction?\n\n${editingTransaction.reason}\n${amount}`;
    
    if (confirm(message)) {
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
      toast.error(t("pleaseEnterGoalName", preferences.language as "en" | "pt" | "es"));
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

  // Mobile-first rendering
  if (isMobile) {
    return (
      <DashboardLayout>
        <div className="pb-20 space-y-4">
          {/* Floating Action Buttons - Mobile Only */}
          <div className="fixed bottom-4 left-4 right-4 z-50 flex gap-2">
            <Button 
              onClick={() => setIsIncomeModalOpen(true)}
              className="flex-1 h-14 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white shadow-lg"
              disabled={!activeGoal}
            >
              <ArrowUp className="mr-2 h-5 w-5" />
              {t('addIncome', preferences.language as "en" | "pt" | "es")}
            </Button>
            <Button 
              onClick={() => setIsExpenseModalOpen(true)}
              className="flex-1 h-14 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-lg"
              disabled={!activeGoal}
            >
              <ArrowDown className="mr-2 h-5 w-5" />
              {t('addExpense', preferences.language as "en" | "pt" | "es")}
            </Button>
          </div>

          {activeGoal ? (
            <>
              {/* Goal Card - Mobile Optimized */}
              <Card className="border-0 bg-gradient-to-br from-primary/10 via-background to-purple-500/10 shadow-lg">
                <CardContent className="p-4">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0 pr-2">
                      <h2 className="text-lg font-bold text-foreground truncate mb-1">{activeGoal.name}</h2>
                      <p className="text-xs text-muted-foreground">{t('savingForDream', preferences.language as "en" | "pt" | "es")}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={openEditGoalModal}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Progress Circle - Compact */}
                  <div className="flex items-center justify-center mb-4">
                    <div className="relative w-32 h-32">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle
                          cx="64"
                          cy="64"
                          r="56"
                          stroke="currentColor"
                          strokeWidth="10"
                          fill="none"
                          className="text-secondary"
                        />
                        <circle
                          cx="64"
                          cy="64"
                          r="56"
                          stroke="url(#gradient-mobile)"
                          strokeWidth="10"
                          fill="none"
                          strokeLinecap="round"
                          strokeDasharray={`${2 * Math.PI * 56}`}
                          strokeDashoffset={`${2 * Math.PI * 56 * (1 - progressPercentage / 100)}`}
                          className="transition-all duration-1000"
                        />
                        <defs>
                          <linearGradient id="gradient-mobile" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#8056D4" />
                            <stop offset="100%" stopColor="#8056D4" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
                          {progressPercentage}%
                        </span>
                        <span className="text-[10px] text-muted-foreground mt-0.5">{t('complete', preferences.language as "en" | "pt" | "es")}</span>
                      </div>
                    </div>
                  </div>

                  {/* Stats - Compact Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-background/80 backdrop-blur rounded-xl p-3 border border-border/50">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{t('current', preferences.language as "en" | "pt" | "es")}</span>
                      </div>
                      <p className="text-base font-bold text-foreground truncate mb-1">
                        {formatCurrency(activeGoal.currentAmount, preferences.currency)}
                      </p>
                      {wiseBalance > 0 && (
                        <div className="flex items-center gap-1 text-[9px] text-green-600 dark:text-green-400">
                          <Wallet className="h-2.5 w-2.5" />
                          <span className="truncate">+{formatCurrency(wiseBalance, preferences.currency)}</span>
                        </div>
                      )}
                    </div>

                    <div className="bg-background/80 backdrop-blur rounded-xl p-3 border border-border/50">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Target className="h-3.5 w-3.5 text-purple-500" />
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{t('target', preferences.language as "en" | "pt" | "es")}</span>
                      </div>
                      <p className="text-base font-bold text-foreground truncate mb-1">
                        {formatCurrency(activeGoal.targetAmount, preferences.currency)}
                      </p>
                      <p className="text-[9px] text-primary font-medium truncate">
                        {formatCurrency(Math.max(0, activeGoal.targetAmount - activeGoal.currentAmount), preferences.currency)} {t('left', preferences.language as "en" | "pt" | "es")}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Transactions - Mobile Optimized */}
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <h3 className="font-semibold text-base mb-3 flex items-center justify-between">
                    <span>{t('recentTransactions', preferences.language as "en" | "pt" | "es")}</span>
                    <span className="text-xs text-muted-foreground font-normal">{recentTransactions.length} {t('transactions', preferences.language as "en" | "pt" | "es")}</span>
                  </h3>
                  {isLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : recentTransactions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">{t('noTransactions', preferences.language as "en" | "pt" | "es")}</p>
                  ) : (
                    <div className="space-y-2">
                      {recentTransactions.map((transaction) => (
                        <div
                          key={transaction.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 active:bg-secondary/50 transition-colors"
                          onClick={() => handleEditTransaction(transaction)}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div
                              className={`p-1.5 rounded-full shrink-0 ${
                                transaction.type === "income"
                                  ? "bg-primary/20 text-primary"
                                  : "bg-accent/20 text-accent"
                              }`}
                            >
                              {transaction.type === "income" ? (
                                <ArrowUp className="h-3.5 w-3.5" />
                              ) : (
                                <ArrowDown className="h-3.5 w-3.5" />
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
              <CardContent className="py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Plus className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{t('noActiveGoal', preferences.language as "en" | "pt" | "es")}</h3>
                <p className="text-sm text-muted-foreground mb-6 px-4">{t('createFirstGoal', preferences.language as "en" | "pt" | "es")}</p>
                <Dialog open={isNewGoalModalOpen} onOpenChange={setIsNewGoalModalOpen}>
                  <DialogTrigger asChild>
                    <Button className="h-12">{t('createGoal', preferences.language as "en" | "pt" | "es")}</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t('createNewGoal', preferences.language as "en" | "pt" | "es")}</DialogTitle>
                      <DialogDescription>{t('setNewGoal', preferences.language as "en" | "pt" | "es")}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-5 px-6">
                      <div className="space-y-2">
                        <Label htmlFor="goal-name">{t('goalName', preferences.language as "en" | "pt" | "es")}</Label>
                        <Input
                          id="goal-name"
                          placeholder={t('goalNameExample', preferences.language as "en" | "pt" | "es")}
                          value={newGoalName}
                          onChange={(e) => setNewGoalName(e.target.value)}
                          className="h-12"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="goal-target">{t('targetAmount', preferences.language as "en" | "pt" | "es")} ($)</Label>
                        <Input
                          id="goal-target"
                          type="text"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={newGoalTargetInput.displayValue}
                          onChange={(e) => newGoalTargetInput.handleChange(e.target.value)}
                          className="h-12"
                        />
                      </div>
                    </div>
                    <DialogFooter className="flex-col gap-2">
                      <Button variant="outline" onClick={() => setIsNewGoalModalOpen(false)} className="w-full h-12">
                        {t('cancel', preferences.language as "en" | "pt" | "es")}
                      </Button>
                      <Button onClick={handleCreateGoal} disabled={createGoalMutation.isPending} className="w-full h-12">
                        {t('createGoal', preferences.language as "en" | "pt" | "es")}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          )}

          {/* Modals */}
          <Dialog open={isIncomeModalOpen} onOpenChange={setIsIncomeModalOpen}>
            <DialogContent className="w-[calc(100vw-2rem)]">
              <DialogHeader>
                <DialogTitle>{t('addIncome', preferences.language as "en" | "pt" | "es")}</DialogTitle>
                <DialogDescription>{t('recordNewIncome', preferences.language as "en" | "pt" | "es")}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('amount', preferences.language as "en" | "pt" | "es")} ({preferences.currency})</Label>
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
                  <Label>{t('description', preferences.language as "en" | "pt" | "es")}</Label>
                  <Input
                    placeholder={t('incomeExample', preferences.language as "en" | "pt" | "es")}
                    value={incomeReason}
                    onChange={(e) => setIncomeReason(e.target.value)}
                    className="h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('categoryOptional', preferences.language as "en" | "pt" | "es")}</Label>
                  <Select value={incomeCategory} onValueChange={setIncomeCategory}>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder={t('autoDetectOrSelect', preferences.language as "en" | "pt" | "es")} />
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
              <DialogFooter className="gap-2 flex-col">
                <Button variant="outline" onClick={() => setIsIncomeModalOpen(false)} className="w-full h-12">
                  {t('cancel', preferences.language as "en" | "pt" | "es")}
                </Button>
                <Button onClick={handleAddIncome} disabled={createTransactionMutation.isPending} className="w-full h-12 bg-green-600 hover:bg-green-700">
                  {createTransactionMutation.isPending ? t('adding', preferences.language as "en" | "pt" | "es") : t('addIncome', preferences.language as "en" | "pt" | "es")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isExpenseModalOpen} onOpenChange={setIsExpenseModalOpen}>
            <DialogContent className="w-[calc(100vw-2rem)]">
              <DialogHeader>
                <DialogTitle>{t('addExpense', preferences.language as "en" | "pt" | "es")}</DialogTitle>
                <DialogDescription>{t('recordNewExpense', preferences.language as "en" | "pt" | "es")}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('amount', preferences.language as "en" | "pt" | "es")} ({preferences.currency})</Label>
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
                  <Label>{t('description', preferences.language as "en" | "pt" | "es")}</Label>
                  <Input
                    placeholder={t('expenseExample', preferences.language as "en" | "pt" | "es")}
                    value={expenseReason}
                    onChange={(e) => setExpenseReason(e.target.value)}
                    className="h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('categoryOptional', preferences.language as "en" | "pt" | "es")}</Label>
                  <Select value={expenseCategory} onValueChange={setExpenseCategory}>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder={t('autoDetectOrSelect', preferences.language as "en" | "pt" | "es")} />
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
              <DialogFooter className="gap-2 flex-col">
                <Button variant="outline" onClick={() => setIsExpenseModalOpen(false)} className="w-full h-12">
                  {t('cancel', preferences.language as "en" | "pt" | "es")}
                </Button>
                <Button onClick={handleAddExpense} disabled={createTransactionMutation.isPending} className="w-full h-12 bg-red-600 hover:bg-red-700">
                  {createTransactionMutation.isPending ? t('adding', preferences.language as "en" | "pt" | "es") : t('addExpense', preferences.language as "en" | "pt" | "es")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </DashboardLayout>
    );
  }

  // Desktop rendering
  return (
    <DashboardLayout>
      <div className="p-3 md:p-6 space-y-4 md:space-y-6">
        {/* Modals for Income and Expense */}
        <div className="hidden">
          <Dialog open={isIncomeModalOpen} onOpenChange={setIsIncomeModalOpen}>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-primary/20 text-primary">
                      <ArrowUp className="h-5 w-5" />
                    </div>
                    <div>
                      <DialogTitle className="text-xl">{t('addIncome', preferences.language as "en" | "pt" | "es")}</DialogTitle>
                      <DialogDescription className="text-sm">{t('recordNewIncome', preferences.language as "en" | "pt" | "es")}</DialogDescription>
                    </div>
                  </div>
                </DialogHeader>
                <div className="space-y-4 px-6 pb-2">
                  <div className="space-y-2">
                    <Label htmlFor="income-amount">{t('amount', preferences.language as "en" | "pt" | "es")} ({preferences.currency})</Label>
                    <Input
                      id="income-amount"
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={incomeAmountInput.displayValue}
                      onChange={(e) => incomeAmountInput.handleChange(e.target.value)}
                      className="text-lg font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="income-reason">{t('description', preferences.language as "en" | "pt" | "es")}</Label>
                    <Input
                      id="income-reason"
                      placeholder={t('incomeExample', preferences.language as "en" | "pt" | "es")}
                      value={incomeReason}
                      onChange={(e) => setIncomeReason(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="income-category">{t('categoryOptional', preferences.language as "en" | "pt" | "es")}</Label>
                    <Select value={incomeCategory} onValueChange={setIncomeCategory}>
                      <SelectTrigger id="income-category">
                        <SelectValue placeholder={t('autoDetectOrSelect', preferences.language as "en" | "pt" | "es")} />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id.toString()}>
                            <div className="flex items-center gap-2">
                              <span>{cat.emoji}</span>
                              <span>{cat.name}</span>
                              <div 
                                className="w-2 h-2 rounded-full ml-auto" 
                                style={{ backgroundColor: cat.color }}
                              />
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter className="gap-2 sm:gap-2">
                  <Button variant="outline" onClick={() => setIsIncomeModalOpen(false)}>
                    {t('cancel', preferences.language as "en" | "pt" | "es")}
                  </Button>
                  <Button onClick={handleAddIncome} disabled={createTransactionMutation.isPending} className="bg-primary hover:bg-primary/90">
                    {createTransactionMutation.isPending ? t('adding', preferences.language as "en" | "pt" | "es") : t('addIncome', preferences.language as "en" | "pt" | "es")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={isExpenseModalOpen} onOpenChange={setIsExpenseModalOpen}>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-accent/20 text-accent">
                      <ArrowDown className="h-5 w-5" />
                    </div>
                    <div>
                      <DialogTitle className="text-xl">{t('addExpense', preferences.language as "en" | "pt" | "es")}</DialogTitle>
                      <DialogDescription className="text-sm">{t('recordNewExpense', preferences.language as "en" | "pt" | "es")}</DialogDescription>
                    </div>
                  </div>
                </DialogHeader>
                <div className="space-y-4 px-6 pb-2">
                  <div className="space-y-2">
                    <Label htmlFor="expense-amount">{t('amount', preferences.language as "en" | "pt" | "es")} ({preferences.currency})</Label>
                    <Input
                      id="expense-amount"
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={expenseAmountInput.displayValue}
                      onChange={(e) => expenseAmountInput.handleChange(e.target.value)}
                      className="text-lg font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expense-reason">{t('description', preferences.language as "en" | "pt" | "es")}</Label>
                    <Input
                      id="expense-reason"
                      placeholder={t('expenseExample', preferences.language as "en" | "pt" | "es")}
                      value={expenseReason}
                      onChange={(e) => setExpenseReason(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expense-category">{t('categoryOptional', preferences.language as "en" | "pt" | "es")}</Label>
                    <Select value={expenseCategory} onValueChange={setExpenseCategory}>
                      <SelectTrigger id="expense-category">
                        <SelectValue placeholder={t('autoDetectOrSelect', preferences.language as "en" | "pt" | "es")} />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id.toString()}>
                            <div className="flex items-center gap-2">
                              <span>{cat.emoji}</span>
                              <span>{cat.name}</span>
                              <div 
                                className="w-2 h-2 rounded-full ml-auto" 
                                style={{ backgroundColor: cat.color }}
                              />
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter className="gap-2 sm:gap-2">
                  <Button variant="outline" onClick={() => setIsExpenseModalOpen(false)}>
                    {t('cancel', preferences.language as "en" | "pt" | "es")}
                  </Button>
                  <Button onClick={handleAddExpense} disabled={createTransactionMutation.isPending} className="bg-red-600 hover:bg-red-700">
                    {createTransactionMutation.isPending ? t('adding', preferences.language as "en" | "pt" | "es") : t('addExpense', preferences.language as "en" | "pt" | "es")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

        {/* Bank Synchronization Section */}
        {activeGoal && (
          <BankSync goalId={activeGoal.id} />
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Recent Transactions */}
          <div className="lg:col-span-2">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">{t('recentTransactions', preferences.language as "en" | "pt" | "es")}</CardTitle>
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
                {isLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <div className="flex items-center gap-4 p-4 rounded-lg hover:bg-muted/20 transition-colors">
                          <Skeleton className="h-11 w-11 rounded-full" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-44" />
                            <Skeleton className="h-3 w-28" />
                          </div>
                          <Skeleton className="h-5 w-20" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : recentTransactions.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">{t('noTransactions', preferences.language as "en" | "pt" | "es")}</p>
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
            {isLoading ? (
              <Card className="border-0 bg-gradient-to-br from-primary/5 via-background to-purple-500/5 shadow-xl">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-7 w-44" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <Skeleton className="h-9 w-9 rounded-lg" />
                  </div>
                  <div className="flex items-center justify-center mb-6">
                    <Skeleton className="w-44 h-44 rounded-full" />
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-6 w-28" />
                    </div>
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-6 w-28" />
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-6 w-28" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : activeGoal ? (
              <>
                {/* Modern Goal Card */}
                <Card className="border-0 bg-gradient-to-br from-primary/5 via-background to-purple-500/5 shadow-xl">
                  <CardContent className="p-4 md:p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4 md:mb-6">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xl md:text-2xl font-bold text-foreground mb-1 truncate">{activeGoal.name}</h3>
                        <p className="text-xs md:text-sm text-muted-foreground">{t('savingForDream', preferences.language as "en" | "pt" | "es")}</p>
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
                    <div className="flex items-center justify-center mb-4 md:mb-6">
                      <div className="relative w-32 h-32 md:w-40 md:h-40">
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
                          <span className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
                            {progressPercentage}%
                          </span>
                          <span className="text-xs text-muted-foreground mt-1">{t('complete', preferences.language as "en" | "pt" | "es")}</span>
                        </div>
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-2 md:gap-3">
                      {/* Current Amount */}
                      <div className="bg-background/80 backdrop-blur rounded-xl md:rounded-2xl p-3 md:p-4 border border-border/50">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-6 w-6 md:h-8 md:w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Sparkles className="h-3 w-3 md:h-4 md:w-4 text-primary" />
                          </div>
                          <span className="text-[10px] md:text-xs font-medium text-muted-foreground">{t('current', preferences.language as "en" | "pt" | "es")}</span>
                        </div>
                        <p className="text-base md:text-xl font-bold text-foreground mb-1 truncate">
                          {formatCurrency(activeGoal.currentAmount, preferences.currency)}
                        </p>
                        {wiseBalance > 0 && (
                          <div className="flex items-center gap-1 text-[10px] md:text-xs text-green-600 dark:text-green-400">
                            <Wallet className="h-2.5 w-2.5 md:h-3 md:w-3" />
                            <span>+{formatCurrency(wiseBalance, preferences.currency)}</span>
                            <span className="text-muted-foreground">• {t('wiseBalance', preferences.language as "en" | "pt" | "es")}</span>
                          </div>
                        )}
                      </div>

                      {/* Target Amount */}
                      <div className="bg-background/80 backdrop-blur rounded-xl md:rounded-2xl p-3 md:p-4 border border-border/50">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-6 w-6 md:h-8 md:w-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                            <Target className="h-3 w-3 md:h-4 md:w-4 text-purple-500" />
                          </div>
                          <span className="text-[10px] md:text-xs font-medium text-muted-foreground">{t('target', preferences.language as "en" | "pt" | "es")}</span>
                        </div>
                        <p className="text-base md:text-xl font-bold text-foreground mb-1 truncate">
                          {formatCurrency(activeGoal.targetAmount, preferences.currency)}
                        </p>
                        <p className="text-[10px] md:text-xs text-primary font-medium truncate">
                          {formatCurrency(Math.max(0, activeGoal.targetAmount - activeGoal.currentAmount), preferences.currency)} {t('left', preferences.language as "en" | "pt" | "es")}
                        </p>
                      </div>
                    </div>

                    {/* Achievement Badge */}
                    {progressPercentage >= 100 && (
                      <div className="mt-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-2xl p-3 text-center">
                        <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                          {t('goalAchieved', preferences.language as "en" | "pt" | "es")}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-2 md:gap-3">
                  <Button 
                    onClick={() => setIsIncomeModalOpen(true)}
                    className="bg-gradient-to-r from-green-600 to-green-700 hover:shadow-lg hover:shadow-green-500/30 transition-all duration-300 text-white font-medium h-11 md:h-auto text-sm md:text-base"
                  >
                    <ArrowUp className="mr-1 md:mr-2 h-4 w-4" />
                    {t('addIncome', preferences.language as "en" | "pt" | "es")}
                  </Button>
                  <Button 
                    onClick={() => setIsExpenseModalOpen(true)}
                    className="bg-gradient-to-r from-red-600 to-red-700 hover:shadow-lg hover:shadow-red-500/30 transition-all duration-300 text-white font-medium h-11 md:h-auto text-sm md:text-base"
                  >
                    <ArrowDown className="mr-1 md:mr-2 h-4 w-4" />
                    {t('addExpense', preferences.language as "en" | "pt" | "es")}
                  </Button>
                </div>
              </>
            ) : (
              <Card className="bg-card border-border">
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground mb-4">{t('noActiveGoal', preferences.language as "en" | "pt" | "es")}</p>
                  <Dialog open={isNewGoalModalOpen} onOpenChange={setIsNewGoalModalOpen}>
                    <DialogTrigger asChild>
                      <Button>{t('createGoal', preferences.language as "en" | "pt" | "es")}</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{t('createNewGoal', preferences.language as "en" | "pt" | "es")}</DialogTitle>
                        <DialogDescription>{t('setNewGoal', preferences.language as "en" | "pt" | "es")}</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-5 px-6">
                        <div className="space-y-2">
                          <Label htmlFor="goal-name">{t('goalName', preferences.language as "en" | "pt" | "es")}</Label>
                          <Input
                            id="goal-name"
                            placeholder={t('goalNameExample', preferences.language as "en" | "pt" | "es")}
                            value={newGoalName}
                            onChange={(e) => setNewGoalName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="goal-target">{t('targetAmount', preferences.language as "en" | "pt" | "es")} ($)</Label>
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
                          {t('cancel', preferences.language as "en" | "pt" | "es")}
                        </Button>
                        <Button onClick={handleCreateGoal} disabled={createGoalMutation.isPending}>
                          {t('createGoal', preferences.language as "en" | "pt" | "es")}
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
              <DialogTitle>{t('editGoal', preferences.language as "en" | "pt" | "es")}</DialogTitle>
              <DialogDescription>{t('updateGoalDetails', preferences.language as "en" | "pt" | "es")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-5 px-6">
              <div className="space-y-2">
                <Label htmlFor="edit-goal-name">{t('goalName', preferences.language as "en" | "pt" | "es")}</Label>
                <Input
                  id="edit-goal-name"
                  placeholder={t('goalNameExample', preferences.language as "en" | "pt" | "es")}
                  value={editGoalName}
                  onChange={(e) => setEditGoalName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-goal-target">{t('targetAmount', preferences.language as "en" | "pt" | "es")} ($)</Label>
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
                {t('cancel', preferences.language as "en" | "pt" | "es")}
              </Button>
              <Button onClick={handleEditGoal} disabled={updateGoalMutation.isPending}>
                {t('saveChanges', preferences.language as "en" | "pt" | "es")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Congratulations Modal */}
        <Dialog open={isCongratulationsModalOpen} onOpenChange={setIsCongratulationsModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-2xl text-center">{t('congratulations', preferences.language as "en" | "pt" | "es")}</DialogTitle>
              <DialogDescription className="text-center pt-4">
                {t('goalReached', preferences.language as "en" | "pt" | "es")}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => setIsCongratulationsModalOpen(false)} className="w-full">
                {t('createNewGoal', preferences.language as "en" | "pt" | "es")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Transaction Modal */}
        <Dialog open={isEditTransactionModalOpen} onOpenChange={setIsEditTransactionModalOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader className="space-y-4">
              <div className="flex items-start gap-4">
                <div
                  className={`p-3 rounded-xl ${
                    editingTransaction?.type === "income"
                      ? "bg-primary/20 text-primary"
                      : "bg-accent/20 text-accent"
                  }`}
                >
                  {editingTransaction?.type === "income" ? (
                    <ArrowUp className="h-5 w-5" />
                  ) : (
                    <ArrowDown className="h-5 w-5" />
                  )}
                </div>
                <div className="flex-1">
                  <DialogTitle className="text-xl mb-1">
                    {editingTransaction?.type === "income" ? t('income', preferences.language as "en" | "pt" | "es") : t('expense', preferences.language as "en" | "pt" | "es")} {t('transaction', preferences.language as "en" | "pt" | "es")}
                  </DialogTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    {editingTransaction?.createdDate && (
                      <p className="text-sm text-muted-foreground">
                        {new Date(editingTransaction.createdDate).toLocaleDateString()} • {new Date(editingTransaction.createdDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                    {editingTransaction?.source && (
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                        editingTransaction.source === 'wise' 
                          ? 'bg-[#9fe870]/20 text-[#9fe870]' 
                          : editingTransaction.source === 'whatsapp'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-purple-500/20 text-purple-400'
                      }`}>
                        {editingTransaction.source === 'wise' ? 'Wise' : editingTransaction.source === 'whatsapp' ? 'WhatsApp' : 'CSV'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </DialogHeader>
            <div className="space-y-4 px-6 pb-2">
              <div className="space-y-2">
                <Label htmlFor="edit-transaction-amount">{t('amount', preferences.language as "en" | "pt" | "es")} ({editingTransaction?.currency || preferences.currency})</Label>
                <Input
                  id="edit-transaction-amount"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={editTransactionAmountInput.displayValue}
                  onChange={(e) => editTransactionAmountInput.handleChange(e.target.value)}
                  className="text-lg font-medium"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-transaction-reason">{t('description', preferences.language as "en" | "pt" | "es")}</Label>
                <Input
                  id="edit-transaction-reason"
                  placeholder={t('expenseExample', preferences.language as "en" | "pt" | "es")}
                  value={editTransactionReason}
                  onChange={(e) => setEditTransactionReason(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-transaction-category">{t('category', preferences.language as "en" | "pt" | "es")}</Label>
                <Select value={editTransactionCategory} onValueChange={setEditTransactionCategory}>
                  <SelectTrigger id="edit-transaction-category">
                    <SelectValue placeholder={t('selectCategory', preferences.language as "en" | "pt" | "es")} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        <div className="flex items-center gap-2">
                          <span>{cat.emoji}</span>
                          <span>{cat.name}</span>
                          <div 
                            className="w-2 h-2 rounded-full ml-auto" 
                            style={{ backgroundColor: cat.color }}
                          />
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button 
                variant="destructive" 
                onClick={handleDeleteTransaction}
                disabled={deleteTransactionMutation.isPending}
                className="sm:flex-initial"
              >
                {t('delete', preferences.language as "en" | "pt" | "es")}
              </Button>
              <div className="flex-1" />
              <Button variant="outline" onClick={() => setIsEditTransactionModalOpen(false)}>
                {t('cancel', preferences.language as "en" | "pt" | "es")}
              </Button>
              <Button 
                onClick={handleUpdateTransaction} 
                disabled={updateTransactionMutation.isPending}
              >
                {updateTransactionMutation.isPending ? t('updating', preferences.language as "en" | "pt" | "es") : t('update', preferences.language as "en" | "pt" | "es")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
