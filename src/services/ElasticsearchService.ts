import axios, { AxiosInstance } from 'axios';

interface SearchQuery {
  from?: number;
  size?: number;
  startTime?: string;
  endTime?: string;
  level?: string;
  searchText?: string;
  browserId?: string;
}

interface LogDocument {
  browserId: string;
  level: string;
  message: string;
  timestamp: string;
  metadata?: any;
  '@timestamp': string;
}

interface SearchResponse {
  hits: {
    total: { value: number };
    hits: Array<{
      _source: LogDocument;
    }>;
  };
  aggregations?: any;
}

interface TrendData {
  timestamp: string;
  count: number;
  errorCount: number;
  warnCount: number;
}

interface PerformanceMetrics {
  avgResponseTime: number;
  errorRate: number;
  throughput: number;
}

interface BrowserComparison {
  browserId: string;
  totalLogs: number;
  errorRate: number;
  avgResponseTime: number;
}

export class ElasticsearchService {
  private baseUrl: string;
  private connected: boolean = false;
  private client: AxiosInstance;

  constructor() {
    this.baseUrl = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
    });
  }

  async initialize(): Promise<void> {
    try {
      const response = await this.client.get('/_cluster/health');
      if (response.data.status !== 'red') {
        this.connected = true;
        console.log('Connected to Elasticsearch');
      } else {
        console.warn('Elasticsearch cluster is in red state');
      }
    } catch (error) {
      console.error('Failed to connect to Elasticsearch:', error);
      this.connected = false;
    }
  }

  async searchLogs(browserId: string, query: SearchQuery = {}): Promise<LogDocument[]> {
    if (!this.connected) throw new Error('Elasticsearch not connected');

    const { size = 100, startTime, endTime, level, searchText } = query;
    
    const searchBody: any = {
      size,
      query: {
        bool: {
          must: [
            { term: { 'browserId.keyword': browserId } }
          ],
          filter: []
        }
      }
    };

    // Add time range filter
    if (startTime || endTime) {
      const timeRange: any = {};
      if (startTime) timeRange.gte = startTime;
      if (endTime) timeRange.lte = endTime;
      searchBody.query.bool.filter.push({
        range: {
          '@timestamp': timeRange
        }
      });
    }

    // Add level filter
    if (level) {
      searchBody.query.bool.must.push({
        term: { 'level.keyword': level }
      });
    }

    // Add search text
    if (searchText) {
      searchBody.query.bool.must.push({
        multi_match: {
          query: searchText,
          fields: ['message^2', 'metadata.*'],
          type: 'phrase_prefix'
        }
      });
    }

    try {
      const response = await this.client.post<SearchResponse>('/browser-logs*/_search', searchBody);
      return response.data.hits.hits.map(hit => hit._source);
    } catch (error) {
      console.error('Error searching logs:', error);
      throw error;
    }
  }

  async searchAllLogs(query: SearchQuery = {}): Promise<LogDocument[]> {
    if (!this.connected) throw new Error('Elasticsearch not connected');

    const { size = 100, startTime, endTime, level, searchText } = query;
    
    const searchBody: any = {
      size,
      query: {
        bool: {
          filter: []
        }
      }
    };

    // Add time range filter
    if (startTime || endTime) {
      const timeRange: any = {};
      if (startTime) timeRange.gte = startTime;
      if (endTime) timeRange.lte = endTime;
      searchBody.query.bool.filter.push({
        range: {
          '@timestamp': timeRange
        }
      });
    }

    // Add level filter
    if (level) {
      searchBody.query.bool.must = searchBody.query.bool.must || [];
      searchBody.query.bool.must.push({
        term: { 'level.keyword': level }
      });
    }

    // Add search text
    if (searchText) {
      searchBody.query.bool.must = searchBody.query.bool.must || [];
      searchBody.query.bool.must.push({
        multi_match: {
          query: searchText,
          fields: ['message^2', 'metadata.*'],
          type: 'phrase_prefix'
        }
      });
    }

    try {
      const response = await this.client.post<SearchResponse>('/browser-logs*/_search', searchBody);
      return response.data.hits.hits.map(hit => hit._source);
    } catch (error) {
      console.error('Error searching all logs:', error);
      throw error;
    }
  }

  async getErrorTrends(timeRange: string = '24h'): Promise<TrendData[]> {
    if (!this.connected) throw new Error('Elasticsearch not connected');

    const interval = this.getIntervalForTimeRange(timeRange);
    const searchBody = {
      size: 0,
      query: {
        bool: {
          filter: [
            {
              range: {
                '@timestamp': {
                  gte: `now-${timeRange}`
                }
              }
            }
          ]
        }
      },
      aggs: {
        trends: {
          date_histogram: {
            field: '@timestamp',
            fixed_interval: interval
          },
          aggs: {
            errorCount: {
              filter: { term: { 'level.keyword': 'error' } }
            },
            warnCount: {
              filter: { term: { 'level.keyword': 'warn' } }
            }
          }
        }
      }
    };

    try {
      const response = await this.client.post('/browser-logs*/_search', searchBody);
      return response.data.aggregations.trends.buckets.map((bucket: any) => ({
        timestamp: bucket.key_as_string,
        count: bucket.doc_count,
        errorCount: bucket.errorCount.doc_count,
        warnCount: bucket.warnCount.doc_count
      }));
    } catch (error) {
      console.error('Error getting error trends:', error);
      throw error;
    }
  }

  async getPerformanceMetrics(browserId: string, timeRange: string = '1h'): Promise<PerformanceMetrics> {
    if (!this.connected) throw new Error('Elasticsearch not connected');

    const searchBody = {
      size: 0,
      query: {
        bool: {
          must: [
            { term: { 'browserId.keyword': browserId } }
          ],
          filter: [
            {
              range: {
                '@timestamp': {
                  gte: `now-${timeRange}`
                }
              }
            }
          ]
        }
      },
      aggs: {
        avgResponseTime: {
          avg: { field: 'metadata.responseTime' }
        },
        errorCount: {
          filter: { term: { 'level.keyword': 'error' } }
        },
        totalCount: {
          value_count: { field: 'level' }
        }
      }
    };

    try {
      const response = await this.client.post<SearchResponse>('/browser-logs*/_search', searchBody);
      const aggs = response.data.aggregations;
      
      return {
        avgResponseTime: aggs.avgResponseTime.value || 0,
        errorRate: aggs.totalCount.value > 0 ? (aggs.errorCount.doc_count / aggs.totalCount.value) * 100 : 0,
        throughput: aggs.totalCount.value
      };
    } catch (error) {
      console.error('Error getting performance metrics:', error);
      throw error;
    }
  }

  async getBrowserComparison(timeRange: string = '24h'): Promise<BrowserComparison[]> {
    if (!this.connected) throw new Error('Elasticsearch not connected');

    const searchBody = {
      size: 0,
      query: {
        bool: {
          filter: [
            {
              range: {
                '@timestamp': {
                  gte: `now-${timeRange}`
                }
              }
            }
          ]
        }
      },
      aggs: {
        browsers: {
          terms: { field: 'browserId.keyword', size: 10 },
          aggs: {
            totalLogs: { value_count: { field: 'level' } },
            errorCount: {
              filter: { term: { 'level.keyword': 'error' } }
            },
            avgResponseTime: {
              avg: { field: 'metadata.responseTime' }
            }
          }
        }
      }
    };

    try {
      const response = await this.client.post('/browser-logs*/_search', searchBody);
      return response.data.aggregations.browsers.buckets.map((bucket: any) => ({
        browserId: bucket.key,
        totalLogs: bucket.totalLogs.value,
        errorRate: bucket.totalLogs.value > 0 ? (bucket.errorCount.doc_count / bucket.totalLogs.value) * 100 : 0,
        avgResponseTime: bucket.avgResponseTime.value || 0
      }));
    } catch (error) {
      console.error('Error getting browser comparison:', error);
      throw error;
    }
  }

  async indexLog(log: LogDocument): Promise<void> {
    if (!this.connected) return;

    try {
      await this.client.post('/browser-logs*/_doc', log);
    } catch (error) {
      console.error('Error indexing log:', error);
    }
  }

  async close(): Promise<void> {
    this.connected = false;
    console.log('Elasticsearch connection closed');
  }

  isConnected(): boolean { 
    return this.connected;
  }

  async connect(): Promise<void> {
    try {
      await this.client.get('/');
      this.connected = true;
      console.log('✅ Elasticsearch connected successfully');
    } catch (error: any) {
      console.warn('⚠️ Elasticsearch connection failed - running without search functionality:', error?.message || 'Unknown error');
      this.connected = false;
      // Don't throw error - allow app to start without Elasticsearch
    }
  }

  private getIntervalForTimeRange(timeRange: string): string {
    const rangeMap: { [key: string]: string } = {
      '1h': '1m',
      '6h': '5m',
      '24h': '1h',
      '7d': '1d',
      '30d': '1d'
    };
    return rangeMap[timeRange] || '1h';
  }
}


