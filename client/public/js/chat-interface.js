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
    
    // Update API URL if different domain
    const apiUrl = params.get('apiUrl');
    if (apiUrl) {
      config.apiUrl = apiUrl;
    }
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
      const response = await fetch(`${config.apiUrl}/webchat/${config.agentId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: message }),
      });
      
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
      console.error('Error sending message:', error);
      hideTypingIndicator();
      addMessageToUI('Desculpe, não foi possível conectar com o servidor. Verifique sua conexão.', 'agent');
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