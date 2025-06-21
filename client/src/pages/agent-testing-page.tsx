import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Agent } from "@shared/schema";
import { Bot, User, Send, Trash2, Download, Copy, Code, ExternalLink, MessageSquare, BarChart3, Zap } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MultimediaTest } from "@/components/multimedia-test";

interface AgentTestingPageProps {
  selectedAgentId?: number | null;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isTyping?: boolean;
}

export default function AgentTestingPage({ selectedAgentId }: AgentTestingPageProps) {
  const [currentAgentId, setCurrentAgentId] = useState<number | null>(selectedAgentId || null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isWebchatModalOpen, setIsWebchatModalOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

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
      setIsTyping(false);
      setMessages(prev => [
        ...prev.filter(msg => !msg.isTyping),
        { role: "assistant", content: data.response, timestamp: new Date() },
      ]);
      setInputMessage("");
    },
    onError: (error: Error) => {
      setIsTyping(false);
      setMessages(prev => prev.filter(msg => !msg.isTyping));
      toast({
        title: "Erro no teste",
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

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (currentAgent && messages.length === 0) {
      setMessages([{
        role: "assistant",
        content: `Olá! Sou o ${currentAgent.name}. Como posso ajudar você hoje?`,
        timestamp: new Date()
      }]);
    }
  }, [currentAgent]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = () => {
    if (!inputMessage.trim() || !currentAgentId || testMutation.isPending) return;

    const userMessage = inputMessage.trim();
    setMessages(prev => [
      ...prev,
      { role: "user", content: userMessage, timestamp: new Date() }
    ]);

    setIsTyping(true);
    setMessages(prev => [
      ...prev,
      { role: "assistant", content: "Digitando...", timestamp: new Date(), isTyping: true }
    ]);

    testMutation.mutate({ agentId: currentAgentId, message: userMessage });
    setInputMessage("");
  };

  const clearChat = () => {
    if (currentAgent) {
      setMessages([{
        role: "assistant",
        content: `Olá! Sou o ${currentAgent.name}. Como posso ajudar você hoje?`,
        timestamp: new Date()
      }]);
    } else {
      setMessages([]);
    }
  };

  const exportChat = () => {
    const chatData = {
      agent: currentAgent?.name,
      timestamp: new Date().toISOString(),
      messages: messages.filter(msg => !msg.isTyping).map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp.toISOString(),
      })),
    };

    const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${currentAgent?.name}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Conversa exportada",
      description: "Histórico da conversa foi baixado como arquivo JSON.",
    });
  };

  const generateWebchatCode = (agentId: number) => {
    const baseUrl = window.location.origin;
    return `<!-- Webchat do Agente AI -->
<div id="ai-webchat-${agentId}"></div>
<script>
  (function() {
    const script = document.createElement('script');
    script.src = '${baseUrl}/webchat.js';
    script.onload = function() {
      AIWebchat.init({
        agentId: ${agentId},
        containerId: 'ai-webchat-${agentId}',
        apiUrl: '${baseUrl}/api',
        theme: {
          primaryColor: '#022b44',
          accentColor: '#b8ec00',
          borderRadius: '8px'
        },
        position: 'bottom-right',
        title: '${currentAgent?.name || "Assistente AI"}',
        subtitle: 'Como posso ajudar você hoje?',
        placeholder: 'Digite sua mensagem...',
        height: '500px',
        width: '350px'
      });
    };
    document.head.appendChild(script);
  })();
</script>`;
  };

  const copyWebchatCode = () => {
    if (!currentAgentId) return;
    
    const code = generateWebchatCode(currentAgentId);
    navigator.clipboard.writeText(code).then(() => {
      toast({
        title: "Código copiado!",
        description: "O código do webchat foi copiado para a área de transferência.",
      });
    }).catch(() => {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar o código. Tente novamente.",
        variant: "destructive",
      });
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar com seleção de agente */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Header do Sidebar */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 rounded-lg" style={{ backgroundColor: '#022b44' }}>
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold" style={{ color: '#022b44' }}>
                Teste de Agentes
              </h1>
              <p className="text-sm text-gray-500">Teste e valide seus agentes</p>
            </div>
          </div>

          {/* Seleção de Agente */}
          <div className="space-y-3">
            <label className="text-sm font-medium" style={{ color: '#022b44' }}>
              Agente para Teste
            </label>
            <Select value={currentAgentId?.toString()} onValueChange={(value) => {
              setCurrentAgentId(parseInt(value));
              setMessages([]);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um agente" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id.toString()}>
                    <div className="flex items-center space-x-2">
                      <Bot className="h-4 w-4" />
                      <span>{agent.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Detalhes do Agente */}
        {currentAgent && (
          <div className="p-6 space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium" style={{ color: '#022b44' }}>
                  {currentAgent.name}
                </h3>
                <Badge 
                  variant={currentAgent.status === "active" ? "default" : "secondary"}
                  style={{ 
                    backgroundColor: currentAgent.status === "active" ? '#b8ec00' : '#94a3b8', 
                    color: currentAgent.status === "active" ? '#022b44' : '#ffffff'
                  }}
                >
                  {currentAgent.status === "active" ? "Ativo" : 
                   currentAgent.status === "testing" ? "Testando" : "Rascunho"}
                </Badge>
              </div>
              
              <p className="text-sm text-gray-600">{currentAgent.description}</p>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Modelo:</span>
                  <span className="font-medium" style={{ color: '#022b44' }}>{currentAgent.model}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Temperatura:</span>
                  <span className="font-medium" style={{ color: '#022b44' }}>{currentAgent.temperature}</span>
                </div>
                {currentAgent.language && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Idioma:</span>
                    <span className="font-medium" style={{ color: '#022b44' }}>{currentAgent.language}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Ações */}
            <div className="space-y-2 pt-4 border-t">
              <Button
                onClick={() => setIsWebchatModalOpen(true)}
                variant="outline"
                size="sm"
                className="w-full justify-start transition-all"
                style={{ borderColor: '#022b44', color: '#022b44' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#022b44';
                  e.currentTarget.style.color = '#FFFFFF';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#022b44';
                }}
              >
                <Code className="h-4 w-4 mr-2" />
                Código Webchat
              </Button>
              
              <Button
                onClick={exportChat}
                variant="outline"
                size="sm"
                className="w-full justify-start transition-all"
                disabled={messages.filter(m => !m.isTyping).length <= 1}
                style={{ 
                  borderColor: '#022b44', 
                  color: messages.filter(m => !m.isTyping).length <= 1 ? '#94a3b8' : '#022b44'
                }}
                onMouseEnter={(e) => {
                  if (!e.currentTarget.disabled) {
                    e.currentTarget.style.backgroundColor = '#022b44';
                    e.currentTarget.style.color = '#FFFFFF';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!e.currentTarget.disabled) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#022b44';
                  }
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar Conversa
              </Button>
              
              <Button
                onClick={clearChat}
                variant="outline"
                size="sm"
                className="w-full justify-start transition-all"
                disabled={messages.filter(m => !m.isTyping).length <= 1}
                style={{ 
                  borderColor: '#022b44', 
                  color: messages.filter(m => !m.isTyping).length <= 1 ? '#94a3b8' : '#022b44'
                }}
                onMouseEnter={(e) => {
                  if (!e.currentTarget.disabled) {
                    e.currentTarget.style.backgroundColor = '#022b44';
                    e.currentTarget.style.color = '#FFFFFF';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!e.currentTarget.disabled) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#022b44';
                  }
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Limpar Conversa
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Área principal do chat */}
      <div className="flex-1 flex flex-col">
        {currentAgent ? (
          <>
            {/* Header do Chat */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-full" style={{ backgroundColor: '#b8ec00' }}>
                    <Bot className="h-5 w-5" style={{ color: '#022b44' }} />
                  </div>
                  <div>
                    <h2 className="font-semibold" style={{ color: '#022b44' }}>
                      {currentAgent.name}
                    </h2>
                    <div className="flex items-center space-x-1">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: '#b8ec00' }}></div>
                      <span className="text-sm text-gray-500">Conectado</span>
                    </div>
                  </div>
                </div>
                
                <Button
                  size="sm"
                  style={{ backgroundColor: '#b8ec00', color: '#022b44' }}
                  className="transition-all"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#022b44';
                    e.currentTarget.style.color = '#FFFFFF';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#b8ec00';
                    e.currentTarget.style.color = '#022b44';
                  }}
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Ativo
                </Button>
              </div>
            </div>

            {/* Área de Mensagens */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex items-start space-x-3 ${
                    message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                  }`}
                >
                  <div className={`p-2 rounded-full ${
                    message.role === 'user' 
                      ? 'border' 
                      : message.isTyping 
                        ? 'bg-yellow-100' 
                        : 'border'
                  }`}
                  style={{
                    backgroundColor: message.role === 'user' 
                      ? 'rgba(2, 43, 68, 0.1)' 
                      : message.isTyping 
                        ? '#fef3c7' 
                        : 'rgba(184, 236, 0, 0.1)',
                    borderColor: message.role === 'user' 
                      ? '#022b44' 
                      : message.isTyping 
                        ? '#fbbf24'
                        : '#b8ec00'
                  }}>
                    {message.role === 'user' ? (
                      <User className="h-4 w-4" style={{ color: '#022b44' }} />
                    ) : (
                      <Bot className="h-4 w-4" style={{ color: message.isTyping ? '#fbbf24' : '#022b44' }} />
                    )}
                  </div>
                  
                  <div className={`max-w-2xl ${message.role === 'user' ? 'text-right' : ''}`}>
                    <div className={`inline-block p-4 rounded-2xl shadow-sm border ${
                      message.role === 'user'
                        ? 'text-white'
                        : 'bg-white'
                    }`}
                    style={{
                      backgroundColor: message.role === 'user' ? '#022b44' : '#ffffff',
                      borderColor: message.role === 'user' ? '#022b44' : '#e5e7eb'
                    }}
                    >
                      {message.isTyping ? (
                        <div className="flex items-center space-x-1">
                          <span>Digitando</span>
                          <div className="flex space-x-1">
                            <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce"></div>
                            <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                            <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                          </div>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      )}
                    </div>
                    
                    <div className={`mt-1 text-xs ${message.role === 'user' ? 'text-right' : ''}`} style={{ color: '#6b7280' }}>
                      {message.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input de Mensagem */}
            <div className="bg-white border-t p-6" style={{ borderColor: '#e5e7eb' }}>
              <div className="flex items-end space-x-3">
                <div className="flex-1">
                  <textarea
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Digite sua mensagem..."
                    className="w-full px-4 py-3 border rounded-2xl resize-none focus:outline-none transition-all"
                    style={{ 
                      borderColor: '#d1d5db',
                      outline: 'none'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#022b44';
                      e.target.style.boxShadow = '0 0 0 3px rgba(2, 43, 68, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#d1d5db';
                      e.target.style.boxShadow = 'none';
                    }}
                    rows={1}
                    disabled={testMutation.isPending}
                  />
                </div>
                
                <Button
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || testMutation.isPending}
                  size="lg"
                  className="rounded-full p-3"
                  style={{ backgroundColor: '#b8ec00', color: '#022b44' }}
                  onMouseEnter={(e) => {
                    if (!e.currentTarget.disabled) {
                      e.currentTarget.style.backgroundColor = '#022b44';
                      e.currentTarget.style.color = '#FFFFFF';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!e.currentTarget.disabled) {
                      e.currentTarget.style.backgroundColor = '#b8ec00';
                      e.currentTarget.style.color = '#022b44';
                    }
                  }}
                >
                  <Send className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          /* Estado sem agente selecionado */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="p-6 rounded-full bg-gray-100 inline-block mb-4">
                <MessageSquare className="h-12 w-12 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2" style={{ color: '#022b44' }}>
                Selecione um Agente
              </h3>
              <p className="text-gray-500 max-w-md">
                Escolha um agente no painel lateral para começar a testar suas conversas
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Modal do Código Webchat */}
      <Dialog open={isWebchatModalOpen} onOpenChange={setIsWebchatModalOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle style={{ color: '#022b44' }}>
              Código do Webchat - {currentAgent?.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="rounded-lg p-4" style={{ backgroundColor: 'rgba(2, 43, 68, 0.05)', borderColor: '#022b44', borderWidth: '1px' }}>
              <h4 className="text-sm font-medium mb-2" style={{ color: '#022b44' }}>📋 Como usar:</h4>
              <ul className="text-sm space-y-1" style={{ color: '#022b44' }}>
                <li>• Copie o código abaixo e cole no HTML do seu site</li>
                <li>• O webchat aparecerá automaticamente no canto da página</li>
                <li>• Personalize as cores e posição através dos parâmetros</li>
                <li>• O código já inclui as cores da sua marca (#022b44 e #b8ec00)</li>
              </ul>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium" style={{ color: '#022b44' }}>
                  Código HTML para integração:
                </label>
                <Button
                  onClick={copyWebchatCode}
                  size="sm"
                  style={{ backgroundColor: '#b8ec00', color: '#022b44' }}
                  className="transition-all"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#022b44';
                    e.currentTarget.style.color = '#FFFFFF';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#b8ec00';
                    e.currentTarget.style.color = '#022b44';
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar Código
                </Button>
              </div>
              
              <div className="relative">
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto max-h-96">
                  <code>{currentAgentId ? generateWebchatCode(currentAgentId) : ''}</code>
                </pre>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <Button 
                variant="outline" 
                onClick={() => setIsWebchatModalOpen(false)}
                style={{ borderColor: '#022b44', color: '#022b44' }}
                className="transition-all"
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#022b44';
                  e.currentTarget.style.color = '#FFFFFF';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#022b44';
                }}
              >
                Fechar
              </Button>
              <Button
                onClick={() => window.open('/docs/webchat', '_blank')}
                style={{ backgroundColor: '#b8ec00', color: '#022b44' }}
                className="transition-all"
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#022b44';
                  e.currentTarget.style.color = '#FFFFFF';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#b8ec00';
                  e.currentTarget.style.color = '#022b44';
                }}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Ver Documentação
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Multimedia Testing Section */}
      {currentAgent && (
        <div className="mt-6">
          <MultimediaTest agentId={currentAgent.id} />
        </div>
      )}
    </div>
  );
}