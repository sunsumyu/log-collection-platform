// Centralized type definitions for the log collection platform

export interface LogEntry {
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  timestamp: string;
  metadata?: Record<string, any>;
  browserId: string;
}

export interface BrowserStats {
  browserId: string;
  total: number;
  byLevel: {
    error?: { count: number; latestTimestamp?: string };
    warn?: { count: number; latestTimestamp?: string };
    info?: { count: number; latestTimestamp?: string };
    debug?: { count: number; latestTimestamp?: string };
  };
  lastActivity?: string;
}

export interface OverviewData {
  totalBrowsers: number;
  browsers: BrowserStats[];
}

export interface LogSearchParams {
  browserId?: string;
  level?: string;
  startTime?: string;
  endTime?: string;
  searchText?: string;
  limit?: number;
}

export interface LogServiceConfig {
  mongodbUri?: string;
  logLevel?: string;
}

export interface ElasticsearchConfig {
  url: string;
  index: string;
}

export interface AppConfig {
  port: number;
  mongodb: {
    uri: string;
    dbName: string;
  };
  elasticsearch: ElasticsearchConfig;
  logLevel: string;
}

export interface SearchQuery {
  level?: string;
  startTime?: string;
  endTime?: string;
  searchText?: string;
  browserId?: string;
  from?: number;
  size?: number;
  limit?: string | number;
  offset?: string | number;
  [key: string]: any;
}

export interface SearchResponse {
  hits: {
    hits: Array<{
      _source: any;
      _id: string;
    }>;
    total: {
      value: number;
    };
  };
}

export interface AggregationResponse {
  aggregations: {
    levels?: {
      buckets: Array<{
        key: string;
        doc_count: number;
      }>;
    };
    browsers?: {
      buckets: Array<{
        key: string;
        doc_count: number;
      }>;
    };
    [key: string]: any;
  };
}
