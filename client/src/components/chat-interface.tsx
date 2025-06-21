import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Agent } from "@shared/schema";
import { Bot, User, Send, Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ChatInterfaceProps {
  agent: Agent;
  className?: string;
}

export default function ChatInterface({ agent, className = "" }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const testMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await apiRequest("POST", `/api/agents/${agent.id}/test`, { message });
      return await res.json();
    },
    onSuccess: (data, variables) => {
      setMessages(prev => [
        ...prev,
        { role: "user", content: variables, timestamp: new Date() },
        { role: "assistant", content: data.response, timestamp: new Date() },
      ]);
      setInputMessage("");
    },
    onError: (error: Error) => {
      toast({
        title: "Test failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || testMutation.isPending) return;
    
    testMutation.mutate(inputMessage.trim());
  };

  const clearChat = () => {
    setMessages([]);
  };

  const addWelcomeMessage = () => {
    const welcomeMessage: Message = {
      role: "assistant",
      content: `Hello! I'm ${agent.name}. How can I help you today?`,
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);
  };

  useEffect(() => {
    // Add welcome message when component mounts or agent changes
    if (messages.length === 0) {
      addWelcomeMessage();
    }
  }, [agent.id]);

  return (
    <Card className={`flex flex-col h-96 ${className}`}>
      {/* Chat Header */}
      <CardHeader className="pb-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="h-8 w-8 bg-primary/10 rounded-lg flex items-center justify-center mr-3">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900">{agent.name}</h4>
              <p className="text-xs text-slate-500">
                {agent.model} • Temperature: {agent.temperature}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center">
              <div className="h-2 w-2 bg-green-500 rounded-full mr-2"></div>
              <span className="text-xs text-slate-600">Online</span>
            </div>
            <Badge variant={agent.status === "active" ? "default" : "secondary"}>
              {agent.status}
            </Badge>
            <Button variant="outline" size="sm" onClick={clearChat}>
              Clear
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* Chat Messages */}
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-full p-4">
          <div className="space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-8">
                <Bot className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">Start a conversation with your AI agent</p>
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex items-start space-x-3 ${
                    message.role === "user" ? "flex-row-reverse space-x-reverse" : ""
                  }`}
                >
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    message.role === "user" 
                      ? "bg-slate-200" 
                      : "bg-primary/10"
                  }`}>
                    {message.role === "user" ? (
                      <User className="h-4 w-4 text-slate-600" />
                    ) : (
                      <Bot className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div className={`flex-1 ${message.role === "user" ? "text-right" : ""}`}>
                    <div className={`rounded-xl p-3 inline-block max-w-[80%] ${
                      message.role === "user"
                        ? "chat-message-user"
                        : "chat-message-assistant"
                    }`}>
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {message.timestamp.toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </p>
                  </div>
                </div>
              ))
            )}
            {testMutation.isPending && (
              <div className="flex items-start space-x-3">
                <div className="h-8 w-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="bg-muted rounded-xl p-3 inline-block">
                    <div className="flex items-center space-x-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <p className="text-sm text-muted-foreground">Thinking...</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </CardContent>

      {/* Chat Input */}
      <div className="p-4 border-t border-slate-200">
        <form onSubmit={handleSendMessage} className="flex space-x-3">
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Type your message..."
            disabled={testMutation.isPending}
            className="flex-1"
            autoFocus
          />
          <Button 
            type="submit" 
            disabled={!inputMessage.trim() || testMutation.isPending}
            size="icon"
          >
            {testMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>
    </Card>
  );
}
