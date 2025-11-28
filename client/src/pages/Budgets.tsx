import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, AlertTriangle, AlertCircle, XCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function BudgetsPage() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    categoryId: "",
    period: "monthly" as "weekly" | "monthly" | "yearly",
    limitAmount: "",
    alertThreshold: "75",
  });

  const { data: budgets, isLoading: budgetsLoading } = trpc.budgets.getAll.useQuery();
  const { data: statusData } = trpc.budgets.checkStatus.useQuery();
  const { data: categories } = trpc.categories.getAll.useQuery();

  const createBudget = trpc.budgets.create.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries();
      setIsCreateOpen(false);
      setFormData({ categoryId: "", period: "monthly", limitAmount: "", alertThreshold: "75" });
    },
  });

  const deleteBudget = trpc.budgets.delete.useMutation({
    onSuccess: () => queryClient.invalidateQueries(),
  });

  const handleCreate = () => {
    createBudget.mutate({
      categoryId: parseInt(formData.categoryId),
      period: formData.period,
      limitAmount: Math.round(parseFloat(formData.limitAmount) * 100),
      alertThreshold: parseInt(formData.alertThreshold),
    });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "warning": return "text-yellow-500 bg-yellow-500/10 border-yellow-500/20";
      case "danger": return "text-orange-500 bg-orange-500/10 border-orange-500/20";
      case "critical": return "text-red-500 bg-red-500/10 border-red-500/20";
      default: return "";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "warning": return <AlertTriangle className="h-5 w-5" />;
      case "danger": return <AlertCircle className="h-5 w-5" />;
      case "critical": return <XCircle className="h-5 w-5" />;
      default: return null;
    }
  };

  if (budgetsLoading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  const alerts = statusData?.alerts || [];
  const activeBudgets = budgets?.filter(b => b.isActive) || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Budget Planning</h1>
          <p className="text-muted-foreground">Set spending limits and track your budget</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create Budget
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Budget</DialogTitle>
              <DialogDescription>Set a spending limit for a category</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={formData.categoryId} onValueChange={(v) => setFormData({ ...formData, categoryId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {cat.emoji} {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Period</Label>
                <Select value={formData.period} onValueChange={(v: any) => setFormData({ ...formData, period: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Budget Limit ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="1000.00"
                  value={formData.limitAmount}
                  onChange={(e) => setFormData({ ...formData, limitAmount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Alert Threshold (%)</Label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  placeholder="75"
                  value={formData.alertThreshold}
                  onChange={(e) => setFormData({ ...formData, alertThreshold: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Get alerts when spending reaches this percentage</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!formData.categoryId || !formData.limitAmount}>
                Create Budget
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">⚠️ Budget Alerts</h2>
          {alerts.map((alert) => {
            const category = categories?.find(c => c.id === alert.categoryId);
            return (
              <Card key={alert.budgetId} className={`border ${getSeverityColor(alert.severity)}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    {getSeverityIcon(alert.severity)}
                    <CardTitle className="text-base">
                      {category?.emoji} {category?.name}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{alert.message}</p>
                  <Progress value={alert.percentage} className="mt-2" />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Budgets Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {activeBudgets.map((budget) => {
          const category = categories?.find(c => c.id === budget.categoryId);
          const percentage = (budget.currentSpent / budget.limitAmount) * 100;
          const spent = budget.currentSpent / 100;
          const limit = budget.limitAmount / 100;
          
          return (
            <Card key={budget.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    {category?.emoji} {category?.name}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteBudget.mutate({ id: budget.id })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <CardDescription className="capitalize">{budget.period}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Spent</span>
                    <span className="font-medium">${spent.toFixed(2)} / ${limit.toFixed(2)}</span>
                  </div>
                  <Progress value={percentage} className="h-2" />
                  <p className="text-xs text-muted-foreground">{percentage.toFixed(0)}% used</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {activeBudgets.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">No budgets yet</p>
            <Button onClick={() => setIsCreateOpen(true)}>Create Your First Budget</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
