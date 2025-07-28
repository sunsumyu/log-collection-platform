import { MongoClient, Db, Collection } from 'mongodb';
import pino, { Logger } from 'pino';
import { EventEmitter } from 'events';
import { 
  extractBrowserId,
  extractBrowserIdFromLog, 
  getUniqueBrowserIds, 
  filterLogsByBrowserId,
  filterMainThreadLogs,
  getLogsForBrowser,
  isMainThreadLog
} from '../utils/browserIdExtractor';

interface LogEntry {
  level: string;
  message: string;
  timestamp: string;
  metadata?: any;
  browserId?: string;
}

interface LogServiceConfig {
  mongodbUri?: string;
  logLevel?: string;
}

class LogService extends EventEmitter {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private collection: Collection | null = null;
  private connected: boolean = false;
  private logger: Logger;

  constructor(private config: LogServiceConfig = {}) {
    super();
    this.logger = this.setupLogger();
  }

  async connect(): Promise<void> {
    if (this.connected) return;

    const uri = this.config.mongodbUri || process.env.MONGODB_URI || 'mongodb://localhost:27017/on-chain-inter-logs';
    this.logger.info(`🔄 Attempting to connect to MongoDB at: ${uri.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@')}`);

    try {
      this.client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 5000, // 5 second timeout
        connectTimeoutMS: 10000, // 10 second timeout
      });
      
      this.logger.info('🔗 Connecting to MongoDB...');
      await this.client.connect();
      
      this.logger.info('📊 Selecting database...');
      this.db = this.client.db('on-chain-inter-logs');
      this.collection = this.db.collection('activity_logs');
      
      // Test the connection with a simple operation
      await this.db.admin().ping();
      
      this.connected = true;
      this.logger.info('✅ MongoDB connected successfully');
    } catch (error) {
      this.logger.error('❌ MongoDB connection failed:');
      this.logger.error('Error details:', {
        name: (error as Error).name,
        message: (error as Error).message,
        code: (error as any).code,
        codeName: (error as any).codeName
      });
      
      // Provide helpful error messages based on common issues
      if ((error as Error).message.includes('ECONNREFUSED')) {
        this.logger.error('💡 Suggestion: MongoDB server is not running or not accessible on the specified port');
      } else if ((error as Error).message.includes('Authentication failed')) {
        this.logger.error('💡 Suggestion: Check your username and password in the connection string');
      } else if ((error as Error).message.includes('Server selection timed out')) {
        this.logger.error('💡 Suggestion: MongoDB server is not responding. Check if MongoDB service is running');
      }
      
      throw error;
    }
  }

  private setupLogger(): Logger {
    return pino({
      level: this.config.logLevel || process.env.LOG_LEVEL || 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
          ignore: 'pid,hostname'
        }
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      redact: {
        paths: ['password', 'token', 'secret', 'key'],
        remove: true
      }
    });
  }

  async initialize(): Promise<void> {
    try {
      const uri = this.config.mongodbUri || process.env.MONGODB_URI || 'mongodb://localhost:27017/on-chain-inter-logs';
      this.client = new MongoClient(uri);
      await this.client.connect();
      
      this.db = this.client.db('on-chain-inter-logs');
      this.collection = this.db.collection('activity_logs');
      this.connected = true;
      
      this.logger.info('MongoDB connected successfully');
      this.emit('connected');
    } catch (error) {
      this.logger.error('Failed to connect to MongoDB:', error);
      this.emit('error', error);
      throw error;
    }
  }

  async log(level: string, message: string, metadata?: any): Promise<void> {
    const determinedBrowserId = metadata?.browserId ?? extractBrowserId(message) ?? undefined;

    const logEntry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      metadata,
      browserId: determinedBrowserId as any // cast, will be undefined if not found
    };

    (this.logger as any)[level](logEntry, message);
    
    if (this.connected && this.collection) {
      try {
        await this.collection.insertOne(logEntry);
      } catch (error) {
        this.logger.error('Failed to insert log into MongoDB:', error);
      }
    }
  }

  async getLogs(filter: any = {}, limit: number = 100): Promise<LogEntry[]> {
    if (!this.connected || !this.collection) {
      throw new Error('Database not connected');
    }

    try {
      const logs = await this.collection
        .find(filter)
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray();
      
      return logs.map(log => {
        // Handle both old format (message) and new format (msg)
        const messageText = log.message || log.msg || '';
        
        // Extract browserId from msg field if not already present
        let browserId = log.browserId;
        if (!browserId && messageText) {
          browserId = extractBrowserId(messageText);
        }
        
        return {
          level: this.mapLogLevel(log.level),
          message: messageText,
          timestamp: log.time || log.timestamp || new Date().toISOString(),  // Prioritize 'time' field
          metadata: log.metadata,
          browserId: browserId
        };
      });
    } catch (error) {
      this.logger.error('Failed to retrieve logs:', error);
      throw error;
    }
  }

  private mapLogLevel(level: any): string {
    // Handle both numeric and string log levels
    if (typeof level === 'string') {
      return level;
    }
    
    // Map numeric pino log levels to string
    const levelMap: { [key: number]: string } = {
      10: 'trace',
      20: 'debug', 
      30: 'info',
      40: 'warn',
      50: 'error',
      60: 'fatal'
    };
    
    return levelMap[level] || 'info';
  }

  async getLogsByLevel(level: string, limit: number = 100): Promise<LogEntry[]> {
    return this.getLogs({ level }, limit);
  }

  async getLogsByTimeRange(startTime: Date, endTime: Date, limit: number = 100): Promise<LogEntry[]> {
    return this.getLogs({
      time: {
        $gte: startTime.toISOString(),
        $lte: endTime.toISOString()
      }
    }, limit);
  }

  async searchLogs(searchTerm: string, limit: number = 100): Promise<LogEntry[]> {
    if (!this.connected || !this.collection) {
      throw new Error('Database not connected');
    }

    try {
      const logs = await this.collection
        .find({
          $or: [
            { message: { $regex: searchTerm, $options: 'i' } },
            { 'metadata.error': { $regex: searchTerm, $options: 'i' } }
          ]
        })
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray();
      
      return logs.map(log => ({
        level: (log as any).level || 'info',
        message: (log as any).message || '',
        timestamp: (log as any).timestamp || new Date().toISOString(),
        metadata: (log as any).metadata,
        browserId: (log as any).browserId
      }));
    } catch (error) {
      this.logger.error('Failed to search logs:', error);
      throw error;
    }
  }

  async getBrowserStats(): Promise<any[]> {
    if (!this.connected || !this.collection) {
      throw new Error('Database not connected');
    }

    try {
      const stats = await this.collection.aggregate([
        {
          $group: {
            _id: '$browserId',
            total: { $sum: 1 },
            byLevel: {
              $push: {
                level: '$level',
                timestamp: '$timestamp'
              }
            }
          }
        },
        { $sort: { total: -1 } }
      ]).toArray();

      return stats;
    } catch (error) {
      this.logger.error('Failed to get browser stats:', error);
      throw error;
    }
  }

  async getOverview(): Promise<any> {
    if (!this.connected || !this.collection) {
      throw new Error('Database not connected');
    }

    try {
      const totalLogs = await this.collection.countDocuments();
      const browserIds = await this.collection.distinct('browserId');
      const errorCount = await this.collection.countDocuments({ level: 'error' });

      // Get detailed stats for each browser
      const browsers = await Promise.all(
        browserIds.map(async (browserId) => {
          if (!browserId) return null; // Skip null/undefined browserIds
          
          const browserLogs = await this.collection!.countDocuments({ browserId });
          const browserErrors = await this.collection!.countDocuments({ browserId, level: 'error' });
          const browserWarns = await this.collection!.countDocuments({ browserId, level: 'warn' });
          const browserInfos = await this.collection!.countDocuments({ browserId, level: 'info' });
          
          // Get latest timestamp for each level
          const latestError = await this.collection!.findOne(
            { browserId, level: 'error' },
            { sort: { timestamp: -1 } }
          );
          const latestWarn = await this.collection!.findOne(
            { browserId, level: 'warn' },
            { sort: { timestamp: -1 } }
          );
          const latestInfo = await this.collection!.findOne(
            { browserId, level: 'info' },
            { sort: { timestamp: -1 } }
          );
          
          return {
            browserId,
            total: browserLogs,
            byLevel: {
              error: {
                count: browserErrors,
                latestTimestamp: latestError?.timestamp
              },
              warn: {
                count: browserWarns,
                latestTimestamp: latestWarn?.timestamp
              },
              info: {
                count: browserInfos,
                latestTimestamp: latestInfo?.timestamp
              }
            }
          };
        })
      );

      // Filter out null browsers
      const validBrowsers = browsers.filter(browser => browser !== null);

      return {
        totalBrowsers: validBrowsers.length,
        totalLogs,
        errorCount,
        browsers: validBrowsers
      };
    } catch (error) {
      this.logger.error('Failed to get overview:', error);
      throw error;
    }
  }

  async getAllBrowserIds(): Promise<string[]> {
    if (!this.connected || !this.collection) {
      throw new Error('Database not connected');
    }

    try {
      // Find logs with [Thread-X][Y] pattern
      const logs = await this.collection.find({
        $or: [
          { "msg": { $regex: /\[Thread-\d+\]\[\d+\]/ } },
          { "message": { $regex: /\[Thread-\d+\]\[\d+\]/ } }
        ]
      }).toArray();
      
      // Extract unique browser IDs
      const browserIds = new Set<string>();
      logs.forEach(log => {
        const messageText = log.message || log.msg || '';
        const browserId = extractBrowserId(messageText);
        if (browserId) {
          browserIds.add(browserId);
        }
      });
      
      return Array.from(browserIds);
    } catch (error) {
      this.logger.error('Failed to get browser IDs:', error);
      throw error;
    }
  }

  async getLogsByBrowser(browserId: string, options: {
    limit?: number;
    skip?: number;
    startTime?: string;
    endTime?: string;
    level?: string;
  } = {}): Promise<LogEntry[]> {
    if (!this.connected || !this.collection) {
      throw new Error('Database not connected');
    }

    const {
      limit = 100,
      skip = 0,
      startTime,
      endTime,
      level
    } = options;

    // Build filter to find logs with specific browserId in msg field
    const filter: any = {
      $or: [
        { "msg": { $regex: new RegExp(`\\[Thread-\\d+\\]\\[${browserId}\\]`) } },
        { "message": { $regex: new RegExp(`\\[Thread-\\d+\\]\\[${browserId}\\]`) } }
      ]
    };

    if (startTime || endTime) {
      filter.timestamp = {};
      if (startTime) filter.timestamp.$gte = startTime;
      if (endTime) filter.timestamp.$lte = endTime;
    }

    if (level) {
      if (typeof level === 'string') {
        // Convert string level to numeric if needed
        const levelMap: { [key: string]: number } = {
          'trace': 10, 'debug': 20, 'info': 30, 'warn': 40, 'error': 50, 'fatal': 60
        };
        filter.level = levelMap[level] || level;
      } else {
        filter.level = level;
      }
    }

    try {
      const logs = await this.collection
        .find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();
      
      return logs.map(log => {
        const messageText = log.message || log.msg || '';
        const extractedBrowserId = extractBrowserId(messageText);
        
        return {
          level: this.mapLogLevel(log.level),
          message: messageText,
          timestamp: log.timestamp || log.time || new Date().toISOString(),
          metadata: log.metadata,
          browserId: extractedBrowserId || ''
        };
      });
    } catch (error) {
      this.logger.error('Failed to get logs by browser:', error);
      throw error;
    }
  }

  async getLogStats(browserId: string): Promise<{
    totalLogs: number;
    errorCount: number;
    warnCount: number;
    infoCount: number;
    debugCount: number;
    lastLogTime: string;
  }> {
    if (!this.collection) {
      throw new Error('Database not connected');
    }
    
    try {
      // Get all logs and filter by browserId
      const allLogs = await this.collection.find({}).toArray();
      const browserLogs = allLogs.filter(log => {
        const message = log.msg || log.message || '';
        const logBrowserId = extractBrowserId(message);
        return logBrowserId === browserId;
      });

      const stats = {
        totalLogs: browserLogs.length,
        errorCount: 0,
        warnCount: 0,
        infoCount: 0,
        debugCount: 0,
        lastLogTime: '1970-01-01T00:00:00.000Z'
      };

      browserLogs.forEach(log => {
        const level = this.mapLogLevel(log.level);
        switch (level) {
          case 'error':
            stats.errorCount++;
            break;
          case 'warn':
            stats.warnCount++;
            break;
          case 'info':
            stats.infoCount++;
            break;
          case 'debug':
            stats.debugCount++;
            break;
          default:
            stats.infoCount++;
        }

        const logTime = log.timestamp || log['@timestamp'];
        if (logTime && new Date(logTime) > new Date(stats.lastLogTime)) {
          stats.lastLogTime = logTime;
        }
      });

      return stats;
    } catch (error) {
      this.logger.error('Error getting log stats:', error);
      throw error;
    }
  }

  async getLogSummary(filters: {
    startTime?: string;
    endTime?: string;
  } = {}): Promise<{
    totalLogs: number;
    browsers: number;
    errorRate: number;
    mostActiveBrowser: string;
    timeRange: { start: string; end: string };
  }> {
    if (!this.connected || !this.collection) {
      throw new Error('Database not connected');
    }

    const { startTime, endTime } = filters;
    const filter: any = {};

    if (startTime || endTime) {
      filter.timestamp = {};
      if (startTime) filter.timestamp.$gte = startTime;
      if (endTime) filter.timestamp.$lte = endTime;
    }

    try {
      const totalLogs = await this.collection.countDocuments(filter);
      const browsers = await this.collection.distinct('browserId', filter);
      const errorCount = await this.collection.countDocuments({ ...filter, level: 'error' });
      
      const browserActivity = await this.collection.aggregate([
        { $match: filter },
        { $group: { _id: '$browserId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 1 }
      ]).toArray();

      const mostActiveBrowser = browserActivity?.[0]?._id ? String(browserActivity[0]._id) : 'N/A';

      return {
        totalLogs,
        browsers: browsers.length,
        errorRate: totalLogs > 0 ? (errorCount / totalLogs) * 100 : 0,
        mostActiveBrowser,
        timeRange: {
          start: startTime || 'beginning',
          end: endTime || 'now'
        }
      };
    } catch (error) {
      this.logger.error('Failed to get log summary:', error);
      throw error;
    }
  }

  async clearLogs(filter: any = {}): Promise<void> {
    if (!this.connected || !this.collection) {
      throw new Error('Database not connected');
    }

    try {
      await this.collection.deleteMany(filter);
      this.logger.info('Logs cleared', filter);
    } catch (error) {
      this.logger.error('Failed to clear logs:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.connected = false;
      this.logger.info('MongoDB connection closed');
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  getLogger(): Logger {
    return this.logger;
  }


}

export { LogService, LogEntry, LogServiceConfig };
export default LogService;
