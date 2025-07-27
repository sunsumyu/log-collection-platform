import { Request, Response, NextFunction } from 'express';
import { Logger } from 'pino';

export interface CustomError extends Error {
  statusCode?: number;
  status?: string;
}

export const createErrorHandler = (logger: Logger) => {
  return (err: CustomError, req: Request, res: Response, next: NextFunction) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    logger.error({
      error: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      ip: req.ip
    }, 'Request error');

    res.status(statusCode).json({
      status: 'error',
      statusCode,
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  };
};

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    status: 'error',
    message: `Route ${req.originalUrl} not found`
  });
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
