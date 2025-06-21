import React, { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { FileText, Search, Calculator, Code, Calendar, FileSpreadsheet, File, Upload, X, Plus } from "lucide-react";
import { insertAgentSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const updateAgentSchema = insertAgentSchema.extend({
  temperature: z.number().min(0).max(2).optional(),
});

type UpdateAgentForm = z.infer<typeof updateAgentSchema>;

interface EditAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: number | null;
}

const availableTools = [
  { id: "web_search", name: "Pesquisa Web", description: "Buscar informações atualizadas na internet", icon: Search },
  { id: "image_analysis", name: "Análise de Imagens", description: "Analisar e descrever imagens", icon: FileText },
  { id: "calculator", name: "Calculadora", description: "Realizar cálculos matemáticos", icon: Calculator },
  { id: "code_interpreter", name: "Interpretador de Código", description: "Executar e analisar código", icon: Code },
];

const googleServices = [
  { id: "calendar", name: "Google Calendar", description: "Gerenciar eventos e compromissos", icon: Calendar },
  { id: "drive", name: "Google Drive", description: "Acessar e gerenciar arquivos", icon: File },
  { id: "sheets", name: "Google Sheets", description: "Trabalhar com planilhas", icon: FileSpreadsheet },
  { id: "docs", name: "Google Docs", description: "Criar e editar documentos", icon: FileText },
];

export default function EditAgentModal({ isOpen, onClose, agentId }: EditAgentModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Agent data query
  const { data: agent, isLoading: agentLoading } = useQuery({
    queryKey: ["/api/agents", agentId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/agents/${agentId}`);
      return await res.json();
    },
    enabled: isOpen && !!agentId,
  });

  // Initialize form with agent data
  const defaultValues = useMemo(() => ({
    name: agent?.name || "",
    description: agent?.description || "",
    systemPrompt: agent?.systemPrompt || "",
    model: agent?.model || "gpt-4o",
    temperature: agent?.temperature || 0.7,
    status: agent?.status || "draft",
  }), [agent]);

  const form = useForm<UpdateAgentForm>({
    resolver: zodResolver(updateAgentSchema),
    values: defaultValues, // Use values instead of defaultValues to update when agent changes
  });

  // Parse existing tools and services
  const existingTools = useMemo(() => {
    return agent?.tools ? agent.tools.split(',').filter(Boolean) : [];
  }, [agent?.tools]);

  const existingGoogleServices = useMemo(() => {
    return agent?.googleServices ? agent.googleServices.split(',').filter(Boolean) : [];
  }, [agent?.googleServices]);

  // Local state for selections
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [selectedGoogleServices, setSelectedGoogleServices] = useState<string[]>([]);
  const [ragDocuments, setRagDocuments] = useState<any[]>([]);
  const [apiConfigs, setApiConfigs] = useState<any[]>([]);
  const [newApiConfig, setNewApiConfig] = useState({ name: "", baseUrl: "", authType: "none" });

  // Initialize selections when agent data is available
  React.useEffect(() => {
    if (agent && isOpen) {
      setSelectedTools(existingTools);
      setSelectedGoogleServices(existingGoogleServices);
    }
  }, [agent, isOpen, existingTools, existingGoogleServices]);

  // Reset states when modal closes
  React.useEffect(() => {
    if (!isOpen) {
      setSelectedTools([]);
      setSelectedGoogleServices([]);
      setRagDocuments([]);
      setApiConfigs([]);
      setNewApiConfig({ name: "", baseUrl: "", authType: "none" });
    }
  }, [isOpen]);

  const updateMutation = useMutation({
    mutationFn: async (data: UpdateAgentForm) => {
      const res = await apiRequest("PUT", `/api/agents/${agentId}`, {
        ...data,
        tools: selectedTools.join(','),
        googleServices: selectedGoogleServices.join(','),
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
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Falha ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleToolToggle = (toolId: string) => {
    setSelectedTools(prev => 
      prev.includes(toolId) 
        ? prev.filter(id => id !== toolId)
        : [...prev, toolId]
    );
  };

  const handleGoogleServiceToggle = (serviceId: string) => {
    setSelectedGoogleServices(prev => 
      prev.includes(serviceId) 
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
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

  const addApiConfig = () => {
    if (newApiConfig.name && newApiConfig.baseUrl) {
      const config = {
        id: Date.now(),
        ...newApiConfig,
        isActive: true,
      };
      setApiConfigs(prev => [...prev, config]);
      setNewApiConfig({ name: "", baseUrl: "", authType: "none" });
      
      toast({
        title: "API adicionada",
        description: `Configuração da API ${config.name} foi adicionada.`,
      });
    }
  };

  const removeApiConfig = (configId: number) => {
    setApiConfigs(prev => prev.filter(config => config.id !== configId));
    toast({
      title: "API removida",
      description: "A configuração da API foi removida.",
    });
  };

  const onSubmit = (data: UpdateAgentForm) => {
    updateMutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Agente</DialogTitle>
        </DialogHeader>

        {agentLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome</FormLabel>
                            <FormControl>
                              <Input placeholder="Nome do agente" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Descrição</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Descreva a função do agente"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="systemPrompt"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Prompt do Sistema</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Instruções para o comportamento do agente"
                                rows={4}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="model"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Modelo</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione o modelo" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="gpt-4o">GPT-4 Omni</SelectItem>
                                  <SelectItem value="gpt-4">GPT-4</SelectItem>
                                  <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="temperature"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Temperatura</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  max="2"
                                  step="0.1"
                                  placeholder="0.7"
                                  {...field}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Status</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione o status" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="draft">Rascunho</SelectItem>
                                <SelectItem value="testing">Testando</SelectItem>
                                <SelectItem value="active">Ativo</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
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
                        {availableTools.map((tool) => {
                          const Icon = tool.icon;
                          const isSelected = selectedTools.includes(tool.id);
                          
                          return (
                            <div
                              key={tool.id}
                              className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                                isSelected 
                                  ? 'border-primary bg-primary/5' 
                                  : 'border-border hover:border-primary/50'
                              }`}
                              onClick={() => handleToolToggle(tool.id)}
                            >
                              <div className="flex items-start space-x-3">
                                <Checkbox
                                  checked={isSelected}
                                  readOnly
                                  className="mt-1"
                                />
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2">
                                    <Icon className="h-4 w-4" />
                                    <h4 className="font-medium">{tool.name}</h4>
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {tool.description}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="knowledge" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Base de Conhecimento</CardTitle>
                      <CardDescription>Gerencie documentos e arquivos para o agente</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground mb-2">
                          Clique para fazer upload ou arraste arquivos aqui
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
                          Selecionar Arquivo
                        </Button>
                      </div>

                      {ragDocuments.length > 0 && (
                        <div className="space-y-2">
                          <Label>Arquivos Carregados:</Label>
                          {ragDocuments.map((doc) => (
                            <div key={doc.id} className="flex items-center justify-between p-3 border rounded">
                              <div className="flex items-center space-x-2">
                                <FileText className="h-4 w-4" />
                                <span className="text-sm">{doc.originalName}</span>
                                <Badge variant="secondary">
                                  {(doc.fileSize / 1024).toFixed(1)} KB
                                </Badge>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeDocument(doc.id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
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
                        {googleServices.map((service) => {
                          const Icon = service.icon;
                          const isSelected = selectedGoogleServices.includes(service.id);
                          
                          return (
                            <div
                              key={service.id}
                              className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                                isSelected 
                                  ? 'border-primary bg-primary/5' 
                                  : 'border-border hover:border-primary/50'
                              }`}
                              onClick={() => handleGoogleServiceToggle(service.id)}
                            >
                              <div className="flex items-start space-x-3">
                                <Checkbox
                                  checked={isSelected}
                                  readOnly
                                  className="mt-1"
                                />
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2">
                                    <Icon className="h-4 w-4" />
                                    <h4 className="font-medium">{service.name}</h4>
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {service.description}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>APIs Externas</CardTitle>
                      <CardDescription>Configure integrações com APIs customizadas</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Input
                          placeholder="Nome da API"
                          value={newApiConfig.name}
                          onChange={(e) => setNewApiConfig(prev => ({ ...prev, name: e.target.value }))}
                        />
                        <Input
                          placeholder="URL Base"
                          value={newApiConfig.baseUrl}
                          onChange={(e) => setNewApiConfig(prev => ({ ...prev, baseUrl: e.target.value }))}
                        />
                        <div className="flex space-x-2">
                          <Select
                            value={newApiConfig.authType}
                            onValueChange={(value) => setNewApiConfig(prev => ({ ...prev, authType: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Sem Autenticação</SelectItem>
                              <SelectItem value="bearer">Bearer Token</SelectItem>
                              <SelectItem value="api_key">API Key</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button type="button" onClick={addApiConfig}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {apiConfigs.length > 0 && (
                        <div className="space-y-2">
                          <Label>APIs Configuradas:</Label>
                          {apiConfigs.map((config) => (
                            <div key={config.id} className="flex items-center justify-between p-3 border rounded">
                              <div>
                                <span className="font-medium">{config.name}</span>
                                <p className="text-sm text-muted-foreground">{config.baseUrl}</p>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeApiConfig(config.id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              <Separator />

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}