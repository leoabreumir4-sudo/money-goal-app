import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Loader2, Send, Sparkles, TrendingUp, Target, PauseCircle } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Streamdown } from "streamdown";
import { usePreferences } from "@/contexts/PreferencesContext";
import { t } from "@/lib/i18n";
import { toast } from "sonner";

// Component to render action buttons based on AI suggestions
function ActionButtons({ content, onAction }: { content: string; onAction: (action: string) => void }) {
  const actions: { label: string; action: string; icon: any; variant?: "default" | "outline" | "destructive" }[] = [];
  
  // Detect if AI suggests creating a goal
  if (content.toLowerCase().includes("create a goal") || content.toLowerCase().includes("set a goal")) {
    actions.push({
      label: "Create Goal",
      action: "create_goal",
      icon: Target,
      variant: "default"
    });
  }
  
  // Detect if AI suggests pausing/canceling expenses
  if (content.toLowerCase().includes("pause") || content.toLowerCase().includes("cancel") || 
      content.toLowerCase().includes("subscription")) {
    actions.push({
      label: "Manage Subscriptions",
      action: "manage_subscriptions",
      icon: PauseCircle,
      variant: "outline"
    });
  }
  
  // Detect if AI talks about savings/investment
  if (content.toLowerCase().includes("save") || content.toLowerCase().includes("saving")) {
    actions.push({
      label: "View Savings Tips",
      action: "savings_tips",
      icon: TrendingUp,
      variant: "outline"
    });
  }
  
  if (actions.length === 0) return null;
  
  return (
    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border/50">
      {actions.map((action, idx) => {
        const Icon = action.icon;
        return (
          <Button
            key={idx}
            variant={action.variant || "outline"}
            size="sm"
            onClick={() => onAction(action.action)}
            className="text-xs"
          >
            <Icon className="h-3 w-3 mr-1" />
            {action.label}
          </Button>
        );
      })}
    </div>
  );
}

export default function Chat() {
  const { preferences } = usePreferences();
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { data: chatHistory = [], refetch } = trpc.chat.getHistory.useQuery();
  const { data: suggestedPrompts = [] } = trpc.chat.getSuggestedPrompts.useQuery();
  const chatMutation = trpc.chat.sendMessage.useMutation();
  const clearHistoryMutation = trpc.chat.clearHistory.useMutation();

  // Convert chat history to messages format
  const messages = chatHistory.map(msg => ({
    role: msg.role as "user" | "assistant",
    content: msg.content,
  }));

  // Calculate messages sent in last 24h
  const userMessagesLast24h = chatHistory.filter((msg) => {
    if (msg.role !== "user") return false;
    const msgDate = new Date(msg.createdDate);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return msgDate >= oneDayAgo;
  }).length;
  
  const messagesRemaining = Math.max(0, 50 - userMessagesLast24h);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading || messagesRemaining === 0) return;

    const userMessage = inputMessage.trim();
    setInputMessage("");
    setIsLoading(true);

    try {
      await chatMutation.mutateAsync({ message: userMessage });
      
      // Refetch to get updated history
      await refetch();
    } catch (error: any) {
      console.error("Chat error:", error);
      
      // Show specific error messages
      if (error.message?.includes("Rate limit")) {
        toast.error("Daily message limit reached. Try again tomorrow!");
      } else if (error.message?.includes("Invalid response")) {
        toast.error("AI service unavailable. Please try again.");
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (confirm("Are you sure you want to clear all chat history?")) {
      await clearHistoryMutation.mutateAsync();
      await refetch();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handlePromptClick = (prompt: string) => {
    setInputMessage(prompt);
    // Auto-send after a small delay so user sees it
    setTimeout(() => {
      handleSendMessage();
    }, 100);
  };

  const handleAction = (action: string) => {
    switch (action) {
      case "create_goal":
        window.location.href = "/dashboard"; // Redirect to dashboard to create goal
        toast.success("Navigate to Dashboard to create a new goal");
        break;
      case "manage_subscriptions":
        window.location.href = "/spending"; // Redirect to spending page
        toast.success("Navigate to Spending page to manage subscriptions");
        break;
      case "savings_tips":
        setInputMessage("Give me 5 specific tips to increase my savings rate");
        setTimeout(() => handleSendMessage(), 100);
        break;
      default:
        break;
    }
  };

  const suggestedQuestions = [
    "Can I travel to Orlando in 2026?",
    "How are my spending habits?",
    "What can I cut to save more?",
    "Am I on track with my goal?",
    "Create a savings plan for me",
    "Should I pause any subscriptions?",
  ];

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-2rem)] flex flex-col p-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">MoneyGoal Advisor</h1>
              <p className="text-sm text-muted-foreground">Your AI Financial Advisor</p>
            </div>
          </div>
          {messages.length > 0 && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleClearHistory}
              disabled={clearHistoryMutation.isPending}
            >
              Clear History
            </Button>
          )}
        </div>

        {/* Chat Messages */}
        <Card className="flex-1 flex flex-col overflow-hidden bg-card border-border">
          <CardContent className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                <div className="h-20 w-20 rounded-full bg-primary/20 flex items-center justify-center">
                  <Sparkles className="h-10 w-10 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">Hello! I'm your Financial Advisor 👋</h2>
                  <p className="text-muted-foreground max-w-md">
                    I have access to all your financial data and can help you make smart money decisions. Ask me anything!
                  </p>
                </div>
                <div className="space-y-2 w-full max-w-2xl">
                  <p className="text-sm text-muted-foreground font-medium">💡 Suggested questions based on your finances:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {suggestedPrompts.map((question, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        className="text-left h-auto py-3 px-4 whitespace-normal justify-start"
                        onClick={() => handlePromptClick(question)}
                      >
                        <span className="text-sm">{question}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-4 ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground"
                      }`}
                    >
                      {message.role === "assistant" ? (
                        <>
                          <Streamdown>{message.content}</Streamdown>
                          <ActionButtons content={message.content} onAction={handleAction} />
                        </>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="max-w-[80%] rounded-lg p-4 bg-secondary text-secondary-foreground">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Analyzing your finances...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </CardContent>

          {/* Input Area */}
          <div className="p-4 border-t border-border">
            {messagesRemaining < 10 && (
              <div className="mb-2 text-xs text-muted-foreground text-center">
                {messagesRemaining > 0 ? (
                  <span>⚠️ {messagesRemaining} messages remaining today</span>
                ) : (
                  <span className="text-destructive">❌ Daily limit reached. Try again in 24 hours.</span>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="Ask me anything about your finances..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isLoading}
                className="flex-1"
              />
              <Button
                onClick={handleSendMessage}
                disabled={isLoading || !inputMessage.trim() || messagesRemaining === 0}
                size="icon"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
