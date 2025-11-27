import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { Trash, Trophy, Calendar, TrendingUp, Archive, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { usePreferences } from "@/contexts/PreferencesContext";
import { t } from "@/lib/i18n";
import { formatCurrency } from "@/lib/currency";

export default function Archived() {
  const { preferences } = usePreferences();
  const utils = trpc.useUtils();
  const { data: archivedGoals = [], isLoading } = trpc.goals.getArchived.useQuery();

  const deleteGoalMutation = trpc.goals.delete.useMutation({
    onSuccess: () => {
      utils.goals.getArchived.invalidate();
      toast.success(t("goalDeletedPermanently", preferences.language));
    },
  });

  const handleDeleteGoal = (id: number) => {
    if (confirm(t("deleteGoalConfirm", preferences.language))) {
      deleteGoalMutation.mutate({ id });
    }
  };

  // Calculate statistics
  const totalGoalsCompleted = archivedGoals.length;
  const totalAmountSaved = archivedGoals.reduce((sum, goal) => sum + goal.currentAmount, 0);
  const totalTarget = archivedGoals.reduce((sum, goal) => sum + goal.targetAmount, 0);
  const averageCompletion = totalTarget > 0 ? Math.round((totalAmountSaved / totalTarget) * 100) : 0;

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 flex items-center justify-center">
              <Archive className="h-6 w-6 text-purple-500" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-foreground">{t("archivedGoals", preferences.language)}</h1>
              <p className="text-lg text-muted-foreground">{t("viewCompletedGoals", preferences.language)}</p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <>
            {/* Statistics Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="bg-muted/30 border-border">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-lg" />
                      <Skeleton className="h-5 w-32" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Skeleton className="h-8 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Goals Skeleton */}
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="bg-muted/30 border-border">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Skeleton className="h-14 w-14 rounded-full" />
                        <div className="space-y-2">
                          <Skeleton className="h-6 w-48" />
                          <Skeleton className="h-4 w-32" />
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-16" />
                          <Skeleton className="h-6 w-24" />
                        </div>
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-6 w-28" />
                        </div>
                        <Skeleton className="h-9 w-9 rounded-lg" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-full rounded-full" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Statistics Cards */}
            {archivedGoals.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20 hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                        <Trophy className="h-5 w-5 text-green-500" />
                      </div>
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        {t("totalCompleted", preferences.language) || "Metas Concluídas"}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                      {totalGoalsCompleted}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("allTimeAchievements", preferences.language) || "Conquistas de todos os tempos"}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20 hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <TrendingUp className="h-5 w-5 text-blue-500" />
                      </div>
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        {t("totalSaved", preferences.language) || "Total Economizado"}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                      {formatCurrency(totalAmountSaved / 100, preferences.currency)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("acrossAllGoals", preferences.language) || "Através de todas as metas"}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20 hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                        <CheckCircle2 className="h-5 w-5 text-purple-500" />
                      </div>
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        {t("averageCompletion", preferences.language) || "Taxa Média"}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                      {averageCompletion}%
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("completionRate", preferences.language) || "Taxa de conclusão"}
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Archived Goals List */}
            {archivedGoals.length === 0 ? (
              <Card className="bg-gradient-to-br from-card to-card/50 border-border">
                <CardContent className="py-20">
                  <div className="text-center">
                    <div className="h-20 w-20 rounded-full bg-gradient-to-br from-purple-500/20 to-purple-600/10 mx-auto mb-6 flex items-center justify-center">
                      <Archive className="h-10 w-10 text-purple-500" />
                    </div>
                    <h3 className="text-2xl font-bold text-foreground mb-3">{t("noArchivedGoalsTitle", preferences.language)}</h3>
                    <p className="text-muted-foreground text-lg max-w-md mx-auto">
                      {t("completeGoalsToSee", preferences.language)}
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
                  const isOverAchieved = progress > 100;
                  const completedDate = new Date(goal.completedDate || goal.createdDate);

                  return (
                    <Card 
                      key={goal.id} 
                      className="bg-gradient-to-br from-card to-card/80 border-border hover:shadow-xl transition-all duration-300 group"
                    >
                      <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                              <Trophy className="h-7 w-7 text-primary" />
                            </div>
                            <div>
                              <CardTitle className="text-foreground text-xl mb-1">{goal.name}</CardTitle>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Calendar className="h-3.5 w-3.5" />
                                <span>
                                  {t("completedOn", preferences.language)} {completedDate.toLocaleDateString(preferences.language === 'pt' ? 'pt-BR' : preferences.language === 'es' ? 'es-ES' : 'en-US', { 
                                    day: 'numeric', 
                                    month: 'long', 
                                    year: 'numeric' 
                                  })}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{t("target", preferences.language)}</p>
                              <p className="text-xl font-bold text-foreground">
                                {formatCurrency(goal.targetAmount / 100, preferences.currency)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{t("finalAmount", preferences.language)}</p>
                              <p className={`text-xl font-bold ${isOverAchieved ? 'text-green-600 dark:text-green-400' : 'text-primary'}`}>
                                {formatCurrency(goal.currentAmount / 100, preferences.currency)}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteGoal(goal.id)}
                              className="hover:bg-destructive/10 hover:text-destructive transition-colors"
                              disabled={deleteGoalMutation.isPending}
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground font-medium">{t("progress", preferences.language)}</span>
                            <div className="flex items-center gap-2">
                              <span className={`font-bold ${progress >= 100 ? 'text-green-600 dark:text-green-400' : 'text-primary'}`}>
                                {progress}%
                              </span>
                              <span className="text-muted-foreground">{t("completed", preferences.language)}</span>
                              {progress >= 100 && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                            </div>
                          </div>
                          <div className="relative w-full bg-secondary/50 rounded-full h-3 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                progress >= 100 
                                  ? 'bg-gradient-to-r from-green-500 to-green-600' 
                                  : 'bg-gradient-to-r from-primary to-purple-600'
                              }`}
                              style={{ width: `${Math.min(progress, 100)}%` }}
                            />
                            {progress >= 100 && (
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                            )}
                          </div>
                          {isOverAchieved && (
                            <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                              <Trophy className="h-4 w-4 text-green-500" />
                              <p className="text-sm text-green-700 dark:text-green-400 font-medium">
                                🎉 {t("exceededGoal", preferences.language) || "Meta superada!"} +{formatCurrency((goal.currentAmount - goal.targetAmount) / 100, preferences.currency)}
                              </p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
