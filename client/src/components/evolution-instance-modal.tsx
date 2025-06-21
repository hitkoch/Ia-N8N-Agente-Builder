import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { insertEvolutionInstanceSchema, Agent } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Smartphone, Globe, Lock } from "lucide-react";
import { z } from "zod";

const createEvolutionInstanceSchema = insertEvolutionInstanceSchema.extend({
  webhookEvents: z.array(z.string()).optional(),
});

type CreateEvolutionInstanceForm = z.infer<typeof createEvolutionInstanceSchema>;

interface EvolutionInstanceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const availableEvents = [
  { id: "messages.upsert", label: "Message Received" },
  { id: "messages.update", label: "Message Updated" },
  { id: "presence.update", label: "Presence Update" },
  { id: "connection.update", label: "Connection Status" },
  { id: "qrcode.updated", label: "QR Code Update" },
  { id: "instance.connect", label: "Instance Connected" },
  { id: "instance.disconnect", label: "Instance Disconnected" },
];

export default function EvolutionInstanceModal({ isOpen, onClose }: EvolutionInstanceModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
    enabled: isOpen,
  });

  const form = useForm<CreateEvolutionInstanceForm>({
    resolver: zodResolver(createEvolutionInstanceSchema),
    defaultValues: {
      name: "",
      url: "",
      instanceId: "",
      apiKey: "",
      status: "inactive",
      webhookUrl: "",
      webhookSecret: "",
      webhookEvents: [],
      connectedAgentId: undefined,
      qrCode: "",
      phoneNumber: "",
      connectionData: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateEvolutionInstanceForm) => {
      const payload = {
        ...data,
        webhookEvents: selectedEvents,
      };
      const res = await apiRequest("POST", "/api/evolution-instances", payload);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/evolution-instances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Evolution instance created",
        description: "Your Evolution API instance has been successfully created.",
      });
      onClose();
      form.reset();
      setSelectedEvents([]);
    },
    onError: (error: Error) => {
      toast({
        title: "Creation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CreateEvolutionInstanceForm) => {
    createMutation.mutate(data);
  };

  const handleEventToggle = (eventId: string, checked: boolean) => {
    if (checked) {
      setSelectedEvents(prev => [...prev, eventId]);
    } else {
      setSelectedEvents(prev => prev.filter(id => id !== eventId));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Smartphone className="h-5 w-5 mr-2" />
            Create Evolution API Instance
          </DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Configuration */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center">
                <Globe className="h-4 w-4 mr-2" />
                Basic Configuration
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Instance Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Customer Support WhatsApp" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="instanceId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Instance ID</FormLabel>
                      <FormControl>
                        <Input placeholder="Unique identifier for this instance" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Evolution API URL</FormLabel>
                    <FormControl>
                      <Input 
                        type="url" 
                        placeholder="https://your-evolution-api.com" 
                        {...field} 
                      />
                    </FormControl>
                    <p className="text-xs text-slate-500">
                      The base URL of your Evolution API instance
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="apiKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>API Key</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="Your Evolution API key" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="connectedAgentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Connected Agent (Optional)</FormLabel>
                    <Select onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)} value={field.value?.toString()}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an agent to connect" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {agents.map((agent) => (
                          <SelectItem key={agent.id} value={agent.id.toString()}>
                            {agent.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500">
                      The AI agent that will handle messages from this instance
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Webhook Configuration */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center">
                <Lock className="h-4 w-4 mr-2" />
                Webhook Configuration
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="webhookUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Webhook URL</FormLabel>
                      <FormControl>
                        <Input 
                          type="url" 
                          placeholder="https://your-domain.com/webhook" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="webhookSecret"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Webhook Secret</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder="Secret for webhook verification" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div>
                <Label className="text-base font-medium">Webhook Events</Label>
                <p className="text-sm text-slate-600 mb-3">
                  Select which events you want to receive via webhook
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {availableEvents.map((event) => (
                    <div key={event.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={event.id}
                        checked={selectedEvents.includes(event.id)}
                        onCheckedChange={(checked) => handleEventToggle(event.id, !!checked)}
                      />
                      <Label htmlFor={event.id} className="text-sm">
                        {event.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Connection Data */}
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="connectionData"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Additional Connection Data (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Additional configuration in JSON format"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <p className="text-xs text-slate-500">
                      Extra configuration data in JSON format for advanced setups
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? (
                  "Creating..."
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Instance
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}