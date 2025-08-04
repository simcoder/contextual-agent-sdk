import { StorageProvider, StorageConfig } from '../types/storage';
import { RedisStorageProvider } from './RedisStorageProvider';
import { MongoStorageProvider } from './MongoStorageProvider';
import { MemoryStorageProvider } from './MemoryStorageProvider';

export type StorageType = 'redis' | 'mongodb' | 'memory';

export interface StorageFactoryConfig {
  type: StorageType;
  config?: StorageConfig;
}

/**
 * Factory class to create storage providers
 * Defaults to in-memory storage if no configuration is provided
 */
export class StorageFactory {
  /**
   * Create a storage provider based on configuration
   */
  static createProvider(factoryConfig?: StorageFactoryConfig): StorageProvider {
    // Default to memory storage if no config provided
    if (!factoryConfig) {
      console.warn('No storage configuration provided. Using in-memory storage (not recommended for production).');
      return new MemoryStorageProvider();
    }

    switch (factoryConfig.type) {
      case 'redis':
        if (!factoryConfig.config?.url) {
          console.warn('Redis URL not provided. Falling back to in-memory storage.');
          return new MemoryStorageProvider();
        }
        return new RedisStorageProvider(factoryConfig.config);

      case 'mongodb':
        if (!factoryConfig.config?.url) {
          console.warn('MongoDB URL not provided. Falling back to in-memory storage.');
          return new MemoryStorageProvider();
        }
        return new MongoStorageProvider(factoryConfig.config);

      case 'memory':
        if (process.env.NODE_ENV === 'production') {
          console.warn('Using in-memory storage in production is not recommended.');
        }
        return new MemoryStorageProvider(factoryConfig.config);

      default:
        console.warn('Unknown storage type. Using in-memory storage.');
        return new MemoryStorageProvider();
    }
  }

  /**
   * Create a storage provider from environment variables
   */
  static createFromEnv(): StorageProvider {
    // Check for Redis configuration
    if (process.env.REDIS_URL) {
      return StorageFactory.createProvider({
        type: 'redis',
        config: {
          url: process.env.REDIS_URL,
          username: process.env.REDIS_USERNAME,
          password: process.env.REDIS_PASSWORD,
          ssl: process.env.REDIS_SSL === 'true',
          maxConnections: process.env.REDIS_MAX_CONNECTIONS ? 
            parseInt(process.env.REDIS_MAX_CONNECTIONS) : undefined,
          timeout: process.env.REDIS_TIMEOUT ? 
            parseInt(process.env.REDIS_TIMEOUT) : undefined,
          maxAge: process.env.SESSION_MAX_AGE ? 
            parseInt(process.env.SESSION_MAX_AGE) : 3600000, // 1 hour default
          cleanupInterval: process.env.SESSION_CLEANUP_INTERVAL ? 
            parseInt(process.env.SESSION_CLEANUP_INTERVAL) : 600000 // 10 minutes default
        }
      });
    }

    // Check for MongoDB configuration
    if (process.env.MONGODB_URL) {
      return StorageFactory.createProvider({
        type: 'mongodb',
        config: {
          url: process.env.MONGODB_URL,
          username: process.env.MONGODB_USERNAME,
          password: process.env.MONGODB_PASSWORD,
          ssl: process.env.MONGODB_SSL === 'true',
          certPath: process.env.MONGODB_CERT_PATH,
          maxConnections: process.env.MONGODB_MAX_CONNECTIONS ? 
            parseInt(process.env.MONGODB_MAX_CONNECTIONS) : undefined,
          timeout: process.env.MONGODB_TIMEOUT ? 
            parseInt(process.env.MONGODB_TIMEOUT) : undefined,
          maxAge: process.env.SESSION_MAX_AGE ? 
            parseInt(process.env.SESSION_MAX_AGE) : 3600000,
          cleanupInterval: process.env.SESSION_CLEANUP_INTERVAL ? 
            parseInt(process.env.SESSION_CLEANUP_INTERVAL) : 600000
        }
      });
    }

    // Default to memory storage with optional configuration
    return StorageFactory.createProvider({
      type: 'memory',
      config: {
        maxAge: process.env.SESSION_MAX_AGE ? 
          parseInt(process.env.SESSION_MAX_AGE) : 3600000,
        cleanupInterval: process.env.SESSION_CLEANUP_INTERVAL ? 
          parseInt(process.env.SESSION_CLEANUP_INTERVAL) : 600000
      }
    });
  }
} 