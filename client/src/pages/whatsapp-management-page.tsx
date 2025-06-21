import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Smartphone, QrCode, CheckCircle, XCircle, RefreshCw, Trash2, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useWhatsAppStatus } from "@/hooks/use-whatsapp-status";
import WhatsAppStatusIndicator from "@/components/whatsapp-status-indicator";
import WhatsAppActivityMonitor from "@/components/whatsapp-activity-monitor";
import type { Agent } from "@shared/schema";

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

  const createInstanceMutation = useMutation({
    mutationFn: async (agentId: number) => {
      const response = await apiRequest("POST", `/api/agents/${agentId}/whatsapp/create`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents", selectedAgentId, "whatsapp"] });
      toast({
        title: "Instância criada",
        description: "Instância WhatsApp criada com sucesso. Escaneie o QR Code para conectar.",
      });
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

  const deleteInstanceMutation = useMutation({
    mutationFn: async (agentId: number) => {
      const response = await apiRequest("DELETE", `/api/agents/${agentId}/whatsapp`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents", selectedAgentId, "whatsapp"] });
      
      if (data.cleaned) {
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



  const getStatusBadge = (status: string) => {
    switch (status) {
      case "CONNECTED":
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Conectado</Badge>;
      case "PENDING":
      case "CREATED":
        return <Badge className="bg-yellow-100 text-yellow-800"><QrCode className="w-3 h-3 mr-1" />Aguardando</Badge>;
      case "close":
      case "DISCONNECTED":
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Desconectado</Badge>;
      default:
        return <Badge variant="secondary">{status || "Desconhecido"}</Badge>;
    }
  };

  const renderQRCode = () => {
    if (!instance?.qrCode) return null;
    
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            QR Code de Conexão
          </CardTitle>
          <CardDescription>
            Escaneie com o WhatsApp para conectar sua instância
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <img 
            src={instance.qrCode} 
            alt="QR Code WhatsApp" 
            className="max-w-xs mx-auto rounded-lg shadow-md"
          />
          <div className="mt-4 text-sm text-gray-600">
            <p><strong>Como conectar:</strong></p>
            <ol className="text-left mt-2 space-y-1">
              <li>1. Abra o WhatsApp no seu celular</li>
              <li>2. Toque em ⋮ → Aparelhos conectados</li>
              <li>3. Toque em "Conectar um aparelho"</li>
              <li>4. Escaneie este QR Code</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    );
  };

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
        <>

          
          {instanceLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin mr-2" />
                Carregando informações da instância...
              </CardContent>
            </Card>
          ) : hasInstance ? (
            <div className="space-y-6">
              {/* Real-time Status and Activity in a 2-column layout */}
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

              {/* Action buttons */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    Gerenciamento da Instância
                  </CardTitle>
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
                    
                    <Button
                      onClick={() => deleteInstanceMutation.mutate(selectedAgentId)}
                      disabled={deleteInstanceMutation.isPending}
                      variant="destructive"
                    >
                      {deleteInstanceMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Trash2 className="w-4 h-4 mr-2" />
                      )}
                      Remover Instância
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* QR Code or Connection Status */}
              {isConnected ? (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    <strong>WhatsApp Conectado!</strong> Seu agente está pronto para receber mensagens automaticamente.
                  </AlertDescription>
                </Alert>
              ) : hasQRCode ? (
                renderQRCode()
              ) : needsAttention ? (
                <Alert variant="destructive">
                  <XCircle className="w-4 h-4" />
                  <AlertDescription>
                    <strong>Atenção!</strong> A conexão WhatsApp foi perdida. Clique em "Atualizar Status" para gerar um novo QR Code.
                  </AlertDescription>
                </Alert>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Pronto para Configurar</CardTitle>
                    <CardDescription>
                      Instância configurada mas aguardando conexão. Escaneie o QR Code quando disponível.
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
                  <Button
                    onClick={() => createInstanceMutation.mutate(selectedAgentId)}
                    disabled={createInstanceMutation.isPending}
                    style={{ backgroundColor: '#b8ec00', color: '#022b44' }}
                    className="hover:opacity-90 w-full"
                    size="lg"
                  >
                    {createInstanceMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Smartphone className="w-4 h-4 mr-2" />
                    )}
                    Criar Nova Instância WhatsApp
                  </Button>
                </CardContent>
              </Card>
              
              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="pt-6">
                  <div className="text-center text-blue-800">
                    <Smartphone className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-sm font-medium">Como funciona:</p>
                    <ol className="text-xs mt-2 space-y-1 text-left">
                      <li>1. Clique em "Criar Nova Instância WhatsApp"</li>
                      <li>2. Será gerado um QR Code para conexão</li>
                      <li>3. Escaneie o QR Code com seu WhatsApp</li>
                      <li>4. Seu agente estará conectado e funcionando</li>
                    </ol>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}