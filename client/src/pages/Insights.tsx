import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingUp, AlertTriangle, Trophy, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

export default function InsightsPage() {
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: insights, isLoading } = trpc.aiInsights.getAll.useQuery({ limit: 20 });
  const { data: unread } = trpc.aiInsights.getUnread.useQuery();

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

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  const allInsights = insights || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI Financial Insights</h1>
          <p className="text-muted-foreground">AI-powered analysis and predictions</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => generateAlerts.mutate()}
            disabled={generateAlerts.isPending}
          >
            {generateAlerts.isPending ? "Generating..." : "Check Alerts"}
          </Button>
          <Button
            variant="outline"
            onClick={() => generateAchievements.mutate()}
            disabled={generateAchievements.isPending}
          >
            {generateAchievements.isPending ? "Checking..." : "Check Achievements"}
          </Button>
          <Button
            onClick={handleGenerateForecast}
            disabled={isGenerating}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            {isGenerating ? "Generating..." : "Generate Forecast"}
          </Button>
        </div>
      </div>

      {/* Unread Count */}
      {unread && unread.length > 0 && (
        <Card className="border-purple-500/20 bg-purple-500/5">
          <CardContent className="pt-6">
            <p className="text-sm">
              <span className="font-semibold">{unread.length}</span> new insight{unread.length !== 1 ? "s" : ""} waiting for you
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
                  <Badge variant="secondary" className="bg-purple-500 text-white">New</Badge>
                </div>
              )}
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {getTypeIcon(insight.type)}
                    <div>
                      <CardTitle className="text-lg">{insight.title}</CardTitle>
                      <CardDescription>
                        {format(new Date(insight.createdDate), "MMM dd, yyyy 'at' h:mm a")}
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteInsight.mutate({ id: insight.id })}
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
                      <p className="text-xs text-muted-foreground">Monthly Income</p>
                      <p className="text-lg font-semibold">${parsedData.avgMonthlyIncome?.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Monthly Expenses</p>
                      <p className="text-lg font-semibold">${parsedData.avgMonthlyExpense?.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Monthly Savings</p>
                      <p className="text-lg font-semibold text-green-500">
                        ${parsedData.monthlySavings?.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Annual Projection</p>
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
                    Mark as Read
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {allInsights.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No insights yet</p>
            <Button onClick={handleGenerateForecast} disabled={isGenerating}>
              Generate Your First Forecast
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
