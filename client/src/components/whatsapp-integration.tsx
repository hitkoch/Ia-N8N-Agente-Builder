import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Smartphone, QrCode, CheckCircle, XCircle, RefreshCw, Trash2 } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { Agent } from '@shared/schema';

interface WhatsAppInstance {
  id: number;
  instanceName: string;
  phoneNumber: string;
  status: string;
  qrCode?: string;
  agentId: number;
  createdAt: string;
  updatedAt: string;
}

interface WhatsAppIntegrationProps {
  agent: Agent;
}

export default function WhatsAppIntegration({ agent }: WhatsAppIntegrationProps) {
  const { toast } = useToast();
  const [showQrCode, setShowQrCode] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');

  // Buscar instância WhatsApp do agente
  const { data: whatsappData, isLoading: isLoadingInstance } = useQuery({
    queryKey: ['/api/agents', agent.id, 'whatsapp'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', `/api/agents/${agent.id}/whatsapp`);
        return await response.json();
      } catch (error) {
        return { hasInstance: false }; // Instância não existe
      }
    },
  });

  const whatsappInstance = whatsappData?.hasInstance ? whatsappData : null;

  // Criar instância WhatsApp
  const createInstanceMutation = useMutation({
    mutationFn: async () => {
      if (!phoneNumber.trim()) {
        throw new Error("Número de telefone é obrigatório");
      }
      const response = await apiRequest('POST', `/api/agents/${agent.id}/whatsapp/create-instance`, {
        phoneNumber: phoneNumber.trim()
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agents', agent.id, 'whatsapp'] });
      toast({
        title: "Instância criada",
        description: "Instância WhatsApp criada com sucesso. Escaneie o QR Code para conectar.",
      });
      setShowQrCode(true);
      setPhoneNumber('');
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar instância",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Conectar instância (gerar novo QR Code)
  const connectInstanceMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/agents/${agent.id}/whatsapp/connect`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agents', agent.id, 'whatsapp'] });
      toast({
        title: "QR Code atualizado",
        description: "Novo QR Code gerado. Escaneie para conectar.",
      });
      setShowQrCode(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao conectar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Verificar status da instância
  const checkStatusMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('GET', `/api/agents/${agent.id}/whatsapp/status`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agents', agent.id, 'whatsapp'] });
      toast({
        title: "Status atualizado",
        description: "Status da instância verificado com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao verificar status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Ativar monitoramento
  const enableMonitoringMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/agents/${agent.id}/whatsapp/enable-monitoring`);
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/agents', agent.id, 'whatsapp'] });
      toast({
        title: "Monitoramento ativado",
        description: "Webhook configurado e monitoramento ativo.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao ativar monitoramento",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Excluir instância
  const deleteInstanceMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('DELETE', `/api/agents/${agent.id}/whatsapp`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agents', agent.id, 'whatsapp'] });
      toast({
        title: "Instância removida",
        description: "Instância WhatsApp removida com sucesso.",
      });
      setShowQrCode(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao remover instância",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONNECTED':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Conectado</Badge>;
      case 'PENDING':
        return <Badge variant="secondary"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Aguardando</Badge>;
      case 'DISCONNECTED':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Desconectado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoadingInstance) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Integração WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Carregando...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          Integração WhatsApp
        </CardTitle>
        <CardDescription>
          Conecte seu agente ao WhatsApp para receber e responder mensagens automaticamente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!whatsappInstance ? (
          // Nenhuma instância criada
          <div className="space-y-4">
            <p className="text-muted-foreground text-center">
              Nenhuma instância WhatsApp configurada para este agente.
            </p>
            
            <div className="space-y-3">
              <div>
                <Label htmlFor="phoneNumber">Número do WhatsApp</Label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  placeholder="Ex: 5541999887766"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Digite apenas números (com código do país e DDD)
                </p>
              </div>
              
              <Button 
                onClick={() => createInstanceMutation.mutate()}
                disabled={createInstanceMutation.isPending || !phoneNumber.trim()}
                className="w-full"
              >
                {createInstanceMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Criando instância...
                  </>
                ) : (
                  <>
                    <Smartphone className="w-4 h-4 mr-2" />
                    Criar Instância WhatsApp
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          // Instância existe
          <div className="space-y-4">
            {/* Status da instância */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">WhatsApp: {whatsappInstance.phoneNumber}</p>
                <p className="text-sm text-muted-foreground">
                  Instância: {whatsappInstance.instanceName}
                </p>
                <p className="text-sm text-muted-foreground">
                  Criada em {new Date(whatsappInstance.createdAt).toLocaleDateString('pt-BR')}
                </p>
              </div>
              {getStatusBadge(whatsappInstance.status)}
            </div>

            {/* Botão de Ativar Monitoramento - Destaque Principal */}
            <div className="p-4 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-green-800">Monitoramento WhatsApp</h4>
                  <p className="text-sm text-green-600">Configure webhooks para receber mensagens automaticamente</p>
                </div>
                <Button
                  onClick={() => enableMonitoringMutation.mutate()}
                  disabled={enableMonitoringMutation.isPending}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-2"
                >
                  {enableMonitoringMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Ativando...
                    </>
                  ) : (
                    <>
                      🔗 Ativar Monitoramento
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Ações secundárias */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => checkStatusMutation.mutate()}
                disabled={checkStatusMutation.isPending}
              >
                {checkStatusMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Verificar Status
              </Button>

              <Button
                variant="outline"
                onClick={() => connectInstanceMutation.mutate()}
                disabled={connectInstanceMutation.isPending}
              >
                {connectInstanceMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <QrCode className="w-4 h-4 mr-2" />
                )}
                Gerar QR Code
              </Button>
            </div>

            {/* Botão de remover instância separado */}
            <div className="pt-2">
              <Button
                variant="destructive"
                onClick={() => deleteInstanceMutation.mutate()}
                disabled={deleteInstanceMutation.isPending}
                className="w-full"
              >
                {deleteInstanceMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Remover Instância
              </Button>
            </div>

            {/* QR Code */}
            {whatsappInstance.qrCode && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium">QR Code para Conexão</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowQrCode(!showQrCode)}
                  >
                    {showQrCode ? 'Ocultar' : 'Mostrar'}
                  </Button>
                </div>
                
                {showQrCode && (
                  <div className="flex justify-center p-4 bg-white rounded-lg border">
                    <img 
                      src={whatsappInstance.qrCode} 
                      alt="QR Code WhatsApp"
                      className="max-w-64 max-h-64"
                    />
                  </div>
                )}
                
                <p className="text-sm text-muted-foreground text-center">
                  Escaneie este QR Code com o WhatsApp para conectar a instância
                </p>
              </div>
            )}

            {/* Ação de remoção */}
            <div className="pt-4 border-t">
              <Button
                variant="destructive"
                onClick={() => {
                  if (confirm('Tem certeza que deseja remover esta instância WhatsApp?')) {
                    deleteInstanceMutation.mutate();
                  }
                }}
                disabled={deleteInstanceMutation.isPending}
                className="w-full"
              >
                {deleteInstanceMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Removendo...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remover Instância
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}