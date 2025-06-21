import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Code, Globe, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface WebchatCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: number | null;
}

export default function WebchatCodeModal({ isOpen, onClose, agentId }: WebchatCodeModalProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data: webchatData, isLoading } = useQuery({
    queryKey: ["/api/agents", agentId, "webchat-code"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/agents/${agentId}/webchat-code`);
      return await res.json();
    },
    enabled: isOpen && !!agentId,
  });

  const copyToClipboard = () => {
    if (webchatData?.code) {
      navigator.clipboard.writeText(webchatData.code);
      setCopied(true);
      toast({
        title: "Código copiado!",
        description: "O código do webchat foi copiado para a área de transferência.",
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Code className="h-5 w-5 mr-2" />
            Código do Webchat
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informações */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <Globe className="h-4 w-4 mr-2" />
                Integração em Website
              </CardTitle>
              <CardDescription>
                Use este código para integrar seu agente de IA em qualquer website
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">1</div>
                  <div className="text-sm font-medium">Copiar Código</div>
                  <div className="text-xs text-slate-600 mt-1">
                    Copie o código JavaScript abaixo
                  </div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">2</div>
                  <div className="text-sm font-medium">Colar no Site</div>
                  <div className="text-xs text-slate-600 mt-1">
                    Cole antes do fechamento do &lt;/body&gt;
                  </div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">3</div>
                  <div className="text-sm font-medium">Pronto!</div>
                  <div className="text-xs text-slate-600 mt-1">
                    Seu chat aparecerá automaticamente
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Funcionalidades */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Funcionalidades Incluídas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Design Responsivo</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Botão Flutuante</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Chat em Tempo Real</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Estilo Customizável</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Mobile Friendly</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Fácil Instalação</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Sem Dependências</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Plug & Play</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Código */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Código para Integração</span>
                <div className="flex items-center space-x-2">
                  <Badge variant="secondary">JavaScript</Badge>
                  <Button
                    onClick={copyToClipboard}
                    variant="outline"
                    size="sm"
                    disabled={!webchatData?.code}
                  >
                    {copied ? (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copiar Código
                      </>
                    )}
                  </Button>
                </div>
              </CardTitle>
              <CardDescription>
                {webchatData?.instructions || "Carregando instruções..."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="animate-pulse">
                  <div className="h-32 bg-slate-200 rounded"></div>
                </div>
              ) : (
                <Textarea
                  value={webchatData?.code || ""}
                  readOnly
                  rows={20}
                  className="font-mono text-xs resize-none"
                  placeholder="Código será gerado aqui..."
                />
              )}
            </CardContent>
          </Card>

          {/* Notas Importantes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Notas Importantes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-slate-600">
                <p>• O agente deve estar com status "Ativo" para funcionar no website</p>
                <p>• O código é responsivo e se adapta a dispositivos móveis</p>
                <p>• Você pode personalizar as cores e estilos editando o CSS no código</p>
                <p>• O webchat se conecta diretamente com sua API de agentes</p>
                <p>• Não há limite de conversas ou mensagens</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Button onClick={copyToClipboard} disabled={!webchatData?.code}>
            <Copy className="h-4 w-4 mr-2" />
            Copiar e Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}