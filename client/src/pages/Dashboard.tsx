import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { ArrowDown, ArrowUp, Pencil, Sparkles, Wallet } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { BankSync } from "@/components/BankSync";
import { usePreferences } from "@/contexts/PreferencesContext";
import { t } from "@/lib/i18n";
import { formatCurrency } from "@/lib/currency";

export default function Dashboard() {
  const { preferences } = usePreferences();
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isNewGoalModalOpen, setIsNewGoalModalOpen] = useState(false);
  const [isEditGoalModalOpen, setIsEditGoalModalOpen] = useState(false);
  const [isCongratulationsModalOpen, setIsCongratulationsModalOpen] = useState(false);
  
  const [incomeAmount, setIncomeAmount] = useState("");
  const [incomeReason, setIncomeReason] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseReason, setExpenseReason] = useState("");
  const [newGoalName, setNewGoalName] = useState("");
  const [newGoalTarget, setNewGoalTarget] = useState("");
  const [editGoalName, setEditGoalName] = useState("");
  const [editGoalTarget, setEditGoalTarget] = useState("");

  const utils = trpc.useUtils();
  const { data: activeGoal, isLoading: goalLoading } = trpc.goals.getActive.useQuery();
  const { data: transactions = [] } = trpc.transactions.getAll.useQuery();
  const { data: wiseBalance = 0 } = trpc.wise.getTotalBalanceConverted.useQuery();

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
      toast.success("Goal updated successfully!");
    },
  });

  const createTransactionMutation = trpc.transactions.create.useMutation({
    onSuccess: (_, variables) => {
      utils.transactions.getAll.invalidate();
      utils.goals.getActive.invalidate();
      
      if (variables.type === "income") {
        setIsIncomeModalOpen(false);
        setIncomeAmount("");
        setIncomeReason("");
      } else {
        setIsExpenseModalOpen(false);
        setExpenseAmount("");
        setExpenseReason("");
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
    
    const amount = Math.round(parseFloat(incomeAmount) * 100);
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
    });
  };

  const handleAddExpense = () => {
    if (!activeGoal) {
      toast.error("Please create a goal first!");
      return;
    }
    
    const amount = Math.round(parseFloat(expenseAmount) * 100);
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
    });
  };

  const handleCreateGoal = () => {
    const targetAmount = Math.round(parseFloat(newGoalTarget) * 100);
    if (isNaN(targetAmount) || targetAmount <= 0) {
      toast.error("Please enter a valid target amount");
      return;
    }
    
    if (!newGoalName.trim()) {
      toast.error("Please enter a goal name");
      return;
    }

    createGoalMutation.mutate({
      name: newGoalName,
      targetAmount,
    });
  };

  const handleEditGoal = () => {
    if (!activeGoal) return;
    
    const targetAmount = Math.round(parseFloat(editGoalTarget) * 100);
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
      setEditGoalTarget((activeGoal.targetAmount / 100).toString());
      setIsEditGoalModalOpen(true);
    }
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
        <div className="flex justify-between items-center gap-4">
          <h1 className="text-3xl font-bold text-foreground">{t('dashboard', preferences.language)}</h1>
          <div className="flex gap-3">
            <Dialog open={isIncomeModalOpen} onOpenChange={setIsIncomeModalOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90">
                  <ArrowUp className="mr-2 h-4 w-4" />
                  {t('addIncome', preferences.language)}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Income</DialogTitle>
                  <DialogDescription>Record a new income transaction for your goal.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="income-amount">Amount ($)</Label>
                    <Input
                      id="income-amount"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={incomeAmount}
                      onChange={(e) => setIncomeAmount(e.target.value)}
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
                <Button className="bg-accent hover:bg-accent/90">
                  <ArrowDown className="mr-2 h-4 w-4" />
                  {t('addExpense', preferences.language)}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Expense</DialogTitle>
                  <DialogDescription>Record a new expense transaction for your goal.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="expense-amount">Amount ($)</Label>
                    <Input
                      id="expense-amount"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={expenseAmount}
                      onChange={(e) => setExpenseAmount(e.target.value)}
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
              </CardHeader>
              <CardContent>
                {recentTransactions.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">{t('noTransactions', preferences.language)}</p>
                ) : (
                  <div className="space-y-3">
                    {recentTransactions.map((transaction) => (
                      <div
                        key={transaction.id}
                        className="flex items-center justify-between p-4 rounded-lg bg-secondary/50"
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
                              {transaction.source && (
                                <span className="px-2 py-0.5 text-xs rounded-full bg-purple-500/20 text-purple-400 font-medium">
                                  {transaction.source === 'wise' ? 'Wise' : 'CSV'}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {new Date(transaction.createdDate).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <p
                          className={`font-semibold ${
                            transaction.type === "income" ? "text-primary" : "text-accent"
                          }`}
                        >
                          {transaction.type === "income" ? "+" : "-"}
                          {formatCurrency(transaction.amount, preferences.currency)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Goal Progress */}
          <div className="space-y-6">
            {activeGoal ? (
              <>
                <Card className="bg-card border-border">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <Sparkles className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t('completed', preferences.language)}</p>
                        <p className="text-2xl font-bold text-foreground">{progressPercentage}%</p>
                      </div>
                    </div>
                  </CardHeader>
                </Card>

                <Card className="bg-card border-border">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-foreground">{activeGoal.name}</CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={openEditGoalModal}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t('currentAmount', preferences.language)}</span>
                        <span className="font-semibold text-foreground">
                          {formatCurrency(activeGoal.currentAmount, preferences.currency)}
                        </span>
                      </div>
                      {wiseBalance > 0 && (
                        <div className="flex justify-between text-xs pl-4 py-1">
                          <span className="text-muted-foreground/80 flex items-center gap-1.5">
                            <Wallet className="h-3 w-3 text-purple-400" />
                            Includes Wise balance
                          </span>
                          <span className="text-muted-foreground/80">
                            {formatCurrency(wiseBalance, preferences.currency)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t('targetAmount', preferences.language)}</span>
                        <span className="font-semibold text-foreground">
                          {formatCurrency(activeGoal.targetAmount, preferences.currency)}
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all duration-500"
                        style={{ width: `${progressPercentage}%` }}
                      />
                    </div>
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
                      <div className="space-y-4 py-4">
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
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={newGoalTarget}
                            onChange={(e) => setNewGoalTarget(e.target.value)}
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
            <div className="space-y-4 py-4">
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
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={editGoalTarget}
                  onChange={(e) => setEditGoalTarget(e.target.value)}
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
      </div>
    </DashboardLayout>
  );
}
