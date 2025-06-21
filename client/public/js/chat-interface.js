(function() {
  'use strict';

  // Configuration and state
  let config = {
    agentId: null,
    agentName: 'Assistente AI',
    primaryColor: '#022b44',
    accentColor: '#b8ec00',
    apiUrl: window.location.origin + '/api'
  };

  let isLoading = false;

  // DOM elements
  const elements = {
    agentName: null,
    messagesContainer: null,
    messageInput: null,
    sendButton: null,
    closeButton: null,
    typingIndicator: null
  };

  // Initialize chat interface
  function init() {
    // Get URL parameters
    parseURLParams();
    
    // Get DOM elements
    getDOMElements();
    
    // Apply customization
    applyCustomization();
    
    // Setup event listeners
    setupEventListeners();
    
    // Set initial focus
    elements.messageInput.focus();
    
    console.log('Chat interface initialized for agent:', config.agentId);
  }

  function parseURLParams() {
    const params = new URLSearchParams(window.location.search);
    
    config.agentId = params.get('agentId') || config.agentId;
    config.agentName = params.get('agentName') || config.agentName;
    config.primaryColor = params.get('primaryColor') || config.primaryColor;
    config.accentColor = params.get('accentColor') || config.accentColor;
    
    // Update API URL - prioritize passed parameter
    const apiUrl = params.get('apiUrl');
    if (apiUrl) {
      config.apiUrl = apiUrl;
      console.log('🌐 API URL configurada via parâmetro:', apiUrl);
    } else {
      // Fallback: use iframe's origin
      config.apiUrl = window.location.origin + '/api';
      console.log('🌐 API URL fallback (iframe origin):', config.apiUrl);
    }
    
    console.log('🔧 Chat Debug:');
    console.log('  Agent ID:', config.agentId);
    console.log('  API URL final:', config.apiUrl);
    console.log('  Iframe origin:', window.location.origin);
    console.log('  URL params:', Object.fromEntries(params));
  }

  function getDOMElements() {
    elements.agentName = document.getElementById('agent-name');
    elements.messagesContainer = document.getElementById('chat-messages');
    elements.messageInput = document.getElementById('message-input');
    elements.sendButton = document.getElementById('send-button');
    elements.closeButton = document.getElementById('close-chat');
    elements.typingIndicator = document.getElementById('typing-indicator');
  }

  function applyCustomization() {
    // Update agent name
    if (elements.agentName) {
      elements.agentName.textContent = config.agentName;
    }
    
    // Apply custom colors
    document.documentElement.style.setProperty('--primary-color', config.primaryColor);
    document.documentElement.style.setProperty('--accent-color', config.accentColor);
    document.documentElement.style.setProperty('--user-bubble-color', config.primaryColor);
  }

  function setupEventListeners() {
    // Send button click
    elements.sendButton.addEventListener('click', handleSendMessage);
    
    // Enter key press
    elements.messageInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    });
    
    // Close button
    elements.closeButton.addEventListener('click', function() {
      // Send message to parent window to close chat
      window.parent.postMessage({ type: 'closeChat' }, '*');
    });
    
    // Input validation
    elements.messageInput.addEventListener('input', function() {
      const hasText = this.value.trim().length > 0;
      elements.sendButton.disabled = !hasText || isLoading;
    });
  }

  async function handleSendMessage() {
    const message = elements.messageInput.value.trim();
    
    if (!message || isLoading) return;
    
    // Clear input and disable send button
    elements.messageInput.value = '';
    elements.sendButton.disabled = true;
    isLoading = true;
    
    // Add user message to UI
    addMessageToUI(message, 'user');
    
    // Show typing indicator
    showTypingIndicator();
    
    try {
      // Send message to API
      const apiEndpoint = `${config.apiUrl}/webchat/${config.agentId}/chat`;
      console.log('Enviando mensagem para:', apiEndpoint);
      console.log('Config atual:', config);
      
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: message }),
        mode: 'cors',
        credentials: 'omit', // Don't send credentials for external sites
      });
      
      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Hide typing indicator
      hideTypingIndicator();
      
      if (response.ok) {
        // Add agent response to UI
        addMessageToUI(data.response || 'Desculpe, não consegui processar sua mensagem.', 'agent');
      } else {
        // Handle error response
        addMessageToUI(data.message || 'Desculpe, ocorreu um erro. Tente novamente.', 'agent');
      }
    } catch (error) {
      console.error('Erro detalhado ao enviar mensagem:', error);
      console.error('URL tentativa:', `${config.apiUrl}/webchat/${config.agentId}/chat`);
      console.error('Config completa:', config);
      console.error('Tipo do erro:', error.name);
      console.error('Mensagem do erro:', error.message);
      
      hideTypingIndicator();
      
      let errorMessage = 'Desculpe, não foi possível conectar com o servidor.';
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorMessage = `Erro de conexão: ${error.message}. Verificando URL: ${config.apiUrl}/webchat/${config.agentId}/chat`;
      } else if (error.message.includes('CORS')) {
        errorMessage = 'Erro de CORS: O servidor não permite requisições desta origem.';
      } else if (error.message.includes('404')) {
        errorMessage = 'Erro 404: Endpoint da API não encontrado.';
      } else if (error.message.includes('500')) {
        errorMessage = 'Erro 500: Problema interno do servidor.';
      }
      
      addMessageToUI(errorMessage, 'agent');
    } finally {
      isLoading = false;
      elements.messageInput.focus();
    }
  }

  function addMessageToUI(text, senderType) {
    // Create message container
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${senderType}-message`;
    
    // Create message content
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = text;
    
    // Create timestamp
    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.textContent = new Date().toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    // Assemble message
    messageDiv.appendChild(contentDiv);
    messageDiv.appendChild(timeDiv);
    
    // Add to messages container
    elements.messagesContainer.appendChild(messageDiv);
    
    // Scroll to bottom
    scrollToBottom();
  }

  function showTypingIndicator() {
    elements.typingIndicator.style.display = 'flex';
    scrollToBottom();
  }

  function hideTypingIndicator() {
    elements.typingIndicator.style.display = 'none';
  }

  function scrollToBottom() {
    setTimeout(() => {
      elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
    }, 100);
  }

  // Listen for messages from parent window
  window.addEventListener('message', function(event) {
    // Handle messages from parent if needed
    if (event.data.type === 'focus') {
      elements.messageInput.focus();
    }
  });

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();