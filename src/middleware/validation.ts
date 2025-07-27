import { Request, Response, NextFunction } from 'express';

export function validateQueryParams(req: Request, res: Response, next: NextFunction): void {
  const { limit, offset, level, startTime, endTime, size } = req.query;
  
  const errors: string[] = [];
  
  if (limit && isNaN(Number(limit))) {
    errors.push('Limit must be a number');
  }
  
  if (offset && isNaN(Number(offset))) {
    errors.push('Offset must be a number');
  }
  
  if (level && !['info', 'warn', 'error', 'debug'].includes(level as string)) {
    errors.push('Level must be one of: info, warn, error, debug');
  }
  
  if (startTime && isNaN(Date.parse(startTime as string))) {
    errors.push('Start time must be a valid date');
  }
  
  if (endTime && isNaN(Date.parse(endTime as string))) {
    errors.push('End time must be a valid date');
  }
  
  if (size && (isNaN(Number(size)) || Number(size) < 1 || Number(size) > 1000)) {
    errors.push('Size must be a number between 1 and 1000');
  }
  
  if (errors.length > 0) {
    res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors
    });
    return;
  }
  
  next();
};

export const sanitizeQueryParams = (req: Request, res: Response, next: NextFunction) => {
  const sanitized: any = {};
  
  if (req.query.browserId) sanitized.browserId = String(req.query.browserId);
  if (req.query.level) sanitized.level = String(req.query.level);
  if (req.query.startTime) sanitized.startTime = String(req.query.startTime);
  if (req.query.endTime) sanitized.endTime = String(req.query.endTime);
  if (req.query.searchText) sanitized.searchText = String(req.query.searchText);
  if (req.query.size) sanitized.size = String(req.query.size);
  
  req.query = sanitized;
  next();
};
