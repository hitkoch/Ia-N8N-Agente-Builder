/**
 * AI Webchat Widget
 * Embedded chat widget for AI agents
 */
(function() {
  'use strict';

  // Global namespace
  window.AIWebchat = window.AIWebchat || {};

  // Default configuration
  const DEFAULT_CONFIG = {
    theme: {
      primaryColor: '#022b44',
      accentColor: '#b8ec00',
      borderRadius: '8px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    },
    position: 'bottom-right',
    title: 'Assistente AI',
    subtitle: 'Como posso ajudar você hoje?',
    placeholder: 'Digite sua mensagem...',
    height: '500px',
    width: '350px',
    showTyping: true,
    autoOpen: false
  };

  // CSS Styles
  const CSS_STYLES = `
    .ai-webchat-container {
      position: fixed;
      z-index: 9999;
      font-family: var(--webchat-font-family);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
      border-radius: var(--webchat-border-radius);
      overflow: hidden;
      background: white;
      display: none;
    }
    
    .ai-webchat-container.position-bottom-right {
      bottom: 20px;
      right: 20px;
    }
    
    .ai-webchat-container.position-bottom-left {
      bottom: 20px;
      left: 20px;
    }
    
    .ai-webchat-container.position-inline {
      position: relative;
      display: block;
    }
    
    .ai-webchat-header {
      background: var(--webchat-primary-color);
      color: white;
      padding: 16px;
      cursor: pointer;
      user-select: none;
    }
    
    .ai-webchat-title {
      font-weight: 600;
      font-size: 16px;
      margin: 0 0 4px 0;
    }
    
    .ai-webchat-subtitle {
      font-size: 12px;
      opacity: 0.9;
      margin: 0;
    }
    
    .ai-webchat-close {
      position: absolute;
      top: 12px;
      right: 12px;
      background: none;
      border: none;
      color: white;
      font-size: 20px;
      cursor: pointer;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      opacity: 0.7;
      transition: opacity 0.2s;
    }
    
    .ai-webchat-close:hover {
      opacity: 1;
      background: rgba(255, 255, 255, 0.1);
    }
    
    .ai-webchat-messages {
      height: calc(var(--webchat-height) - 120px);
      overflow-y: auto;
      padding: 16px;
      background: #f8fafc;
    }
    
    .ai-webchat-message {
      margin-bottom: 16px;
      display: flex;
      align-items: flex-start;
      gap: 8px;
    }
    
    .ai-webchat-message.user {
      flex-direction: row-reverse;
    }
    
    .ai-webchat-message-content {
      max-width: 80%;
      padding: 12px 16px;
      border-radius: 18px;
      font-size: 14px;
      line-height: 1.4;
    }
    
    .ai-webchat-message.bot .ai-webchat-message-content {
      background: white;
      border: 1px solid #e2e8f0;
      color: #1e293b;
    }
    
    .ai-webchat-message.user .ai-webchat-message-content {
      background: var(--webchat-primary-color);
      color: white;
    }
    
    .ai-webchat-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      flex-shrink: 0;
    }
    
    .ai-webchat-message.bot .ai-webchat-avatar {
      background: var(--webchat-primary-color);
      color: white;
    }
    
    .ai-webchat-message.user .ai-webchat-avatar {
      background: var(--webchat-accent-color);
      color: var(--webchat-primary-color);
    }
    
    .ai-webchat-typing {
      display: none;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      color: #64748b;
      font-size: 14px;
    }
    
    .ai-webchat-typing.show {
      display: flex;
    }
    
    .ai-webchat-typing-dots {
      display: flex;
      gap: 4px;
    }
    
    .ai-webchat-typing-dot {
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: #94a3b8;
      animation: typing 1.4s infinite ease-in-out;
    }
    
    .ai-webchat-typing-dot:nth-child(2) {
      animation-delay: 0.2s;
    }
    
    .ai-webchat-typing-dot:nth-child(3) {
      animation-delay: 0.4s;
    }
    
    @keyframes typing {
      0%, 60%, 100% {
        transform: translateY(0);
        opacity: 0.5;
      }
      30% {
        transform: translateY(-10px);
        opacity: 1;
      }
    }
    
    .ai-webchat-input-area {
      padding: 16px;
      border-top: 1px solid #e2e8f0;
      background: white;
      display: flex;
      gap: 8px;
      align-items: center;
    }
    
    .ai-webchat-input {
      flex: 1;
      padding: 12px 16px;
      border: 1px solid #e2e8f0;
      border-radius: 24px;
      font-size: 14px;
      outline: none;
      resize: none;
      min-height: 20px;
      max-height: 100px;
      font-family: inherit;
    }
    
    .ai-webchat-input:focus {
      border-color: var(--webchat-primary-color);
      box-shadow: 0 0 0 3px rgba(2, 43, 68, 0.1);
    }
    
    .ai-webchat-send {
      background: var(--webchat-accent-color);
      color: var(--webchat-primary-color);
      border: none;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 16px;
      transition: all 0.2s;
      flex-shrink: 0;
    }
    
    .ai-webchat-send:hover {
      background: var(--webchat-primary-color);
      color: white;
      transform: scale(1.05);
    }
    
    .ai-webchat-send:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }
    
    .ai-webchat-toggle {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: var(--webchat-primary-color);
      color: white;
      border: none;
      cursor: pointer;
      font-size: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      transition: all 0.3s;
      z-index: 9998;
    }
    
    .ai-webchat-toggle:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 25px rgba(0, 0, 0, 0.2);
    }
    
    .ai-webchat-toggle.hidden {
      display: none;
    }
  `;

  class AIWebchatWidget {
    constructor(config) {
      this.config = { ...DEFAULT_CONFIG, ...config };
      this.messages = [];
      this.isOpen = this.config.position === 'inline' || this.config.autoOpen;
      this.isTyping = false;
      this.container = null;
      this.toggleButton = null;
      
      this.init();
    }

    init() {
      this.injectStyles();
      this.createWidget();
      this.bindEvents();
      
      if (this.config.position === 'inline') {
        this.show();
      }
    }

    injectStyles() {
      const style = document.createElement('style');
      style.textContent = CSS_STYLES;
      style.textContent += `
        :root {
          --webchat-primary-color: ${this.config.theme.primaryColor};
          --webchat-accent-color: ${this.config.theme.accentColor};
          --webchat-border-radius: ${this.config.theme.borderRadius};
          --webchat-font-family: ${this.config.theme.fontFamily};
          --webchat-height: ${this.config.height};
          --webchat-width: ${this.config.width};
        }
      `;
      document.head.appendChild(style);
    }

    createWidget() {
      // Create container
      this.container = document.createElement('div');
      this.container.className = `ai-webchat-container position-${this.config.position}`;
      this.container.style.width = this.config.width;
      this.container.style.height = this.config.height;

      // Create toggle button (for floating positions)
      if (this.config.position !== 'inline') {
        this.toggleButton = document.createElement('button');
        this.toggleButton.className = 'ai-webchat-toggle';
        this.toggleButton.innerHTML = '💬';
        document.body.appendChild(this.toggleButton);
      }

      // Widget HTML
      this.container.innerHTML = `
        <div class="ai-webchat-header">
          <h3 class="ai-webchat-title">${this.config.title}</h3>
          <p class="ai-webchat-subtitle">${this.config.subtitle}</p>
          ${this.config.position !== 'inline' ? '<button class="ai-webchat-close">×</button>' : ''}
        </div>
        <div class="ai-webchat-messages"></div>
        <div class="ai-webchat-typing">
          <div class="ai-webchat-avatar">🤖</div>
          <span>Digitando</span>
          <div class="ai-webchat-typing-dots">
            <div class="ai-webchat-typing-dot"></div>
            <div class="ai-webchat-typing-dot"></div>
            <div class="ai-webchat-typing-dot"></div>
          </div>
        </div>
        <div class="ai-webchat-input-area">
          <textarea class="ai-webchat-input" placeholder="${this.config.placeholder}" rows="1"></textarea>
          <button class="ai-webchat-send">▶</button>
        </div>
      `;

      // Append to container or body
      const targetContainer = this.config.containerId ? 
        document.getElementById(this.config.containerId) : document.body;
      
      if (targetContainer) {
        targetContainer.appendChild(this.container);
      }
    }

    bindEvents() {
      // Toggle button
      if (this.toggleButton) {
        this.toggleButton.addEventListener('click', () => this.toggle());
      }

      // Close button
      const closeBtn = this.container.querySelector('.ai-webchat-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.hide());
      }

      // Send button
      const sendBtn = this.container.querySelector('.ai-webchat-send');
      const input = this.container.querySelector('.ai-webchat-input');
      
      sendBtn.addEventListener('click', () => this.sendMessage());
      
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });

      // Auto-resize textarea
      input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 100) + 'px';
      });
    }

    async sendMessage() {
      const input = this.container.querySelector('.ai-webchat-input');
      const message = input.value.trim();
      
      if (!message) return;

      // Add user message
      this.addMessage('user', message);
      input.value = '';
      input.style.height = 'auto';

      // Show typing indicator
      this.showTyping();

      try {
        // Send to API
        const response = await fetch(`${this.config.apiUrl}/agents/${this.config.agentId}/test`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ message }),
        });

        if (!response.ok) {
          throw new Error('Falha na comunicação com o servidor');
        }

        const data = await response.json();
        
        // Hide typing and add bot response
        this.hideTyping();
        this.addMessage('bot', data.response || 'Desculpe, não consegui processar sua mensagem.');
        
      } catch (error) {
        this.hideTyping();
        this.addMessage('bot', 'Desculpe, ocorreu um erro. Tente novamente mais tarde.');
        console.error('Webchat error:', error);
      }
    }

    addMessage(type, content) {
      const messagesContainer = this.container.querySelector('.ai-webchat-messages');
      const messageEl = document.createElement('div');
      messageEl.className = `ai-webchat-message ${type}`;
      
      const avatar = type === 'bot' ? '🤖' : '👤';
      
      messageEl.innerHTML = `
        <div class="ai-webchat-avatar">${avatar}</div>
        <div class="ai-webchat-message-content">${this.escapeHtml(content)}</div>
      `;
      
      messagesContainer.appendChild(messageEl);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      
      this.messages.push({ type, content, timestamp: new Date() });
    }

    showTyping() {
      if (this.config.showTyping) {
        const typing = this.container.querySelector('.ai-webchat-typing');
        typing.classList.add('show');
        
        const messagesContainer = this.container.querySelector('.ai-webchat-messages');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }

    hideTyping() {
      const typing = this.container.querySelector('.ai-webchat-typing');
      typing.classList.remove('show');
    }

    show() {
      this.container.style.display = 'block';
      this.isOpen = true;
      
      if (this.toggleButton) {
        this.toggleButton.classList.add('hidden');
      }
      
      // Focus input
      setTimeout(() => {
        const input = this.container.querySelector('.ai-webchat-input');
        if (input) input.focus();
      }, 100);
    }

    hide() {
      this.container.style.display = 'none';
      this.isOpen = false;
      
      if (this.toggleButton) {
        this.toggleButton.classList.remove('hidden');
      }
    }

    toggle() {
      if (this.isOpen) {
        this.hide();
      } else {
        this.show();
      }
    }

    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
  }

  // Public API
  window.AIWebchat.init = function(config) {
    return new AIWebchatWidget(config);
  };

})();