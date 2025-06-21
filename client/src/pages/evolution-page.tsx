import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EvolutionInstance, Agent } from "@shared/schema";
import { Plus, Settings, Eye, Webhook, Smartphone, QrCode, Phone, Activity, ExternalLink, Copy, Trash2, AlertCircle, CheckCircle, Clock } from "lucide-react";
import EvolutionInstanceModal from "@/components/evolution-instance-modal";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function EvolutionPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("instances");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: instances = [], isLoading } = useQuery<EvolutionInstance[]>({
    queryKey: ["/api/evolution-instances"],
  });

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const deleteInstanceMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/evolution-instances/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/evolution-instances"] });
      toast({
        title: "Instance deleted",
        description: "Evolution instance has been successfully deleted.",
      });
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "connected":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "active":
        return <Activity className="h-4 w-4 text-blue-500" />;
      case "testing":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-slate-400" />;
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Content copied to clipboard",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">Evolution API Integration</h3>
          <p className="text-sm text-slate-600 mt-1">Connect your AI agents to WhatsApp via Evolution API</p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Instance
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="instances">Instances</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
        </TabsList>

        <TabsContent value="instances" className="space-y-6">
          {/* Integration Guide */}
          <Alert>
            <Smartphone className="h-4 w-4" />
            <AlertDescription>
              Evolution API allows you to integrate WhatsApp with your AI agents. Create an instance, connect your phone, and start automating conversations.
              <a 
                href="https://doc.evolution-api.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center ml-2 text-primary hover:underline"
              >
                View Documentation <ExternalLink className="h-3 w-3 ml-1" />
              </a>
            </AlertDescription>
          </Alert>

          {/* API Instances */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6">
                    <div className="h-4 bg-slate-200 rounded mb-4"></div>
                    <div className="h-3 bg-slate-200 rounded mb-2"></div>
                    <div className="h-3 bg-slate-200 rounded mb-4"></div>
                    <div className="flex space-x-2">
                      <div className="h-8 bg-slate-200 rounded flex-1"></div>
                      <div className="h-8 bg-slate-200 rounded flex-1"></div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : instances.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <div className="h-24 w-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Webhook className="h-12 w-12 text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">No Evolution instances</h3>
                <p className="text-slate-600 mb-4">Create your first Evolution API instance to get started</p>
                <Button onClick={() => setIsCreateModalOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Instance
                </Button>
              </div>
            ) : (
              instances.map((instance) => {
                const connectedAgent = agents.find(a => a.id === instance.connectedAgentId);
                return (
                  <Card key={instance.id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center">
                          <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                            <Smartphone className="h-5 w-5 text-green-600" />
                          </div>
                          <div>
                            <h4 className="text-lg font-semibold text-slate-900">{instance.name}</h4>
                            <p className="text-sm text-slate-600">{instance.instanceId}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(instance.status)}
                          <Badge 
                            variant={
                              instance.status === "connected" ? "default" : 
                              instance.status === "active" ? "secondary" : 
                              "outline"
                            }
                          >
                            {instance.status}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="space-y-3 mb-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">URL:</span>
                          <div className="flex items-center">
                            <span className="text-slate-900 font-mono text-xs truncate max-w-32">
                              {instance.url}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(instance.url)}
                              className="h-6 w-6 p-0 ml-1"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        
                        {instance.phoneNumber && (
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Phone:</span>
                            <div className="flex items-center">
                              <Phone className="h-3 w-3 mr-1 text-green-500" />
                              <span className="text-slate-900">{instance.phoneNumber}</span>
                            </div>
                          </div>
                        )}
                        
                        {connectedAgent && (
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Agent:</span>
                            <span className="text-slate-900 font-medium">{connectedAgent.name}</span>
                          </div>
                        )}
                        
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Webhook:</span>
                          <div className="flex items-center">
                            <div className={`h-2 w-2 rounded-full mr-2 ${
                              instance.webhookUrl ? "bg-green-500" : "bg-yellow-500"
                            }`}></div>
                            <span className="text-slate-900">
                              {instance.webhookUrl ? "Connected" : "Pending"}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Last Activity:</span>
                          <span className="text-slate-900">
                            {instance.lastActivity 
                              ? new Date(instance.lastActivity).toLocaleString()
                              : "Never"
                            }
                          </span>
                        </div>
                      </div>
                      
                      {instance.qrCode && (
                        <div className="mb-4 p-3 bg-slate-50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-slate-700">QR Code</span>
                            <QrCode className="h-4 w-4 text-slate-500" />
                          </div>
                          <div className="bg-white p-2 rounded border">
                            <img 
                              src={`data:image/png;base64,${instance.qrCode}`} 
                              alt="WhatsApp QR Code"
                              className="w-full h-32 object-contain"
                            />
                          </div>
                          <p className="text-xs text-slate-500 mt-2">
                            Scan with WhatsApp to connect your phone
                          </p>
                        </div>
                      )}
                      
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm" className="flex-1">
                          <Settings className="h-4 w-4 mr-1" />
                          Configure
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1">
                          <Eye className="h-4 w-4 mr-1" />
                          Monitor
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => deleteInstanceMutation.mutate(instance.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="webhooks" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Global Webhook Configuration</CardTitle>
              <p className="text-sm text-slate-600">Configure default webhook settings for new instances</p>
            </CardHeader>
            <CardContent>
              <form className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="default-webhook-url">Default Webhook URL</Label>
                    <Input
                      id="default-webhook-url"
                      type="url"
                      placeholder="https://your-domain.com/webhook"
                    />
                  </div>
                  <div>
                    <Label htmlFor="default-webhook-secret">Default Webhook Secret</Label>
                    <Input
                      id="default-webhook-secret"
                      type="password"
                      placeholder="Enter secret key"
                    />
                  </div>
                </div>
                
                <div>
                  <Label className="text-base font-medium">Default Event Types</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
                    {[
                      "Message Received",
                      "Message Sent", 
                      "Instance Connect",
                      "Instance Disconnect",
                      "QR Code Update",
                      "Status Change"
                    ].map((eventType) => (
                      <div key={eventType} className="flex items-center space-x-2">
                        <Checkbox id={`default-${eventType}`} />
                        <Label htmlFor={`default-${eventType}`} className="text-sm">{eventType}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" type="button">
                    Test Webhook
                  </Button>
                  <Button type="submit">
                    Save Configuration
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-green-100">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-slate-600">Connected</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {instances.filter(i => i.status === "connected").length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-blue-100">
                    <Activity className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-slate-600">Active</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {instances.filter(i => i.status === "active").length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-yellow-100">
                    <Clock className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-slate-600">Testing</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {instances.filter(i => i.status === "testing").length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-slate-100">
                    <Smartphone className="h-5 w-5 text-slate-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-slate-600">Total</p>
                    <p className="text-2xl font-bold text-slate-900">{instances.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {instances.filter(i => i.lastActivity).slice(0, 5).map((instance) => (
                  <div key={instance.id} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-b-0">
                    <div className="flex items-center">
                      <div className="h-8 w-8 bg-slate-100 rounded-lg flex items-center justify-center mr-3">
                        <Smartphone className="h-4 w-4 text-slate-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{instance.name}</p>
                        <p className="text-xs text-slate-500">{instance.instanceId}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-900">
                        {instance.lastActivity 
                          ? new Date(instance.lastActivity).toLocaleString()
                          : "No activity"
                        }
                      </p>
                      <div className="flex items-center mt-1">
                        {getStatusIcon(instance.status)}
                        <span className="text-xs text-slate-500 ml-1">{instance.status}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {instances.filter(i => i.lastActivity).length === 0 && (
                  <p className="text-center text-slate-500 py-8">No recent activity</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <EvolutionInstanceModal 
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}
