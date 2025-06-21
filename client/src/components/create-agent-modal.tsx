import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { insertAgentSchema } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Upload, Database, Globe, Calendar, FileText, Sheet, FolderOpen, Brain, Code, Search, Image, Calculator, Webhook } from "lucide-react";
import { z } from "zod";

const createAgentSchema = insertAgentSchema.extend({
  tools: z.array(z.string()).optional(),
  googleServices: z.array(z.string()).optional(),
  externalApis: z.string().optional(),
});

type CreateAgentForm = z.infer<typeof createAgentSchema>;

interface CreateAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const availableTools = [
  { id: "web_search", label: "Pesquisa Web", description: "Permite ao agente pesquisar informações na web", icon: Search },
  { id: "image_analysis", label: "Análise de Imagens", description: "Capacidade de analisar e descrever imagens", icon: Image },
  { id: "file_upload", label: "Upload de Arquivos", description: "Aceita uploads de documentos para análise", icon: Upload },
  { id: "calculator", label: "Calculadora", description: "Realiza cálculos matemáticos complexos", icon: Calculator },
  { id: "code_interpreter", label: "Interpretador de Código", description: "Executa e analisa código de programação", icon: Code },
];

const googleServices = [
  { id: "calendar", label: "Google Calendar", icon: Calendar, description: "Gerenciar eventos e agendamentos" },
  { id: "drive", label: "Google Drive", icon: FolderOpen, description: "Acessar e gerenciar arquivos" },
  { id: "sheets", label: "Google Sheets", icon: Sheet, description: "Manipular planilhas e dados" },
  { id: "docs", label: "Google Docs", icon: FileText, description: "Criar e editar documentos" },
];

export default function CreateAgentModal({ isOpen, onClose }: CreateAgentModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [selectedGoogleServices, setSelectedGoogleServices] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("basic");
  const [apiConfigs, setApiConfigs] = useState<Array<{name: string, url: string, authType: string}>>([]);

  const form = useForm<CreateAgentForm>({
    resolver: zodResolver(createAgentSchema),
    defaultValues: {
      name: "",
      description: "",
      systemPrompt: "",
      model: "gpt-4o",
      temperature: 0.7,
      maxTokens: 2048,
      topP: 1.0,
      status: "draft",
      responseStyle: "professional",
      language: "pt",
      tools: [],
      googleServices: [],
      knowledgeBase: "",
      externalApis: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateAgentForm) => {
      const payload = {
        ...data,
        tools: selectedTools,
        googleServices: selectedGoogleServices,
        externalApis: JSON.stringify(apiConfigs),
      };
      const res = await apiRequest("POST", "/api/agents", payload);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Agente criado",
        description: "Seu agente de IA foi criado com sucesso.",
      });
      onClose();
      form.reset();
      setSelectedTools([]);
      setSelectedGoogleServices([]);
      setApiConfigs([]);
      setActiveTab("basic");
    },
    onError: (error: Error) => {
      toast({
        title: "Falha na criação",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CreateAgentForm) => {
    createMutation.mutate(data);
  };

  const handleToolToggle = (toolId: string, checked: boolean) => {
    if (checked) {
      setSelectedTools(prev => [...prev, toolId]);
    } else {
      setSelectedTools(prev => prev.filter(id => id !== toolId));
    }
  };

  const handleGoogleServiceToggle = (serviceId: string, checked: boolean) => {
    if (checked) {
      setSelectedGoogleServices(prev => [...prev, serviceId]);
    } else {
      setSelectedGoogleServices(prev => prev.filter(id => id !== serviceId));
    }
  };

  const addApiConfig = () => {
    setApiConfigs(prev => [...prev, { name: "", url: "", authType: "bearer" }]);
  };

  const removeApiConfig = (index: number) => {
    setApiConfigs(prev => prev.filter((_, i) => i !== index));
  };

  const updateApiConfig = (index: number, field: string, value: string) => {
    setApiConfigs(prev => prev.map((config, i) => 
      i === index ? { ...config, [field]: value } : config
    ));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Brain className="h-5 w-5 mr-2" />
            Criar Novo Agente
          </DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">Básico</TabsTrigger>
            <TabsTrigger value="tools">Ferramentas</TabsTrigger>
            <TabsTrigger value="knowledge">Base de Conhecimento</TabsTrigger>
            <TabsTrigger value="integrations">Integrações</TabsTrigger>
          </TabsList>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              {/* Aba Básico */}
              <TabsContent value="basic" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome do Agente</FormLabel>
                        <FormControl>
                          <Input placeholder="Digite um nome para seu agente" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="draft">Rascunho</SelectItem>
                            <SelectItem value="testing">Teste</SelectItem>
                            <SelectItem value="active">Ativo</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Input placeholder="Breve descrição do propósito do seu agente" {...field} />
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
                          placeholder="Defina a personalidade, função e instruções do seu agente..."
                          rows={6}
                          {...field}
                        />
                      </FormControl>
                      <p className="text-xs text-slate-500">
                        Este prompt define como seu agente de IA irá se comportar e responder aos usuários.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="responseStyle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estilo de Resposta</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o estilo de resposta" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="professional">Profissional</SelectItem>
                            <SelectItem value="casual">Casual</SelectItem>
                            <SelectItem value="technical">Técnico</SelectItem>
                            <SelectItem value="creative">Criativo</SelectItem>
                            <SelectItem value="friendly">Amigável</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="language"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Idioma Principal</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o idioma" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="pt">Português</SelectItem>
                            <SelectItem value="en">Inglês</SelectItem>
                            <SelectItem value="es">Espanhol</SelectItem>
                            <SelectItem value="fr">Francês</SelectItem>
                            <SelectItem value="de">Alemão</SelectItem>
                            <SelectItem value="it">Italiano</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Configurações Avançadas */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Configurações do Modelo</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="model"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Modelo</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="gpt-4o">GPT-4o</SelectItem>
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
                            <FormLabel>Temperatura: {field.value}</FormLabel>
                            <FormControl>
                              <Input
                                type="range"
                                min="0"
                                max="2"
                                step="0.1"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="maxTokens"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Max Tokens</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="1"
                                max="8192"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Aba Ferramentas */}
              <TabsContent value="tools" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Code className="h-4 w-4 mr-2" />
                      Ferramentas Disponíveis
                    </CardTitle>
                    <CardDescription>
                      Selecione as ferramentas que seu agente poderá utilizar
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {availableTools.map((tool) => (
                        <div key={tool.id} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-slate-50">
                          <Checkbox
                            id={tool.id}
                            checked={selectedTools.includes(tool.id)}
                            onCheckedChange={(checked) => handleToolToggle(tool.id, !!checked)}
                          />
                          <div className="flex-1">
                            <div className="flex items-center">
                              <tool.icon className="h-4 w-4 mr-2 text-slate-600" />
                              <Label htmlFor={tool.id} className="font-medium">
                                {tool.label}
                              </Label>
                            </div>
                            <p className="text-sm text-slate-500 mt-1">{tool.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {selectedTools.length > 0 && (
                      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm font-medium text-blue-800">Ferramentas Selecionadas:</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {selectedTools.map((toolId) => {
                            const tool = availableTools.find(t => t.id === toolId);
                            return (
                              <Badge key={toolId} variant="secondary">
                                {tool?.label}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Aba Base de Conhecimento */}
              <TabsContent value="knowledge" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Database className="h-4 w-4 mr-2" />
                      Base de Conhecimento
                    </CardTitle>
                    <CardDescription>
                      Configure a base de conhecimento e documentos RAG para seu agente
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <FormField
                      control={form.control}
                      name="knowledgeBase"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Conhecimento Base</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Adicione informações específicas que seu agente deve conhecer..."
                              rows={6}
                              {...field}
                            />
                          </FormControl>
                          <p className="text-xs text-slate-500">
                            Informações específicas do domínio, políticas da empresa, ou conhecimento especializado.
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Separator />

                    <div>
                      <h4 className="text-sm font-medium mb-3">Upload de Documentos RAG</h4>
                      <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
                        <Upload className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                        <p className="text-sm text-slate-600 mb-2">
                          Arraste arquivos aqui ou clique para fazer upload
                        </p>
                        <p className="text-xs text-slate-500">
                          Suporta PDF, DOC, TXT, MD (máx. 10MB cada)
                        </p>
                        <Button type="button" variant="outline" className="mt-3">
                          <Upload className="h-4 w-4 mr-2" />
                          Selecionar Arquivos
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Aba Integrações */}
              <TabsContent value="integrations" className="space-y-6">
                {/* Google Services */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Globe className="h-4 w-4 mr-2" />
                      Google Services
                    </CardTitle>
                    <CardDescription>
                      Integre seu agente com serviços do Google
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {googleServices.map((service) => (
                        <div key={service.id} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-slate-50">
                          <Checkbox
                            id={service.id}
                            checked={selectedGoogleServices.includes(service.id)}
                            onCheckedChange={(checked) => handleGoogleServiceToggle(service.id, !!checked)}
                          />
                          <div className="flex-1">
                            <div className="flex items-center">
                              <service.icon className="h-4 w-4 mr-2 text-slate-600" />
                              <Label htmlFor={service.id} className="font-medium">
                                {service.label}
                              </Label>
                            </div>
                            <p className="text-sm text-slate-500 mt-1">{service.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* APIs Externas */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Webhook className="h-4 w-4 mr-2" />
                        APIs Externas
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={addApiConfig}>
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar API
                      </Button>
                    </CardTitle>
                    <CardDescription>
                      Configure integrações com APIs externas
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {apiConfigs.map((config, index) => (
                      <div key={index} className="p-4 border rounded-lg space-y-3">
                        <div className="flex justify-between items-center">
                          <h5 className="font-medium">API #{index + 1}</h5>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeApiConfig(index)}
                          >
                            Remover
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <Input
                            placeholder="Nome da API"
                            value={config.name}
                            onChange={(e) => updateApiConfig(index, 'name', e.target.value)}
                          />
                          <Input
                            placeholder="URL Base"
                            value={config.url}
                            onChange={(e) => updateApiConfig(index, 'url', e.target.value)}
                          />
                          <Select
                            value={config.authType}
                            onValueChange={(value) => updateApiConfig(index, 'authType', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="bearer">Bearer Token</SelectItem>
                              <SelectItem value="api_key">API Key</SelectItem>
                              <SelectItem value="basic">Basic Auth</SelectItem>
                              <SelectItem value="oauth">OAuth</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))}
                    
                    {apiConfigs.length === 0 && (
                      <div className="text-center py-6 text-slate-500">
                        <Webhook className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                        <p>Nenhuma API externa configurada</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Botões de Ação */}
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? (
                    "Criando..."
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Criar Agente
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}