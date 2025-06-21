(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    chatUrl: '', // Will be set based on script source  
    apiUrl: '', // Will be set based on script source
    position: 'bottom-right',
    zIndex: 999999
  };

  // State
  let isOpen = false;
  let chatIframe = null;
  let toggleButton = null;
  let agentConfig = {};

  // Initialize the webchat widget
  function init() {
    try {
      // Find script element and extract configuration
      const scriptElement = findScriptElement();
      if (!scriptElement) {
        console.error('Webchat: Could not find script element');
        return;
      }

      // Extract configuration from script attributes
      extractConfig(scriptElement);
      
      // Set chat URL based on script source
      setChatUrl(scriptElement);
      
      // Create and inject styles
      injectStyles();
      
      // Create toggle button
      createToggleButton();
      
      // Create chat iframe
      createChatIframe();
      
      // Setup event listeners
      setupEventListeners();
      
      console.log('Webchat initialized for agent:', agentConfig.agentId);
    } catch (error) {
      console.error('Webchat initialization error:', error);
    }
  }

  function findScriptElement() {
    // Try multiple ways to find the script element
    const scripts = document.querySelectorAll('script');
    
    // First, try to find by data-agent-id
    let scriptElement = document.querySelector('script[data-agent-id]');
    
    // If not found, try to find by src containing webchat-loader
    if (!scriptElement) {
      for (const script of scripts) {
        if (script.src && script.src.includes('webchat-loader.js')) {
          scriptElement = script;
          break;
        }
      }
    }
    
    return scriptElement;
  }

  function extractConfig(scriptElement) {
    // Extract all data attributes
    agentConfig = {
      agentId: scriptElement.getAttribute('data-agent-id') || 'default',
      agentName: scriptElement.getAttribute('data-agent-name') || 'Assistente AI',
      primaryColor: scriptElement.getAttribute('data-primary-color') || '#022b44',
      accentColor: scriptElement.getAttribute('data-accent-color') || '#b8ec00',
      position: scriptElement.getAttribute('data-position') || 'bottom-right',
      title: scriptElement.getAttribute('data-title') || 'Chat',
      subtitle: scriptElement.getAttribute('data-subtitle') || 'Como posso ajudar?'
    };
    
    CONFIG.position = agentConfig.position;
  }

  function setChatUrl(scriptElement) {
    // Always use the script source URL for external sites
    const scriptSrc = scriptElement.src;
    if (scriptSrc) {
      const url = new URL(scriptSrc);
      CONFIG.chatUrl = `${url.protocol}//${url.host}/chat.html`;
      CONFIG.apiUrl = `${url.protocol}//${url.host}/api`;
    } else {
      // Fallback to current domain (for local development)
      CONFIG.chatUrl = `${window.location.protocol}//${window.location.host}/chat.html`;
      CONFIG.apiUrl = `${window.location.protocol}//${window.location.host}/api`;
    }
    
    console.log('🔧 Webchat Debug:');
    console.log('  Script source:', scriptSrc);
    console.log('  Chat URL:', CONFIG.chatUrl);
    console.log('  API URL:', CONFIG.apiUrl);
    console.log('  Current domain:', window.location.host);
  }

  function injectStyles() {
    const styles = `
      .webchat-toggle-button {
        position: fixed;
        ${CONFIG.position.includes('right') ? 'right: 20px;' : 'left: 20px;'}
        ${CONFIG.position.includes('bottom') ? 'bottom: 20px;' : 'top: 20px;'}
        width: 60px;
        height: 60px;
        background: linear-gradient(135deg, ${agentConfig.primaryColor}, #1e40af);
        border: none;
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: ${CONFIG.zIndex};
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 24px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      
      .webchat-toggle-button:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
      }
      
      .webchat-toggle-button.open {
        background: #ef4444;
      }
      
      .webchat-iframe {
        position: fixed;
        ${CONFIG.position.includes('right') ? 'right: 20px;' : 'left: 20px;'}
        ${CONFIG.position.includes('bottom') ? 'bottom: 90px;' : 'top: 90px;'}
        width: 350px;
        height: 500px;
        border: none;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
        z-index: ${CONFIG.zIndex - 1};
        background: white;
        display: none;
        opacity: 0;
        transform: translateY(20px);
        transition: all 0.3s ease;
      }
      
      .webchat-iframe.open {
        display: block;
        opacity: 1;
        transform: translateY(0);
      }
      
      @media (max-width: 480px) {
        .webchat-iframe {
          width: calc(100vw - 40px);
          height: calc(100vh - 40px);
          ${CONFIG.position.includes('right') ? 'right: 20px;' : 'left: 20px;'}
          ${CONFIG.position.includes('bottom') ? 'bottom: 20px;' : 'top: 20px;'}
        }
      }
    `;
    
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
  }

  function createToggleButton() {
    toggleButton = document.createElement('button');
    toggleButton.className = 'webchat-toggle-button';
    toggleButton.innerHTML = '💬';
    toggleButton.setAttribute('aria-label', 'Abrir chat');
    toggleButton.setAttribute('title', agentConfig.title);
    
    document.body.appendChild(toggleButton);
  }

  function createChatIframe() {
    chatIframe = document.createElement('iframe');
    chatIframe.className = 'webchat-iframe';
    
    // Build iframe URL with parameters - use the API URL from script source
    const params = new URLSearchParams({
      agentId: agentConfig.agentId,
      agentName: agentConfig.agentName,
      primaryColor: agentConfig.primaryColor,
      accentColor: agentConfig.accentColor,
      apiUrl: CONFIG.apiUrl // Use the API URL from script source, not current domain
    });
    
    chatIframe.src = `${CONFIG.chatUrl}?${params.toString()}`;
    chatIframe.setAttribute('allow', 'clipboard-write');
    chatIframe.setAttribute('title', 'Chat com ' + agentConfig.agentName);
    
    console.log('Webchat iframe criado:', chatIframe.src);
    console.log('Parâmetros:', Object.fromEntries(params));
    
    document.body.appendChild(chatIframe);
  }

  function setupEventListeners() {
    // Toggle button click
    toggleButton.addEventListener('click', toggleChat);
    
    // Listen for messages from iframe
    window.addEventListener('message', function(event) {
      // Verify origin for security
      if (event.source !== chatIframe.contentWindow) return;
      
      if (event.data.type === 'closeChat') {
        closeChat();
      }
    });
    
    // Close chat on escape key
    document.addEventListener('keydown', function(event) {
      if (event.key === 'Escape' && isOpen) {
        closeChat();
      }
    });
    
    // Close chat when clicking outside (optional)
    document.addEventListener('click', function(event) {
      if (isOpen && 
          !chatIframe.contains(event.target) && 
          !toggleButton.contains(event.target)) {
        // Uncomment to enable click-outside-to-close
        // closeChat();
      }
    });
  }

  function toggleChat() {
    if (isOpen) {
      closeChat();
    } else {
      openChat();
    }
  }

  function openChat() {
    isOpen = true;
    chatIframe.classList.add('open');
    toggleButton.classList.add('open');
    toggleButton.innerHTML = '×';
    toggleButton.setAttribute('aria-label', 'Fechar chat');
    
    // Focus iframe after animation
    setTimeout(() => {
      chatIframe.contentWindow.postMessage({ type: 'focus' }, '*');
    }, 300);
  }

  function closeChat() {
    isOpen = false;
    chatIframe.classList.remove('open');
    toggleButton.classList.remove('open');
    toggleButton.innerHTML = '💬';
    toggleButton.setAttribute('aria-label', 'Abrir chat');
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // DOM is already loaded
    if (document.body) {
      init();
    } else {
      // Body not ready yet, wait a bit
      setTimeout(init, 100);
    }
  }

})();