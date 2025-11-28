import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingUp, AlertTriangle, Trophy, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import DashboardLayout from "@/components/DashboardLayout";

export default function InsightsPage() {
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: insights, isLoading } = trpc.aiInsights.getAll.useQuery({ limit: 20 });
  const { data: unread } = trpc.aiInsights.getUnread.useQuery();
  const { data: dataAvailability, isLoading: dataCheckLoading } = trpc.aiInsights.checkDataAvailability.useQuery();

  const generateForecast = trpc.aiInsights.generateForecast.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries();
      setIsGenerating(false);
    },
    onError: () => setIsGenerating(false),
  });

  const generateAlerts = trpc.aiInsights.generateAlerts.useMutation({
    onSuccess: () => queryClient.invalidateQueries(),
  });

  const generateAchievements = trpc.aiInsights.generateAchievements.useMutation({
    onSuccess: () => queryClient.invalidateQueries(),
  });

  const markAsRead = trpc.aiInsights.markAsRead.useMutation({
    onSuccess: () => queryClient.invalidateQueries(),
  });

  const deleteInsight = trpc.aiInsights.delete.useMutation({
    onSuccess: () => queryClient.invalidateQueries(),
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "forecast": return <TrendingUp className="h-5 w-5" />;
      case "alert": return <AlertTriangle className="h-5 w-5" />;
      case "achievement": return <Trophy className="h-5 w-5" />;
      default: return <Sparkles className="h-5 w-5" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "forecast": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "alert": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "achievement": return "bg-green-500/10 text-green-500 border-green-500/20";
      case "suggestion": return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      default: return "";
    }
  };

  const handleGenerateForecast = () => {
    setIsGenerating(true);
    generateForecast.mutate();
  };

  if (isLoading || dataCheckLoading) {
    return (
      <DashboardLayout>
        <div className="container mx-auto p-6 flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
        </div>
      </DashboardLayout>
    );
  }

  const allInsights = insights || [];

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Insights Financeiros com IA</h1>
          <p className="text-muted-foreground">Análise e predições geradas por IA</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => generateAlerts.mutate()}
            disabled={generateAlerts.isPending || !dataAvailability?.canGenerateAlerts}
            title={!dataAvailability?.canGenerateAlerts ? `Precisa de mais ${3 - (dataAvailability?.transactionCount || 0)} transações` : ""}
          >
            {generateAlerts.isPending ? "Gerando..." : "Verificar Alertas"}
          </Button>
          <Button
            variant="outline"
            onClick={() => generateAchievements.mutate()}
            disabled={generateAchievements.isPending || !dataAvailability?.canGenerateAchievements}
            title={!dataAvailability?.canGenerateAchievements ? "Crie sua primeira meta para desbloquear conquistas" : ""}
          >
            {generateAchievements.isPending ? "Verificando..." : "Verificar Conquistas"}
          </Button>
          <Button
            onClick={handleGenerateForecast}
            disabled={isGenerating || !dataAvailability?.canGenerateForecast}
            className="gap-2"
            title={!dataAvailability?.canGenerateForecast ? `Precisa de mais ${5 - (dataAvailability?.transactionCount || 0)} transações` : ""}
          >
            <Sparkles className="h-4 w-4" />
            {isGenerating ? "Gerando..." : "Gerar Previsão"}
          </Button>
        </div>
      </div>

      {/* Unread Count */}
      {unread && unread.length > 0 && (
        <Card className="border-purple-500/20 bg-purple-500/5">
          <CardContent className="pt-6">
            <p className="text-sm">
              <span className="font-semibold">{unread.length}</span> {unread.length !== 1 ? "novos insights esperando por você" : "novo insight esperando por você"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Insights Feed */}
      <div className="space-y-4">
        {allInsights.map((insight) => {
          const isUnread = !insight.isRead;
          let parsedData = null;
          
          try {
            if (insight.data) {
              parsedData = JSON.parse(insight.data);
            }
          } catch (e) {
            // Ignore parse errors
          }

          return (
            <Card
              key={insight.id}
              className={`relative ${isUnread ? "border-purple-500/30 shadow-lg" : ""} ${getTypeColor(insight.type)}`}
            >
              {isUnread && (
                <div className="absolute top-3 right-3">
                  <Badge variant="secondary" className="bg-purple-500 text-white">Novo</Badge>
                </div>
              )}
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {getTypeIcon(insight.type)}
                    <div>
                      <CardTitle className="text-lg">{insight.title}</CardTitle>
                      <CardDescription>
                        {format(new Date(insight.createdDate), "dd 'de' MMM, yyyy 'às' HH:mm")}
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteInsight.mutate({ id: insight.id })}
                    title="Excluir insight"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <p className="whitespace-pre-wrap">{insight.message}</p>
                </div>

                {/* Show data if it's a forecast */}
                {insight.type === "forecast" && parsedData && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                    <div>
                      <p className="text-xs text-muted-foreground">Receita Mensal</p>
                      <p className="text-lg font-semibold">${parsedData.avgMonthlyIncome?.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Despesas Mensais</p>
                      <p className="text-lg font-semibold">${parsedData.avgMonthlyExpense?.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Poupança Mensal</p>
                      <p className="text-lg font-semibold text-green-500">
                        ${parsedData.monthlySavings?.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Projeção Anual</p>
                      <p className="text-lg font-semibold text-green-500">
                        ${parsedData.projectedAnnualSavings?.toFixed(2)}
                      </p>
                    </div>
                  </div>
                )}

                {isUnread && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => markAsRead.mutate({ id: insight.id })}
                  >
                    Marcar como Lido
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Data Availability Status */}
      {dataAvailability && !dataAvailability.canGenerateForecast && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="py-6">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              </div>
              <div className="space-y-2 flex-1">
                <h3 className="font-semibold text-yellow-700 dark:text-yellow-400">Começando com Insights de IA</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Você tem <span className="font-semibold">{dataAvailability.transactionCount}</span> transações. Aqui está o que você precisa para desbloquear todos os recursos:
                </p>
                <div className="space-y-1">
                  {dataAvailability.recommendations.map((rec, idx) => (
                    <div key={idx} className="text-sm text-muted-foreground flex items-center gap-2">
                      <div className="w-1 h-1 bg-yellow-500 rounded-full" />
                      {rec}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" asChild>
                    <a href="/spending">Adicionar Transações</a>
                  </Button>
                  {!dataAvailability.hasGoals && (
                    <Button size="sm" variant="outline" asChild>
                      <a href="/goals">Criar Metas</a>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {allInsights.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">Nenhum insight ainda</p>
            {dataAvailability?.canGenerateForecast ? (
              <Button onClick={handleGenerateForecast} disabled={isGenerating}>
                Gerar Sua Primeira Previsão
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">Adicione mais transações para desbloquear previsões</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
    </DashboardLayout>
  );
}
