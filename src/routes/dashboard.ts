import express, { Router } from 'express';
import { LogService } from '../services/LogService';
import { ElasticsearchService } from '../services/ElasticsearchService';

interface DashboardStats {
  totalBrowsers: number;
  browsers: Array<{
    browserId: string;
    totalLogs: number;
    errorCount: number;
    warnCount: number;
    infoCount: number;
    debugCount: number;
    lastLogTime: string;
  }>;
}

interface RealtimeData {
  browserId: string;
  recentLogs: any[];
  stats: any;
  errorRate: number;
  warnRate: number;
  infoRate: number;
  debugRate: number;
}

// Factory function to create router with initialized services
function createDashboardRouter(logService: LogService, elasticsearchService: ElasticsearchService): Router {
  const router = express.Router();

  // Dashboard overview
  router.get('/overview', async (req, res) => {
    try {
      const browserIds = await logService.getAllBrowserIds();
      const overview: DashboardStats = {
        totalBrowsers: browserIds.length,
        browsers: []
      };
      
      // Get stats for each browser
      for (const browserId of browserIds) {
        try {
          const stats = await logService.getLogStats(browserId);
          overview.browsers.push({
            browserId,
            ...stats
          });
        } catch (error) {
          console.error(`Error getting stats for browser ${browserId}:`, error);
        }
      }
      
      res.json(overview);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Real-time dashboard data
  router.get('/realtime/:browserId', async (req, res) => {
    try {
      const { browserId } = req.params;
      
      // Get recent logs (last 10 minutes)
      const recentLogs = await logService.getLogsByBrowser(browserId, {
        limit: 50,
        startTime: new Date(Date.now() - 10 * 60 * 1000).toISOString() // 10 minutes ago
      });
      
      const stats = await logService.getLogStats(browserId);
      
      // Calculate rates based on recent logs
      const recentCount = recentLogs.length;
      const errorCount = recentLogs.filter((log: any) => log.level === 'error').length;
      const warnCount = recentLogs.filter((log: any) => log.level === 'warn').length;
      const infoCount = recentLogs.filter((log: any) => log.level === 'info').length;
      const debugCount = recentLogs.filter((log: any) => log.level === 'debug').length;
      
      const data: RealtimeData = {
        browserId,
        recentLogs,
        stats,
        errorRate: recentCount > 0 ? (errorCount / recentCount) * 100 : 0,
        warnRate: recentCount > 0 ? (warnCount / recentCount) * 100 : 0,
        infoRate: recentCount > 0 ? (infoCount / recentCount) * 100 : 0,
        debugRate: recentCount > 0 ? (debugCount / recentCount) * 100 : 0
      };
      
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Get error trends
  router.get('/trends/errors', async (req, res) => {
    try {
      const { timeRange = '24h' } = req.query;
      
      const trends = await elasticsearchService.getErrorTrends(timeRange as string);
      res.json(trends);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Get performance metrics
  router.get('/metrics/performance', async (req, res) => {
    try {
      const { browserId, timeRange = '1h' } = req.query;
      
      const metrics = await elasticsearchService.getPerformanceMetrics(
        browserId as string,
        timeRange as string
      );
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Get browser comparison
  router.get('/comparison/browsers', async (req, res) => {
    try {
      const { timeRange = '24h' } = req.query;
      
      const comparison = await elasticsearchService.getBrowserComparison(timeRange as string);
      res.json(comparison);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  return router;
}

export { createDashboardRouter };
export default createDashboardRouter;
