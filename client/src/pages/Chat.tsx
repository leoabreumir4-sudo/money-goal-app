import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Loader2, Send, Sparkles } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Streamdown } from "streamdown";
import { usePreferences } from "@/contexts/PreferencesContext";
import { t } from "@/lib/i18n";

export default function Chat() {
  const { preferences } = usePreferences();
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { data: chatHistory = [], refetch } = trpc.chat.getHistory.useQuery();
  const chatMutation = trpc.chat.sendMessage.useMutation();
  const clearHistoryMutation = trpc.chat.clearHistory.useMutation();

  // Convert chat history to messages format
  const messages = chatHistory.map(msg => ({
    role: msg.role as "user" | "assistant",
    content: msg.content,
  }));

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = inputMessage.trim();
    setInputMessage("");
    setIsLoading(true);

    try {
      await chatMutation.mutateAsync({ message: userMessage });
      
      // Refetch to get updated history
      await refetch();
    } catch (error) {
      console.error("Chat error:", error);
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
                  <p className="text-sm text-muted-foreground font-medium">💡 Try asking:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {suggestedQuestions.map((question, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        className="text-left h-auto py-3 px-4 whitespace-normal"
                        onClick={() => {
                          setInputMessage(question);
                        }}
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
                        <Streamdown>{message.content}</Streamdown>
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
                        <span className="text-sm">{t("thinking", preferences.language)}</span>
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
                disabled={isLoading || !inputMessage.trim()}
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
