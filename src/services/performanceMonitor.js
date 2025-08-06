const os = require('os');
const queryService = require('./queryService');

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        averageResponseTime: 0,
        responseTimes: [],
      },
      database: {
        totalQueries: 0,
        slowQueries: 0,
        averageQueryTime: 0,
        queryTimes: [],
      },
      memory: {
        usage: [],
        peak: 0,
      },
      errors: {
        total: 0,
        byType: {},
      },
      cache: {
        hits: 0,
        misses: 0,
        hitRate: 0,
      },
    };
    
    this.startTime = Date.now();
    this.isMonitoring = false;
  }

  // Start monitoring
  start() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this._startMemoryMonitoring();
    this._startCacheMonitoring();
    
    console.log('🚀 Performance monitoring started');
  }

  // Stop monitoring
  stop() {
    this.isMonitoring = false;
    console.log('🛑 Performance monitoring stopped');
  }

  // Record request metrics
  recordRequest(duration, success = true, errorType = null) {
    if (!this.isMonitoring) return;

    this.metrics.requests.total++;
    
    if (success) {
      this.metrics.requests.successful++;
    } else {
      this.metrics.requests.failed++;
      this._recordError(errorType);
    }

    this.metrics.requests.responseTimes.push(duration);
    
    // Keep only last 1000 response times for memory efficiency
    if (this.metrics.requests.responseTimes.length > 1000) {
      this.metrics.requests.responseTimes.shift();
    }

    this._updateAverageResponseTime();
  }

  // Record database query metrics
  recordDatabaseQuery(duration, isSlow = false) {
    if (!this.isMonitoring) return;

    this.metrics.database.totalQueries++;
    
    if (isSlow) {
      this.metrics.database.slowQueries++;
    }

    this.metrics.database.queryTimes.push(duration);
    
    // Keep only last 1000 query times
    if (this.metrics.database.queryTimes.length > 1000) {
      this.metrics.database.queryTimes.shift();
    }

    this._updateAverageQueryTime();
  }

  // Record cache metrics
  recordCacheHit() {
    if (!this.isMonitoring) return;
    this.metrics.cache.hits++;
    this._updateCacheHitRate();
  }

  recordCacheMiss() {
    if (!this.isMonitoring) return;
    this.metrics.cache.misses++;
    this._updateCacheHitRate();
  }

  // Record error
  _recordError(errorType) {
    this.metrics.errors.total++;
    
    if (errorType) {
      this.metrics.errors.byType[errorType] = 
        (this.metrics.errors.byType[errorType] || 0) + 1;
    }
  }

  // Update average response time
  _updateAverageResponseTime() {
    const times = this.metrics.requests.responseTimes;
    if (times.length > 0) {
      this.metrics.requests.averageResponseTime = 
        times.reduce((sum, time) => sum + time, 0) / times.length;
    }
  }

  // Update average query time
  _updateAverageQueryTime() {
    const times = this.metrics.database.queryTimes;
    if (times.length > 0) {
      this.metrics.database.averageQueryTime = 
        times.reduce((sum, time) => sum + time, 0) / times.length;
    }
  }

  // Update cache hit rate
  _updateCacheHitRate() {
    const total = this.metrics.cache.hits + this.metrics.cache.misses;
    if (total > 0) {
      this.metrics.cache.hitRate = (this.metrics.cache.hits / total) * 100;
    }
  }

  // Start memory monitoring
  _startMemoryMonitoring() {
    setInterval(() => {
      if (!this.isMonitoring) return;

      const memUsage = process.memoryUsage();
      const memoryData = {
        timestamp: Date.now(),
        rss: Math.round(memUsage.rss / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        external: Math.round(memUsage.external / 1024 / 1024), // MB
      };

      this.metrics.memory.usage.push(memoryData);
      
      // Keep only last 100 memory readings
      if (this.metrics.memory.usage.length > 100) {
        this.metrics.memory.usage.shift();
      }

      // Update peak memory usage
      if (memoryData.rss > this.metrics.memory.peak) {
        this.metrics.memory.peak = memoryData.rss;
      }
    }, 30000); // Every 30 seconds
  }

  // Start cache monitoring
  _startCacheMonitoring() {
    setInterval(() => {
      if (!this.isMonitoring) return;
      
      try {
        const cacheStats = queryService.getCacheStats();
        // Cache stats are updated in real-time by the query service
      } catch (error) {
        console.error('Error getting cache stats:', error);
      }
    }, 60000); // Every minute
  }

  // Get current metrics
  getMetrics() {
    const uptime = Date.now() - this.startTime;
    
    return {
      ...this.metrics,
      system: {
        uptime: Math.round(uptime / 1000), // seconds
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus().length,
        totalMemory: Math.round(os.totalmem() / 1024 / 1024 / 1024), // GB
        freeMemory: Math.round(os.freemem() / 1024 / 1024 / 1024), // GB
        loadAverage: os.loadavg(),
      },
      cache: {
        ...this.metrics.cache,
        ...queryService.getCacheStats(),
      },
    };
  }

  // Get performance summary
  getSummary() {
    const metrics = this.getMetrics();
    const uptimeHours = metrics.system.uptime / 3600;
    
    return {
      uptime: `${Math.round(uptimeHours * 10) / 10}h`,
      requests: {
        total: metrics.requests.total,
        successRate: metrics.requests.total > 0 
          ? Math.round((metrics.requests.successful / metrics.requests.total) * 100)
          : 0,
        averageResponseTime: `${Math.round(metrics.requests.averageResponseTime)}ms`,
      },
      database: {
        totalQueries: metrics.database.totalQueries,
        slowQueries: metrics.database.slowQueries,
        averageQueryTime: `${Math.round(metrics.database.averageQueryTime)}ms`,
      },
      memory: {
        current: `${metrics.memory.usage[metrics.memory.usage.length - 1]?.rss || 0}MB`,
        peak: `${metrics.memory.peak}MB`,
      },
      cache: {
        hitRate: `${Math.round(metrics.cache.hitRate)}%`,
        hits: metrics.cache.hits,
        misses: metrics.cache.misses,
      },
      errors: {
        total: metrics.errors.total,
        topErrors: Object.entries(metrics.errors.byType)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .map(([type, count]) => ({ type, count })),
      },
    };
  }

  // Reset metrics
  reset() {
    this.metrics = {
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        averageResponseTime: 0,
        responseTimes: [],
      },
      database: {
        totalQueries: 0,
        slowQueries: 0,
        averageQueryTime: 0,
        queryTimes: [],
      },
      memory: {
        usage: [],
        peak: 0,
      },
      errors: {
        total: 0,
        byType: {},
      },
      cache: {
        hits: 0,
        misses: 0,
        hitRate: 0,
      },
    };
    
    this.startTime = Date.now();
    console.log('🔄 Performance metrics reset');
  }

  // Export metrics for external monitoring
  exportMetrics() {
    return {
      timestamp: new Date().toISOString(),
      metrics: this.getMetrics(),
      summary: this.getSummary(),
    };
  }
}

// Create singleton instance
const performanceMonitor = new PerformanceMonitor();

module.exports = performanceMonitor; 