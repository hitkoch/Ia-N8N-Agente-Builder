import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Smartphone, QrCode, CheckCircle, XCircle, RefreshCw, Trash2, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useWhatsAppStatus } from "@/hooks/use-whatsapp-status";
import WhatsAppStatusIndicator from "@/components/whatsapp-status-indicator";
import WhatsAppActivityMonitor from "@/components/whatsapp-activity-monitor";

interface Agent {
  id: number;
  name: string;
  description: string;
}

interface WhatsAppInstance {
  id: number;
  instanceName: string;
  status: string;
  qrCode?: string;
  agentId: number;
  createdAt: string;
  updatedAt: string;
}

export default function WhatsAppManagementPage() {
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const {
    instance,
    isLoading: instanceLoading,
    error: instanceError,
    status,
    statusDisplay,
    isPolling,
    isConnected,
    hasQRCode,
    needsAttention,
    refreshStatus,
    startPolling,
    stopPolling,
    instanceName,
    lastUpdated,
    hasInstance
  } = useWhatsAppStatus({
    agentId: selectedAgentId,
    enabled: !!selectedAgentId,
    onStatusChange: (oldStatus, newStatus) => {
      if (newStatus === "CONNECTED") {
        toast({
          title: "WhatsApp Conectado!",
          description: "Seu agente está pronto para receber mensagens.",
        });
      } else if (oldStatus === "CONNECTED" && newStatus !== "CONNECTED") {
        toast({
          title: "Conexão perdida",
          description: "O WhatsApp foi desconectado. Verifique a conexão.",
          variant: "destructive",
        });
      }
    }
  });

  // Auto-refresh to get QR code when instance is created
  useEffect(() => {
    if (hasInstance && status === "AWAITING_QR_SCAN" && !instance?.qrCode) {
      // Poll for QR code every 3 seconds for up to 30 seconds
      const pollForQR = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/agents", selectedAgentId, "whatsapp"] });
      }, 3000);

      // Stop polling after 30 seconds
      setTimeout(() => {
        clearInterval(pollForQR);
      }, 30000);

      return () => clearInterval(pollForQR);
    }
  }, [hasInstance, status, instance?.qrCode, selectedAgentId, queryClient]);

  const createInstanceMutation = useMutation({
    mutationFn: async ({ agentId, phoneNumber }: { agentId: number; phoneNumber: string }) => {
      const response = await apiRequest("POST", `/api/agents/${agentId}/whatsapp/create-instance`, {
        phoneNumber: phoneNumber
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents", selectedAgentId, "whatsapp"] });
      if (data.qrCode) {
        setIsQRModalOpen(true);
      }
      toast({
        title: "Instância WhatsApp criada",
        description: "Instância criada com sucesso! QR Code será exibido quando disponível.",
      });
      setIsCreateDialogOpen(false);
      setPhoneNumber("");
      startPolling();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar instância",
        description: error.message || "Falha ao criar instância WhatsApp",
        variant: "destructive",
      });
    },
  });

  const removeInstanceMutation = useMutation({
    mutationFn: async (agentId: number) => {
      const response = await apiRequest("DELETE", `/api/agents/${agentId}/whatsapp`);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.message?.includes("Nenhuma instância")) {
        toast({
          title: "Limpeza concluída",
          description: "Nenhuma instância fantasma encontrada para remover.",
        });
      } else {
        toast({
          title: "Instância removida",
          description: "Instância WhatsApp removida com sucesso.",
        });
      }
      stopPolling();
      setIsQRModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/agents", selectedAgentId, "whatsapp"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover instância",
        description: error.message || "Falha ao remover instância WhatsApp",
        variant: "destructive",
      });
    },
  });

  const refreshStatusMutation = useMutation({
    mutationFn: async (agentId: number) => {
      const response = await apiRequest("GET", `/api/agents/${agentId}/whatsapp/status`);
      return response.json();
    },
    onSuccess: () => {
      refreshStatus();
      toast({
        title: "Status atualizado",
        description: "Status da instância atualizado com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar status",
        description: error.message || "Falha ao verificar status",
        variant: "destructive",
      });
    },
  });

  const fetchQRMutation = useMutation({
    mutationFn: async (agentId: number) => {
      const response = await apiRequest("GET", `/api/agents/${agentId}/whatsapp/fetch-qr`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents", selectedAgentId, "whatsapp"] });
      if (data.qrCode) {
        setIsQRModalOpen(true);
        toast({
          title: "QR Code encontrado",
          description: "QR Code gerado com sucesso! Escaneie para conectar.",
        });
      } else {
        toast({
          title: "QR Code não disponível",
          description: "Aguarde alguns segundos e tente novamente.",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao buscar QR Code",
        description: error.message || "QR Code ainda não está disponível",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: '#022b44' }}>
          Gerenciamento WhatsApp
        </h1>
        <p className="text-gray-600 mt-2">
          Configure e gerencie as conexões WhatsApp dos seus agentes de IA
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            Selecionar Agente
          </CardTitle>
          <CardDescription>
            Escolha um agente para gerenciar sua conexão WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select 
            value={selectedAgentId?.toString() || ""} 
            onValueChange={(value) => setSelectedAgentId(parseInt(value))}
          >
            <SelectTrigger className="w-full">
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
        </CardContent>
      </Card>

      {selectedAgentId && (
        <div>
          {instanceLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin mr-2" />
                Carregando informações da instância...
              </CardContent>
            </Card>
          ) : hasInstance ? (
            <div className="space-y-6">
              {/* Instance Management Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    Gerenciamento da Instância
                  </CardTitle>
                  <CardDescription>
                    Controle e configurações da instância WhatsApp
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      onClick={() => refreshStatusMutation.mutate(selectedAgentId)}
                      disabled={refreshStatusMutation.isPending}
                      variant="outline"
                    >
                      {refreshStatusMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <RefreshCw className="w-4 h-4 mr-2" />
                      )}
                      Atualizar Status
                    </Button>
                    
                    {!isConnected && (
                      <Button
                        onClick={startPolling}
                        disabled={isPolling}
                        variant="outline"
                      >
                        {isPolling ? "Verificando..." : "Iniciar Monitoramento"}
                      </Button>
                    )}

                    {status === "AWAITING_QR_SCAN" && !instance?.qrCode && (
                      <Button
                        onClick={() => fetchQRMutation.mutate(selectedAgentId)}
                        disabled={fetchQRMutation.isPending}
                        style={{ backgroundColor: '#b8ec00', color: '#022b44' }}
                        className="hover:opacity-90"
                      >
                        {fetchQRMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <QrCode className="w-4 h-4 mr-2" />
                        )}
                        Buscar QR Code
                      </Button>
                    )}
                    
                    <Button
                      onClick={() => removeInstanceMutation.mutate(selectedAgentId)}
                      disabled={removeInstanceMutation.isPending}
                      variant="destructive"
                    >
                      {removeInstanceMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Trash2 className="w-4 h-4 mr-2" />
                      )}
                      Excluir Instância
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Status and Activity */}
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-1">
                  <WhatsAppStatusIndicator
                    status={status}
                    instanceName={instanceName}
                    lastActivity={lastUpdated}
                    isPolling={isPolling}
                  />
                </div>
                
                <div className="lg:col-span-2">
                  <WhatsAppActivityMonitor
                    agentId={selectedAgentId}
                    status={status}
                  />
                </div>
              </div>

              {/* QR Code Display - Show directly on page instead of modal */}
              {instance?.qrCode && !isConnected && (
                <Card className="border-blue-200 bg-blue-50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-blue-800">
                      <QrCode className="w-5 h-5" />
                      QR Code para Conexão WhatsApp
                    </CardTitle>
                    <CardDescription>
                      Escaneie este código com seu WhatsApp para conectar a instância
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col lg:flex-row gap-6 items-center">
                      <div className="flex-shrink-0">
                        <img 
                          src={instance.qrCode} 
                          alt="QR Code WhatsApp" 
                          className="w-64 h-64 rounded-lg shadow-md border-2 border-blue-200"
                        />
                      </div>
                      <div className="flex-1 text-sm text-blue-700 space-y-3">
                        <div>
                          <h4 className="font-semibold mb-2">Como conectar:</h4>
                          <ol className="space-y-2">
                            <li className="flex items-start gap-2">
                              <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">1</span>
                              <span>Abra o WhatsApp no seu celular</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">2</span>
                              <span>Toque em "Dispositivos conectados"</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">3</span>
                              <span>Toque em "Conectar um dispositivo"</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">4</span>
                              <span>Escaneie este QR Code</span>
                            </li>
                          </ol>
                        </div>
                        <div className="bg-blue-100 p-3 rounded-lg">
                          <p className="text-xs">
                            <strong>Importante:</strong> O QR Code expira em alguns minutos. 
                            Se não conseguir escanear, clique em "Atualizar Status" para gerar um novo código.
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Connection Status Messages */}
              {status === "open" || isConnected ? (
                <Card className="border-green-200 bg-green-50">
                  <CardContent className="pt-6">
                    <div className="text-center text-green-800">
                      <CheckCircle className="w-8 h-8 mx-auto mb-2" />
                      <p className="text-sm font-medium">WhatsApp Conectado!</p>
                      <p className="text-xs mt-1">
                        Seu agente está pronto para receber mensagens.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : status === "close" || status === "disconnected" ? (
                <Alert variant="destructive">
                  <XCircle className="w-4 h-4" />
                  <AlertDescription>
                    <strong>Atenção!</strong> A conexão WhatsApp foi perdida. Clique em "Atualizar Status" para gerar um novo QR Code.
                  </AlertDescription>
                </Alert>
              ) : !instance?.qrCode && status === "AWAITING_QR_SCAN" ? (
                <Card className="border-orange-200 bg-orange-50">
                  <CardContent className="pt-6">
                    <div className="text-center text-orange-800">
                      <QrCode className="w-8 h-8 mx-auto mb-2" />
                      <p className="text-sm font-medium">Gerando QR Code...</p>
                      <p className="text-xs mt-1">
                        Aguarde enquanto o código de conexão é gerado.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Pronto para Configurar</CardTitle>
                    <CardDescription>
                      Instância configurada. Aguardando geração do QR Code.
                    </CardDescription>
                  </CardHeader>
                </Card>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Nenhuma Instância Encontrada</CardTitle>
                  <CardDescription>
                    Este agente ainda não possui uma instância WhatsApp configurada.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        style={{ backgroundColor: '#b8ec00', color: '#022b44' }}
                        className="hover:opacity-90 w-full"
                        size="lg"
                      >
                        <Smartphone className="w-4 h-4 mr-2" />
                        Criar Instância WhatsApp
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Criar Instância WhatsApp</DialogTitle>
                        <DialogDescription>
                          Crie uma instância completa com QR Code para conectar este agente ao WhatsApp.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="phoneNumber">Número de Telefone</Label>
                          <Input
                            id="phoneNumber"
                            placeholder="41999887766"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                          Cancelar
                        </Button>
                        <Button
                          onClick={() => createInstanceMutation.mutate({ agentId: selectedAgentId, phoneNumber })}
                          disabled={createInstanceMutation.isPending || !phoneNumber}
                          style={{ backgroundColor: '#b8ec00', color: '#022b44' }}
                          className="hover:opacity-90"
                        >
                          {createInstanceMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : null}
                          Criar Instância
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* QR Code Modal */}
      <Dialog open={isQRModalOpen} onOpenChange={setIsQRModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5" />
              QR Code WhatsApp
            </DialogTitle>
          </DialogHeader>
          {instance?.qrCode && (
            <div className="text-center space-y-4">
              <img 
                src={instance.qrCode} 
                alt="QR Code WhatsApp" 
                className="w-full max-w-xs mx-auto rounded-lg shadow-md"
              />
              <div className="text-sm text-gray-600">
                <p><strong>Como conectar:</strong></p>
                <ol className="text-left mt-2 space-y-1">
                  <li>1. Abra o WhatsApp no seu celular</li>
                  <li>2. Toque em "Dispositivos conectados"</li>
                  <li>3. Toque em "Conectar um dispositivo"</li>
                  <li>4. Escaneie este QR Code</li>
                </ol>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}