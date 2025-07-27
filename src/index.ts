import express from 'express';
import http from 'http';
import { Server as SocketIoServer } from 'socket.io';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';

import { createLogsRouter } from './routes/logs';
import { createDashboardRouter } from './routes/dashboard';
import { LogService } from './services/LogService';
import { ElasticsearchService } from './services/ElasticsearchService';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new SocketIoServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Services
const logService = new LogService();
const elasticsearchService = new ElasticsearchService();

// Initialize services first, then create routes
async function initializeApp(): Promise<void> {
  try {
    await logService.initialize();
    await elasticsearchService.initialize();
    
    // Create routes with initialized services
    const logRoutes = createLogsRouter(logService, elasticsearchService);
    const dashboardRoutes = createDashboardRouter(logService, elasticsearchService);
    
    // Routes
    app.use('/api/logs', logRoutes);
    app.use('/api/dashboard', dashboardRoutes);
    
    console.log('✅ Services initialized and routes configured');
  } catch (error) {
    console.error('❌ Failed to initialize services:', error);
  }
}

// Socket.IO for real-time updates
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('subscribe-logs', (filters) => {
    socket.join('logs-room');
    console.log(`Client ${socket.id} subscribed to logs with filters:`, filters);
  });
  
  socket.on('unsubscribe-logs', () => {
    socket.leave('logs-room');
    console.log(`Client ${socket.id} unsubscribed from logs`);
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Emit log events to connected clients
logService.on('log-added', (log) => {
  io.to('logs-room').emit('new-log', log);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      mongodb: logService.isConnected(),
      elasticsearch: elasticsearchService.isConnected()
    }
  });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

const PORT = process.env.PORT || 3000;

// Initialize and start server
initializeApp().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}`);
    console.log(`🔍 API docs: http://localhost:${PORT}/api/health`);
  });
}).catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  
  try {
    await logService.close();
    await elasticsearchService.close();
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  
  try {
    await logService.close();
    await elasticsearchService.close();
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});

export { app, server, io };
