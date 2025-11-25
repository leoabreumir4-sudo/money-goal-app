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

const COLORS = ['#22c55e', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export default function Spending() {
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
      toast.success("Recurring expense added successfully!");
    },
  });

  const deleteRecurringMutation = trpc.recurringExpenses.delete.useMutation({
    onSuccess: () => {
      utils.recurringExpenses.getAll.invalidate();
      toast.success("Recurring expense deleted!");
    },
  });

  const handleAddRecurring = () => {
    const amount = Math.round(parseFloat(recurringAmount) * 100);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    
    if (!recurringName.trim()) {
      toast.error("Please enter a name");
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
    return expenseTransactions.reduce((sum, t) => sum + t.amount, 0);
  }, [expenseTransactions]);

  // Group expenses by category (using reason as category for now)
  const expensesByCategory = useMemo(() => {
    const grouped: Record<string, number> = {};
    expenseTransactions.forEach(t => {
      const category = t.reason || "Uncategorized";
      grouped[category] = (grouped[category] || 0) + t.amount;
    });
    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [expenseTransactions]);

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
            <h1 className="text-3xl font-bold">Spending Analysis</h1>
            <p className="text-muted-foreground">See where your money goes</p>
          </div>
          <Button onClick={() => setIsAddRecurringModalOpen(true)} className="bg-purple-600 hover:bg-purple-700">
            <Plus className="mr-2 h-4 w-4" />
            Recurring Expense
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-4 items-center">
          <div className="flex gap-2">
            <Button
              variant={filterType === "All" ? "default" : "outline"}
              onClick={() => setFilterType("All")}
            >
              All
            </Button>
            <Button
              variant={filterType === "By Category" ? "default" : "outline"}
              onClick={() => setFilterType("By Category")}
            >
              By Category
            </Button>
            <Button
              variant={filterType === "Fixed vs Variable" ? "default" : "outline"}
              onClick={() => setFilterType("Fixed vs Variable")}
            >
              Fixed vs Variable
            </Button>
          </div>

          <Select defaultValue="This Month">
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="This Month">This Month</SelectItem>
              <SelectItem value="Last Month">Last Month</SelectItem>
              <SelectItem value="Last 3 Months">Last 3 Months</SelectItem>
              <SelectItem value="This Year">This Year</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant={showOnlyRecurring ? "default" : "outline"}
            onClick={() => setShowOnlyRecurring(!showOnlyRecurring)}
          >
            Show Only Recurring
          </Button>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Spending Distribution (Pie Chart) */}
          <Card>
            <CardHeader>
              <CardTitle>Spending Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {pieChartData.length === 0 ? (
                <div className="h-80 flex items-center justify-center text-muted-foreground">
                  No spending data available
                </div>
              ) : (
                <div className="space-y-4">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="text-center">
                    <div className="text-sm text-muted-foreground">Total Spending</div>
                    <div className="text-3xl font-bold">${(totalSpending / 100).toFixed(2)}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* By Category */}
          <Card>
            <CardHeader>
              <CardTitle>By Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {expensesByCategory.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No expenses yet
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
                            <div className="font-bold">${(item.value / 100).toFixed(2)} • {percentage.toFixed(1)}%</div>
                            <div className="text-xs text-green-500">↑ 0.0% vs previous</div>
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
            <CardTitle>Recurring Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recurringExpenses.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No recurring expenses yet</p>
              ) : (
                recurringExpenses.map(expense => (
                  <div key={expense.id} className="flex justify-between items-center p-4 rounded-lg border">
                    <div>
                      <div className="font-medium">{expense.name}</div>
                      <div className="text-sm text-muted-foreground capitalize">{expense.frequency}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-lg font-bold text-red-500">
                        ${(expense.amount / 100).toFixed(2)}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm("Are you sure you want to delete this recurring expense?")) {
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
            <CardTitle>Insights & Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <div className="font-semibold text-blue-500">💡 Spending Tip</div>
                <p className="text-sm mt-1">
                  Your largest expense category is {expensesByCategory[0]?.name || "N/A"}. 
                  Consider reviewing these expenses for potential savings.
                </p>
              </div>
              
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="font-semibold text-green-500">✓ Good Job!</div>
                <p className="text-sm mt-1">
                  You're tracking your expenses consistently. Keep it up!
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Add Recurring Expense Modal */}
        <Dialog open={isAddRecurringModalOpen} onOpenChange={setIsAddRecurringModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Recurring Expense</DialogTitle>
              <DialogDescription>
                Add an expense that repeats regularly
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="recurringName">Name</Label>
                <Input
                  id="recurringName"
                  value={recurringName}
                  onChange={(e) => setRecurringName(e.target.value)}
                  placeholder="e.g., Netflix, Gym Membership"
                />
              </div>

              <div>
                <Label htmlFor="recurringAmount">Amount ($)</Label>
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
                <Label htmlFor="recurringFrequency">Frequency</Label>
                <Select value={recurringFrequency} onValueChange={(v: any) => setRecurringFrequency(v)}>
                  <SelectTrigger id="recurringFrequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddRecurringModalOpen(false)}>Cancel</Button>
              <Button onClick={handleAddRecurring}>Add Expense</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
