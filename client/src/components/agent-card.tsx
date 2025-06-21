import { Agent } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Bot, MoreVertical, Edit, Copy, Trash2, Play } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AgentCardProps {
  agent: Agent;
  onEdit: () => void;
  onTest: () => void;
}

export default function AgentCard({ agent, onEdit, onTest }: AgentCardProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isWebchatModalOpen, setIsWebchatModalOpen] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/agents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Agent deleted",
        description: "The agent has been successfully deleted.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (agent: Agent) => {
      const { id, ownerId, createdAt, updatedAt, ...agentData } = agent;
      const duplicatedAgent = {
        ...agentData,
        name: `${agent.name} (Copy)`,
        status: "draft" as const,
      };
      await apiRequest("POST", "/api/agents", duplicatedAgent);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Agent duplicated",
        description: "The agent has been successfully duplicated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Duplicate failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this agent? This action cannot be undone.")) {
      deleteMutation.mutate(agent.id);
    }
  };

  const handleDuplicate = () => {
    duplicateMutation.mutate(agent);
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "active":
        return "default";
      case "testing":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "text-green-700";
      case "testing":
        return "text-yellow-700";
      default:
        return "text-slate-600";
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="h-12 w-12 bg-primary/10 rounded-xl flex items-center justify-center">
            <Bot className="h-6 w-6 text-primary" />
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant={getStatusVariant(agent.status)}>
              {agent.status === "active" ? "Active" : agent.status === "testing" ? "Testing" : "Draft"}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Agent
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDuplicate}>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDelete} className="text-red-600">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        <h4 className="text-lg font-semibold text-slate-900 mb-2">{agent.name}</h4>
        <p className="text-sm text-slate-600 mb-4 line-clamp-2">
          {agent.systemPrompt.length > 100 
            ? `${agent.systemPrompt.substring(0, 100)}...`
            : agent.systemPrompt
          }
        </p>
        
        <div className="space-y-2 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Model:</span>
            <span className="text-slate-900 font-medium">{agent.model}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Temperature:</span>
            <span className="text-slate-900 font-medium">{agent.temperature}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Max Tokens:</span>
            <span className="text-slate-900 font-medium">{agent.maxTokens}</span>
          </div>
        </div>
        
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={onEdit} className="flex-1">
            <Edit className="h-4 w-4 mr-1" />
            Edit
          </Button>
          <Button size="sm" onClick={onTest} className="flex-1">
            <Play className="h-4 w-4 mr-1" />
            Test
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
