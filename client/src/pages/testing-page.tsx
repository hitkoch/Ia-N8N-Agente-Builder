import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Agent } from "@shared/schema";
import { Bot, User, Send, Trash2, Download, Share, BarChart } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import ChatInterface from "@/components/chat-interface";

interface TestingPageProps {
  selectedAgentId?: number | null;
}

export default function TestingPage({ selectedAgentId }: TestingPageProps) {
  const [currentAgentId, setCurrentAgentId] = useState<number | null>(selectedAgentId || null);
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string; timestamp: Date }>>([]);
  const [inputMessage, setInputMessage] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const currentAgent = agents.find(a => a.id === currentAgentId);

  const testMutation = useMutation({
    mutationFn: async ({ agentId, message }: { agentId: number; message: string }) => {
      const res = await apiRequest("POST", `/api/agents/${agentId}/test`, { message });
      return await res.json();
    },
    onSuccess: (data, variables) => {
      setMessages(prev => [
        ...prev,
        { role: "user", content: variables.message, timestamp: new Date() },
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

  useEffect(() => {
    if (selectedAgentId && selectedAgentId !== currentAgentId) {
      setCurrentAgentId(selectedAgentId);
      setMessages([]);
    }
  }, [selectedAgentId, currentAgentId]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !currentAgentId || testMutation.isPending) return;
    
    testMutation.mutate({
      agentId: currentAgentId,
      message: inputMessage.trim(),
    });
  };

  const clearChat = () => {
    setMessages([]);
  };

  const sendTestMessage = (message: string) => {
    if (!currentAgentId) return;
    testMutation.mutate({
      agentId: currentAgentId,
      message,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">Agent Testing</h3>
          <p className="text-sm text-slate-600 mt-1">Test your AI agents in real-time</p>
        </div>
        <div className="flex items-center space-x-4">
          <Select value={currentAgentId?.toString() || ""} onValueChange={(value) => {
            setCurrentAgentId(parseInt(value));
            setMessages([]);
          }}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select an agent" />
            </SelectTrigger>
            <SelectContent>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id.toString()}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={clearChat}>
            <Trash2 className="h-4 w-4 mr-2" />
            Clear Chat
          </Button>
        </div>
      </div>

      {!currentAgent ? (
        <div className="text-center py-12">
          <div className="h-24 w-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Bot className="h-12 w-12 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-900 mb-2">Select an agent to test</h3>
          <p className="text-slate-600">Choose an agent from the dropdown above to start testing</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Chat Interface */}
          <div className="lg:col-span-3">
            <Card className="h-96 flex flex-col">
              {/* Chat Header */}
              <CardHeader className="pb-4">
                <div className="flex items-center">
                  <div className="h-8 w-8 bg-primary/10 rounded-lg flex items-center justify-center mr-3">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">{currentAgent.name}</h4>
                    <p className="text-xs text-slate-500">{currentAgent.model} • Temperature: {currentAgent.temperature}</p>
                  </div>
                  <div className="ml-auto flex items-center">
                    <div className="h-2 w-2 bg-green-500 rounded-full mr-2"></div>
                    <span className="text-xs text-slate-600">Online</span>
                  </div>
                </div>
              </CardHeader>

              {/* Chat Messages */}
              <CardContent className="flex-1 overflow-y-auto space-y-4 pb-4">
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
                            ? "bg-primary text-white"
                            : "bg-slate-100 text-slate-900"
                        }`}>
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {message.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
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
                  />
                  <Button 
                    type="submit" 
                    disabled={!inputMessage.trim() || testMutation.isPending}
                    size="icon"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </Card>
          </div>

          {/* Agent Settings Panel */}
          <div className="space-y-6">
            {/* Current Agent Info */}
            <Card>
              <CardHeader>
                <h5 className="text-sm font-semibold text-slate-900">Current Agent</h5>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Model:</span>
                  <span className="text-slate-900 font-medium">{currentAgent.model}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Temperature:</span>
                  <span className="text-slate-900 font-medium">{currentAgent.temperature}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Max Tokens:</span>
                  <span className="text-slate-900 font-medium">{currentAgent.maxTokens}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Status:</span>
                  <Badge variant={currentAgent.status === "active" ? "default" : "secondary"}>
                    {currentAgent.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <h5 className="text-sm font-semibold text-slate-900">Quick Actions</h5>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="ghost" size="sm" className="w-full justify-start">
                  <Download className="h-4 w-4 mr-2" />
                  Export Conversation
                </Button>
                <Button variant="ghost" size="sm" className="w-full justify-start">
                  <Share className="h-4 w-4 mr-2" />
                  Share Test Results
                </Button>
                <Button variant="ghost" size="sm" className="w-full justify-start">
                  <BarChart className="h-4 w-4 mr-2" />
                  View Analytics
                </Button>
              </CardContent>
            </Card>

            {/* Test Templates */}
            <Card>
              <CardHeader>
                <h5 className="text-sm font-semibold text-slate-900">Test Templates</h5>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full justify-start"
                  onClick={() => sendTestMessage("Hello, can you help me?")}
                >
                  Basic Greeting
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full justify-start"
                  onClick={() => sendTestMessage("What are your pricing plans?")}
                >
                  Pricing Inquiry
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full justify-start"
                  onClick={() => sendTestMessage("I need technical support")}
                >
                  Support Request
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
