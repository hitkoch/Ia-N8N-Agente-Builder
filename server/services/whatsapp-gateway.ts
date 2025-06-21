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
    console.log(`🔌 Conectando instância: ${instanceName}`);
    
    const response = await fetch(`${this.baseUrl}/instance/connect/${instanceName}`, {
      method: 'POST',
      headers: {
        'apikey': this.globalToken
      }
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`❌ Erro ao conectar instância: ${response.status} - ${error}`);
      throw new Error(`Falha ao conectar instância: ${response.statusText}`);
    }

    const data: InstanceStatusResponse = await response.json();
    console.log(`✅ Conectando instância ${instanceName}: ${data.instance.status}`);
    
    return data;
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