import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, Clock, Wifi, WifiOff, Smartphone, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface WhatsAppStatusIndicatorProps {
  status: string;
  instanceName?: string;
  lastActivity?: string;
  isPolling?: boolean;
  className?: string;
}

const statusConfig = {
  CONNECTED: {
    icon: CheckCircle,
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    label: "Conectado",
    description: "WhatsApp conectado e funcionando",
    pulse: false
  },
  open: {
    icon: CheckCircle,
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    label: "Conectado",
    description: "WhatsApp conectado e funcionando",
    pulse: false
  },
  PENDING: {
    icon: Clock,
    color: "text-yellow-600",
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-200",
    label: "Aguardando",
    description: "Aguardando conexão do WhatsApp",
    pulse: true
  },
  CREATED: {
    icon: Smartphone,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    label: "Criado",
    description: "Instância criada, escaneie o QR Code",
    pulse: true
  },
  close: {
    icon: XCircle,
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    label: "Desconectado",
    description: "WhatsApp foi desconectado",
    pulse: false
  },
  DISCONNECTED: {
    icon: WifiOff,
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    label: "Desconectado",
    description: "Conexão perdida com o WhatsApp",
    pulse: false
  },
  connecting: {
    icon: Clock,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    label: "Conectando",
    description: "Escaneie o QR Code para conectar",
    pulse: true
  }
};

export default function WhatsAppStatusIndicator({ 
  status, 
  instanceName, 
  lastActivity, 
  isPolling = false,
  className 
}: WhatsAppStatusIndicatorProps) {
  const [dots, setDots] = useState("");
  
  const config = statusConfig[status as keyof typeof statusConfig] || {
    icon: Clock,
    color: "text-gray-600",
    bgColor: "bg-gray-50",
    borderColor: "border-gray-200",
    label: "Verificando",
    description: "Verificando status da conexão",
    pulse: true
  };
  const Icon = config.icon;

  // Animated dots for loading states
  useEffect(() => {
    if (config.pulse || isPolling) {
      const interval = setInterval(() => {
        setDots(prev => prev.length >= 3 ? "" : prev + ".");
      }, 500);
      return () => clearInterval(interval);
    } else {
      setDots("");
    }
  }, [config.pulse, isPolling]);

  const formatLastActivity = (timestamp: string) => {
    if (!timestamp) return "Nunca";
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return "Agora mesmo";
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min atrás`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h atrás`;
    return date.toLocaleDateString('pt-BR');
  };

  return (
    <Card className={cn("relative", config.borderColor, className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Icon className={cn("w-5 h-5", config.color)} />
            Status da Conexão
          </span>
          {isPolling && (
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Wifi className="w-3 h-3 animate-pulse" />
              Verificando{dots}
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className={cn("p-3 rounded-lg", config.bgColor)}>
          <div className="flex items-center justify-between">
            <Badge 
              variant="outline" 
              className={cn(
                "border-0 font-medium",
                config.color,
                config.bgColor,
                config.pulse && "animate-pulse"
              )}
            >
              <Icon className="w-3 h-3 mr-1" />
              {config.label}{config.pulse ? dots : ""}
            </Badge>
            
            {status === "CONNECTED" && (
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            )}
          </div>
          
          <p className="text-sm text-gray-600 mt-1">
            {config.description}
          </p>
        </div>

        {instanceName && (
          <div className="text-sm">
            <span className="text-gray-500">Instância:</span>
            <span className="ml-2 font-mono text-xs bg-gray-100 px-2 py-1 rounded">
              {instanceName}
            </span>
          </div>
        )}

        <div className="text-sm">
          <span className="text-gray-500">Última atividade:</span>
          <span className="ml-2">{formatLastActivity(lastActivity || "")}</span>
        </div>

        {/* Connection Quality Indicator */}
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>Qualidade da conexão:</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((bar) => (
              <div
                key={bar}
                className={cn(
                  "w-1 h-3 rounded-sm",
                  status === "CONNECTED" && bar <= 4 ? "bg-green-500" :
                  status === "PENDING" && bar <= 2 ? "bg-yellow-500" :
                  status === "close" || status === "DISCONNECTED" ? "bg-red-200" :
                  "bg-gray-200"
                )}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}