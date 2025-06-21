import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Agent } from "@shared/schema";
import { Bot, User, Send, Trash2, Download, Share, BarChart, Copy, Code, ExternalLink } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import ChatInterface from "@/components/chat-interface";
import Sidebar from "@/components/sidebar";

interface TestingPageProps {
  selectedAgentId?: number | null;
}

export default function TestingPage({ selectedAgentId }: TestingPageProps) {
  const [currentAgentId, setCurrentAgentId] = useState<number | null>(selectedAgentId || null);
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string; timestamp: Date }>>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isWebchatModalOpen, setIsWebchatModalOpen] = useState(false);
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
        title: "Teste falhou",
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

  const clearChat = () => {
    setMessages([]);
  };

  const exportChat = () => {
    const chatData = {
      agent: currentAgent?.name,
      timestamp: new Date().toISOString(),
      messages: messages.map(msg => ({
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
      title: "Chat exportado",
      description: "Histórico do chat foi baixado como arquivo JSON.",
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
        position: 'bottom-right', // 'bottom-right', 'bottom-left', 'inline'
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: '#022b44' }}>
            Teste de Agentes
          </h1>
          <p className="text-gray-600 mt-1">Teste seus agentes AI e avalie suas respostas</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            onClick={() => setIsWebchatModalOpen(true)}
            disabled={!currentAgentId}
            className="flex items-center space-x-2"
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
            <Code className="h-4 w-4" />
            <span>Código Webchat</span>
          </Button>
          <Button
            variant="outline"
            onClick={exportChat}
            disabled={messages.length === 0}
            className="flex items-center space-x-2"
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
            <Download className="h-4 w-4" />
            <span>Exportar Chat</span>
          </Button>
          <Button
            variant="outline"
            onClick={clearChat}
            disabled={messages.length === 0}
            className="flex items-center space-x-2"
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
            <Trash2 className="h-4 w-4" />
            <span>Limpar</span>
          </Button>
        </div>
      </div>

      {/* Agent Selection */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <BarChart className="h-5 w-5" style={{ color: '#022b44' }} />
              <div>
                <h3 className="text-lg font-semibold" style={{ color: '#022b44' }}>
                  Selecionar Agente para Teste
                </h3>
                <p className="text-sm text-gray-500">Escolha um agente da sua coleção</p>
              </div>
            </div>
            {currentAgent && (
              <Badge 
                variant={currentAgent.status === "active" ? "default" : "secondary"}
                style={{ backgroundColor: '#b8ec00', color: '#022b44' }}
              >
                {currentAgent.status === "active" ? "Ativo" : 
                 currentAgent.status === "testing" ? "Testando" : "Rascunho"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Select value={currentAgentId?.toString()} onValueChange={(value) => setCurrentAgentId(parseInt(value))}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione um agente para testar" />
            </SelectTrigger>
            <SelectContent>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id.toString()}>
                  <div className="flex items-center space-x-2">
                    <Bot className="h-4 w-4" />
                    <span>{agent.name}</span>
                    <span className="text-xs text-gray-500">({agent.model})</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {currentAgent && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium" style={{ color: '#022b44' }}>Detalhes do Agente</h4>
              <div className="mt-2 space-y-1 text-sm">
                <div><span className="font-medium">Descrição:</span> {currentAgent.description}</div>
                <div><span className="font-medium">Modelo:</span> {currentAgent.model}</div>
                <div><span className="font-medium">Temperatura:</span> {currentAgent.temperature}</div>
                <div className="flex items-center">
                  <span className="font-medium">Status:</span>
                  <Badge 
                    variant={currentAgent.status === "active" ? "default" : "secondary"} 
                    className="ml-2"
                    style={{ backgroundColor: '#b8ec00', color: '#022b44' }}
                  >
                    {currentAgent.status === "active" ? "Ativo" : 
                     currentAgent.status === "testing" ? "Testando" : "Rascunho"}
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chat Interface */}
      {currentAgent ? (
        <div className="h-[600px]">
          <ChatInterface agent={currentAgent} />
        </div>
      ) : (
        <Card className="h-[600px] flex items-center justify-center">
          <CardContent className="text-center">
            <Bot className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2" style={{ color: '#022b44' }}>
              Nenhum Agente Selecionado
            </h3>
            <p className="text-gray-500">Selecione um agente acima para começar a testar</p>
          </CardContent>
        </Card>
      )}

      {/* Webchat Code Modal */}
      <Dialog open={isWebchatModalOpen} onOpenChange={setIsWebchatModalOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle style={{ color: '#022b44' }}>
              Código do Webchat - {currentAgent?.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-800 mb-2">📋 Como usar:</h4>
              <ul className="text-sm text-blue-700 space-y-1">
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

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-yellow-800 mb-2">⚠️ Configurações disponíveis:</h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• <strong>position:</strong> 'bottom-right', 'bottom-left', 'inline'</li>
                <li>• <strong>theme:</strong> Personalize primaryColor, accentColor, borderRadius</li>
                <li>• <strong>size:</strong> Ajuste height e width conforme necessário</li>
                <li>• <strong>textos:</strong> Customize title, subtitle e placeholder</li>
              </ul>
            </div>

            <div className="flex justify-end space-x-3">
              <Button 
                variant="outline" 
                onClick={() => setIsWebchatModalOpen(false)}
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
    </div>
  );
}