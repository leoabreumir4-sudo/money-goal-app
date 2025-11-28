import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Plus, Target, TrendingUp, Shield, Archive, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

export default function GoalsPage() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    targetAmount: "",
    goalType: "savings" as "savings" | "emergency" | "general",
    priority: "5",
    monthlyContribution: "",
    targetDate: "",
  });

  const { data: activeGoals, isLoading } = trpc.goals.getActive.useQuery();
  const { data: savingsGoals } = trpc.goals.getSavings.useQuery();
  const { data: emergencyFund } = trpc.goals.getEmergencyFund.useQuery();
  const { data: archivedGoals } = trpc.goals.getArchived.useQuery();

  const createGoal = trpc.goals.create.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries();
      setIsCreateOpen(false);
      setFormData({
        name: "",
        targetAmount: "",
        goalType: "savings",
        priority: "5",
        monthlyContribution: "",
        targetDate: "",
      });
    },
  });

  const updateGoal = trpc.goals.update.useMutation({
    onSuccess: () => queryClient.invalidateQueries(),
  });

  const deleteGoal = trpc.goals.delete.useMutation({
    onSuccess: () => queryClient.invalidateQueries(),
  });

  const handleCreate = () => {
    createGoal.mutate({
      name: formData.name,
      targetAmount: Math.round(parseFloat(formData.targetAmount) * 100),
      goalType: formData.goalType,
      priority: parseInt(formData.priority),
      monthlyContribution: formData.monthlyContribution ? Math.round(parseFloat(formData.monthlyContribution) * 100) : undefined,
      targetDate: formData.targetDate ? new Date(formData.targetDate) : undefined,
    });
  };

  const archiveGoal = (goalId: number) => {
    updateGoal.mutate({
      id: goalId,
      status: "archived",
      archivedDate: new Date(),
    });
  };

  const getGoalIcon = (type: string) => {
    switch (type) {
      case "emergency": return <Shield className="h-5 w-5" />;
      case "savings": return <TrendingUp className="h-5 w-5" />;
      default: return <Target className="h-5 w-5" />;
    }
  };

  const getGoalColor = (type: string) => {
    switch (type) {
      case "emergency": return "bg-red-500/10 text-red-500 border-red-500/20";
      case "savings": return "bg-green-500/10 text-green-500 border-green-500/20";
      default: return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  const allActiveGoals = [activeGoals, ...(savingsGoals || []), emergencyFund].filter(Boolean);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Financial Goals</h1>
          <p className="text-muted-foreground">Track multiple goals with priorities</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create Goal
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Goal</DialogTitle>
              <DialogDescription>Set a financial target to work towards</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Goal Name</Label>
                <Input
                  placeholder="Emergency Fund, Vacation, New Car..."
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Target Amount ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="5000.00"
                  value={formData.targetAmount}
                  onChange={(e) => setFormData({ ...formData, targetAmount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Goal Type</Label>
                <Select value={formData.goalType} onValueChange={(v: any) => setFormData({ ...formData, goalType: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="savings">💰 Savings Goal</SelectItem>
                    <SelectItem value="emergency">🛡️ Emergency Fund</SelectItem>
                    <SelectItem value="general">🎯 General Goal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Priority (1-10)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Monthly Goal ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="500"
                    value={formData.monthlyContribution}
                    onChange={(e) => setFormData({ ...formData, monthlyContribution: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Target Date (Optional)</Label>
                <Input
                  type="date"
                  value={formData.targetDate}
                  onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!formData.name || !formData.targetAmount}>
                Create Goal
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Emergency Fund Highlight */}
      {emergencyFund && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-red-500" />
              <CardTitle>Emergency Fund</CardTitle>
              <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
                Priority {emergencyFund.priority}
              </Badge>
            </div>
            <CardDescription>{emergencyFund.name}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-semibold">
                  ${(emergencyFund.currentAmount / 100).toFixed(2)} / ${(emergencyFund.targetAmount / 100).toFixed(2)}
                </span>
              </div>
              <Progress value={(emergencyFund.currentAmount / emergencyFund.targetAmount) * 100} className="h-3" />
              <p className="text-xs text-muted-foreground">
                {((emergencyFund.currentAmount / emergencyFund.targetAmount) * 100).toFixed(1)}% complete
              </p>
            </div>
            {emergencyFund.monthlyContribution && (
              <p className="text-sm text-muted-foreground">
                Monthly goal: ${(emergencyFund.monthlyContribution / 100).toFixed(2)}
              </p>
            )}
            {emergencyFund.targetDate && (
              <p className="text-sm text-muted-foreground">
                Target: {format(new Date(emergencyFund.targetDate), "MMM dd, yyyy")}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Active Goals Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {savingsGoals?.map((goal) => {
          const percentage = (goal.currentAmount / goal.targetAmount) * 100;
          
          return (
            <Card key={goal.id} className={getGoalColor(goal.goalType)}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {getGoalIcon(goal.goalType)}
                    <div>
                      <CardTitle className="text-lg">{goal.name}</CardTitle>
                      <CardDescription className="capitalize">{goal.goalType} Goal</CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Badge variant="outline">P{goal.priority}</Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => archiveGoal(goal.id)}
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-semibold">
                      ${(goal.currentAmount / 100).toFixed(2)} / ${(goal.targetAmount / 100).toFixed(2)}
                    </span>
                  </div>
                  <Progress value={percentage} className="h-2" />
                  <p className="text-xs text-muted-foreground">{percentage.toFixed(1)}% complete</p>
                </div>
                <div className="flex items-center justify-between text-sm">
                  {goal.monthlyContribution && (
                    <span className="text-muted-foreground">
                      Monthly: ${(goal.monthlyContribution / 100).toFixed(2)}
                    </span>
                  )}
                  {goal.targetDate && (
                    <span className="text-muted-foreground">
                      {format(new Date(goal.targetDate), "MMM yyyy")}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Archived Goals */}
      {archivedGoals && archivedGoals.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Archive className="h-5 w-5" />
            Archived Goals
          </h2>
          <div className="grid gap-3 md:grid-cols-3">
            {archivedGoals.map((goal) => (
              <Card key={goal.id} className="opacity-60">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{goal.name}</CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteGoal.mutate({ id: goal.id })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    ${(goal.currentAmount / 100).toFixed(2)} / ${(goal.targetAmount / 100).toFixed(2)}
                  </p>
                  {goal.archivedDate && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Archived {format(new Date(goal.archivedDate), "MMM dd, yyyy")}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {allActiveGoals.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No active goals yet</p>
            <Button onClick={() => setIsCreateOpen(true)}>Create Your First Goal</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
