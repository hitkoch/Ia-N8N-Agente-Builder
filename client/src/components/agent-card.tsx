import React, { useState } from "react";
import { Agent } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Bot, MoreVertical, Edit, Copy, Trash2, Play, Code } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import WebchatCodeModal from "./webchat-code-modal";

interface AgentCardProps {
  agent: Agent;
  onTest: () => void;
}

export default function AgentCard({ agent, onTest }: AgentCardProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isWebchatModalOpen, setIsWebchatModalOpen] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/agents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Agente deletado",
        description: "O agente foi deletado com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Falha ao deletar",
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
        name: `${agent.name} (Cópia)`,
        status: "draft" as const,
      };
      await apiRequest("POST", "/api/agents", duplicatedAgent);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Agente duplicado",
        description: "O agente foi duplicado com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Falha ao duplicar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDelete = () => {
    if (confirm("Tem certeza de que deseja deletar este agente? Esta ação não pode ser desfeita.")) {
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

  const getStatusText = (status: string) => {
    switch (status) {
      case "active":
        return "Ativo";
      case "testing":
        return "Testando";
      default:
        return "Rascunho";
    }
  };

  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="h-12 w-12 bg-primary/10 rounded-xl flex items-center justify-center">
              <Bot className="h-6 w-6 text-primary" />
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant={getStatusVariant(agent.status)}>
                {getStatusText(agent.status)}
              </Badge>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setLocation(`/agents/${agent.id}/edit`)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Editar Agente
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDuplicate}>
                    <Copy className="h-4 w-4 mr-2" />
                    Duplicar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsWebchatModalOpen(true)}>
                    <Code className="h-4 w-4 mr-2" />
                    Código do Webchat
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDelete} className="text-red-600">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Deletar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <h3 className="font-semibold text-lg text-foreground truncate">
                {agent.name}
              </h3>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {agent.description || "Sem descrição"}
              </p>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Modelo: {agent.model || "GPT-4"}</span>
              <span className={getStatusColor(agent.status)}>
                {getStatusText(agent.status)}
              </span>
            </div>

            <div className="flex space-x-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation(`/agents/${agent.id}/edit`)}
                className="flex-1"
              >
                <Edit className="h-4 w-4 mr-1" />
                Editar
              </Button>
              <Button
                size="sm"
                onClick={onTest}
                className="flex-1"
              >
                <Play className="h-4 w-4 mr-1" />
                Testar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <WebchatCodeModal
        isOpen={isWebchatModalOpen}
        onClose={() => setIsWebchatModalOpen(false)}
        agentId={agent.id}
      />
    </>
  );
}