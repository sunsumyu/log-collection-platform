import express, { Router } from 'express';
import { LogService } from '../services/LogService';
import { ElasticsearchService } from '../services/ElasticsearchService';

interface QueryParams {
  query?: string;
  limit?: string;
  skip?: string;
  startTime?: string;
  endTime?: string;
  level?: string;
  browserId?: string;
}

interface LogQueryOptions {
  limit: number;
  skip: number;
  startTime?: string;
  endTime?: string;
  level?: string;
}

// Factory function to create router with initialized services
function createLogsRouter(logService: LogService, elasticsearchService: ElasticsearchService): Router {
  const router = express.Router();

  // Get all browser IDs
  router.get('/browsers', async (req, res) => {
    try {
      const browserIds = await logService.getAllBrowserIds();
      res.json({ browserIds });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Get logs for specific browser
  router.get('/browser/:browserId', async (req, res) => {
    try {
      const { browserId } = req.params;
      const { limit, skip, startTime, endTime, level } = req.query as QueryParams;
      
      const logs = await logService.getLogsByBrowser(browserId as string, {
        limit: Number(limit),
        skip: Number(skip),
        ...(startTime && { startTime }),
        ...(endTime && { endTime }),
        ...(level && { level })
      });
      
      res.json({ logs, count: logs.length });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Get log statistics for browser
  router.get('/browser/:browserId/stats', async (req, res) => {
    try {
      const { browserId } = req.params;
      const stats = await logService.getLogStats(browserId);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Search logs
  router.get('/search', async (req, res) => {
    try {
      const { query, limit, startTime, endTime, level } = req.query as QueryParams;
      
      if (!query) {
        return res.status(400).json({ error: 'Query parameter is required' });
      }
      
      const logs = await elasticsearchService.searchLogs(query as string, {
        size: Number(limit || 100),
        ...(startTime && { startTime }),
        ...(endTime && { endTime }),
        ...(level && { level })
      });
      
      return res.json({ logs, count: logs.length });
    } catch (error) {
      return res.status(500).json({ error: (error as Error).message });
    }
  });

  // Get all logs with pagination
  router.get('/', async (req, res) => {
    try {
      const { limit, skip, startTime, endTime, level } = req.query as QueryParams;
      
      // Build MongoDB filter object
      const filter: any = {};
      
      if (startTime || endTime) {
        filter.time = {};  // Use 'time' field as per actual data structure
        if (startTime) filter.time.$gte = startTime;
        if (endTime) filter.time.$lte = endTime;
      }
      
      if (level) {
        // Convert string level to numeric if needed
        const levelMap: { [key: string]: number } = {
          'trace': 10, 'debug': 20, 'info': 30, 'warn': 40, 'error': 50, 'fatal': 60
        };
        filter.level = levelMap[level] || level;
      }
      
      const logs = await logService.getLogs(filter, parseInt(limit || '100'));
      
      // Apply skip manually since MongoDB skip is expensive for large datasets
      const skipNum = parseInt(skip || '0');
      const paginatedLogs = skipNum > 0 ? logs.slice(skipNum) : logs;
      
      res.json({ logs: paginatedLogs, count: paginatedLogs.length, total: logs.length });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Get log levels
  router.get('/levels', async (req, res) => {
    try {
      const levels = ['error', 'warn', 'info', 'debug', 'trace'];
      res.json({ levels });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Get log summary
  router.get('/summary', async (req, res) => {
    try {
      const { startTime, endTime } = req.query as QueryParams;
      const summary = await logService.getLogSummary({
        ...(startTime && { startTime }),
        ...(endTime && { endTime })
      });
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Delete logs (admin endpoint)
  router.delete('/', async (req, res) => {
    try {
      const { startTime, endTime, level, browserId } = req.query as QueryParams;
      
      const filter: any = {};
      
      if (startTime || endTime) {
        filter.timestamp = {};
        if (startTime) filter.timestamp.$gte = startTime;
        if (endTime) filter.timestamp.$lte = endTime;
      }
      
      if (level) filter.level = level;
      if (browserId) filter.browserId = browserId;
      
      await logService.clearLogs(filter);
      res.json({ message: 'Logs deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  return router;
}

export { createLogsRouter };
export default createLogsRouter;
