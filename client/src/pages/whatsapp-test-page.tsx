import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  FlaskConical, 
  MessageSquare, 
  Zap, 
  QrCode, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  Clock,
  Send,
  Smartphone
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Agent {
  id: number;
  name: string;
  description: string;
}

interface TestResult {
  timestamp: string;
  test: string;
  status: 'success' | 'error' | 'pending';
  data: any;
  duration?: number;
}

export default function WhatsAppTestPage() {
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("41985656666");
  const [testMessage, setTestMessage] = useState("Olá! Este é um teste do sistema WhatsApp. Como você está?");
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const { toast } = useToast();

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const addTestResult = (test: string, status: 'success' | 'error' | 'pending', data: any, duration?: number) => {
    const result: TestResult = {
      timestamp: new Date().toLocaleTimeString(),
      test,
      status,
      data,
      duration
    };
    setTestResults(prev => [result, ...prev.slice(0, 19)]); // Keep last 20 results
  };

  const clearResults = () => {
    setTestResults([]);
    toast({
      title: "Log limpo",
      description: "Todos os resultados de teste foram removidos.",
    });
  };

  // Test mutations
  const createInstanceMutation = useMutation({
    mutationFn: async () => {
      const startTime = Date.now();
      const response = await apiRequest("POST", `/api/agents/${selectedAgentId}/whatsapp/create-instance`, {
        phoneNumber
      });
      const duration = Date.now() - startTime;
      const data = await response.json();
      return { data, duration };
    },
    onMutate: () => {
      addTestResult("Criar Instância WhatsApp", "pending", { phoneNumber });
    },
    onSuccess: ({ data, duration }) => {
      addTestResult("Criar Instância WhatsApp", "success", data, duration);
      toast({
        title: "Teste realizado",
        description: "Instância WhatsApp criada com sucesso.",
      });
    },
    onError: (error: any) => {
      addTestResult("Criar Instância WhatsApp", "error", { error: error.message });
      toast({
        title: "Teste falhou",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const checkStatusMutation = useMutation({
    mutationFn: async () => {
      const startTime = Date.now();
      const response = await apiRequest("GET", `/api/agents/${selectedAgentId}/whatsapp`);
      const duration = Date.now() - startTime;
      const data = await response.json();
      return { data, duration };
    },
    onMutate: () => {
      addTestResult("Verificar Status", "pending", {});
    },
    onSuccess: ({ data, duration }) => {
      const status = data.hasInstance ? 'success' : 'error';
      addTestResult("Verificar Status", status, data, duration);
      
      if (!data.hasInstance) {
        toast({
          title: "Instância não encontrada",
          description: "Este agente não possui uma instância WhatsApp configurada.",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      addTestResult("Verificar Status", "error", { error: error.message });
    },
  });

  const testWebhookMessageMutation = useMutation({
    mutationFn: async () => {
      const startTime = Date.now();
      const webhookData = {
        event: "MESSAGES_UPSERT",
        instance: `whatsapp-${phoneNumber}`,
        data: {
          messages: [{
            key: {
              remoteJid: `55${phoneNumber}@s.whatsapp.net`,
              fromMe: false,
              id: `test_${Date.now()}`
            },
            message: {
              conversation: testMessage
            },
            messageTimestamp: Math.floor(Date.now() / 1000).toString()
          }]
        }
      };
      
      const response = await apiRequest("POST", "/api/whatsapp/webhook", webhookData);
      const duration = Date.now() - startTime;
      const data = await response.json();
      return { data, duration, webhookData };
    },
    onMutate: () => {
      addTestResult("Webhook - Mensagem", "pending", { message: testMessage });
    },
    onSuccess: ({ data, duration, webhookData }) => {
      addTestResult("Webhook - Mensagem", "success", { 
        sent: webhookData, 
        response: data 
      }, duration);
      toast({
        title: "Webhook testado",
        description: "Mensagem processada via webhook.",
      });
    },
    onError: (error: any) => {
      addTestResult("Webhook - Mensagem", "error", { error: error.message });
    },
  });

  const testConnectionUpdateMutation = useMutation({
    mutationFn: async (state: 'open' | 'close') => {
      const startTime = Date.now();
      const webhookData = {
        event: "CONNECTION_UPDATE",
        instance: `whatsapp-${phoneNumber}`,
        data: { state }
      };
      
      const response = await apiRequest("POST", "/api/whatsapp/webhook", webhookData);
      const duration = Date.now() - startTime;
      const data = await response.json();
      return { data, duration, state };
    },
    onMutate: (state) => {
      addTestResult(`Webhook - Conexão ${state}`, "pending", { state });
    },
    onSuccess: ({ data, duration, state }) => {
      addTestResult(`Webhook - Conexão ${state}`, "success", data, duration);
    },
    onError: (error: any) => {
      addTestResult("Webhook - Conexão", "error", { error: error.message });
    },
  });

  const fetchQRMutation = useMutation({
    mutationFn: async () => {
      const startTime = Date.now();
      const response = await apiRequest("GET", `/api/agents/${selectedAgentId}/whatsapp/status`);
      const duration = Date.now() - startTime;
      const data = await response.json();
      return { data, duration };
    },
    onMutate: () => {
      addTestResult("Buscar Status/QR", "pending", {});
    },
    onSuccess: ({ data, duration }) => {
      const status = data.hasInstance !== false ? 'success' : 'error';
      addTestResult("Buscar Status/QR", status, data, duration);
      
      if (data.hasInstance === false) {
        toast({
          title: "Instância não encontrada",
          description: "Configure uma instância WhatsApp primeiro.",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      addTestResult("Buscar Status/QR", "error", { error: error.message });
    },
  });

  const deleteInstanceMutation = useMutation({
    mutationFn: async () => {
      const startTime = Date.now();
      const response = await apiRequest("DELETE", `/api/agents/${selectedAgentId}/whatsapp`);
      const duration = Date.now() - startTime;
      const data = await response.json();
      return { data, duration };
    },
    onMutate: () => {
      addTestResult("Remover Instância", "pending", {});
    },
    onSuccess: ({ data, duration }) => {
      addTestResult("Remover Instância", "success", data, duration);
      toast({
        title: "Instância removida",
        description: "Instância WhatsApp foi removida com sucesso.",
      });
    },
    onError: (error: any) => {
      addTestResult("Remover Instância", "error", { error: error.message });
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-100 text-green-800">Sucesso</Badge>;
      case 'error':
        return <Badge variant="destructive">Erro</Badge>;
      case 'pending':
        return <Badge variant="secondary">Executando</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2" style={{ color: '#022b44' }}>
          <FlaskConical className="w-8 h-8" />
          Testes WhatsApp
        </h1>
        <p className="text-gray-600 mt-2">
          Ferramenta completa para testar todas as funcionalidades do sistema WhatsApp
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            Configuração do Teste
          </CardTitle>
          <CardDescription>
            Configure os parâmetros para executar os testes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="agent">Agente</Label>
              <Select 
                value={selectedAgentId?.toString() || ""} 
                onValueChange={(value) => setSelectedAgentId(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um agente" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id.toString()}>
                      {agent.name} - {agent.description || "Sem descrição"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Número de Telefone</Label>
              <div className="flex gap-2">
                <Input
                  id="phone"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="41985656666"
                  maxLength={15}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPhoneNumber("41985656666")}
                  className="whitespace-nowrap"
                >
                  Usar Padrão
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Use o número da sua instância ativa: 41985656666
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Mensagem de Teste</Label>
            <Textarea
              id="message"
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              placeholder="Digite a mensagem que será enviada no teste do webhook"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="tests" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="tests">Executar Testes</TabsTrigger>
          <TabsTrigger value="results">Resultados</TabsTrigger>
        </TabsList>

        <TabsContent value="tests" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            
            {/* Instance Management Tests */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Instância</CardTitle>
                <CardDescription>Gerenciamento da instância WhatsApp</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  onClick={() => createInstanceMutation.mutate()}
                  disabled={!selectedAgentId || createInstanceMutation.isPending}
                  className="w-full"
                  style={{ backgroundColor: '#b8ec00', color: '#022b44' }}
                >
                  <Smartphone className="w-4 h-4 mr-2" />
                  Criar Instância
                </Button>
                
                <Button
                  onClick={() => checkStatusMutation.mutate()}
                  disabled={!selectedAgentId || checkStatusMutation.isPending}
                  variant="outline"
                  className="w-full"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Verificar Status
                </Button>

                <Button
                  onClick={() => fetchQRMutation.mutate()}
                  disabled={!selectedAgentId || fetchQRMutation.isPending}
                  variant="outline"
                  className="w-full"
                >
                  <QrCode className="w-4 h-4 mr-2" />
                  Buscar Status/QR
                </Button>

                <Button
                  onClick={() => deleteInstanceMutation.mutate()}
                  disabled={!selectedAgentId || deleteInstanceMutation.isPending}
                  variant="destructive"
                  className="w-full"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Remover Instância
                </Button>
              </CardContent>
            </Card>

            {/* Webhook Tests */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Webhook</CardTitle>
                <CardDescription>Testes de eventos via webhook</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  onClick={() => testWebhookMessageMutation.mutate()}
                  disabled={!selectedAgentId || testWebhookMessageMutation.isPending}
                  className="w-full"
                  style={{ backgroundColor: '#b8ec00', color: '#022b44' }}
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Simular Mensagem
                </Button>

                <Button
                  onClick={() => testConnectionUpdateMutation.mutate('open')}
                  disabled={!selectedAgentId || testConnectionUpdateMutation.isPending}
                  variant="outline"
                  className="w-full"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Simular Conexão
                </Button>

                <Button
                  onClick={() => testConnectionUpdateMutation.mutate('close')}
                  disabled={!selectedAgentId || testConnectionUpdateMutation.isPending}
                  variant="outline"
                  className="w-full"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Simular Desconexão
                </Button>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Ações Rápidas</CardTitle>
                <CardDescription>Sequências automatizadas de teste</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  onClick={() => {
                    if (!selectedAgentId) return;
                    
                    // Sequência de testes
                    checkStatusMutation.mutate();
                    setTimeout(() => testWebhookMessageMutation.mutate(), 1500);
                    setTimeout(() => testConnectionUpdateMutation.mutate('open'), 3000);
                  }}
                  disabled={!selectedAgentId}
                  className="w-full"
                  style={{ backgroundColor: '#b8ec00', color: '#022b44' }}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Teste Completo
                </Button>

                <Button
                  onClick={clearResults}
                  variant="outline"
                  className="w-full"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Limpar Log
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Resultados dos Testes</CardTitle>
              <CardDescription>
                Log detalhado de todos os testes executados ({testResults.length} registros)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                {testResults.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    Nenhum teste executado ainda. Execute alguns testes para ver os resultados aqui.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {testResults.map((result, index) => (
                      <div key={index} className="border rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(result.status)}
                            <span className="font-medium">{result.test}</span>
                            {getStatusBadge(result.status)}
                          </div>
                          <div className="text-sm text-gray-500 flex items-center gap-2">
                            <span>{result.timestamp}</span>
                            {result.duration && (
                              <Badge variant="outline">{result.duration}ms</Badge>
                            )}
                          </div>
                        </div>
                        <details className="text-sm">
                          <summary className="cursor-pointer text-gray-600 hover:text-gray-800">
                            Ver detalhes
                          </summary>
                          <pre className="mt-2 bg-gray-50 p-2 rounded text-xs overflow-x-auto">
                            {JSON.stringify(result.data, null, 2)}
                          </pre>
                        </details>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}