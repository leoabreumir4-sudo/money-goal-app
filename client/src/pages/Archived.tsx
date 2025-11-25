import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Trash } from "lucide-react";
import { toast } from "sonner";

export default function Archived() {
  const utils = trpc.useUtils();
  const { data: archivedGoals = [] } = trpc.goals.getArchived.useQuery();

  const deleteGoalMutation = trpc.goals.delete.useMutation({
    onSuccess: () => {
      utils.goals.getArchived.invalidate();
      toast.success("Goal deleted permanently!");
    },
  });

  const handleDeleteGoal = (id: number) => {
    if (confirm("Are you sure you want to permanently delete this goal?")) {
      deleteGoalMutation.mutate({ id });
    }
  };

  return (
    <DashboardLayout>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Archived Goals</h1>
          <p className="text-muted-foreground">View your completed financial goals</p>
        </div>

        {/* Archived Goals List */}
        {archivedGoals.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="py-16">
              <div className="text-center">
                <div className="h-16 w-16 rounded-full bg-secondary mx-auto mb-4 flex items-center justify-center">
                  <span className="text-3xl">🎯</span>
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">No Archived Goals</h3>
                <p className="text-muted-foreground">
                  Complete your goals on the Dashboard to see them here!
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {archivedGoals.map((goal) => {
              const progress = goal.targetAmount > 0 
                ? Math.min(Math.round((goal.currentAmount / goal.targetAmount) * 100), 100)
                : 0;

              return (
                <Card key={goal.id} className="bg-card border-border">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                          <span className="text-2xl">🎯</span>
                        </div>
                        <div>
                          <CardTitle className="text-foreground">{goal.name}</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            Completed {new Date(goal.completedDate || goal.createdDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Target</p>
                          <p className="text-lg font-semibold text-foreground">
                            ${(goal.targetAmount / 100).toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Final Amount</p>
                          <p className="text-lg font-semibold text-primary">
                            ${(goal.currentAmount / 100).toLocaleString()}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteGoal(goal.id)}
                        >
                          <Trash className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium text-foreground">{progress}% Completed</span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-3 overflow-hidden">
                        <div
                          className="bg-primary h-full rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
