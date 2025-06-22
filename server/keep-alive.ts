/**
 * Keep-Alive Service
 * Prevents the application from going to sleep in deployment environments
 */

export class KeepAliveService {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly pingInterval = 3 * 60 * 1000; // 3 minutos para manter ativo
  private readonly baseUrl = process.env.REPL_URL || 'http://localhost:5000';

  start() {
    console.log('🔄 Iniciando serviço Keep-Alive');
    
    this.intervalId = setInterval(async () => {
      try {
        const response = await fetch(`${this.baseUrl}/health`, {
          method: 'GET',
          headers: { 'User-Agent': 'KeepAlive/1.0' }
        });
        
        if (response.ok) {
          console.log('✅ Keep-Alive ping enviado');
        }
      } catch (error) {
        console.log('⚠️ Keep-Alive ping falhou:', error.message);
      }
    }, this.pingInterval);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🛑 Serviço Keep-Alive parado');
    }
  }
}

export const keepAliveService = new KeepAliveService();