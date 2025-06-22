// Test the complete webhook system
const token = '8Tu2U0TAe7k3dnhHJlXgy9GgQeiWdVbx';
const instanceName = '5541996488281';

async function testSystem() {
  console.log('Testando sistema completo...');
  
  // Send test message
  const response = await fetch(`https://apizap.ecomtools.com.br/message/sendText/${instanceName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': token
    },
    body: JSON.stringify({
      number: '5541988470604',
      text: 'TESTE FINAL DO SISTEMA - Responda esta mensagem pelo WhatsApp agora!'
    })
  });

  const result = await response.json();
  console.log('Mensagem enviada:', result.key?.id);
  
  // Monitor for 30 seconds
  let checks = 0;
  const maxChecks = 30;
  
  const interval = setInterval(async () => {
    checks++;
    
    try {
      const messagesResponse = await fetch(`https://apizap.ecomtools.com.br/chat/findMessages/${instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': token
        },
        body: JSON.stringify({
          where: { key: { fromMe: false } },
          limit: 3
        })
      });
      
      if (messagesResponse.ok) {
        const messages = await messagesResponse.json();
        if (Array.isArray(messages) && messages.length > 0) {
          const latest = messages[0];
          const messageTime = latest.messageTimestamp * 1000;
          const timeDiff = Date.now() - messageTime;
          
          if (timeDiff < 5000) { // Message less than 5 seconds old
            const phoneNumber = latest.key?.remoteJid?.replace('@s.whatsapp.net', '');
            const messageText = latest.message?.conversation;
            
            if (phoneNumber && messageText) {
              console.log(`MENSAGEM DETECTADA: ${phoneNumber} - "${messageText}"`);
              console.log('Sistema funcionando automaticamente!');
              clearInterval(interval);
              return;
            }
          }
        }
      }
    } catch (error) {
      // Continue
    }
    
    if (checks >= maxChecks) {
      clearInterval(interval);
      console.log('Teste finalizado');
    }
  }, 1000);
}

testSystem();