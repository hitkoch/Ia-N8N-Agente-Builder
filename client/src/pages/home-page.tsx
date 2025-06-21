import { useState } from "react";
import { Switch, Route } from "wouter";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Agent } from "@shared/schema";
import { Bot, CheckCircle, Webhook, MessageCircle, Plus, Eye, Zap } from "lucide-react";
import AgentCard from "@/components/agent-card";
import CreateAgentModal from "@/components/create-agent-modal";
import AgentCreationWizard from "@/components/agent-creation-wizard";
import AgentsPage from "./agents-page";
import TemplatesPage from "./templates-page";
import EvolutionPage from "./evolution-page";
import TestingPage from "./testing-page";
import SettingsPage from "./settings-page";

interface DashboardStats {
  totalAgents: number;
  activeAgents: number;
  integrations: number;
  conversations: number;
}

export default function HomePage() {
  const [currentSection, setCurrentSection] = useState("dashboard");
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const recentAgents = agents.slice(0, 3);

  const handleTestAgent = (agentId: number) => {
    setSelectedAgentId(agentId);
    setCurrentSection("testing");
  };

  const renderDashboardOverview = () => (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-primary/10">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-600">Total Agents</p>
                <p className="text-2xl font-bold text-slate-900">{stats?.totalAgents || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-600">Active Agents</p>
                <p className="text-2xl font-bold text-slate-900">{stats?.activeAgents || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-indigo-100">
                <Webhook className="h-5 w-5 text-indigo-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-600">API Integrations</p>
                <p className="text-2xl font-bold text-slate-900">{stats?.integrations || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-yellow-100">
                <MessageCircle className="h-5 w-5 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-600">Conversations</p>
                <p className="text-2xl font-bold text-slate-900">{stats?.conversations || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity and Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Agents */}
        <Card>
          <CardHeader>
            <CardTitle>Seus Agentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentAgents.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">
                  No agents created yet. Create your first agent to get started!
                </p>
              ) : (
                recentAgents.map((agent) => (
                  <div key={agent.id} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-b-0">
                    <div className="flex items-center">
                      <div className="h-10 w-10 bg-slate-100 rounded-lg flex items-center justify-center">
                        <Bot className="h-5 w-5 text-slate-600" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-slate-900">{agent.name}</p>
                        <p className="text-xs text-slate-500">{agent.model}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        agent.status === "active" 
                          ? "bg-green-100 text-green-700"
                          : agent.status === "testing"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-slate-100 text-slate-600"
                      }`}>
                        {agent.status === "active" ? "Active" : agent.status === "testing" ? "Testing" : "Draft"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Links Rápidos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              variant="outline"
              className="w-full justify-start h-auto p-4 mb-2"
              onClick={() => setIsWizardOpen(true)}
              style={{ borderColor: '#b8ec00' }}
            >
              <div className="flex items-center">
                <div className="h-10 w-10 rounded-lg flex items-center justify-center mr-4" style={{ backgroundColor: '#b8ec00' }}>
                  <Bot className="h-5 w-5" style={{ color: '#022b44' }} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium" style={{ color: '#022b44' }}>Assistente de Criação</p>
                  <p className="text-xs text-slate-500">Guia passo a passo personalizado</p>
                </div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start h-auto p-4"
              onClick={() => setIsCreateModalOpen(true)}
            >
              <div className="flex items-center">
                <div className="h-10 w-10 rounded-lg flex items-center justify-center mr-4" style={{ backgroundColor: '#022b44' }}>
                  <Plus className="h-5 w-5" style={{ color: '#b8ec00' }} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium" style={{ color: '#022b44' }}>Criação Rápida</p>
                  <p className="text-xs text-slate-500">Para usuários experientes</p>
                </div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start h-auto p-4"
              onClick={() => setCurrentSection("evolution")}
            >
              <div className="flex items-center">
                <div className="h-10 w-10 bg-indigo-100 rounded-lg flex items-center justify-center mr-4">
                  <Webhook className="h-5 w-5 text-indigo-600" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-slate-900">Setup Evolution API</p>
                  <p className="text-xs text-slate-500">Configure webhooks and integrations</p>
                </div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start h-auto p-4"
              onClick={() => setCurrentSection("testing")}
            >
              <div className="flex items-center">
                <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center mr-4">
                  <Zap className="h-5 w-5 text-green-600" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-slate-900">Test Agents</p>
                  <p className="text-xs text-slate-500">Try your AI agents in real-time</p>
                </div>
              </div>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (currentSection) {
      case "agents":
        return <AgentsPage onTest={handleTestAgent} />;
      case "templates":
        return <TemplatesPage />;
      case "evolution":
        return <EvolutionPage />;
      case "testing":
        return <TestingPage selectedAgentId={selectedAgentId} />;
      case "settings":
        return <SettingsPage />;
      default:
        return renderDashboardOverview();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar currentSection={currentSection} onSectionChange={setCurrentSection} />
      
      <div className="ml-64 flex flex-col min-h-screen">
        <Header 
          currentSection={currentSection}
          onCreateAgent={() => setIsCreateModalOpen(true)}
          onOpenWizard={() => setIsWizardOpen(true)}
        />
        
        <main className="flex-1 p-6">
          {renderContent()}
        </main>
      </div>

      <AgentCreationWizard
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
      />
      
      <CreateAgentModal 
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}
