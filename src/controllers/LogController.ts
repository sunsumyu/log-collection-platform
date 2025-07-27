import { Request, Response } from 'express';
import { LogService } from '../services/LogService';
import { ElasticsearchService } from '../services/ElasticsearchService';
import { asyncHandler } from '../middleware/errorHandler';

export class LogController {
  constructor(
    private logService: LogService,
    private elasticsearchService: ElasticsearchService
  ) {}

  getLogs = asyncHandler(async (req: Request, res: Response) => {
    const {
      browserId,
      level,
      startTime,
      endTime,
      searchText,
      size
    } = req.query;

    const logs = await this.logService.getLogs({
      browserId: browserId as string,
      level: level as string,
      startTime: startTime as string,
      endTime: endTime as string,
      searchText: searchText as string,
      limit: size ? parseInt(size as string, 10) : 100
    });

    res.json({
      status: 'success',
      count: logs.length,
      data: logs
    });
  });

  getBrowserStats = asyncHandler(async (req: Request, res: Response) => {
    try {
      const stats = await this.logService.getBrowserStats();
      res.json({
        status: 'success',
        data: stats
      });
    } catch (error) {
      // Removed handleError reference
    }
  });

  getOverview = asyncHandler(async (req: Request, res: Response) => {
    const overview = await this.logService.getOverview();
    res.json({
      status: 'success',
      data: overview
    });
  });

  searchLogs = asyncHandler(async (req: Request, res: Response) => {
    const {
      browserId,
      level,
      startTime,
      endTime,
      searchText,
      size
    } = req.query;

    const logs = await this.elasticsearchService.searchAllLogs({
      browserId: browserId as string,
      level: level as string,
      startTime: startTime as string,
      endTime: endTime as string,
      searchText: searchText as string,
      size: size ? parseInt(size as string, 10) : 100
    });

    res.json({
      status: 'success',
      count: logs.length,
      data: logs
    });
  });

  getErrorTrends = asyncHandler(async (req: Request, res: Response) => {
    const trends = await this.elasticsearchService.getErrorTrends();
    res.json({
      status: 'success',
      data: trends
    });
  });

  getPerformanceMetrics = asyncHandler(async (req: Request, res: Response) => {
    const { browserId } = req.query;
    const metrics = await this.elasticsearchService.getPerformanceMetrics(browserId as string);
    res.json({
      status: 'success',
      data: metrics
    });
  });

  getBrowserComparison = asyncHandler(async (req: Request, res: Response) => {
    const comparison = await this.elasticsearchService.getBrowserComparison();
    res.json({
      status: 'success',
      data: comparison
    });
  });
}
