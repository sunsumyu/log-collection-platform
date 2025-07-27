import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { Router } from 'express';
import { createRoutes } from './routes';
import { LogService } from './services/LogService';
import { ElasticsearchService } from './services/ElasticsearchService';
import { config } from './config';
import pino from 'pino';

class Application {
  private app = express();
  private server = createServer(this.app);
  private io = new Server(this.server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  private logger = pino({
    level: config.logLevel,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
        ignore: 'pid,hostname'
      }
    }
  });
  
  private logService = new LogService({
    mongodbUri: config.mongodb.uri,
    logLevel: config.logLevel
  });
  
  private elasticsearchService = new ElasticsearchService();

  constructor() {
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
    this.setupSocketHandlers();
  }

  private setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    this.app.use(express.static('public'));
  }

  private setupRoutes() {
    // Import and use the complete logs router
    const { createLogsRouter } = require('./routes/logs');
    const logsRouter = createLogsRouter(this.logService, this.elasticsearchService);
    
    const router = Router();
    
    // Health check
    router.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Overview endpoint
    router.get('/overview', async (req, res) => {
      try {
        const stats = await this.logService.getOverview();
        res.json({ status: 'success', data: stats });
      } catch (error) {
        res.status(500).json({ status: 'error', message: 'Failed to fetch overview' });
      }
    });

    // Use the complete logs router for all log-related endpoints
    this.app.use('/api/logs', logsRouter);
    this.app.use('/api', router);
  }

  private setupErrorHandling() {
    this.app.use((req, res) => {
      res.status(404).json({ status: 'error', message: 'Route not found' });
    });
  }

  private setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      this.logger.info(`Client connected: ${socket.id}`);
      
      socket.on('join-browser-room', (browserId: string) => {
        socket.join(`browser-${browserId}`);
      });

      socket.on('disconnect', () => {
        this.logger.info(`Client disconnected: ${socket.id}`);
      });
    });

    // Emit real-time updates when new logs are added
    this.logService.on('newLog', (logData) => {
      this.io.to(`browser-${logData.browserId}`).emit('log-update', logData);
    });
  }

  async start() {
    try {
      await this.logService.connect();
      
      // Try to connect to Elasticsearch, but don't fail if it's not available
      try {
        await this.elasticsearchService.connect();
        this.logger.info('✅ Elasticsearch connected successfully');
      } catch (esError) {
        this.logger.warn('⚠️  Elasticsearch connection failed, continuing without search functionality:', (esError as Error).message);
      }
      
      this.server.listen(config.port, () => {
        this.logger.info(`🚀 Log Collection Platform running on port ${config.port}`);
        this.logger.info(`📊 Dashboard: http://localhost:${config.port}`);
        this.logger.info(`🔍 API: http://localhost:${config.port}/api`);
      });
    } catch (error) {
      this.logger.error('Failed to start application:', error);
      process.exit(1);
    }
  }
}

// Start the application
const app = new Application();
app.start().catch(console.error);

export default app;

 
