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
import { ArrowLeft, Save, Upload, FileText, Trash2, Settings, Database, Smartphone, Bot } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import Sidebar from "@/components/sidebar";

interface AgentEditProps {
  agentId: string;
}

export default function AgentEditNew({ agentId }: AgentEditProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [currentTab, setCurrentTab] = useState("basic");
  const { user, isLoading: authLoading } = useAuth();

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      setLocation("/auth");
    }
  }, [authLoading, user, setLocation]);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    systemPrompt: "",
    knowledgeBase: "",
    model: "gpt-4o",
    temperature: 0.7,
    status: "draft"
  });

  // Fetch agent
  const { data: agent, isLoading, error } = useQuery({
    queryKey: [`/api/agents/${agentId}`],
    enabled: !!agentId && !!user,
    retry: false,
  });

  // Fetch documents
  const { data: documents = [] } = useQuery({
    queryKey: [`/api/agents/${agentId}/documents`],
    enabled: !!agentId && !!agent && !!user,
    retry: false,
  });

  // Update form when agent loads
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

  // Update agent
  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch(`/api/agents/${agentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Erro ${response.status}`);
      }

      return await response.json();
    },
    onSuccess: () => {
      toast({ title: "Agente atualizado", description: "Configurações salvas com sucesso." });
      queryClient.invalidateQueries({ queryKey: [`/api/agents/${agentId}`] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  // Upload file
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("document", file);

      const response = await fetch(`/api/agents/${agentId}/upload-document`, {
        method: "POST",
        body: form,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Erro no upload");
      }

      return await response.json();
    },
    onSuccess: () => {
      toast({ title: "Documento enviado", description: "Arquivo processado com sucesso." });
      queryClient.invalidateQueries({ queryKey: [`/api/agents/${agentId}/documents`] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro no upload", description: error.message, variant: "destructive" });
    },
  });

  // Delete document
  const deleteMutation = useMutation({
    mutationFn: async (docId: number) => {
      const response = await fetch(`/api/agents/${agentId}/documents/${docId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Erro ao excluir documento");
      }

      return await response.json();
    },
    onSuccess: () => {
      toast({ title: "Documento excluído" });
      queryClient.invalidateQueries({ queryKey: [`/api/agents/${agentId}/documents`] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
  };

  const handleDeleteDoc = (docId: number) => {
    deleteMutation.mutate(docId);
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Bot className="h-12 w-12 mx-auto mb-4 animate-pulse text-blue-500" />
          <p className="text-gray-600">Carregando agente...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect in useEffect
  }

  if (error || (!isLoading && !agent)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Bot className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600 mb-2">Agente não encontrado</p>
          <p className="text-sm text-gray-500 mb-4">ID: {agentId}</p>
          <Button onClick={() => setLocation("/")}>
            Voltar ao Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const handleSectionChange = (section: string) => {
    setLocation("/");
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar onSectionChange={handleSectionChange} />
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navigation Bar */}
        <div className="bg-white border-b shadow-sm flex-shrink-0">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Button variant="ghost" size="sm" onClick={() => setLocation("/")}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Dashboard
                </Button>
                <div className="h-6 w-px bg-gray-300"></div>
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">{agent.name}</h1>
                  <p className="text-sm text-gray-500">Editando agente</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <Badge variant={agent.status === "active" ? "default" : "secondary"}>
                  {agent.status === "active" ? "Ativo" : "Rascunho"}
                </Badge>
                
                <Button onClick={handleSave} disabled={updateMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  {updateMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white border-b flex-shrink-0">
          <div className="px-6">
            <nav className="flex space-x-8">
              {[
                { id: "basic", label: "Configurações Básicas", icon: Settings },
                { id: "knowledge", label: "Base de Conhecimento", icon: Database },
                { id: "whatsapp", label: "WhatsApp", icon: Smartphone }
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setCurrentTab(tab.id)}
                    className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                      currentTab === tab.id
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
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-auto">
          <div className="px-6 py-8 max-w-5xl mx-auto w-full">
        {/* Basic Tab */}
        {currentTab === "basic" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Informações Básicas</CardTitle>
                <CardDescription>Configure o nome, descrição e status do agente</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="name">Nome do Agente</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ex: Assistente de Vendas"
                      className="mt-2"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                      <SelectTrigger className="mt-2">
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

                <div>
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descreva brevemente a função deste agente..."
                    rows={3}
                    className="mt-2"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Configurações de IA</CardTitle>
                <CardDescription>Configure o comportamento e modelo de IA</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label htmlFor="systemPrompt">Prompt do Sistema</Label>
                  <Textarea
                    id="systemPrompt"
                    value={formData.systemPrompt}
                    onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                    placeholder="Você é um assistente especializado em..."
                    rows={8}
                    className="mt-2"
                  />
                  <p className="text-sm text-gray-500 mt-2">
                    Este prompt define como o agente se comporta e responde às perguntas
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="model">Modelo de IA</Label>
                    <Select value={formData.model} onValueChange={(value) => setFormData({ ...formData, model: value })}>
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gpt-4o">GPT-4o (Mais Avançado)</SelectItem>
                        <SelectItem value="gpt-4">GPT-4 (Balanceado)</SelectItem>
                        <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo (Rápido)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Criatividade: {formData.temperature}</Label>
                    <div className="mt-2">
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={formData.temperature}
                        onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>Conservador</span>
                        <span>Criativo</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Knowledge Tab */}
        {currentTab === "knowledge" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Conhecimento Personalizado</CardTitle>
                <CardDescription>Adicione informações específicas que o agente deve conhecer</CardDescription>
              </CardHeader>
              <CardContent>
                <div>
                  <Label htmlFor="knowledgeBase">Base de Conhecimento</Label>
                  <Textarea
                    id="knowledgeBase"
                    value={formData.knowledgeBase}
                    onChange={(e) => setFormData({ ...formData, knowledgeBase: e.target.value })}
                    placeholder="Adicione informações específicas, procedimentos, FAQ ou qualquer conhecimento que o agente deve ter..."
                    rows={8}
                    className="mt-2"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Documentos</CardTitle>
                <CardDescription>Carregue arquivos para expandir o conhecimento do agente</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Arquivos Suportados</p>
                      <p className="text-sm text-gray-500">PDF, DOCX, TXT, XLSX</p>
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
                        {uploadMutation.isPending ? "Enviando..." : "Carregar Arquivo"}
                      </Button>
                    </div>
                  </div>

                  {documents.length > 0 ? (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium">Documentos Carregados</h4>
                      {documents.map((doc: any) => (
                        <div key={doc.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <FileText className="h-5 w-5 text-blue-500" />
                            <div>
                              <p className="font-medium text-sm">{doc.originalName || doc.filename}</p>
                              <p className="text-xs text-gray-500">
                                {doc.fileSize && `${(doc.fileSize / 1024).toFixed(1)} KB`}
                                {doc.mimeType && ` • ${doc.mimeType}`}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteDoc(doc.id)}
                            disabled={deleteMutation.isPending}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
                      <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                      <p className="text-gray-500 mb-2">Nenhum documento carregado</p>
                      <p className="text-sm text-gray-400">Arraste e solte arquivos ou clique em "Carregar Arquivo"</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* WhatsApp Tab */}
        {currentTab === "whatsapp" && (
          <Card>
            <CardHeader>
              <CardTitle>Integração WhatsApp</CardTitle>
              <CardDescription>Configure a conexão com WhatsApp Business</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Smartphone className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">WhatsApp em Desenvolvimento</h3>
                <p className="text-gray-500 max-w-md mx-auto">
                  A integração com WhatsApp Business estará disponível em breve. 
                  Você poderá conectar seu agente diretamente ao WhatsApp.
                </p>
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