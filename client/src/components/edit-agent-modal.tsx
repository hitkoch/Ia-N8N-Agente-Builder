import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { insertAgentSchema, Agent } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Save, Trash2 } from "lucide-react";
import { z } from "zod";

const updateAgentSchema = insertAgentSchema.extend({
  temperature: z.number().min(0).max(2),
  maxTokens: z.number().min(1).max(4096),
  topP: z.number().min(0).max(1),
});

type UpdateAgentForm = z.infer<typeof updateAgentSchema>;

interface EditAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: number | null;
}

export default function EditAgentModal({ isOpen, onClose, agentId }: EditAgentModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: agent, isLoading } = useQuery<Agent>({
    queryKey: ["/api/agents", agentId],
    enabled: isOpen && !!agentId,
  });

  const form = useForm<UpdateAgentForm>({
    resolver: zodResolver(updateAgentSchema),
    defaultValues: {
      name: "",
      systemPrompt: "",
      model: "gpt-3.5-turbo",
      temperature: 0.7,
      maxTokens: 2048,
      topP: 1.0,
      status: "draft",
    },
  });

  useEffect(() => {
    if (agent) {
      form.reset({
        name: agent.name,
        systemPrompt: agent.systemPrompt,
        model: agent.model,
        temperature: agent.temperature,
        maxTokens: agent.maxTokens,
        topP: agent.topP,
        status: agent.status,
      });
    }
  }, [agent, form]);

  const updateMutation = useMutation({
    mutationFn: async (data: UpdateAgentForm) => {
      const res = await apiRequest("PUT", `/api/agents/${agentId}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents", agentId] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Agent updated",
        description: "Your AI agent has been successfully updated.",
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/agents/${agentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Agent deleted",
        description: "The agent has been successfully deleted.",
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: UpdateAgentForm) => {
    const updateData = {
      ...data,
      tools: selectedTools.join(','),
      googleServices: selectedGoogleServices.join(','),
    };
    updateMutation.mutate(updateData);
  };

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
      // Simular upload de arquivo
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

  const addApiConfig = () => {
    if (newApiConfig.name && newApiConfig.baseUrl) {
      const config = {
        id: Date.now(),
        ...newApiConfig,
        authConfig: "{}",
        endpoints: "[]",
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

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this agent? This action cannot be undone.")) {
      deleteMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-slate-200 rounded w-1/4"></div>
              <div className="h-8 bg-slate-200 rounded"></div>
              <div className="h-4 bg-slate-200 rounded w-1/3"></div>
              <div className="h-32 bg-slate-200 rounded"></div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!agent) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit AI Agent</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Agent Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>AI Model</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a model" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="gpt-4">GPT-4</SelectItem>
                        <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                        <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="systemPrompt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>System Prompt</FormLabel>
                  <FormControl>
                    <Textarea rows={6} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="temperature"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Temperature</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
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
                        max="4096"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="topP"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Top P</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        max="1"
                        step="0.1"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-between pt-4">
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Agent
              </Button>
              <div className="flex space-x-3">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? (
                    "Saving..."
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
