import { Button } from "@/components/ui/button";
import { Plus, Bell, Bot } from "lucide-react";

interface HeaderProps {
  currentSection: string;
  onCreateAgent: () => void;
  onOpenWizard?: () => void;
}

const sectionTitles = {
  dashboard: { title: "Dashboard Overview", subtitle: "Manage your AI agents and integrations" },
  agents: { title: "AI Agents", subtitle: "Create and manage your intelligent assistants" },
  evolution: { title: "Evolution API", subtitle: "Configure webhooks and API integrations" },
  testing: { title: "Agent Testing", subtitle: "Test your AI agents in real-time" },
  settings: { title: "Settings", subtitle: "Manage your account and preferences" },
};

export default function Header({ currentSection, onCreateAgent, onOpenWizard }: HeaderProps) {
  const { title, subtitle } = sectionTitles[currentSection as keyof typeof sectionTitles] || sectionTitles.dashboard;

  return (
    <header className="bg-white shadow-sm border-b border-slate-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-600 mt-1">{subtitle}</p>
        </div>
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" className="relative">
            <Bell className="h-4 w-4" />
            <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
          </Button>
          <Button onClick={onCreateAgent}>
            <Plus className="h-4 w-4 mr-2" />
            Create Agent
          </Button>
        </div>
      </div>
    </header>
  );
}
