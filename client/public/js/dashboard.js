/**
 * Dashboard WhatsApp - JavaScript
 * Gerencia a conexão dos agentes com WhatsApp
 */

class WhatsAppDashboard {
    constructor() {
        this.currentAgentId = null;
        this.pollingInterval = null;
        this.isPolling = false;
        
        this.elements = {
            agentSelect: document.getElementById('agent-select'),
            connectButton: document.getElementById('connect-button'),
            connectionStatus: document.getElementById('connection-status'),
            qrContainer: document.getElementById('qr-container'),
            qrCode: document.getElementById('qr-code'),
            successMessage: document.getElementById('success-message'),
            errorMessage: document.getElementById('error-message'),
            pollingIndicator: document.getElementById('polling-indicator'),
            errorText: document.getElementById('error-text')
        };
        
        this.init();
    }
    
    init() {
        console.log('🚀 Inicializando Dashboard WhatsApp');
        
        this.loadAgents();
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        this.elements.agentSelect.addEventListener('change', (e) => {
            this.currentAgentId = e.target.value;
            this.elements.connectButton.disabled = !this.currentAgentId;
            
            if (this.currentAgentId) {
                this.checkExistingConnection();
            } else {
                this.resetUI();
            }
        });
        
        this.elements.connectButton.addEventListener('click', () => {
            if (this.currentAgentId) {
                this.connectToWhatsApp();
            }
        });
    }
    
    async loadAgents() {
        try {
            console.log('📥 Carregando lista de agentes');
            
            const response = await fetch('/api/agents', {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const agents = await response.json();
            
            this.elements.agentSelect.innerHTML = '<option value="">Selecione um agente</option>';
            
            agents.forEach(agent => {
                const option = document.createElement('option');
                option.value = agent.id;
                option.textContent = `${agent.name} - ${agent.description || 'Sem descrição'}`;
                this.elements.agentSelect.appendChild(option);
            });
            
            console.log(`✅ ${agents.length} agentes carregados`);
            
        } catch (error) {
            console.error('❌ Erro ao carregar agentes:', error);
            this.showError('Falha ao carregar lista de agentes');
        }
    }
    
    async checkExistingConnection() {
        try {
            console.log(`🔍 Verificando conexão existente para agente ${this.currentAgentId}`);
            
            const response = await fetch(`/api/agents/${this.currentAgentId}/whatsapp`);
            
            if (response.ok) {
                const instance = await response.json();
                console.log('📱 Instância existente encontrada:', instance.status);
                
                this.updateConnectionStatus(instance.status);
                
                if (instance.status === 'CONNECTED') {
                    this.showSuccessMessage();
                } else if (instance.qrCode) {
                    this.showQRCode(instance.qrCode);
                    this.startPolling();
                }
            } else if (response.status === 404) {
                console.log('ℹ️ Nenhuma instância WhatsApp encontrada para este agente');
                this.updateConnectionStatus('NONE');
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
        } catch (error) {
            console.error('❌ Erro ao verificar conexão:', error);
            this.updateConnectionStatus('ERROR');
        }
    }
    
    async connectToWhatsApp() {
        if (!this.currentAgentId) return;
        
        try {
            console.log(`🔌 Conectando agente ${this.currentAgentId} ao WhatsApp`);
            
            this.elements.connectButton.disabled = true;
            this.elements.connectButton.innerHTML = '<div class="loading-spinner"></div> Conectando...';
            this.hideMessages();
            
            const response = await fetch(`/api/agents/${this.currentAgentId}/whatsapp/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
            }
            
            const instance = await response.json();
            console.log('✅ Instância criada:', instance);
            
            this.updateConnectionStatus(instance.status);
            
            if (instance.qrCode) {
                this.showQRCode(instance.qrCode);
                this.startPolling();
            }
            
        } catch (error) {
            console.error('❌ Erro ao conectar WhatsApp:', error);
            this.showError(error.message);
            this.elements.connectButton.disabled = false;
            this.elements.connectButton.textContent = 'Conectar ao WhatsApp';
        }
    }
    
    startPolling() {
        if (this.isPolling) {
            this.stopPolling();
        }
        
        console.log('🔄 Iniciando polling de status');
        this.isPolling = true;
        this.elements.pollingIndicator.classList.add('visible');
        
        this.pollingInterval = setInterval(() => {
            this.checkConnectionStatus();
        }, 7000); // Check every 7 seconds
    }
    
    stopPolling() {
        if (this.pollingInterval) {
            console.log('⏹️ Parando polling de status');
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        
        this.isPolling = false;
        this.elements.pollingIndicator.classList.remove('visible');
    }
    
    async checkConnectionStatus() {
        if (!this.currentAgentId || !this.isPolling) return;
        
        try {
            console.log('🔍 Verificando status da conexão...');
            
            const response = await fetch(`/api/agents/${this.currentAgentId}/whatsapp/status`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const instance = await response.json();
            console.log('📊 Status atual:', instance.status);
            
            this.updateConnectionStatus(instance.status);
            
            if (instance.status === 'CONNECTED') {
                this.stopPolling();
                this.hideQRCode();
                this.showSuccessMessage();
                this.elements.connectButton.textContent = 'WhatsApp Conectado';
                this.elements.connectButton.disabled = true;
            } else if (instance.status === 'close' || instance.status === 'DISCONNECTED') {
                // Status disconnected, show new QR if available
                if (instance.qrCode) {
                    this.showQRCode(instance.qrCode);
                }
            }
            
        } catch (error) {
            console.error('❌ Erro no polling:', error);
            this.stopPolling();
            this.showError('Erro ao verificar status da conexão');
        }
    }
    
    updateConnectionStatus(status) {
        const statusElement = this.elements.connectionStatus;
        const statusText = statusElement.querySelector('span');
        
        // Remove all status classes
        statusElement.classList.remove('status-pending', 'status-connected', 'status-disconnected');
        
        switch (status) {
            case 'CONNECTED':
                statusElement.classList.add('status-connected');
                statusText.textContent = 'Conectado';
                break;
            case 'PENDING':
            case 'CREATED':
                statusElement.classList.add('status-pending');
                statusText.textContent = 'Aguardando conexão';
                break;
            case 'close':
            case 'DISCONNECTED':
                statusElement.classList.add('status-disconnected');
                statusText.textContent = 'Desconectado';
                break;
            case 'NONE':
                statusElement.classList.add('status-pending');
                statusText.textContent = 'Não configurado';
                break;
            case 'ERROR':
                statusElement.classList.add('status-disconnected');
                statusText.textContent = 'Erro na conexão';
                break;
            default:
                statusElement.classList.add('status-pending');
                statusText.textContent = status || 'Status desconhecido';
        }
    }
    
    showQRCode(qrCodeData) {
        console.log('🖼️ Exibindo QR Code');
        
        this.elements.qrCode.src = qrCodeData;
        this.elements.qrContainer.classList.add('visible');
        this.hideMessages();
        
        this.elements.connectButton.textContent = 'Aguardando leitura do QR Code...';
        this.elements.connectButton.disabled = true;
    }
    
    hideQRCode() {
        console.log('🔒 Ocultando QR Code');
        this.elements.qrContainer.classList.remove('visible');
    }
    
    showSuccessMessage() {
        console.log('✅ Exibindo mensagem de sucesso');
        this.hideMessages();
        this.elements.successMessage.classList.add('visible');
    }
    
    showError(message) {
        console.log('❌ Exibindo erro:', message);
        this.hideMessages();
        this.elements.errorText.textContent = message;
        this.elements.errorMessage.classList.add('visible');
    }
    
    hideMessages() {
        this.elements.successMessage.classList.remove('visible');
        this.elements.errorMessage.classList.remove('visible');
    }
    
    resetUI() {
        console.log('🔄 Resetando interface');
        
        this.stopPolling();
        this.hideQRCode();
        this.hideMessages();
        this.updateConnectionStatus('NONE');
        
        this.elements.connectButton.textContent = 'Conectar ao WhatsApp';
        this.elements.connectButton.disabled = true;
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new WhatsAppDashboard();
});