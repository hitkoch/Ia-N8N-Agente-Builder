import { Bot, BarChart3, FileText, Webhook, TestTube, Settings, User, LogOut, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

interface SidebarProps {
  currentSection: string;
  onSectionChange: (section: string) => void;
}

export default function Sidebar({ currentSection, onSectionChange }: SidebarProps) {
  const { user, logoutMutation } = useAuth();

  const navigation = [
    { id: "dashboard", name: "Dashboard", icon: BarChart3 },
    { id: "agents", name: "Agentes IA", icon: Bot },
    { id: "whatsapp", name: "WhatsApp", icon: MessageSquare },
    { id: "whatsapp-test", name: "Testes WhatsApp", icon: TestTube },
    { id: "templates", name: "Modelos", icon: FileText },
    { id: "evolution", name: "API Evolution", icon: Webhook },
    { id: "testing", name: "Teste de Agentes", icon: TestTube },
    { id: "settings", name: "Configurações", icon: Settings },
  ];

  return (
    <div className="fixed inset-y-0 left-0 z-50 w-64 shadow-lg" style={{ backgroundColor: '#022b44' }}>
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="flex items-center px-6 py-4 border-b border-white border-opacity-20">
          <div className="h-8 w-8 rounded-lg flex items-center justify-center mr-3" style={{ backgroundColor: '#b8ec00' }}>
            <Bot className="h-4 w-4" style={{ color: '#022b44' }} />
          </div>
          <h2 className="text-xl font-bold text-white">AI Agent Builder</h2>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onSectionChange(item.id)}
                className={`w-full group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                  currentSection === item.id
                    ? "text-[#022b44] font-semibold shadow-sm"
                    : "text-white hover:text-[#b8ec00] hover:bg-white hover:bg-opacity-10"
                }`}
                style={currentSection === item.id ? { backgroundColor: '#b8ec00' } : {}}
              >
                <Icon
                  className={`mr-3 h-5 w-5 ${
                    currentSection === item.id
                      ? "text-[#022b44]"
                      : "text-white group-hover:text-[#b8ec00]"
                  }`}
                />
                {item.name}
              </button>
            );
          })}
        </nav>

        {/* User Profile */}
        <div className="px-4 py-4 border-t border-white border-opacity-20">
          <div className="flex items-center">
            <div className="h-8 w-8 bg-[#b8ec00] rounded-full flex items-center justify-center">
              <User className="h-4 w-4 text-[#022b44]" />
            </div>
            <div className="ml-3 flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-gray-300 truncate">{user?.username}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              className="ml-2 text-gray-300 hover:text-[#b8ec00]"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}