/**
 * Performance Monitor
 * Tracks response times and system performance
 */

interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: number;
  agentId?: number;
  success: boolean;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private readonly MAX_METRICS = 100;

  startTimer(operation: string): () => void {
    const startTime = Date.now();
    
    return (agentId?: number, success: boolean = true) => {
      const duration = Date.now() - startTime;
      
      this.addMetric({
        operation,
        duration,
        timestamp: Date.now(),
        agentId,
        success
      });
      
      // Log slow operations
      if (duration > 2000) {
        console.log(`⚠️ Operação lenta detectada: ${operation} - ${duration}ms`);
      } else if (duration < 500) {
        console.log(`⚡ Resposta rápida: ${operation} - ${duration}ms`);
      }
      
      return duration;
    };
  }

  private addMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);
    
    // Keep only recent metrics
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics.shift();
    }
  }

  getStats(): {
    averageResponseTime: number;
    fastResponses: number;
    slowResponses: number;
    totalRequests: number;
  } {
    if (this.metrics.length === 0) {
      return {
        averageResponseTime: 0,
        fastResponses: 0,
        slowResponses: 0,
        totalRequests: 0
      };
    }

    const totalTime = this.metrics.reduce((sum, metric) => sum + metric.duration, 0);
    const averageResponseTime = totalTime / this.metrics.length;
    const fastResponses = this.metrics.filter(m => m.duration < 1000).length;
    const slowResponses = this.metrics.filter(m => m.duration > 3000).length;

    return {
      averageResponseTime: Math.round(averageResponseTime),
      fastResponses,
      slowResponses,
      totalRequests: this.metrics.length
    };
  }

  getRecentMetrics(count: number = 10): PerformanceMetric[] {
    return this.metrics.slice(-count);
  }
}

export const performanceMonitor = new PerformanceMonitor();