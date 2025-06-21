import { useAuth } from "@/hooks/use-auth";
import { Bot, BarChart3, Settings, Webhook, TestTube, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SidebarProps {
  currentSection: string;
  onSectionChange: (section: string) => void;
}

export default function Sidebar({ currentSection, onSectionChange }: SidebarProps) {
  const { user, logoutMutation } = useAuth();

  const navigation = [
    { id: "dashboard", name: "Dashboard", icon: BarChart3 },
    { id: "agents", name: "AI Agents", icon: Bot },
    { id: "evolution", name: "Evolution API", icon: Webhook },
    { id: "testing", name: "Agent Testing", icon: TestTube },
    { id: "settings", name: "Settings", icon: Settings },
  ];

  return (
    <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg border-r border-slate-200">
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="flex items-center px-6 py-4 border-b border-slate-200">
          <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center mr-3">
            <Bot className="text-white h-4 w-4" />
          </div>
          <h1 className="text-lg font-semibold text-slate-900">AI Agent Builder</h1>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-4 py-6 space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onSectionChange(item.id)}
                className={cn(
                  "w-full group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                  currentSection === item.id
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <Icon
                  className={cn(
                    "mr-3 h-5 w-5",
                    currentSection === item.id
                      ? "text-slate-600"
                      : "text-slate-400 group-hover:text-slate-600"
                  )}
                />
                {item.name}
              </button>
            );
          })}
        </nav>

        {/* User Profile */}
        <div className="px-4 py-4 border-t border-slate-200">
          <div className="flex items-center">
            <div className="h-8 w-8 bg-slate-200 rounded-full flex items-center justify-center">
              <User className="h-4 w-4 text-slate-600" />
            </div>
            <div className="ml-3 flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{user?.name}</p>
              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              className="ml-2 text-slate-400 hover:text-slate-600"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
