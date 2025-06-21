/**
 * WhatsApp Gateway Service
 * Integração com o gateway centralizado da API Evolution
 */

export interface CreateInstanceRequest {
  instanceName: string;
  token?: string;
  qrcode?: boolean;
  integration?: string;
}

export interface CreateInstanceResponse {
  instance: {
    instanceName: string;
    status: string;
  };
  hash: {
    apikey: string;
  };
  qrcode?: {
    code: string;
    base64: string;
  };
}

export interface InstanceStatusResponse {
  instance: {
    instanceName: string;
    status: string;
    instanceId?: string;
  };
  connectionStatus: string;
  qrcode?: {
    code: string;
    base64: string;
  };
  ownerJid?: string;
  profileName?: string;
}

export interface SendMessageRequest {
  number: string;
  text: string;
  delay?: number;
}

export interface SendMessageResponse {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  message: {
    conversation: string;
  };
  messageTimestamp: string;
  status: string;
}

export class WhatsAppGatewayService {
  private readonly baseUrl = 'https://apizap.ecomtools.com.br';
  private readonly globalToken = process.env.WHATSAPP_GATEWAY_TOKEN || '8Tu2U0TAe7k3dnhHJlXgy9GgQeiWdVbx';

  constructor() {
    if (!this.globalToken) {
      console.warn('⚠️ WHATSAPP_GATEWAY_TOKEN não configurado. Funcionalidades do WhatsApp podem não funcionar.');
    }
  }

  /**
   * Busca detalhes de uma instância específica
   */
  async fetchInstance(instanceName: string): Promise<InstanceStatusResponse> {
    console.log(`🔍 Buscando detalhes da instância: ${instanceName}`);
    
    try {
      const response = await fetch(`${this.baseUrl}/instance/fetchInstances?instanceName=${instanceName}`, {
        method: 'GET',
        headers: {
          'apikey': this.globalToken
        }
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`❌ Erro ao buscar instância: ${response.status} - ${error}`);
        throw new Error(`Falha ao buscar instância: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`📊 Resposta da API:`, JSON.stringify(data, null, 2));
      
      // Evolution API returns array with instance data
      const instanceData = Array.isArray(data) && data.length > 0 ? data[0] : null;
      
      if (!instanceData) {
        throw new Error('Instância não encontrada');
      }
      
      const status = instanceData.connectionStatus || 'close';
      console.log(`📊 Status da instância ${instanceName}: ${status}`);
      
      return {
        instance: {
          instanceName: instanceData.name,
          status: status,
          instanceId: instanceData.id
        },
        connectionStatus: status,
        ownerJid: instanceData.ownerJid,
        profileName: instanceData.profileName
      } as InstanceStatusResponse;
    } catch (error) {
      console.error(`❌ Erro ao buscar instância ${instanceName}:`, error);
      throw error;
    }
  }

  /**
   * Cria uma nova instância do WhatsApp
   */
  async createInstance(instanceName: string): Promise<CreateInstanceResponse> {
    console.log(`📱 Criando instância WhatsApp: ${instanceName}`);
    
    const requestData: CreateInstanceRequest = {
      instanceName,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS'
    };

    const response = await fetch(`${this.baseUrl}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.globalToken
      },
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`❌ Erro ao criar instância: ${response.status} - ${error}`);
      throw new Error(`Falha ao criar instância: ${response.statusText}`);
    }

    const data: CreateInstanceResponse = await response.json();
    console.log(`✅ Instância criada: ${instanceName}, Status: ${data.instance.status}`);
    
    return data;
  }

  /**
   * Obtém o status e QR Code de uma instância
   */
  async getInstanceStatus(instanceName: string): Promise<InstanceStatusResponse> {
    console.log(`🔍 Verificando status da instância: ${instanceName}`);
    
    const response = await fetch(`${this.baseUrl}/instance/connect/${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': this.globalToken
      }
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`❌ Erro ao verificar status: ${response.status} - ${error}`);
      throw new Error(`Falha ao verificar status: ${response.statusText}`);
    }

    const data: InstanceStatusResponse = await response.json();
    console.log(`📊 Status da instância ${instanceName}: ${data.instance.status}`);
    
    return data;
  }

  /**
   * Conecta uma instância (gera novo QR Code se necessário)
   */
  async connectInstance(instanceName: string): Promise<InstanceStatusResponse> {
    console.log(`🔌 Conectando instância e gerando QR Code: ${instanceName}`);
    
    // For Evolution API, connecting means the instance will start generating QR code
    // We wait a moment and check the connection state
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds for QR generation
    
    const response = await fetch(`${this.baseUrl}/instance/connectionState/${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': this.globalToken
      }
    });

    if (!response.ok) {
      // If connectionState doesn't work, fall back to fetchInstances
      const instancesResponse = await fetch(`${this.baseUrl}/instance/fetchInstances`, {
        method: 'GET',
        headers: {
          'apikey': this.globalToken
        }
      });

      if (instancesResponse.ok) {
        const instances = await instancesResponse.json();
        const instance = instances.find((inst: any) => inst.name === instanceName);
        
        if (instance) {
          console.log(`🔍 Estado da instância ${instanceName}: ${instance.connectionStatus}`);
          
          const data: InstanceStatusResponse = {
            instance: {
              instanceName: instance.name,
              status: instance.connectionStatus,
              state: instance.connectionStatus,
              qrcode: undefined // QR code will come via webhook
            }
          };
          
          console.log(`✅ Instância conectada ${instanceName}: ${data.instance.status}`);
          return data;
        }
      }
      
      throw new Error(`Falha ao verificar estado da instância: ${response.statusText}`);
    }

    const connectionData = await response.json();
    console.log(`🔍 Estado da conexão ${instanceName}: ${connectionData.instance.state}`);
    
    const data: InstanceStatusResponse = {
      instance: {
        instanceName: instanceName,
        status: connectionData.instance.state,
        state: connectionData.instance.state,
        qrcode: undefined // QR code will be delivered via webhook
      }
    };
    
    console.log(`✅ Instância conectada ${instanceName}: ${data.instance.status}`);
    return data;
  }

  /**
   * Busca QR Code diretamente da API
   */
  async fetchQRCode(instanceName: string): Promise<string | null> {
    console.log(`🔍 Buscando QR Code para: ${instanceName}`);
    
    try {
      // Since direct QR code endpoints are not available in this Evolution API version,
      // we need to check if QR code is available via the instance data
      console.log(`🔍 Verificando se QR Code está disponível na instância...`);
      
      // Check the instance details to see if QR code is embedded
      const instanceResponse = await fetch(`${this.baseUrl}/instance/fetchInstances`, {
        method: 'GET',
        headers: {
          'apikey': this.globalToken
        }
      });

      if (instanceResponse.ok) {
        const instances = await instanceResponse.json();
        const instance = instances.find((inst: any) => inst.name === instanceName);
        
        if (instance && instance.connectionStatus === 'connecting') {
          console.log(`⚠️ QR Code não está disponível diretamente na API para: ${instanceName}`);
          console.log(`📱 A instância está em estado 'connecting' mas o QR Code virá via webhook`);
          
          // Return null to indicate QR code will come via webhook
          return null;
        }
      }

      // Fallback: try limited endpoints that might work
      const endpoints = [
        `/chat/fetchInstances/${instanceName}`,
        `/instance/fetchInstances/${instanceName}`
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method: 'GET',
            headers: {
              'apikey': this.globalToken
            }
          });

          if (response.ok) {
            const data = await response.json();
            console.log(`🔍 Resposta de ${endpoint}:`, JSON.stringify(data, null, 2));
            
            // Try different possible QR code field names
            const qrCode = data.qrcode || data.qrCode || data.base64 || 
                          data.instance?.qrcode || data.instance?.qrCode ||
                          data.qr || data.qr_code || data.code || null;
            
            if (qrCode) {
              console.log(`✅ QR Code encontrado via ${endpoint}`);
              return qrCode.startsWith('data:image') ? qrCode : `data:image/png;base64,${qrCode}`;
            }
          } else {
            console.log(`❌ ${endpoint} retornou ${response.status}`);
          }
        } catch (error) {
          // Continue to next endpoint
        }
      }

      console.log(`⚠️ QR Code não encontrado para ${instanceName}`);
      return null;
    } catch (error) {
      console.error(`❌ Erro ao buscar QR Code: ${error.message}`);
      return null;
    }
  }

  /**
   * Envia uma mensagem via WhatsApp
   */
  async sendMessage(instanceName: string, number: string, text: string): Promise<SendMessageResponse> {
    console.log(`💬 Enviando mensagem via ${instanceName} para ${number}`);
    
    const requestData: SendMessageRequest = {
      number,
      text,
      delay: 1000
    };

    const response = await fetch(`${this.baseUrl}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.globalToken
      },
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`❌ Erro ao enviar mensagem: ${response.status} - ${error}`);
      throw new Error(`Falha ao enviar mensagem: ${response.statusText}`);
    }

    const data: SendMessageResponse = await response.json();
    console.log(`✅ Mensagem enviada para ${number} via ${instanceName}`);
    
    return data;
  }

  /**
   * Configura o webhook para uma instância usando o formato correto da Evolution API
   */
  async setWebhook(instanceName: string): Promise<any> {
    console.log(`🔗 Configurando webhook para instância: ${instanceName}`);
    
    // Get the app base URL from environment or construct it
    const baseUrl = process.env.REPL_SLUG 
      ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.replit.dev`
      : 'http://localhost:5000';
    
    const webhookUrl = `${baseUrl}/api/whatsapp/webhook`;
    
    // Use the exact body structure provided by the user
    const requestData = {
      webhook: {
        enabled: true,
        url: webhookUrl,
        headers: {
          "Content-Type": "application/json"
        },
        byEvents: false,
        base64: true, // Enable base64 for media
        events: [
          "APPLICATION_STARTUP",
          "QRCODE_UPDATED", 
          "MESSAGES_SET",
          "MESSAGES_UPSERT",
          "MESSAGES_UPDATE",
          "MESSAGES_DELETE",
          "SEND_MESSAGE",
          "CONTACTS_SET",
          "CONTACTS_UPSERT",
          "CONTACTS_UPDATE",
          "PRESENCE_UPDATE",
          "CHATS_SET",
          "CHATS_UPSERT",
          "CHATS_UPDATE",
          "CHATS_DELETE",
          "GROUPS_UPSERT",
          "GROUP_UPDATE",
          "GROUP_PARTICIPANTS_UPDATE",
          "CONNECTION_UPDATE",
          "LABELS_EDIT",
          "LABELS_ASSOCIATION",
          "CALL",
          "TYPEBOT_START",
          "TYPEBOT_CHANGE_STATUS"
        ]
      }
    };

    console.log(`📋 Configurando webhook com URL: ${webhookUrl}`);
    console.log(`📋 Payload:`, JSON.stringify(requestData, null, 2));

    const response = await fetch(`${this.baseUrl}/webhook/set/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.globalToken
      },
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`❌ Erro ao configurar webhook: ${response.status} - ${error}`);
      throw new Error(`Falha ao configurar webhook: ${response.statusText} - ${error}`);
    }

    const data = await response.json();
    console.log(`✅ Webhook configurado com sucesso para: ${instanceName}`);
    console.log(`📋 Resposta da API:`, JSON.stringify(data, null, 2));
    
    return data;
  }

  /**
   * Remove uma instância
   */
  async deleteInstance(instanceName: string): Promise<boolean> {
    console.log(`🗑️ Removendo instância: ${instanceName}`);
    
    const response = await fetch(`${this.baseUrl}/instance/delete/${instanceName}`, {
      method: 'DELETE',
      headers: {
        'apikey': this.globalToken
      }
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`❌ Erro ao remover instância: ${response.status} - ${error}`);
      throw new Error(`Falha ao remover instância: ${response.statusText}`);
    }

    console.log(`✅ Instância removida: ${instanceName}`);
    return true;
  }

  /**
   * Gera um nome único para a instância baseado no agente
   */
  generateInstanceName(agentId: number, userId: number): string {
    return `agent-${userId}-${agentId}-whatsapp`;
  }

  /**
   * Valida se um número de telefone está no formato correto
   */
  validatePhoneNumber(number: string): boolean {
    // Remove caracteres não numéricos
    const cleanNumber = number.replace(/\D/g, '');
    
    // Verifica se tem pelo menos 10 dígitos (formato brasileiro mínimo)
    return cleanNumber.length >= 10 && cleanNumber.length <= 15;
  }

  /**
   * Formata número de telefone para o formato do WhatsApp
   */
  formatPhoneNumber(number: string): string {
    // Remove caracteres não numéricos
    let cleanNumber = number.replace(/\D/g, '');
    
    // Se não tem código do país, adiciona 55 (Brasil)
    if (cleanNumber.length === 11 && cleanNumber.startsWith('9')) {
      cleanNumber = '55' + cleanNumber;
    } else if (cleanNumber.length === 10) {
      cleanNumber = '559' + cleanNumber;
    }
    
    // Adiciona @s.whatsapp.net se não estiver presente
    if (!cleanNumber.includes('@')) {
      cleanNumber += '@s.whatsapp.net';
    }
    
    return cleanNumber;
  }
}

export const whatsappGatewayService = new WhatsAppGatewayService();