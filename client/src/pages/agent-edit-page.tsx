import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  ArrowLeft, 
  Save, 
  TestTube, 
  Upload, 
  FileText, 
  Trash2, 
  Settings, 
  Database,
  Smartphone,
  Bot,
  Zap
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Sidebar from "@/components/sidebar";
import ChatInterface from "@/components/chat-interface";
import WhatsAppIntegration from "@/components/whatsapp-integration";

interface AgentEditPageProps {
  agentId: string;
}

export default function AgentEditPage({ agentId }: AgentEditPageProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [activeSection, setActiveSection] = useState("basic");
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    systemPrompt: "",
    knowledgeBase: "",
    model: "gpt-4o",
    temperature: 0.7,
    status: "draft"
  });

  // Fetch agent data
  const { data: agent, isLoading } = useQuery({
    queryKey: [`/api/agents/${agentId}`],
    enabled: !!agentId,
  });

  // Fetch documents
  const { data: documents = [] } = useQuery({
    queryKey: [`/api/agents/${agentId}/documents`],
    enabled: !!agentId,
  });

  // Update form when agent data loads
  useEffect(() => {
    if (agent) {
      setFormData({
        name: agent.name || "",
        description: agent.description || "",
        systemPrompt: agent.systemPrompt || "",
        knowledgeBase: agent.knowledgeBase || "",
        model: agent.model || "gpt-4o",
        temperature: agent.temperature || 0.7,
        status: agent.status || "draft"
      });
    }
  }, [agent]);

  // Update agent mutation
  const updateAgentMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch(`/api/agents/${agentId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ${response.status}: ${errorText}`);
      }

      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Agente atualizado",
        description: "As configurações foram salvas com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/agents/${agentId}`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Test agent mutation
  const testAgentMutation = useMutation({
    mutationFn: async (message: string) => {
      return await apiRequest(`/api/agents/${agentId}/test`, {
        method: "POST",
        body: { message },
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro no teste",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // File upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("document", file);

      const response = await fetch(`/api/agents/${agentId}/upload-document`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro no upload: ${errorText}`);
      }

      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Documento enviado",
        description: "O arquivo foi processado e adicionado à base de conhecimento.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/agents/${agentId}/documents`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro no upload",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete document mutation
  const deleteDocumentMutation = useMutation({
    mutationFn: async (documentId: number) => {
      return await apiRequest(`/api/agents/${agentId}/documents/${documentId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      toast({
        title: "Documento excluído",
        description: "O documento foi removido da base de conhecimento.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/agents/${agentId}/documents`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateAgentMutation.mutate(formData);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
  };

  const handleDeleteDocument = (documentId: number) => {
    deleteDocumentMutation.mutate(documentId);
  };

  const handleSectionChange = (section: string) => {
    switch (section) {
      case "dashboard":
        setLocation("/");
        break;
      case "agents":
        setLocation("/agents");
        break;
      case "templates":
        setLocation("/templates");
        break;
      case "integrations":
        setLocation("/integrations");
        break;
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen">
        <Sidebar onSectionChange={handleSectionChange} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Bot className="h-12 w-12 mx-auto mb-4 animate-pulse text-blue-500" />
            <p className="text-gray-600">Carregando agente...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex h-screen">
        <Sidebar onSectionChange={handleSectionChange} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Bot className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600">Agente não encontrado</p>
            <Button onClick={() => setLocation("/")} className="mt-4">
              Voltar ao Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar onSectionChange={handleSectionChange} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/")}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{agent.name}</h1>
                <p className="text-sm text-gray-500">Editando configurações do agente</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Badge variant={agent.status === "active" ? "default" : "secondary"}>
                {agent.status === "active" ? "Ativo" : "Rascunho"}
              </Badge>
              
              <Dialog open={isTestModalOpen} onOpenChange={setIsTestModalOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <TestTube className="h-4 w-4 mr-2" />
                    Testar
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl h-[80vh]">
                  <DialogHeader>
                    <DialogTitle>Testar Agente: {agent.name}</DialogTitle>
                  </DialogHeader>
                  <ChatInterface
                    agentId={agentId}
                    testMode={true}
                    onTest={(message) => testAgentMutation.mutate(message)}
                    testResult={testAgentMutation.data}
                    isLoading={testAgentMutation.isPending}
                  />
                </DialogContent>
              </Dialog>

              <Button 
                onClick={handleSave}
                disabled={updateAgentMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Save className="h-4 w-4 mr-2" />
                {updateAgentMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="space-y-6">
            {/* Navigation Tabs */}
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                {[
                  { id: "basic", label: "Básico", icon: Settings },
                  { id: "knowledge", label: "Base de Conhecimento", icon: Database },
                  { id: "whatsapp", label: "WhatsApp", icon: Smartphone },
                  { id: "advanced", label: "Avançado", icon: Zap }
                ].map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveSection(tab.id)}
                      className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                        activeSection === tab.id
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Basic Configuration */}
            {activeSection === "basic" && (
              <Card>
                <CardHeader>
                  <CardTitle>Configurações Básicas</CardTitle>
                  <CardDescription>
                    Configure as informações fundamentais do seu agente
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome do Agente</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Ex: Assistente de Vendas"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Rascunho</SelectItem>
                          <SelectItem value="active">Ativo</SelectItem>
                          <SelectItem value="testing">Em Teste</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Descreva o propósito e funcionalidades do agente..."
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="systemPrompt">Prompt do Sistema</Label>
                    <Textarea
                      id="systemPrompt"
                      value={formData.systemPrompt}
                      onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                      placeholder="Você é um assistente especializado em..."
                      rows={6}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="model">Modelo de IA</Label>
                      <Select value={formData.model} onValueChange={(value) => setFormData({ ...formData, model: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gpt-4o">GPT-4o (Recomendado)</SelectItem>
                          <SelectItem value="gpt-4">GPT-4</SelectItem>
                          <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="temperature">Criatividade (Temperature: {formData.temperature})</Label>
                      <input
                        type="range"
                        id="temperature"
                        min="0"
                        max="1"
                        step="0.1"
                        value={formData.temperature}
                        onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Conservador</span>
                        <span>Criativo</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Knowledge Base */}
            {activeSection === "knowledge" && (
              <Card>
                <CardHeader>
                  <CardTitle>Base de Conhecimento</CardTitle>
                  <CardDescription>
                    Gerencie documentos e informações que o agente pode consultar
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="knowledgeBase">Conhecimento Base (Texto)</Label>
                    <Textarea
                      id="knowledgeBase"
                      value={formData.knowledgeBase}
                      onChange={(e) => setFormData({ ...formData, knowledgeBase: e.target.value })}
                      placeholder="Adicione informações específicas que o agente deve conhecer..."
                      rows={6}
                    />
                  </div>

                  <div className="border-t pt-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">Documentos</h4>
                          <p className="text-sm text-gray-500">
                            Envie arquivos PDF, DOCX, TXT ou XLSX para expandir o conhecimento
                          </p>
                        </div>
                        <div>
                          <input
                            type="file"
                            id="file-upload"
                            accept=".pdf,.docx,.txt,.xlsx"
                            onChange={handleFileUpload}
                            className="hidden"
                          />
                          <Button 
                            onClick={() => document.getElementById('file-upload')?.click()}
                            disabled={uploadMutation.isPending}
                            variant="outline"
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            {uploadMutation.isPending ? "Enviando..." : "Enviar Arquivo"}
                          </Button>
                        </div>
                      </div>

                      {documents.length > 0 ? (
                        <div className="space-y-3">
                          {documents.map((doc: any, index: number) => (
                            <div key={`${doc.id}-${index}`} className="flex items-center justify-between p-4 border rounded-lg">
                              <div className="flex items-center space-x-3">
                                <FileText className="h-5 w-5 text-blue-500" />
                                <div>
                                  <p className="font-medium">{doc.originalFilename || doc.filename}</p>
                                  <p className="text-sm text-gray-500">
                                    {doc.fileSize ? `${(doc.fileSize / 1024).toFixed(1)} KB` : ''} 
                                    {doc.fileType && ` • ${doc.fileType.toUpperCase()}`}
                                    {doc.totalChunks > 1 && ` • ${doc.totalChunks} chunks`}
                                  </p>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteDocument(doc.id)}
                                disabled={deleteDocumentMutation.isPending}
                                className="text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                          <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                          <p className="text-gray-500">Nenhum documento enviado ainda</p>
                          <p className="text-sm text-gray-400">Envie arquivos para expandir a base de conhecimento</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* WhatsApp Integration */}
            {activeSection === "whatsapp" && (
              <WhatsAppIntegration agentId={agentId} />
            )}

            {/* Advanced Settings */}
            {activeSection === "advanced" && (
              <Card>
                <CardHeader>
                  <CardTitle>Configurações Avançadas</CardTitle>
                  <CardDescription>
                    Configurações técnicas e integrações especializadas
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="font-medium">Capacidades</h4>
                      <div className="space-y-2">
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" className="rounded" />
                          <span className="text-sm">Análise de Imagens</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" className="rounded" />
                          <span className="text-sm">Transcrição de Áudio</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" className="rounded" />
                          <span className="text-sm">Busca na Web</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" className="rounded" />
                          <span className="text-sm">Integração com APIs</span>
                        </label>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium">Logs e Monitoramento</h4>
                      <div className="space-y-2">
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" className="rounded" defaultChecked />
                          <span className="text-sm">Registrar Conversas</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" className="rounded" defaultChecked />
                          <span className="text-sm">Métricas de Performance</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" className="rounded" />
                          <span className="text-sm">Alertas de Erro</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}