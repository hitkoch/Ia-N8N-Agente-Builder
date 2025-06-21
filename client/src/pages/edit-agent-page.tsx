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
import WhatsAppIntegration from "@/components/whatsapp-integration";

interface EditAgentPageProps {
  agentId: string;
}

export default function EditAgentPage({ agentId }: EditAgentPageProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);

  // Handle sidebar navigation
  const handleSectionChange = (section: string) => {
    switch (section) {
      case "dashboard":
        setLocation("/");
        break;
      case "agents":
        setLocation("/");
        break;
      case "templates":
        setLocation("/");
        break;
      case "testing":
        setLocation("/");
        break;
      case "evolution":
        setLocation("/");
        break;
      case "settings":
        setLocation("/");
        break;
      default:
        setLocation("/");
    }
  };

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
  const [currentStep, setCurrentStep] = useState(1);

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
    { 
      id: 1, 
      title: "Configurações Básicas", 
      description: "Nome, descrição e configurações do modelo", 
      completed: !!(formData.name && formData.description && formData.systemPrompt),
      required: true
    },
    { 
      id: 2, 
      title: "Ferramentas", 
      description: "Selecionar capacidades do agente", 
      completed: selectedTools.length > 0,
      required: false
    },
    { 
      id: 3, 
      title: "Base de Conhecimento", 
      description: "Upload de documentos e contexto", 
      completed: ragDocuments.length > 0 || !!formData.knowledgeBase,
      required: false
    },
    { 
      id: 4, 
      title: "Revisão Final", 
      description: "Verificar e salvar configurações", 
      completed: false,
      required: true
    },
  ];

  const canProceedToStep = (stepId: number) => {
    if (stepId === 1) return true;
    const previousStep = steps.find(s => s.id === stepId - 1);
    return !previousStep?.required || previousStep?.completed;
  };

  const nextStep = () => {
    if (currentStep < steps.length && canProceedToStep(currentStep + 1)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

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
      <Sidebar currentSection="agents" onSectionChange={handleSectionChange} />
      
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

          {/* Step-by-Step Progress */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle style={{ color: '#022b44' }} className="text-lg flex items-center">
                <BarChart className="h-5 w-5 mr-2" />
                Progresso da Edição - Etapa {currentStep} de {steps.length}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Progress Bar */}
              <div className="mb-6">
                <div className="flex justify-between mb-2">
                  {steps.map((step, index) => (
                    <button
                      key={step.id}
                      onClick={() => canProceedToStep(step.id) ? setCurrentStep(step.id) : null}
                      className={`flex flex-col items-center space-y-2 transition-all ${
                        canProceedToStep(step.id) ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                      }`}
                      disabled={!canProceedToStep(step.id)}
                    >
                      <div className="flex items-center space-x-2">
                        {step.completed ? (
                          <div 
                            className="h-8 w-8 rounded-full flex items-center justify-center shadow-md"
                            style={{ backgroundColor: '#b8ec00' }}
                          >
                            <CheckCircle className="h-5 w-5" style={{ color: '#022b44' }} />
                          </div>
                        ) : (
                          <div 
                            className={`h-8 w-8 rounded-full border-2 flex items-center justify-center ${
                              currentStep === step.id ? 'shadow-md' : 'shadow-sm'
                            }`}
                            style={{ 
                              borderColor: currentStep === step.id ? '#b8ec00' : '#022b44',
                              backgroundColor: currentStep === step.id ? '#b8ec00' : 'white'
                            }}
                          >
                            <span 
                              className="text-xs font-medium" 
                              style={{ color: currentStep === step.id ? '#022b44' : '#022b44' }}
                            >
                              {step.id}
                            </span>
                          </div>
                        )}
                      </div>
                      <span 
                        className={`text-xs text-center ${
                          currentStep === step.id ? 'font-semibold' : 'font-medium'
                        }`}
                        style={{ 
                          color: currentStep === step.id || step.completed ? '#022b44' : '#6b7280' 
                        }}
                      >
                        {step.title}
                      </span>
                    </button>
                  ))}
                </div>
                
                {/* Progress Line */}
                <div className="relative">
                  <div className="absolute top-0 left-0 h-1 bg-gray-200 rounded-full w-full"></div>
                  <div 
                    className="absolute top-0 left-0 h-1 rounded-full transition-all duration-300"
                    style={{ 
                      backgroundColor: '#b8ec00',
                      width: `${(currentStep - 1) / (steps.length - 1) * 100}%`
                    }}
                  ></div>
                </div>
              </div>

              {/* Current Step Info */}
              <div className="text-center">
                <h3 className="text-lg font-semibold" style={{ color: '#022b44' }}>
                  {steps[currentStep - 1]?.title}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {steps[currentStep - 1]?.description}
                </p>
                {steps[currentStep - 1]?.required && (
                  <Badge variant="destructive" className="mt-2 text-xs">
                    Obrigatório
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Step Content */}
          <Card>
            <CardContent className="p-6">
              {/* Step 1: Basic Configuration */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <h2 className="text-xl font-semibold" style={{ color: '#022b44' }}>
                      Configurações Básicas
                    </h2>
                    <p className="text-gray-600 mt-2">
                      Defina as informações fundamentais do seu agente
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: '#022b44' }}>
                      Nome do Agente *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2"
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
                      Descrição *
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
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: '#022b44' }}>
                      Prompt do Sistema *
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
                      required
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
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
                        Idioma
                      </label>
                      <select
                        value={formData.language || 'pt-BR'}
                        onChange={(e) => setFormData(prev => ({ ...prev, language: e.target.value }))}
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
                        <option value="pt-BR">Português (Brasil)</option>
                        <option value="en">English</option>
                        <option value="es">Español</option>
                        <option value="fr">Français</option>
                        <option value="de">Deutsch</option>
                        <option value="it">Italiano</option>
                        <option value="ja">日本語</option>
                        <option value="ko">한국어</option>
                        <option value="zh">中文</option>
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
                </div>
              )}

              {/* Step 2: Tools */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <h2 className="text-xl font-semibold" style={{ color: '#022b44' }}>
                      Ferramentas e Capacidades
                    </h2>
                    <p className="text-gray-600 mt-2">
                      Selecione as ferramentas que seu agente pode usar (opcional)
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="flex items-center space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedTools.includes("web_search")}
                        onChange={(e) => handleToolChange("web_search", e.target.checked)}
                        className="rounded"
                      />
                      <div>
                        <div className="font-medium" style={{ color: '#022b44' }}>Pesquisa Web</div>
                        <div className="text-sm text-gray-500">Buscar informações atualizadas na internet</div>
                      </div>
                    </label>

                    <label className="flex items-center space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedTools.includes("image_analysis")}
                        onChange={(e) => handleToolChange("image_analysis", e.target.checked)}
                        className="rounded"
                      />
                      <div>
                        <div className="font-medium" style={{ color: '#022b44' }}>Análise de Imagens</div>
                        <div className="text-sm text-gray-500">Analisar e descrever imagens</div>
                      </div>
                    </label>

                    <label className="flex items-center space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedTools.includes("calculator")}
                        onChange={(e) => handleToolChange("calculator", e.target.checked)}
                        className="rounded"
                      />
                      <div>
                        <div className="font-medium" style={{ color: '#022b44' }}>Calculadora</div>
                        <div className="text-sm text-gray-500">Realizar cálculos matemáticos</div>
                      </div>
                    </label>

                    <label className="flex items-center space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedTools.includes("code_interpreter")}
                        onChange={(e) => handleToolChange("code_interpreter", e.target.checked)}
                        className="rounded"
                      />
                      <div>
                        <div className="font-medium" style={{ color: '#022b44' }}>Interpretador de Código</div>
                        <div className="text-sm text-gray-500">Executar e analisar código</div>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* Step 3: Knowledge Base */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <h2 className="text-xl font-semibold" style={{ color: '#022b44' }}>
                      Base de Conhecimento
                    </h2>
                    <p className="text-gray-600 mt-2">
                      Adicione documentos e conhecimento específico para o seu agente
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: '#022b44' }}>
                      Conhecimento Textual
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
                      rows={6}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Conhecimento específico e contexto que o agente deve usar nas suas respostas.
                    </p>
                  </div>

                  <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold mb-4" style={{ color: '#022b44' }}>
                      Upload de Documentos
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
                </div>
              )}

              {/* Step 4: Review */}
              {currentStep === 4 && (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <h2 className="text-xl font-semibold" style={{ color: '#022b44' }}>
                      Revisão Final
                    </h2>
                    <p className="text-gray-600 mt-2">
                      Verifique as configurações antes de salvar
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Configurações Básicas</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div>
                          <span className="text-xs text-gray-500">Nome:</span>
                          <p className="font-medium">{formData.name || "Não definido"}</p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">Modelo:</span>
                          <p className="font-medium">{formData.model}</p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">Temperatura:</span>
                          <p className="font-medium">{formData.temperature}</p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Recursos</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div>
                          <span className="text-xs text-gray-500">Ferramentas:</span>
                          <p className="font-medium">{selectedTools.length} selecionadas</p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">Documentos:</span>
                          <p className="font-medium">{ragDocuments.length} arquivos</p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">Base de Conhecimento:</span>
                          <p className="font-medium">{formData.knowledgeBase ? "Configurada" : "Não definida"}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-blue-800 mb-2">✅ Tudo Pronto!</h4>
                    <p className="text-sm text-blue-700">
                      Seu agente está configurado e pronto para ser salvo. Clique em "Salvar Alterações" para finalizar.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Navigation Buttons */}
          <div className="flex justify-between items-center mt-6">
            <Button 
              type="button" 
              variant="outline" 
              onClick={prevStep}
              disabled={currentStep === 1}
              style={{ borderColor: '#022b44', color: '#022b44' }}
              className="transition-all"
              onMouseEnter={(e) => {
                if (currentStep !== 1) {
                  e.currentTarget.style.backgroundColor = '#022b44';
                  e.currentTarget.style.color = '#FFFFFF';
                }
              }}
              onMouseLeave={(e) => {
                if (currentStep !== 1) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#022b44';
                }
              }}
            >
              Anterior
            </Button>

            <div className="flex space-x-3">
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

              {currentStep < steps.length ? (
                <Button 
                  type="button"
                  onClick={nextStep}
                  disabled={!canProceedToStep(currentStep + 1)}
                  style={{ backgroundColor: '#b8ec00', color: '#022b44' }}
                  className="transition-all"
                  onMouseEnter={(e) => {
                    if (canProceedToStep(currentStep + 1)) {
                      e.currentTarget.style.backgroundColor = '#022b44';
                      e.currentTarget.style.color = '#FFFFFF';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (canProceedToStep(currentStep + 1)) {
                      e.currentTarget.style.backgroundColor = '#b8ec00';
                      e.currentTarget.style.color = '#022b44';
                    }
                  }}
                >
                  Próximo
                </Button>
              ) : (
                <Button 
                  type="button"
                  onClick={handleSubmit}
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
              )}
            </div>
          </div>


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