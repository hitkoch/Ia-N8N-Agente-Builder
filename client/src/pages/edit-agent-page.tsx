import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle, Circle, Upload, FileText, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface EditAgentPageProps {
  agentId: string;
}

export default function EditAgentPage({ agentId }: EditAgentPageProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: agent, isLoading } = useQuery({
    queryKey: ["/api/agents", agentId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/agents/${agentId}`);
      return await res.json();
    },
  });

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    systemPrompt: "",
    model: "gpt-4o",
    temperature: 0.7,
    status: "draft",
  });

  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [selectedGoogleServices, setSelectedGoogleServices] = useState<string[]>([]);
  const [ragDocuments, setRagDocuments] = useState<any[]>([]);
  const [currentStep, setCurrentStep] = useState(1);

  React.useEffect(() => {
    if (agent) {
      setFormData({
        name: agent.name || "",
        description: agent.description || "",
        systemPrompt: agent.systemPrompt || "",
        model: agent.model || "gpt-4o",
        temperature: agent.temperature || 0.7,
        status: agent.status || "draft",
      });
      
      setSelectedTools(Array.isArray(agent.tools) ? agent.tools : (agent.tools ? agent.tools.split(',').filter(Boolean) : []));
      setSelectedGoogleServices(Array.isArray(agent.googleServices) ? agent.googleServices : (agent.googleServices ? agent.googleServices.split(',').filter(Boolean) : []));
      setRagDocuments(Array.isArray(agent.ragDocuments) ? agent.ragDocuments : []);
    }
  }, [agent?.id]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PUT", `/api/agents/${agentId}`, {
        ...data,
        tools: selectedTools,
        googleServices: selectedGoogleServices,
        ragDocuments: ragDocuments,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Agente atualizado",
        description: "O agente foi atualizado com sucesso.",
      });
      setLocation("/");
    },
    onError: (error: Error) => {
      toast({
        title: "Falha ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  const handleToolChange = (toolId: string, checked: boolean) => {
    if (checked) {
      setSelectedTools(prev => [...prev, toolId]);
    } else {
      setSelectedTools(prev => prev.filter(id => id !== toolId));
    }
  };

  const handleServiceChange = (serviceId: string, checked: boolean) => {
    if (checked) {
      setSelectedGoogleServices(prev => [...prev, serviceId]);
    } else {
      setSelectedGoogleServices(prev => prev.filter(id => id !== serviceId));
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const newDoc = {
        id: Date.now(),
        filename: file.name,
        originalName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        content: `Conteúdo do arquivo ${file.name}`,
      };
      setRagDocuments(prev => [...prev, newDoc]);
      
      toast({
        title: "Arquivo adicionado",
        description: `${file.name} foi adicionado à base de conhecimento.`,
      });
    }
  };

  const removeDocument = (docId: number) => {
    setRagDocuments(prev => prev.filter(doc => doc.id !== docId));
    toast({
      title: "Arquivo removido",
      description: "O arquivo foi removido da base de conhecimento.",
    });
  };

  const steps = [
    { id: 1, title: "Configurações Básicas", description: "Nome, descrição e configurações do modelo", completed: !!formData.name },
    { id: 2, title: "Ferramentas", description: "Selecionar capacidades do agente", completed: selectedTools.length > 0 },
    { id: 3, title: "Base de Conhecimento", description: "Upload de documentos e contexto", completed: ragDocuments.length > 0 },
    { id: 4, title: "Integrações", description: "Conectar com serviços externos", completed: selectedGoogleServices.length > 0 },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center space-x-4">
        <Button variant="ghost" onClick={() => setLocation("/")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <h1 className="text-3xl font-bold">Editar Agente</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Timeline/Steps */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Progresso da Edição</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {steps.map((step, index) => (
                  <div key={step.id} className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      {step.completed ? (
                        <CheckCircle className="h-6 w-6 text-green-500" />
                      ) : (
                        <Circle className="h-6 w-6 text-gray-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className={`text-sm font-medium ${step.completed ? 'text-green-700' : 'text-gray-500'}`}>
                          {step.title}
                        </span>
                        {step.completed && (
                          <Badge variant="secondary" className="text-xs">Completo</Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Form Content */}
        <div className="lg:col-span-3">
          <form onSubmit={handleSubmit} className="space-y-6">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basic">Básico</TabsTrigger>
                <TabsTrigger value="tools">Ferramentas</TabsTrigger>
                <TabsTrigger value="knowledge">Base de Conhecimento</TabsTrigger>
                <TabsTrigger value="integrations">Integrações</TabsTrigger>
              </TabsList>

          <TabsContent value="basic" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Configurações Básicas</CardTitle>
                <CardDescription>Defina as configurações fundamentais do agente</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Nome</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nome do agente"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Descrição</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Descreva a função do agente"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Prompt do Sistema</label>
                  <textarea
                    value={formData.systemPrompt}
                    onChange={(e) => setFormData(prev => ({ ...prev, systemPrompt: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Instruções para o comportamento do agente"
                    rows={4}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Modelo</label>
                    <select
                      value={formData.model}
                      onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="gpt-4o">GPT-4 Omni</option>
                      <option value="gpt-4">GPT-4</option>
                      <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Temperatura</label>
                    <input
                      type="number"
                      min="0"
                      max="2"
                      step="0.1"
                      value={formData.temperature}
                      onChange={(e) => setFormData(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="draft">Rascunho</option>
                    <option value="testing">Testando</option>
                    <option value="active">Ativo</option>
                  </select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tools" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Ferramentas Disponíveis</CardTitle>
                <CardDescription>Selecione as ferramentas que o agente pode usar</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={selectedTools.includes("web_search")}
                      onChange={(e) => handleToolChange("web_search", e.target.checked)}
                      className="rounded"
                    />
                    <div>
                      <div className="font-medium">Pesquisa Web</div>
                      <div className="text-sm text-gray-500">Buscar informações atualizadas na internet</div>
                    </div>
                  </label>

                  <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={selectedTools.includes("image_analysis")}
                      onChange={(e) => handleToolChange("image_analysis", e.target.checked)}
                      className="rounded"
                    />
                    <div>
                      <div className="font-medium">Análise de Imagens</div>
                      <div className="text-sm text-gray-500">Analisar e descrever imagens</div>
                    </div>
                  </label>

                  <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={selectedTools.includes("calculator")}
                      onChange={(e) => handleToolChange("calculator", e.target.checked)}
                      className="rounded"
                    />
                    <div>
                      <div className="font-medium">Calculadora</div>
                      <div className="text-sm text-gray-500">Realizar cálculos matemáticos</div>
                    </div>
                  </label>

                  <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={selectedTools.includes("code_interpreter")}
                      onChange={(e) => handleToolChange("code_interpreter", e.target.checked)}
                      className="rounded"
                    />
                    <div>
                      <div className="font-medium">Interpretador de Código</div>
                      <div className="text-sm text-gray-500">Executar e analisar código</div>
                    </div>
                  </label>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="knowledge" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Base de Conhecimento</CardTitle>
                <CardDescription>Faça upload de documentos para enriquecer o conhecimento do agente</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-600 mb-2">
                    Clique para fazer upload ou arraste arquivos aqui
                  </p>
                  <p className="text-xs text-gray-500 mb-4">
                    Suporte para PDF, TXT, DOC, DOCX, MD (máx. 10MB)
                  </p>
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload-edit"
                    accept=".pdf,.txt,.doc,.docx,.md"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById('file-upload-edit')?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Selecionar Arquivo
                  </Button>
                </div>

                {ragDocuments.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Arquivos Carregados:</h4>
                    <div className="space-y-2">
                      {ragDocuments.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-gray-50">
                          <div className="flex items-center space-x-3">
                            <FileText className="h-4 w-4 text-blue-500" />
                            <div>
                              <p className="text-sm font-medium">{doc.originalName}</p>
                              <p className="text-xs text-gray-500">
                                {(doc.fileSize / 1024).toFixed(1)} KB • {doc.mimeType}
                              </p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeDocument(doc.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-blue-800 mb-2">💡 Dicas para Base de Conhecimento</h4>
                  <ul className="text-xs text-blue-700 space-y-1">
                    <li>• Use documentos relevantes para o contexto do seu agente</li>
                    <li>• Textos bem estruturados melhoram as respostas</li>
                    <li>• Evite documentos muito técnicos se o agente for para usuários finais</li>
                    <li>• PDFs com texto selecionável funcionam melhor</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integrations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Serviços Google</CardTitle>
                <CardDescription>Conecte com serviços do Google</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={selectedGoogleServices.includes("calendar")}
                      onChange={(e) => handleServiceChange("calendar", e.target.checked)}
                      className="rounded"
                    />
                    <div>
                      <div className="font-medium">Google Calendar</div>
                      <div className="text-sm text-gray-500">Gerenciar eventos e compromissos</div>
                    </div>
                  </label>

                  <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={selectedGoogleServices.includes("drive")}
                      onChange={(e) => handleServiceChange("drive", e.target.checked)}
                      className="rounded"
                    />
                    <div>
                      <div className="font-medium">Google Drive</div>
                      <div className="text-sm text-gray-500">Acessar e gerenciar arquivos</div>
                    </div>
                  </label>

                  <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={selectedGoogleServices.includes("sheets")}
                      onChange={(e) => handleServiceChange("sheets", e.target.checked)}
                      className="rounded"
                    />
                    <div>
                      <div className="font-medium">Google Sheets</div>
                      <div className="text-sm text-gray-500">Trabalhar com planilhas</div>
                    </div>
                  </label>

                  <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={selectedGoogleServices.includes("docs")}
                      onChange={(e) => handleServiceChange("docs", e.target.checked)}
                      className="rounded"
                    />
                    <div>
                      <div className="font-medium">Google Docs</div>
                      <div className="text-sm text-gray-500">Criar e editar documentos</div>
                    </div>
                  </label>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
            </Tabs>

            <div className="flex justify-end space-x-2 pt-6 border-t">
              <Button type="button" variant="outline" onClick={() => setLocation("/")}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}