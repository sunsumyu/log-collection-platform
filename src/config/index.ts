// Centralized application configuration
import dotenv from 'dotenv';
import { AppConfig } from '../types';

dotenv.config();

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://107.161.83.190:27017/on-chain-inter-logs',
    dbName: 'on-chain-inter-logs'
  },
  elasticsearch: {
    url: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
    index: 'browser-logs'
  },
  logLevel: process.env.LOG_LEVEL || 'info'
};

// Re-export types for convenience
export * from '../types';
