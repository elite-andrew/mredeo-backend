const db = require('../config/database');
const NodeCache = require('node-cache');

// Cache configuration - 5 minutes default TTL
const cache = new NodeCache({ 
  stdTTL: 300, // 5 minutes
  checkperiod: 600, // Check for expired keys every 10 minutes
  useClones: false // Better performance
});

class QueryService {
  constructor() {
    this.pool = db;
  }

  // Execute query with connection from pool
  async query(text, params = []) {
    const client = await this.pool.connect();
    try {
      const start = Date.now();
      const result = await client.query(text, params);
      const duration = Date.now() - start;
      
      // Log slow queries (over 100ms)
      if (duration > 100) {
        console.log('Slow query detected:', {
          text: text.substring(0, 100) + '...',
          duration: `${duration}ms`,
          params: params.length
        });
      }
      
      return result;
    } finally {
      client.release();
    }
  }

  // Execute transaction
  async transaction(callback) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Cached query execution
  async cachedQuery(cacheKey, text, params = [], ttl = 300) {
    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Execute query
    const result = await this.query(text, params);
    
    // Cache the result
    cache.set(cacheKey, result, ttl);
    
    return result;
  }

  // Batch insert optimization
  async batchInsert(table, columns, values) {
    if (values.length === 0) return { rowCount: 0 };
    
    const placeholders = values.map((_, rowIndex) => {
      const start = rowIndex * columns.length + 1;
      return `(${columns.map((_, colIndex) => `$${start + colIndex}`).join(', ')})`;
    }).join(', ');

    const query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${placeholders}`;
    const flatValues = values.flat();
    
    return await this.query(query, flatValues);
  }

  // Pagination helper
  async paginatedQuery(baseQuery, page = 1, limit = 10, params = []) {
    const offset = (page - 1) * limit;
    const countQuery = `SELECT COUNT(*) FROM (${baseQuery}) as count_query`;
    const dataQuery = `${baseQuery} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    
    const [countResult, dataResult] = await Promise.all([
      this.query(countQuery, params),
      this.query(dataQuery, [...params, limit, offset])
    ]);

    return {
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
      }
    };
  }

  // Clear cache
  clearCache(pattern = null) {
    if (pattern) {
      const keys = cache.keys();
      keys.forEach(key => {
        if (key.includes(pattern)) {
          cache.del(key);
        }
      });
    } else {
      cache.flushAll();
    }
  }

  // Get cache stats
  getCacheStats() {
    return cache.getStats();
  }

  // Optimized user queries with caching
  async getUserById(id, useCache = true) {
    const cacheKey = `user:${id}`;
    const query = `
      SELECT id, full_name, username, email, phone_number, role, 
             profile_picture, is_active, created_at, updated_at
      FROM users 
      WHERE id = $1 AND is_deleted = false
    `;
    
    if (useCache) {
      return await this.cachedQuery(cacheKey, query, [id], 600); // 10 minutes cache
    }
    return await this.query(query, [id]);
  }

  // Optimized payment queries
  async getPaymentsByUserId(userId, page = 1, limit = 20) {
    const baseQuery = `
      SELECT p.*, ct.name as contribution_type_name
      FROM payments p
      LEFT JOIN contribution_types ct ON p.contribution_type_id = ct.id
      WHERE p.user_id = $1
      ORDER BY p.created_at DESC
    `;
    
    return await this.paginatedQuery(baseQuery, page, limit, [userId]);
  }

  // Optimized notification queries
  async getNotificationsByUserId(userId, page = 1, limit = 20) {
    const baseQuery = `
      SELECT n.*, 
             CASE WHEN nr.is_read THEN true ELSE false END as is_read
      FROM notifications n
      LEFT JOIN notification_reads nr ON n.id = nr.notification_id AND nr.user_id = $1
      ORDER BY n.created_at DESC
    `;
    
    return await this.paginatedQuery(baseQuery, page, limit, [userId]);
  }

  // Bulk operations for better performance
  async bulkUpdateNotifications(notificationIds, userId) {
    const placeholders = notificationIds.map((_, index) => `$${index + 2}`).join(', ');
    const query = `
      INSERT INTO notification_reads (notification_id, user_id, is_read, created_at)
      SELECT id, $1, true, NOW()
      FROM notifications 
      WHERE id IN (${placeholders})
      ON CONFLICT (notification_id, user_id) 
      DO UPDATE SET is_read = true, updated_at = NOW()
    `;
    
    return await this.query(query, [userId, ...notificationIds]);
  }
}

module.exports = new QueryService(); 