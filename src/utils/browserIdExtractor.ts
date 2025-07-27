interface LogEntry {
  msg?: string;
  message?: string;
  [key: string]: any;
}

/**
 * Extract browser ID from log message format
 * @param logMessage - The log message string
 * @returns The extracted browser ID or null if not found
 */
function extractBrowserId(logMessage: string): string | null {
  // Pattern to match [Thread-0][16] format where 16 is the browser ID
  const pattern = /\[Thread-\d+\]\[(\d+)\]/;
  const match = logMessage.match(pattern);
  
  if (match && match[1]) {
    return match[1];
  }
  
  return null;
}

/**
 * Extract browser ID from structured log object
 * @param logEntry - The log entry object
 * @returns The extracted browser ID or null if not found
 */
function extractBrowserIdFromLog(logEntry: LogEntry): string | null {
  if (!logEntry) {
    return null;
  }
  
  const message = logEntry.msg || logEntry.message || '';
  return extractBrowserId(message);
}

/**
 * Get all unique browser IDs from a collection of logs
 * @param logs - Array of log entry objects
 * @returns Array of unique browser IDs
 */
function getUniqueBrowserIds(logs: LogEntry[]): string[] {
  const browserIds = new Set<string>();
  
  logs.forEach(log => {
    const browserId = extractBrowserIdFromLog(log);
    if (browserId) {
      browserIds.add(browserId);
    }
  });
  
  return Array.from(browserIds);
}

/**
 * Filter logs by browser ID
 * @param logs - Array of log entry objects
 * @param browserId - The browser ID to filter by
 * @returns Array of logs for the specified browser ID
 */
function filterLogsByBrowserId(logs: LogEntry[], browserId: string): LogEntry[] {
  return logs.filter(log => {
    const extractedBrowserId = extractBrowserIdFromLog(log);
    return extractedBrowserId === browserId;
  });
}

/**
 * Group logs by browser ID
 * @param logs - Array of log entry objects
 * @returns Object with browser IDs as keys and arrays of logs as values
 */
function groupLogsByBrowserId(logs: LogEntry[]): Record<string, LogEntry[]> {
  const grouped: Record<string, LogEntry[]> = {};
  
  logs.forEach(log => {
    const browserId = extractBrowserIdFromLog(log);
    if (browserId) {
      if (!grouped[browserId]) {
        grouped[browserId] = [];
      }
      grouped[browserId].push(log);
    }
  });
  
  return grouped;
}

/**
 * Validate if a string is a valid browser ID format
 * @param browserId - The browser ID to validate
 * @returns True if valid browser ID format
 */
function isValidBrowserId(browserId: string): boolean {
  return /^\d+$/.test(browserId);
}

/**
 * Format browser ID for display
 * @param browserId - The browser ID to format
 * @returns Formatted browser ID string
 */
function formatBrowserId(browserId: string): string {
  return `Browser-${browserId}`;
}

/**
 * Check if a log message is from MainThread (no browser ID)
 * @param logMessage - The log message string
 * @returns True if this is a MainThread message
 */
function isMainThreadMessage(logMessage: string): boolean {
  // MainThread messages don't have [Thread-X][Y] pattern
  const browserIdPattern = /\[Thread-\d+\]\[\d+\]/;
  return !browserIdPattern.test(logMessage);
}

/**
 * Check if a log entry is from MainThread
 * @param logEntry - The log entry object
 * @returns True if this is a MainThread message
 */
function isMainThreadLog(logEntry: LogEntry): boolean {
  if (!logEntry) {
    return false;
  }
  
  const message = logEntry.msg || logEntry.message || '';
  return isMainThreadMessage(message);
}

/**
 * Filter logs to get only MainThread messages
 * @param logs - Array of log entry objects
 * @returns Array of MainThread logs
 */
function filterMainThreadLogs(logs: LogEntry[]): LogEntry[] {
  return logs.filter(log => isMainThreadLog(log));
}

/**
 * Filter logs to get only browser-specific messages (excluding MainThread)
 * @param logs - Array of log entry objects
 * @returns Array of browser-specific logs
 */
function filterBrowserLogs(logs: LogEntry[]): LogEntry[] {
  return logs.filter(log => !isMainThreadLog(log));
}

/**
 * Get logs for a specific browser including optional MainThread messages
 * @param logs - Array of log entry objects
 * @param browserId - The browser ID to filter by
 * @param includeMainThread - Whether to include MainThread messages
 * @returns Array of logs for the specified browser
 */
function getLogsForBrowser(logs: LogEntry[], browserId: string, includeMainThread: boolean = false): LogEntry[] {
  const browserLogs = filterLogsByBrowserId(logs, browserId);
  
  if (includeMainThread) {
    const mainThreadLogs = filterMainThreadLogs(logs);
    return [...browserLogs, ...mainThreadLogs].sort((a, b) => {
      const timeA = new Date(a.timestamp || a['@timestamp'] || 0).getTime();
      const timeB = new Date(b.timestamp || b['@timestamp'] || 0).getTime();
      return timeA - timeB;
    });
  }
  
  return browserLogs;
}

export {
  extractBrowserId,
  extractBrowserIdFromLog,
  getUniqueBrowserIds,
  filterLogsByBrowserId,
  groupLogsByBrowserId,
  isValidBrowserId,
  formatBrowserId,
  isMainThreadMessage,
  isMainThreadLog,
  filterMainThreadLogs,
  filterBrowserLogs,
  getLogsForBrowser,
  LogEntry
};
