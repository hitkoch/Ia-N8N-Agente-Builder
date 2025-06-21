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
import { ArrowLeft, Save, TestTube, Upload, FileText, Trash2, Settings, Database, Smartphone, Bot } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import Sidebar from "@/components/sidebar";

interface AgentEditProps {
  agentId: string;
}

export default function AgentEdit({ agentId }: AgentEditProps) {
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

  // Fetch agent with custom query function to debug
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
      return await apiRequest(`/api/agents/${agentId}/documents/${docId}`, {
        method: "DELETE",
      });
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

  const handleSectionChange = (section: string) => {
    setLocation("/");
  };

  if (authLoading || isLoading) {
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

  if (!user) {
    return null; // Will redirect in useEffect
  }

  if (error || (!isLoading && !agent)) {
    return (
      <div className="flex h-screen">
        <Sidebar onSectionChange={handleSectionChange} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Bot className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600 mb-2">Agente não encontrado</p>
            <p className="text-sm text-gray-500 mb-4">ID: {agentId}</p>
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
        <div className="bg-white border-b px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={() => setLocation("/")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <div>
                <h1 className="text-2xl font-bold">{agent.name}</h1>
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

        {/* Tab Navigation */}
        <div className="border-b bg-white px-6 flex-shrink-0">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: "basic", label: "Básico", icon: Settings },
              { id: "knowledge", label: "Conhecimento", icon: Database },
              { id: "whatsapp", label: "WhatsApp", icon: Smartphone }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setCurrentTab(tab.id)}
                  className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                    currentTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">


          {/* Basic Tab */}
          {currentTab === "basic" && (
            <div className="max-w-4xl">
              <Card>
                <CardHeader>
                  <CardTitle>Configurações Básicas</CardTitle>
                  <CardDescription>Configure as informações do agente</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="name">Nome</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Nome do agente"
                        className="mt-1"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="status">Status</Label>
                      <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Rascunho</SelectItem>
                          <SelectItem value="active">Ativo</SelectItem>
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
                      placeholder="Descreva o agente..."
                      rows={3}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="systemPrompt">Prompt do Sistema</Label>
                    <Textarea
                      id="systemPrompt"
                      value={formData.systemPrompt}
                      onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                      placeholder="Você é um assistente..."
                      rows={6}
                      className="mt-1"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="model">Modelo</Label>
                      <Select value={formData.model} onValueChange={(value) => setFormData({ ...formData, model: value })}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                          <SelectItem value="gpt-4">GPT-4</SelectItem>
                          <SelectItem value="gpt-3.5-turbo">GPT-3.5</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label>Temperature: {formData.temperature}</Label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={formData.temperature}
                        onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                        className="w-full mt-2 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Knowledge Tab */}
          {currentTab === "knowledge" && (
            <div className="max-w-4xl">
              <Card>
                <CardHeader>
                  <CardTitle>Base de Conhecimento</CardTitle>
                  <CardDescription>Gerencie documentos e conhecimento</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label htmlFor="knowledgeBase">Conhecimento Base</Label>
                    <Textarea
                      id="knowledgeBase"
                      value={formData.knowledgeBase}
                      onChange={(e) => setFormData({ ...formData, knowledgeBase: e.target.value })}
                      placeholder="Adicione informações que o agente deve conhecer..."
                      rows={6}
                      className="mt-1"
                    />
                  </div>

                  <div className="border-t pt-6">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h4 className="font-medium">Documentos</h4>
                        <p className="text-sm text-gray-500">Envie arquivos para expandir o conhecimento</p>
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
                          {uploadMutation.isPending ? "Enviando..." : "Enviar"}
                        </Button>
                      </div>
                    </div>

                    {documents.length > 0 ? (
                      <div className="space-y-3">
                        {documents.map((doc: any) => (
                          <div key={doc.id} className="flex items-center justify-between p-4 border rounded">
                            <div className="flex items-center space-x-3">
                              <FileText className="h-5 w-5 text-blue-500" />
                              <div>
                                <p className="font-medium">{doc.originalName || doc.filename}</p>
                                <p className="text-sm text-gray-500">
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
                              className="text-red-500"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded">
                        <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                        <p className="text-gray-500">Nenhum documento enviado</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* WhatsApp Tab */}
          {currentTab === "whatsapp" && (
            <div className="max-w-4xl">
              <Card>
                <CardHeader>
                  <CardTitle>Integração WhatsApp</CardTitle>
                  <CardDescription>Configure a integração com WhatsApp</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <Smartphone className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-500">Configuração do WhatsApp será implementada</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}