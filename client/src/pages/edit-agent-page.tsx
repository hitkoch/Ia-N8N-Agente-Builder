import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, CheckCircle, Circle, Upload, FileText, X, BarChart, MessageSquare } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Sidebar from "@/components/sidebar";
import ChatInterface from "@/components/chat-interface";

interface EditAgentPageProps {
  agentId: string;
}

export default function EditAgentPage({ agentId }: EditAgentPageProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);

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
    knowledgeBase: "",
    model: "gpt-4o",
    temperature: 0.7,
    status: "draft",
  });

  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [selectedGoogleServices, setSelectedGoogleServices] = useState<string[]>([]);
  const [ragDocuments, setRagDocuments] = useState<any[]>([]);

  // Carregar dados do agente
  useEffect(() => {
    if (agent) {
      setFormData({
        name: agent.name || "",
        description: agent.description || "",
        systemPrompt: agent.systemPrompt || "",
        knowledgeBase: agent.knowledgeBase || "",
        model: agent.model || "gpt-4o",
        temperature: agent.temperature || 0.7,
        status: agent.status || "draft",
      });
    }
  }, [agent]);

  // Carregar documentos existentes
  useEffect(() => {
    if (agentId) {
      loadRagDocuments();
    }
  }, [agentId]);

  const loadRagDocuments = async () => {
    try {
      const response = await apiRequest("GET", `/api/agents/${agentId}/documents`);
      const docs = await response.json();
      setRagDocuments(docs);
    } catch (error) {
      console.error("Erro ao carregar documentos:", error);
    }
  };

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PUT", `/api/agents/${agentId}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    toast({
      title: "Processando arquivo...",
      description: `Extraindo texto de ${file.name}`,
    });

    try {
      const formDataFile = new FormData();
      formDataFile.append('document', file);
      
      const response = await apiRequest("POST", `/api/agents/${agentId}/upload-document`, formDataFile, {
        'Content-Type': undefined
      });
      
      const ragDoc = await response.json();
      setRagDocuments(prev => [...prev, ragDoc]);
      
      if (ragDoc.processingStatus === 'success') {
        toast({
          title: "Arquivo processado com sucesso",
          description: `${file.name} foi adicionado à base de conhecimento do agente.`,
        });
      } else if (ragDoc.processingStatus === 'unsupported') {
        toast({
          title: "Processamento limitado",
          description: `${file.name} foi salvo mas requer extração manual de texto.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro no processamento",
          description: `${file.name} não pôde ser processado corretamente.`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Erro no upload:", error);
      toast({
        title: "Erro no upload",
        description: "Não foi possível processar o arquivo.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteDocument = async (documentId: number, fileName: string) => {
    if (!confirm(`Deseja realmente excluir "${fileName}"? Esta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      await apiRequest("DELETE", `/api/agents/${agentId}/documents/${documentId}`);
      
      setRagDocuments(prev => prev.filter(doc => doc.id !== documentId));
      
      toast({
        title: "Documento excluído",
        description: `${fileName} foi removido da base de conhecimento e todos os embeddings foram excluídos.`,
      });
    } catch (error) {
      console.error("Erro ao excluir documento:", error);
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir o documento.",
        variant: "destructive",
      });
    }
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
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar currentSection="agents" onSectionChange={() => {}} />
      
      {/* Main Content */}
      <div className="flex-1 ml-64">
        <div className="container mx-auto py-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" onClick={() => setLocation("/")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <h1 className="text-3xl font-bold" style={{ color: '#022b44' }}>
                Editar Agente
              </h1>
            </div>
            <Button 
              onClick={() => setIsTestModalOpen(true)}
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
              <MessageSquare className="h-4 w-4 mr-2" />
              Testar Agente
            </Button>
          </div>

          {/* Timeline Progress - Above Form */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle style={{ color: '#022b44' }} className="text-lg flex items-center">
                <BarChart className="h-5 w-5 mr-2" />
                Progresso da Edição
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col space-y-6">
                {steps.map((step, index) => (
                  <div key={`step-${step.id}`} className="flex items-center space-x-4">
                    {/* Step Indicator */}
                    <div className="flex-shrink-0 relative">
                      {step.completed ? (
                        <div 
                          className="h-10 w-10 rounded-full flex items-center justify-center shadow-md"
                          style={{ backgroundColor: '#b8ec00' }}
                        >
                          <CheckCircle className="h-6 w-6" style={{ color: '#022b44' }} />
                        </div>
                      ) : (
                        <div 
                          className="h-10 w-10 rounded-full border-2 flex items-center justify-center shadow-sm bg-white"
                          style={{ borderColor: '#022b44' }}
                        >
                          <span className="text-sm font-medium" style={{ color: '#022b44' }}>
                            {step.id}
                          </span>
                        </div>
                      )}
                      {/* Connector Line */}
                      {index < steps.length - 1 && (
                        <div 
                          className="absolute top-10 left-5 w-0.5 h-10"
                          style={{ 
                            backgroundColor: step.completed ? '#b8ec00' : '#e5e7eb' 
                          }}
                        />
                      )}
                    </div>
                    
                    {/* Step Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3">
                        <p 
                          className={`text-base font-medium ${
                            step.completed ? 'font-semibold' : ''
                          }`}
                          style={{ 
                            color: step.completed ? '#022b44' : '#6b7280' 
                          }}
                        >
                          {step.title}
                        </p>
                        {step.completed && (
                          <Badge 
                            variant="secondary" 
                            style={{ backgroundColor: '#b8ec00', color: '#022b44' }}
                            className="text-xs"
                          >
                            Concluído
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {step.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Main Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle style={{ color: '#022b44' }}>Configurações do Agente</CardTitle>
                <CardDescription>Configure as propriedades básicas do seu agente</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#022b44' }}>
                    Nome do Agente
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2"
                    style={{ 
                      focusRingColor: '#022b44',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#022b44';
                      e.target.style.boxShadow = `0 0 0 2px rgba(2, 43, 68, 0.2)`;
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#d1d5db';
                      e.target.style.boxShadow = 'none';
                    }}
                    placeholder="Digite o nome do agente"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#022b44' }}>
                    Descrição
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2"
                    onFocus={(e) => {
                      e.target.style.borderColor = '#022b44';
                      e.target.style.boxShadow = `0 0 0 2px rgba(2, 43, 68, 0.2)`;
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#d1d5db';
                      e.target.style.boxShadow = 'none';
                    }}
                    placeholder="Descreva a função do agente"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#022b44' }}>
                    Prompt do Sistema
                  </label>
                  <textarea
                    value={formData.systemPrompt}
                    onChange={(e) => setFormData(prev => ({ ...prev, systemPrompt: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2"
                    onFocus={(e) => {
                      e.target.style.borderColor = '#022b44';
                      e.target.style.boxShadow = `0 0 0 2px rgba(2, 43, 68, 0.2)`;
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#d1d5db';
                      e.target.style.boxShadow = 'none';
                    }}
                    placeholder="Instruções para o comportamento do agente"
                    rows={4}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#022b44' }}>
                    Base de Conhecimento
                  </label>
                  <textarea
                    value={formData.knowledgeBase || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, knowledgeBase: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2"
                    onFocus={(e) => {
                      e.target.style.borderColor = '#022b44';
                      e.target.style.boxShadow = `0 0 0 2px rgba(2, 43, 68, 0.2)`;
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#d1d5db';
                      e.target.style.boxShadow = 'none';
                    }}
                    placeholder="Informações específicas, contexto adicional ou conhecimento especializado para o agente"
                    rows={4}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Conhecimento específico e contexto que o agente deve usar nas suas respostas.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: '#022b44' }}>
                      Modelo
                    </label>
                    <select
                      value={formData.model}
                      onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2"
                      onFocus={(e) => {
                        e.target.style.borderColor = '#022b44';
                        e.target.style.boxShadow = `0 0 0 2px rgba(2, 43, 68, 0.2)`;
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#d1d5db';
                        e.target.style.boxShadow = 'none';
                      }}
                    >
                      <option value="gpt-4o">GPT-4 Omni</option>
                      <option value="gpt-4">GPT-4</option>
                      <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: '#022b44' }}>
                      Temperatura
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="2"
                      step="0.1"
                      value={formData.temperature}
                      onChange={(e) => setFormData(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2"
                      onFocus={(e) => {
                        e.target.style.borderColor = '#022b44';
                        e.target.style.boxShadow = `0 0 0 2px rgba(2, 43, 68, 0.2)`;
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#d1d5db';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                </div>

                {/* Document Upload Section */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold mb-4" style={{ color: '#022b44' }}>
                    Documentos da Base de Conhecimento
                  </h3>
                  
                  <div className="border-2 border-dashed rounded-lg p-6 text-center mb-4"
                       style={{ borderColor: '#022b44' }}>
                    <Upload className="h-12 w-12 mx-auto mb-4" style={{ color: '#022b44' }} />
                    <div className="text-sm text-gray-600 mb-2">
                      <label htmlFor="file-upload" className="cursor-pointer">
                        <span 
                          className="hover:opacity-80 transition-opacity" 
                          style={{ color: '#022b44' }}
                        >
                          Fazer upload de documentos
                        </span>
                        <span> ou arraste e solte</span>
                      </label>
                      <input
                        id="file-upload"
                        type="file"
                        className="sr-only"
                        multiple
                        accept=".pdf,.docx,.txt,.xlsx"
                        onChange={handleFileUpload}
                      />
                    </div>
                    <p className="text-xs text-gray-500">PDF, DOCX, TXT, XLSX até 10MB cada</p>
                  </div>

                  {ragDocuments.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium" style={{ color: '#022b44' }}>
                        Arquivos Carregados ({ragDocuments.length}):
                      </h4>
                      <div className="space-y-2">
                        {ragDocuments.map((doc) => (
                          <div key={doc.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-gray-50">
                            <div className="flex items-center space-x-3">
                              <FileText className="h-4 w-4" style={{ color: '#022b44' }} />
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
                              onClick={() => handleDeleteDocument(doc.id, doc.originalName)}
                              className="text-red-500 hover:text-red-700"
                              title="Excluir documento"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setLocation("/")}
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
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={updateMutation.isPending}
                style={{ backgroundColor: '#b8ec00', color: '#022b44' }}
                className="transition-all"
                onMouseEnter={(e) => {
                  if (!updateMutation.isPending) {
                    e.currentTarget.style.backgroundColor = '#022b44';
                    e.currentTarget.style.color = '#FFFFFF';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!updateMutation.isPending) {
                    e.currentTarget.style.backgroundColor = '#b8ec00';
                    e.currentTarget.style.color = '#022b44';
                  }
                }}
              >
                {updateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Test Modal */}
      <Dialog open={isTestModalOpen} onOpenChange={setIsTestModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle style={{ color: '#022b44' }}>
              Testar Agente: {agent?.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 min-h-0">
            {agent && (
              <ChatInterface 
                agent={agent} 
                className="h-full"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}