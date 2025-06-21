import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface WhatsAppInstance {
  id: number;
  instanceName: string;
  status: string;
  qrCode?: string;
  agentId: number;
  createdAt: string;
  updatedAt: string;
}

interface UseWhatsAppStatusOptions {
  agentId: number | null;
  enabled?: boolean;
  pollingInterval?: number;
  onStatusChange?: (oldStatus: string, newStatus: string) => void;
}

export function useWhatsAppStatus({
  agentId,
  enabled = true,
  pollingInterval = 10000, // 10 seconds default
  onStatusChange
}: UseWhatsAppStatusOptions) {
  const [isPolling, setIsPolling] = useState(false);
  const [lastStatus, setLastStatus] = useState<string>("");
  const queryClient = useQueryClient();

  const { 
    data: instance, 
    isLoading, 
    error,
    refetch 
  } = useQuery<WhatsAppInstance>({
    queryKey: ["/api/agents", agentId, "whatsapp"],
    enabled: enabled && !!agentId,
    retry: false,
    retryOnMount: false,
    throwOnError: false,
    refetchInterval: (data) => {
      // Only poll if instance exists and is not connected
      if (!data || data.status === "CONNECTED") {
        setIsPolling(false);
        return false;
      }
      setIsPolling(true);
      return pollingInterval;
    },
    refetchIntervalInBackground: false,
  });

  // Handle status changes
  useEffect(() => {
    if (instance?.status && instance.status !== lastStatus) {
      if (lastStatus && onStatusChange) {
        onStatusChange(lastStatus, instance.status);
      }
      setLastStatus(instance.status);
    }
  }, [instance?.status, lastStatus, onStatusChange]);

  // Manual refresh function
  const refreshStatus = useCallback(async () => {
    if (!agentId) return;
    
    try {
      await queryClient.invalidateQueries({ 
        queryKey: ["/api/agents", agentId, "whatsapp"] 
      });
      await refetch();
    } catch (error) {
      console.error("Error refreshing WhatsApp status:", error);
    }
  }, [agentId, queryClient, refetch]);

  // Force polling start/stop
  const startPolling = useCallback(() => {
    setIsPolling(true);
    queryClient.invalidateQueries({ 
      queryKey: ["/api/agents", agentId, "whatsapp"] 
    });
  }, [agentId, queryClient]);

  const stopPolling = useCallback(() => {
    setIsPolling(false);
  }, []);

  // Auto-stop polling when connected
  useEffect(() => {
    if (instance?.status === "CONNECTED") {
      stopPolling();
    }
  }, [instance?.status, stopPolling]);

  // Connection quality assessment
  const getConnectionQuality = useCallback((): 'excellent' | 'good' | 'poor' | 'unknown' => {
    if (!instance) return 'unknown';
    
    switch (instance.status) {
      case "CONNECTED":
        return 'excellent';
      case "PENDING":
      case "CREATED":
        return 'good';
      case "close":
      case "DISCONNECTED":
        return 'poor';
      default:
        return 'unknown';
    }
  }, [instance]);

  // Status display helpers
  const getStatusDisplay = useCallback(() => {
    if (!instance) return { label: "Não configurado", color: "gray" };
    
    const statusMap = {
      CONNECTED: { label: "Conectado", color: "green" },
      PENDING: { label: "Aguardando", color: "yellow" },
      CREATED: { label: "Criado", color: "blue" },
      close: { label: "Desconectado", color: "red" },
      DISCONNECTED: { label: "Desconectado", color: "red" },
    };
    
    return statusMap[instance.status as keyof typeof statusMap] || 
           { label: instance.status, color: "gray" };
  }, [instance]);

  // Check if QR code is available
  const hasQRCode = useCallback(() => {
    return !!(instance?.qrCode && instance.status !== "CONNECTED");
  }, [instance]);

  // Check if instance needs attention
  const needsAttention = useCallback(() => {
    return instance?.status === "close" || instance?.status === "DISCONNECTED";
  }, [instance]);

  return {
    // Data
    instance,
    isLoading,
    error,
    
    // Status information
    status: instance?.status || "",
    statusDisplay: getStatusDisplay(),
    connectionQuality: getConnectionQuality(),
    
    // State flags
    isPolling,
    hasQRCode: hasQRCode(),
    needsAttention: needsAttention(),
    isConnected: instance?.status === "CONNECTED",
    
    // Actions
    refreshStatus,
    startPolling,
    stopPolling,
    
    // Helpers
    lastUpdated: instance?.updatedAt,
    instanceName: instance?.instanceName,
  };
}