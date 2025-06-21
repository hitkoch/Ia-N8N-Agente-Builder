/**
 * WhatsApp Manager - Complete Interface Management
 * Handles all WhatsApp instance operations and UI states
 */

class WhatsAppManager {
    constructor() {
        this.currentAgentId = null;
        this.pollingInterval = null;
        this.isPolling = false;
        this.token = localStorage.getItem('token');
        
        this.elements = {
            agentSelector: document.getElementById('agent-selector'),
            managementArea: document.getElementById('management-area'),
            noConnectionState: document.getElementById('no-connection-state'),
            withConnectionState: document.getElementById('with-connection-state'),
            loadingState: document.getElementById('loading-state'),
            
            // Buttons
            createInstanceBtn: document.getElementById('create-instance-btn'),
            refreshQrcodeBtn: document.getElementById('refresh-qrcode-btn'),
            editInstanceBtn: document.getElementById('edit-instance-btn'),
            testInstanceBtn: document.getElementById('test-instance-btn'),
            deleteInstanceBtn: document.getElementById('delete-instance-btn'),
            logoutBtn: document.getElementById('logout-btn'),
            
            // Status elements
            connectionStatus: document.getElementById('connection-status'),
            instanceName: document.getElementById('instance-name'),
            lastActivity: document.getElementById('last-activity'),
            qrcodeContainer: document.getElementById('qrcode-container'),
            
            // Stats elements
            statsReceived: document.getElementById('stats-received'),
            statsSent: document.getElementById('stats-sent'),
            statsUptime: document.getElementById('stats-uptime'),
            
            // Modals
            editModal: document.getElementById('edit-modal'),
            deleteModal: document.getElementById('delete-modal'),
            saveInstanceBtn: document.getElementById('save-instance-btn'),
            confirmDeleteBtn: document.getElementById('confirm-delete-btn'),
            
            // Notifications
            notifications: document.getElementById('notifications')
        };
        
        this.init();
    }
    
    init() {
        console.log('🚀 Inicializando WhatsApp Manager');
        
        // Check authentication - use session-based auth instead of token
        this.checkAuthentication();
        
        this.setupEventListeners();
        this.loadAgents();
    }
    
    async checkAuthentication() {
        try {
            const response = await fetch('/api/user');
            if (!response.ok) {
                this.redirectToLogin();
                return;
            }
            const user = await response.json();
            console.log(`✅ Usuário autenticado: ${user.name}`);
        } catch (error) {
            console.error('❌ Erro de autenticação:', error);
            this.redirectToLogin();
        }
    }
    
    redirectToLogin() {
        window.location.href = '/';
    }
    
    setupEventListeners() {
        // Agent selection
        this.elements.agentSelector.addEventListener('change', (e) => {
            this.handleAgentSelection(e.target.value);
        });
        
        // Button events
        this.elements.createInstanceBtn.addEventListener('click', () => {
            this.createInstance();
        });
        
        this.elements.refreshQrcodeBtn.addEventListener('click', () => {
            this.refreshQRCode();
        });
        
        this.elements.editInstanceBtn.addEventListener('click', () => {
            this.openEditModal();
        });
        
        this.elements.testInstanceBtn.addEventListener('click', () => {
            this.testConnection();
        });
        
        this.elements.deleteInstanceBtn.addEventListener('click', () => {
            this.openDeleteModal();
        });
        
        this.elements.saveInstanceBtn.addEventListener('click', () => {
            this.saveInstanceSettings();
        });
        
        this.elements.confirmDeleteBtn.addEventListener('click', () => {
            this.deleteInstance();
        });
        
        this.elements.logoutBtn.addEventListener('click', () => {
            this.logout();
        });
        
        // Modal close events
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                this.closeModal(modal.id);
            });
        });
        
        // Close modal on backdrop click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal.id);
                }
            });
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
                if (response.status === 401) {
                    this.redirectToLogin();
                    return;
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const agents = await response.json();
            this.populateAgentSelector(agents);
            
            console.log(`✅ ${agents.length} agentes carregados`);
            
        } catch (error) {
            console.error('❌ Erro ao carregar agentes:', error);
            this.showNotification('Erro ao carregar agentes', 'error');
        }
    }
    
    populateAgentSelector(agents) {
        this.elements.agentSelector.innerHTML = '<option value="">Selecione um agente</option>';
        
        agents.forEach(agent => {
            const option = document.createElement('option');
            option.value = agent.id;
            option.textContent = `${agent.name} - ${agent.description || 'Sem descrição'}`;
            this.elements.agentSelector.appendChild(option);
        });
    }
    
    async handleAgentSelection(agentId) {
        if (!agentId) {
            this.elements.managementArea.classList.add('hidden');
            this.currentAgentId = null;
            this.stopPolling();
            return;
        }
        
        this.currentAgentId = parseInt(agentId);
        this.elements.managementArea.classList.remove('hidden');
        
        console.log(`👤 Agente selecionado: ${this.currentAgentId}`);
        
        await this.fetchInstanceDetails();
    }
    
    async fetchInstanceDetails() {
        if (!this.currentAgentId) return;
        
        try {
            console.log(`🔍 Buscando detalhes da instância para agente ${this.currentAgentId}`);
            
            const response = await fetch(`/api/agents/${this.currentAgentId}/whatsapp`, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.status === 404) {
                // No instance found
                this.showNoConnectionState();
                console.log('ℹ️ Nenhuma instância encontrada');
                return;
            }
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const instance = await response.json();
            this.showWithConnectionState(instance);
            
            // Start polling if status is not connected
            if (instance.status !== 'CONNECTED') {
                this.startPolling();
            }
            
        } catch (error) {
            console.error('❌ Erro ao buscar detalhes da instância:', error);
            this.showNotification('Erro ao verificar status da conexão', 'error');
        }
    }
    
    showNoConnectionState() {
        this.elements.noConnectionState.classList.remove('hidden');
        this.elements.withConnectionState.classList.add('hidden');
        this.elements.loadingState.classList.add('hidden');
        this.stopPolling();
    }
    
    showWithConnectionState(instance) {
        this.elements.noConnectionState.classList.add('hidden');
        this.elements.withConnectionState.classList.remove('hidden');
        this.elements.loadingState.classList.add('hidden');
        
        this.updateUI(instance);
    }
    
    showLoadingState() {
        this.elements.noConnectionState.classList.add('hidden');
        this.elements.withConnectionState.classList.add('hidden');
        this.elements.loadingState.classList.remove('hidden');
    }
    
    updateUI(data) {
        console.log('🔄 Atualizando interface com dados:', data);
        
        // Update connection status
        this.updateConnectionStatus(data.status);
        
        // Update instance name
        this.elements.instanceName.textContent = data.instanceName || '-';
        
        // Update last activity
        const lastActivity = data.updatedAt ? 
            new Date(data.updatedAt).toLocaleString('pt-BR') : '-';
        this.elements.lastActivity.textContent = lastActivity;
        
        // Update QR Code
        this.updateQRCode(data);
        
        // Update statistics (placeholder for now)
        this.updateStatistics();
    }
    
    updateConnectionStatus(status) {
        const statusElement = this.elements.connectionStatus;
        const statusClasses = ['connected', 'disconnected', 'pending'];
        
        // Remove all status classes
        statusClasses.forEach(cls => statusElement.classList.remove(cls));
        
        let statusText = '';
        let statusClass = '';
        
        switch (status) {
            case 'CONNECTED':
                statusText = '🟢 Conectado';
                statusClass = 'connected';
                break;
            case 'PENDING':
            case 'CREATED':
                statusText = '🟡 Aguardando Conexão';
                statusClass = 'pending';
                break;
            case 'close':
            case 'DISCONNECTED':
                statusText = '🔴 Desconectado';
                statusClass = 'disconnected';
                break;
            default:
                statusText = `❓ ${status || 'Status Desconhecido'}`;
                statusClass = 'pending';
        }
        
        statusElement.className = `status-dot ${statusClass}`;
        statusElement.innerHTML = `<i class="fas fa-circle"></i> ${statusText}`;
    }
    
    updateQRCode(data) {
        const container = this.elements.qrcodeContainer;
        
        if (data.status === 'CONNECTED') {
            container.innerHTML = `
                <div class="qrcode-placeholder">
                    <i class="fas fa-check-circle" style="color: var(--success-color);"></i>
                    <p><strong>WhatsApp Conectado!</strong></p>
                    <p>Seu agente está pronto para receber mensagens.</p>
                </div>
            `;
        } else if (data.qrCode) {
            container.innerHTML = `
                <img src="${data.qrCode}" alt="QR Code WhatsApp" class="qrcode-image">
                <div style="margin-top: 1rem;">
                    <p><strong>Escaneie com o WhatsApp</strong></p>
                    <p style="font-size: 0.9rem; color: var(--text-muted);">
                        Abra o WhatsApp → Mais opções → Aparelhos conectados → Conectar aparelho
                    </p>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="qrcode-placeholder">
                    <i class="fas fa-qrcode"></i>
                    <p>QR Code será exibido aqui</p>
                    <p style="font-size: 0.9rem;">Clique em "Gerar Novo QR Code" para começar</p>
                </div>
            `;
        }
    }
    
    updateStatistics() {
        // Placeholder statistics - in real implementation, these would come from API
        this.elements.statsReceived.textContent = Math.floor(Math.random() * 500);
        this.elements.statsSent.textContent = Math.floor(Math.random() * 300);
        this.elements.statsUptime.textContent = Math.floor(Math.random() * 100) + '%';
    }
    
    async createInstance() {
        if (!this.currentAgentId) return;
        
        try {
            console.log(`🔌 Criando instância para agente ${this.currentAgentId}`);
            
            this.showLoadingState();
            this.elements.createInstanceBtn.disabled = true;
            
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
            
            this.showNotification('Instância WhatsApp criada com sucesso!', 'success');
            this.showWithConnectionState(instance);
            this.startPolling();
            
        } catch (error) {
            console.error('❌ Erro ao criar instância:', error);
            this.showNotification(`Erro ao criar instância: ${error.message}`, 'error');
            this.showNoConnectionState();
        } finally {
            this.elements.createInstanceBtn.disabled = false;
        }
    }
    
    async refreshQRCode() {
        if (!this.currentAgentId) return;
        
        try {
            console.log('🔄 Atualizando QR Code');
            
            this.elements.refreshQrcodeBtn.disabled = true;
            this.elements.refreshQrcodeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando...';
            
            await this.fetchInstanceDetails();
            
            this.showNotification('QR Code atualizado', 'success');
            
        } catch (error) {
            console.error('❌ Erro ao atualizar QR Code:', error);
            this.showNotification('Erro ao atualizar QR Code', 'error');
        } finally {
            this.elements.refreshQrcodeBtn.disabled = false;
            this.elements.refreshQrcodeBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Gerar Novo QR Code';
        }
    }
    
    async testConnection() {
        if (!this.currentAgentId) return;
        
        try {
            console.log('🧪 Testando conexão');
            
            this.elements.testInstanceBtn.disabled = true;
            this.elements.testInstanceBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testando...';
            
            const response = await fetch(`/api/agents/${this.currentAgentId}/whatsapp/status`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const instance = await response.json();
                this.updateUI(instance);
                this.showNotification('Status da conexão atualizado', 'success');
            } else {
                throw new Error('Falha ao verificar status');
            }
            
        } catch (error) {
            console.error('❌ Erro ao testar conexão:', error);
            this.showNotification('Erro ao testar conexão', 'error');
        } finally {
            this.elements.testInstanceBtn.disabled = false;
            this.elements.testInstanceBtn.innerHTML = '<i class="fas fa-vial"></i> Testar Conexão';
        }
    }
    
    async deleteInstance() {
        if (!this.currentAgentId) return;
        
        try {
            console.log(`🗑️ Excluindo instância do agente ${this.currentAgentId}`);
            
            const response = await fetch(`/api/agents/${this.currentAgentId}/whatsapp`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Falha ao excluir instância');
            }
            
            console.log('✅ Instância excluída com sucesso');
            
            this.showNotification('Instância WhatsApp excluída com sucesso', 'success');
            this.showNoConnectionState();
            this.closeModal('delete-modal');
            
        } catch (error) {
            console.error('❌ Erro ao excluir instância:', error);
            this.showNotification(`Erro ao excluir instância: ${error.message}`, 'error');
        }
    }
    
    startPolling() {
        if (this.isPolling) {
            this.stopPolling();
        }
        
        console.log('🔄 Iniciando polling de status');
        this.isPolling = true;
        
        this.pollingInterval = setInterval(() => {
            this.checkConnectionStatus();
        }, 10000); // Check every 10 seconds
    }
    
    stopPolling() {
        if (this.pollingInterval) {
            console.log('⏹️ Parando polling de status');
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        this.isPolling = false;
    }
    
    async checkConnectionStatus() {
        if (!this.currentAgentId || !this.isPolling) return;
        
        try {
            const response = await fetch(`/api/agents/${this.currentAgentId}/whatsapp/status`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const instance = await response.json();
                this.updateUI(instance);
                
                // Stop polling if connected
                if (instance.status === 'CONNECTED') {
                    this.stopPolling();
                    this.showNotification('WhatsApp conectado com sucesso!', 'success');
                }
            }
            
        } catch (error) {
            console.error('❌ Erro no polling:', error);
            // Don't show notification for polling errors to avoid spam
        }
    }
    
    openEditModal() {
        this.elements.editModal.classList.add('show');
    }
    
    openDeleteModal() {
        this.elements.deleteModal.classList.add('show');
    }
    
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('show');
        }
    }
    
    saveInstanceSettings() {
        // Placeholder for instance settings save
        this.showNotification('Configurações salvas (funcionalidade em desenvolvimento)', 'warning');
        this.closeModal('edit-modal');
    }
    
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 0; margin-left: 1rem;">×</button>
            </div>
        `;
        
        this.elements.notifications.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }
    
    async logout() {
        try {
            await fetch('/api/logout', { method: 'POST' });
        } catch (error) {
            console.error('Erro no logout:', error);
        }
        window.location.href = '/';
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new WhatsAppManager();
});