// Using built-in fetch in Node.js 18+

async function testWebhook() {
  const webhookData = {
    event: "MESSAGES_UPSERT",
    instance: "41988470604",
    data: {
      messages: [{
        key: {
          remoteJid: "5541999887766@s.whatsapp.net",
          fromMe: false,
          id: "test-message-" + Date.now()
        },
        message: {
          conversation: "Como funciona o sistema de IA?"
        },
        messageTimestamp: Math.floor(Date.now() / 1000).toString()
      }]
    }
  };
  
  try {
    const response = await fetch('http://localhost:5000/api/whatsapp/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(webhookData)
    });
    
    const result = await response.json();
    console.log('Webhook Response:', result);
    console.log('Status:', response.status);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testWebhook();