import { Router } from 'express';
import { LogController } from '../controllers/LogController';
import { validateQueryParams, sanitizeQueryParams } from '../middleware/validation';
import { LogService } from '../services/LogService';
import { ElasticsearchService } from '../services/ElasticsearchService';

export const createRoutes = (logService: LogService, elasticsearchService: ElasticsearchService) => {
  const router = Router();
  const controller = new LogController(logService, elasticsearchService);

  // Health check endpoint
  router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Log routes
  router.get('/logs', validateQueryParams, sanitizeQueryParams, controller.getLogs);
  router.get('/logs/search', validateQueryParams, sanitizeQueryParams, controller.searchLogs);
  
  // Analytics routes
  router.get('/analytics/overview', controller.getOverview);
  router.get('/analytics/browsers', controller.getBrowserStats);
  router.get('/analytics/error-trends', controller.getErrorTrends);
  router.get('/analytics/performance', controller.getPerformanceMetrics);
  router.get('/analytics/browser-comparison', controller.getBrowserComparison);

  return router;
};
