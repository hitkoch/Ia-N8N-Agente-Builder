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
    status?: string;
    state?: string;
    instanceId?: string;
  };
  connectionStatus?: string;
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
    console.log(`📱 WhatsApp Gateway Service inicializado`);
    console.log(`🔗 Base URL: ${this.baseUrl}`);
    console.log(`🔑 Token configurado: ${this.globalToken ? 'Sim' : 'Não'}`);
  }

  /**
   * Busca detalhes de uma instância específica
   */
  async fetchInstance(instanceName: string): Promise<InstanceStatusResponse> {
    const response = await fetch(`${this.baseUrl}/instance/fetchInstances`, {
      method: 'GET',
      headers: {
        'apikey': this.globalToken
      }
    });

    if (!response.ok) {
      throw new Error(`Falha ao buscar instâncias: ${response.statusText}`);
    }

    const instances = await response.json();
    const instance = instances.find((inst: any) => inst.name === instanceName);

    if (!instance) {
      throw new Error(`Instância ${instanceName} não encontrada`);
    }

    return {
      instance: {
        instanceName: instance.name,
        status: instance.connectionStatus,
        instanceId: instance.id
      },
      connectionStatus: instance.connectionStatus,
      ownerJid: instance.ownerJid,
      profileName: instance.profileName
    };
  }

  /**
   * Cria uma nova instância do WhatsApp
   */
  async createInstance(instanceName: string): Promise<CreateInstanceResponse> {
    console.log(`📱 Criando instância: ${instanceName}`);
    
    const requestData: CreateInstanceRequest = {
      instanceName: instanceName,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS"
    };

    console.log(`📋 Payload: ${JSON.stringify(requestData, null, 2)}`);

    const response = await fetch(`${this.baseUrl}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.globalToken
      },
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Erro na API Evolution:`, errorText);
      throw new Error(`Falha ao criar instância: ${response.statusText} - ${errorText}`);
    }

    let data: CreateInstanceResponse;
    try {
      const responseText = await response.text();
      console.log(`📋 Raw response from Evolution API:`, responseText);
      
      // Clean any potential HTML/DOCTYPE issues from response
      const cleanedResponse = responseText.replace(/<!DOCTYPE[^>]*>/gi, '').replace(/<html[^>]*>.*<\/html>/gis, '').trim();
      
      if (!cleanedResponse.startsWith('{')) {
        throw new Error(`Resposta não é JSON válido: ${cleanedResponse.substring(0, 200)}`);
      }
      
      data = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error(`❌ Erro ao fazer parse da resposta:`, parseError);
      throw new Error(`Resposta da API não é JSON válido: ${parseError.message}`);
    }
    console.log(`✅ Instância criada: ${data.instance.instanceName}`);
    
    return data;
  }

  /**
   * Conecta uma instância e gera QR Code automaticamente
   */
  async connectInstance(instanceName: string): Promise<InstanceStatusResponse> {
    console.log(`🔌 Conectando instância para gerar QR Code: ${instanceName}`);
    
    try {
      // Use the correct Evolution API endpoint - path parameter format
      const connectUrl = `${this.baseUrl}/instance/connect/${instanceName}`;
      console.log(`📞 Chamando endpoint: ${connectUrl}`);
      
      const connectResponse = await fetch(connectUrl, {
        method: 'GET',
        headers: {
          'apikey': this.globalToken
        }
      });

      if (connectResponse.ok) {
        const connectData = await connectResponse.json();
        console.log(`✅ Connect response recebido para: ${instanceName}`, JSON.stringify(connectData, null, 2));
        
        // Check if QR code is directly in the response
        if (connectData.qrcode && connectData.qrcode.base64) {
          console.log(`🎉 QR Code gerado diretamente para: ${instanceName}`);
          return {
            instance: {
              instanceName: instanceName,
              status: 'AWAITING_QR_SCAN'
            },
            connectionStatus: 'connecting',
            qrcode: {
              code: connectData.qrcode.code || 'qr_generated',
              base64: connectData.qrcode.base64
            }
          };
        }
        
        // If instance is already connected
        if (connectData.instance && connectData.instance.state === 'open') {
          console.log(`✅ Instância já conectada: ${instanceName}`);
          return {
            instance: {
              instanceName: instanceName,
              status: 'CONNECTED'
            },
            connectionStatus: 'open',
            qrcode: undefined
          };
        }
        
        // Instance is connecting, QR code should be available soon
        console.log(`🔄 Instância conectando: ${instanceName}, aguardando QR Code...`);
        
      } else {
        console.log(`⚠️ Connect endpoint falhou: ${connectResponse.status} - ${connectResponse.statusText}`);
        const errorData = await connectResponse.text();
        console.log(`📋 Error response: ${errorData}`);
      }

      // Wait a moment for QR code generation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Try to fetch the QR code after connection attempt
      const qrCode = await this.fetchQRCode(instanceName);
      if (qrCode) {
        console.log(`✅ QR Code obtido após connect para: ${instanceName}`);
        return {
          instance: {
            instanceName: instanceName,
            status: 'AWAITING_QR_SCAN'
          },
          connectionStatus: 'connecting',
          qrcode: {
            code: 'qr_generated',
            base64: qrCode
          }
        };
      }
      
      // Return connecting status - QR code will come via webhook
      return {
        instance: {
          instanceName: instanceName,
          status: 'AWAITING_QR_SCAN'
        },
        connectionStatus: 'connecting',
        qrcode: undefined
      };
      
    } catch (error) {
      console.error(`❌ Erro ao conectar instância ${instanceName}:`, error);
      throw new Error(`Falha ao iniciar conexão: ${error.message}`);
    }
  }

  /**
   * Busca QR Code usando o endpoint connect da Evolution API
   */
  async fetchQRCode(instanceName: string): Promise<string | null> {
    try {
      console.log(`🔍 Buscando QR Code para: ${instanceName}`);
      
      // Use the connect endpoint to get QR code
      const connectUrl = `${this.baseUrl}/instance/connect/${instanceName}`;
      const response = await fetch(connectUrl, {
        method: 'GET',
        headers: {
          'apikey': this.globalToken
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`📋 Connect response para QR:`, JSON.stringify(data, null, 2));
        
        // Check if QR code is in the response
        if (data.qrcode?.base64) {
          console.log(`✅ QR Code encontrado via connect para: ${instanceName}`);
          return data.qrcode.base64;
        }
        
        if (data.base64) {
          console.log(`✅ QR Code base64 direto para: ${instanceName}`);
          return data.base64;
        }
        
        console.log(`⚠️ Connect response sem QR Code para ${instanceName}`);
        return null;
      }

      console.log(`❌ Connect endpoint falhou para QR Code ${instanceName}:`, response.status);
      return null;
      
    } catch (error) {
      console.error(`❌ Erro ao buscar QR Code para ${instanceName}:`, error);
      return null;
    }
  }

  /**
   * Obtém o status e QR Code de uma instância
   */
  async getInstanceStatus(instanceName: string): Promise<InstanceStatusResponse> {
    const response = await fetch(`${this.baseUrl}/instance/connectionState/${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': this.globalToken
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Erro ao obter status da instância:`, errorText);
      throw new Error(`Falha ao obter status da instância: ${response.statusText} - ${errorText}`);
    }

    let rawData: any;
    try {
      const responseText = await response.text();
      console.log(`📋 Raw status response:`, responseText);
      
      const cleanedResponse = responseText.replace(/<!DOCTYPE[^>]*>/gi, '').replace(/<html[^>]*>.*<\/html>/gis, '').trim();
      
      if (!cleanedResponse.startsWith('{')) {
        throw new Error(`Resposta de status não é JSON válido: ${cleanedResponse.substring(0, 200)}`);
      }
      
      rawData = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error(`❌ Erro ao fazer parse da resposta de status:`, parseError);
      throw new Error(`Resposta de status não é JSON válido: ${parseError.message}`);
    }
    
    // Transform the actual API response to our expected format
    const normalizedResponse: InstanceStatusResponse = {
      instance: {
        instanceName: rawData.instance?.instanceName || instanceName,
        status: rawData.instance?.state || rawData.instance?.status || 'unknown',
        state: rawData.instance?.state,
        instanceId: rawData.instance?.instanceId
      },
      connectionStatus: rawData.instance?.state || rawData.connectionStatus || 'unknown',
      qrcode: rawData.qrcode,
      ownerJid: rawData.ownerJid,
      profileName: rawData.profileName
    };
    
    console.log(`📱 Normalized status for ${instanceName}:`, normalizedResponse.connectionStatus);
    return normalizedResponse;
  }

  /**
   * Envia uma mensagem via WhatsApp
   */
  async sendMessage(instanceName: string, number: string, text: string): Promise<SendMessageResponse> {
    const requestData: SendMessageRequest = {
      number: number,
      text: text
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
      const errorText = await response.text();
      console.error(`❌ Erro ao enviar mensagem:`, errorText);
      throw new Error(`Falha ao enviar mensagem: ${response.statusText} - ${errorText}`);
    }

    let data: SendMessageResponse;
    try {
      const responseText = await response.text();
      console.log(`📋 Raw send message response:`, responseText);
      
      const cleanedResponse = responseText.replace(/<!DOCTYPE[^>]*>/gi, '').replace(/<html[^>]*>.*<\/html>/gis, '').trim();
      
      if (!cleanedResponse.startsWith('{')) {
        throw new Error(`Resposta de envio não é JSON válido: ${cleanedResponse.substring(0, 200)}`);
      }
      
      data = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error(`❌ Erro ao fazer parse da resposta de envio:`, parseError);
      throw new Error(`Resposta de envio não é JSON válido: ${parseError.message}`);
    }
    
    return data;
  }

  /**
   * Configura o webhook para uma instância usando o formato correto da Evolution API
   */
  async setWebhook(instanceName: string): Promise<any> {
    console.log(`🔗 Configurando webhook para instância: ${instanceName}`);
    
    const webhookUrl = 'https://ian8n.com.br/api/whatsapp/webhook';
    console.log(`📋 Configurando webhook com URL: ${webhookUrl}`);
    
    const webhookData = {
      webhook: {
        enabled: true,
        url: webhookUrl,
        base64: true, // ATIVADO: Para receber imagens, áudios, etc.
        events: [
          "MESSAGES_UPSERT",   // ATIVADO: Evento principal para novas mensagens.
          "CONNECTION_UPDATE"  // ATIVADO: Útil para saber o status da conexão.
          // Todos os outros eventos foram removidos para otimização.
        ]
      }
    };

    console.log(`📋 Payload: ${JSON.stringify(webhookData, null, 2)}`);

    const response = await fetch(`${this.baseUrl}/webhook/set/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.globalToken
      },
      body: JSON.stringify(webhookData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Erro ao configurar webhook:`, errorText);
      throw new Error(`Falha ao configurar webhook: ${response.statusText} - ${errorText}`);
    }

    let data: any;
    try {
      const responseText = await response.text();
      console.log(`📋 Raw webhook response:`, responseText);
      
      const cleanedResponse = responseText.replace(/<!DOCTYPE[^>]*>/gi, '').replace(/<html[^>]*>.*<\/html>/gis, '').trim();
      
      if (!cleanedResponse.startsWith('{')) {
        throw new Error(`Resposta de webhook não é JSON válido: ${cleanedResponse.substring(0, 200)}`);
      }
      
      data = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error(`❌ Erro ao fazer parse da resposta de webhook:`, parseError);
      throw new Error(`Resposta de webhook não é JSON válido: ${parseError.message}`);
    }
    
    console.log(`✅ Webhook configurado com sucesso para: ${instanceName}`);
    console.log(`📋 Resposta da API: ${JSON.stringify(data, null, 2)}`);
    
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
      console.warn(`⚠️ Falha ao remover instância ${instanceName}: ${response.statusText}`);
      return false;
    }

    console.log(`✅ Instância removida: ${instanceName}`);
    return true;
  }

  /**
   * Gera um nome único para a instância baseado no agente
   */
  generateInstanceName(agentId: number, userId: number): string {
    return `agent-${agentId}-user-${userId}-whatsapp`;
  }

  /**
   * Valida se um número de telefone está no formato correto
   */
  validatePhoneNumber(number: string): boolean {
    const phoneRegex = /^\d{10,15}$/;
    return phoneRegex.test(number.replace(/\D/g, ''));
  }

  /**
   * Formata número de telefone para o formato do WhatsApp
   */
  formatPhoneNumber(number: string): string {
    const cleaned = number.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('0')) {
      return cleaned.substring(1);
    }
    return cleaned;
  }

  /**
   * Valida nome da instância
   */
  validateInstanceName(instanceName: string): boolean {
    return /^[a-zA-Z0-9_-]+$/.test(instanceName);
  }
}

export const whatsappGatewayService = new WhatsAppGatewayService();