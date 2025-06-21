import { useQuery } from "@tanstack/react-query";
import { Agent } from "@shared/schema";
import AgentCard from "@/components/agent-card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";
import CreateAgentModal from "@/components/create-agent-modal";

interface AgentsPageProps {
  onTest: (agentId: number) => void;
}

export default function AgentsPage({ onTest }: AgentsPageProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const { data: agents = [], isLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 animate-pulse">
            <div className="h-6 bg-slate-200 rounded mb-4"></div>
            <div className="h-4 bg-slate-200 rounded mb-2"></div>
            <div className="h-4 bg-slate-200 rounded mb-4"></div>
            <div className="flex space-x-2">
              <div className="flex-1 h-8 bg-slate-200 rounded"></div>
              <div className="flex-1 h-8 bg-slate-200 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">Agentes IA</h3>
          <p className="text-sm text-slate-600 mt-1">Gerencie e configure seus agentes IA</p>
        </div>
        <Button 
          onClick={() => setIsCreateModalOpen(true)}
          style={{ backgroundColor: '#b8ec00', color: '#022b44' }}
          className="hover:shadow-lg transition-all"
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#022b44';
            e.currentTarget.style.color = '#FFFFFF';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#b8ec00';
            e.currentTarget.style.color = '#022b44';
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Criar Agente
        </Button>
      </div>

      {agents.length === 0 ? (
        <div className="text-center py-12">
          <div className="h-24 w-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Plus className="h-12 w-12 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-900 mb-2">Nenhum agente ainda</h3>
          <p className="text-slate-600 mb-4">Crie seu primeiro agente IA para começar</p>
          <Button 
            onClick={() => setIsCreateModalOpen(true)}
            style={{ backgroundColor: '#b8ec00', color: '#022b44' }}
            className="hover:shadow-lg transition-all"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#022b44';
              e.currentTarget.style.color = '#FFFFFF';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#b8ec00';
              e.currentTarget.style.color = '#022b44';
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Criar Seu Primeiro Agente
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onTest={() => onTest(agent.id)}
            />
          ))}
        </div>
      )}

      <CreateAgentModal 
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}
