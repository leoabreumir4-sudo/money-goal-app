import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Loader2, Send, Sparkles, TrendingUp, Target, PauseCircle } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { usePreferences } from "@/contexts/PreferencesContext";
import { t } from "@/lib/i18n";
import { toast } from "sonner";
import AIMessage from "@/components/AIMessage";
import { useIsMobile } from "@/hooks/useMobile";

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
  const isMobile = useIsMobile();
  const { preferences } = usePreferences();
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("Analisando...");
  const [optimisticMessages, setOptimisticMessages] = useState<any[]>([]);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  
  const { data: chatHistory = [], refetch } = trpc.chat.getHistory.useQuery();
  const { data: suggestedPrompts = [] } = trpc.chat.getSuggestedPrompts.useQuery();
  // Welcome insights disabled for now
  const welcomeData: { userName?: string; insights?: string[] } | null = null;
  const chatMutation = trpc.chat.sendMessage.useMutation();
  const clearHistoryMutation = trpc.chat.clearHistory.useMutation();

  // Combine real chat history with optimistic messages
  const messages = [...chatHistory, ...optimisticMessages].map(msg => ({
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

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading || messagesRemaining === 0) return;

    const userMessage = inputMessage.trim();
    setInputMessage("");
    
    // Show user message immediately (optimistic UI)
    const optimisticUserMessage = {
      id: Date.now(),
      userId: "current",
      role: "user" as const,
      content: userMessage,
      createdDate: new Date(),
    };
    
    setOptimisticMessages([optimisticUserMessage]);
    setIsLoading(true);
    
    // Set dynamic loading status based on message content (translated)
    const lang = preferences.language as "en" | "pt" | "es";
    if (/\b(quanto custa|custo|pre[çc]o|or[çc]amento|viagem|hotel|passagem|voo|flight|price|cost|budget)\b/i.test(userMessage)) {
      setLoadingStatus(t("searchingWeb", lang));
    } else if (/\b(converter|conversão|câmbio|dólar|real|exchange)\b/i.test(userMessage)) {
      setLoadingStatus(t("checkingExchangeRate", lang));
    } else if (/\b(gastos|despesas|spending|expenses|categorias)\b/i.test(userMessage)) {
      setLoadingStatus(t("analyzingSpending", lang));
    } else if (/\b(meta|goal|objetivo|poupar|save)\b/i.test(userMessage)) {
      setLoadingStatus(t("calculatingGoals", lang));
    } else if (/\b(oi|olá|hi|hello)\b/i.test(userMessage)) {
      setLoadingStatus(t("preparingGreeting", lang));
    } else {
      setLoadingStatus(t("thinking", lang));
    }

    try {
      await chatMutation.mutateAsync({ message: userMessage });
      
      // Refetch to get real history with AI response
      await refetch();
      
      // Only clear optimistic message AFTER refetch completes successfully
      setOptimisticMessages([]);
    } catch (error: any) {
      console.error("Chat error:", error);
      
      // Remove optimistic message on error
      setOptimisticMessages([]);
      
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

  // Scroll to bottom automatically when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current && !showScrollButton) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistory, optimisticMessages, showScrollButton]);

  // Handle scroll to detect if user scrolled up
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isNearBottom);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

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
      <div className={`flex flex-col ${isMobile ? 'h-[calc(100vh-4rem)] p-3' : 'h-[calc(100vh-2rem)] p-6'}`}>
        {/* Header */}
        <div className={`flex items-center justify-between ${isMobile ? 'mb-3' : 'mb-6'}`}>
          <div className="flex items-center gap-3">
            <div className={`rounded-xl bg-gradient-to-br from-primary via-primary/90 to-primary/80 shadow-lg flex items-center justify-center ${isMobile ? 'h-10 w-10' : 'h-14 w-14'}`}>
              <Sparkles className={`text-primary-foreground ${isMobile ? 'h-5 w-5' : 'h-7 w-7'}`} />
            </div>
            <div>
              <h1 className={`font-bold text-foreground ${isMobile ? 'text-xl' : 'text-3xl'}`}>Moni</h1>
              <p className={`text-muted-foreground ${isMobile ? 'text-[10px]' : 'text-sm'}`}>
                {preferences.language === 'pt' ? 'Sua Consultora Financeira Inteligente' : 
                 preferences.language === 'es' ? 'Tu Asesora Financiera Inteligente' : 
                 'Your Intelligent Financial Advisor'}
              </p>
            </div>
          </div>
          {messages.length > 0 && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleClearHistory}
              disabled={clearHistoryMutation.isPending}
              className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50 transition-all"
            >
              Clear History
            </Button>
          )}
        </div>

        {/* Chat Messages */}
        <Card className="flex-1 flex flex-col overflow-hidden bg-gradient-to-br from-card to-card/80 border-border/50 shadow-xl relative">
          <CardContent className={`flex-1 overflow-y-auto space-y-4 relative ${isMobile ? 'p-3' : 'p-6'}`} ref={messagesContainerRef}>
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                <div className={`rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-primary/80 shadow-lg flex items-center justify-center ${isMobile ? 'h-16 w-16' : 'h-24 w-24'}`}>
                  <Sparkles className={`text-primary-foreground ${isMobile ? 'h-8 w-8' : 'h-12 w-12'}`} />
                </div>
                <div>
                  <h2 className={`font-bold text-foreground ${isMobile ? 'text-xl mb-2' : 'text-3xl mb-3'}`}>
                    Hello! 👋
                  </h2>
                  <p className={`text-muted-foreground max-w-md ${isMobile ? 'mb-2 text-xs' : 'mb-4 text-base'}`}>
                    I have access to all your financial data and can help you make smart money decisions. Ask me anything!
                  </p>
                </div>
                <div className="space-y-3 w-full max-w-2xl">
                  <p className="text-sm text-muted-foreground font-semibold">💡 Suggested questions based on your finances:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {suggestedPrompts.map((question, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        className="text-left h-auto py-4 px-4 whitespace-normal justify-start hover:bg-gradient-to-r hover:from-primary/10 hover:to-primary/5 hover:border-primary/50 transition-all duration-200 hover:shadow-md"
                        onClick={() => handlePromptClick(question)}
                      >
                        <span className="text-sm font-medium">{question}</span>
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
                      className={`max-w-[80%] rounded-xl p-4 shadow-md ${
                        message.role === "user"
                          ? "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground shadow-primary/20"
                          : "bg-gradient-to-br from-secondary to-secondary/80 text-secondary-foreground"
                      }`}
                    >
                      {message.role === "assistant" ? (
                        <>
                          <AIMessage content={message.content} />
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
                    <div className="max-w-[80%] rounded-xl p-4 bg-gradient-to-br from-secondary to-secondary/80 text-secondary-foreground shadow-md">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm font-medium">{loadingStatus}</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </CardContent>
          
          {/* Scroll to bottom button */}
          {showScrollButton && messages.length > 0 && (
            <button
              onClick={scrollToBottom}
              className="absolute bottom-32 right-6 bg-gradient-to-br from-primary to-primary/90 hover:shadow-xl hover:shadow-primary/30 text-primary-foreground rounded-full p-3 shadow-lg transition-all duration-200 z-20 hover:scale-110"
              aria-label="Scroll to bottom"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
          )}

          {/* Input Area */}
          <div className="p-4 border-t border-border/50 bg-gradient-to-b from-transparent to-card/50">
            {messagesRemaining < 10 && (
              <div className="mb-3 text-xs text-center">
                {messagesRemaining > 0 ? (
                  <span className="px-3 py-1.5 rounded-full bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20 font-medium">⚠️ {messagesRemaining} messages remaining today</span>
                ) : (
                  <span className="px-3 py-1.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20 font-medium">❌ Daily limit reached. Try again in 24 hours.</span>
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
                className="flex-1 bg-background/50 border-border/50 focus:border-primary/50 transition-colors"
              />
              <Button
                onClick={handleSendMessage}
                disabled={isLoading || !inputMessage.trim() || messagesRemaining === 0}
                size="icon"
                className="bg-gradient-to-br from-primary to-primary/90 hover:shadow-lg hover:shadow-primary/30 transition-all"
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
