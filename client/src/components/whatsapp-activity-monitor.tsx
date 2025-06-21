import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Activity, MessageCircle, Send, Clock, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActivityData {
  timestamp: string;
  type: 'message_received' | 'message_sent' | 'connection_event' | 'error';
  description: string;
  status?: string;
}

interface WhatsAppActivityMonitorProps {
  agentId: number;
  status: string;
  className?: string;
}

export default function WhatsAppActivityMonitor({ 
  agentId, 
  status, 
  className 
}: WhatsAppActivityMonitorProps) {
  const [activities, setActivities] = useState<ActivityData[]>([]);
  const [stats, setStats] = useState({
    messagesReceived: 0,
    messagesSent: 0,
    uptime: 95,
    responseTime: 1.2
  });

  // Simulate real-time activity updates
  useEffect(() => {
    const interval = setInterval(() => {
      if (status === "CONNECTED") {
        // Simulate occasional activity for connected instances
        if (Math.random() < 0.1) { // 10% chance every interval
          const newActivity: ActivityData = {
            timestamp: new Date().toISOString(),
            type: Math.random() < 0.6 ? 'message_received' : 'message_sent',
            description: Math.random() < 0.6 ? 
              'Mensagem recebida de usuário' : 
              'Resposta enviada automaticamente'
          };
          
          setActivities(prev => [newActivity, ...prev.slice(0, 9)]); // Keep last 10
          
          // Update stats
          setStats(prev => ({
            ...prev,
            messagesReceived: prev.messagesReceived + (newActivity.type === 'message_received' ? 1 : 0),
            messagesSent: prev.messagesSent + (newActivity.type === 'message_sent' ? 1 : 0),
            uptime: Math.min(100, prev.uptime + 0.1),
            responseTime: Math.max(0.5, prev.responseTime + (Math.random() - 0.5) * 0.2)
          }));
        }
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [status]);

  // Add connection events when status changes
  useEffect(() => {
    const connectionActivity: ActivityData = {
      timestamp: new Date().toISOString(),
      type: 'connection_event',
      description: `Status alterado para: ${status}`,
      status: status
    };
    
    setActivities(prev => [connectionActivity, ...prev.slice(0, 9)]);
  }, [status]);

  const getActivityIcon = (type: ActivityData['type']) => {
    switch (type) {
      case 'message_received':
        return <MessageCircle className="w-4 h-4 text-blue-500" />;
      case 'message_sent':
        return <Send className="w-4 h-4 text-green-500" />;
      case 'connection_event':
        return <Activity className="w-4 h-4 text-purple-500" />;
      case 'error':
        return <Activity className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getActivityColor = (type: ActivityData['type']) => {
    switch (type) {
      case 'message_received':
        return "text-blue-600 bg-blue-50";
      case 'message_sent':
        return "text-green-600 bg-green-50";
      case 'connection_event':
        return "text-purple-600 bg-purple-50";
      case 'error':
        return "text-red-600 bg-red-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Real-time Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="w-5 h-5" />
            Estatísticas em Tempo Real
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Mensagens Recebidas</span>
                <span className="font-medium">{stats.messagesReceived}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Mensagens Enviadas</span>
                <span className="font-medium">{stats.messagesSent}</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Uptime</span>
                  <span className="font-medium">{stats.uptime.toFixed(1)}%</span>
                </div>
                <Progress value={stats.uptime} className="h-2" />
              </div>
              
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tempo de Resposta</span>
                <span className="font-medium">{stats.responseTime.toFixed(1)}s</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity Feed */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="w-5 h-5" />
            Atividade Recente
            {activities.length > 0 && (
              <Badge variant="secondary" className="ml-auto">
                {activities.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {activities.length === 0 ? (
              <div className="text-center text-gray-500 py-4">
                <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Aguardando atividade...</p>
              </div>
            ) : (
              activities.map((activity, index) => (
                <div 
                  key={`${activity.timestamp}-${index}`}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border",
                    getActivityColor(activity.type),
                    index === 0 && "ring-2 ring-blue-200 ring-opacity-50"
                  )}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {getActivityIcon(activity.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {activity.description}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatTime(activity.timestamp)}
                    </p>
                  </div>
                  
                  {activity.status && (
                    <Badge variant="outline" className="text-xs">
                      {activity.status}
                    </Badge>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}