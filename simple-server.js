const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

let db, collection;

// Browser ID extraction function
function extractBrowserId(logMessage) {
  const pattern = /\[Thread-\d+\]\[(\d+)\]/;
  const match = logMessage.match(pattern);
  
  if (match && match[1]) {
    return match[1];
  }
  
  return null;
}

// Map log levels
function mapLogLevel(level) {
  if (typeof level === 'number') {
    switch (level) {
      case 10: return 'trace';
      case 20: return 'debug';
      case 30: return 'info';
      case 40: return 'warn';
      case 50: return 'error';
      case 60: return 'fatal';
      default: return 'info';
    }
  }
  
  return level || 'info';
}

// Process log entry
function processLogEntry(log) {
  const messageText = log.message || log.msg || '';
  
  let browserId = log.browserId;
  if (!browserId && messageText) {
    browserId = extractBrowserId(messageText);
  }
  
  return {
    level: mapLogLevel(log.level),
    message: messageText,
    timestamp: log.timestamp || log.time || new Date().toISOString(),
    metadata: log.metadata,
    browserId: browserId
  };
}

// Connect to MongoDB
async function connectDB() {
  try {
    const client = new MongoClient('mongodb://107.161.83.190:27017/on-chain-inter-logs');
    await client.connect();
    db = client.db('on-chain-inter-logs');
    collection = db.collection('activity_logs');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
}

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get all browser IDs
app.get('/api/logs/browsers', async (req, res) => {
  try {
    const logs = await collection.find({
      $or: [
        { "msg": { $regex: /\[Thread-\d+\]\[\d+\]/ } },
        { "message": { $regex: /\[Thread-\d+\]\[\d+\]/ } }
      ]
    }).toArray();
    
    const browserIds = [...new Set(logs.map(log => {
      const messageText = log.message || log.msg || '';
      return extractBrowserId(messageText);
    }).filter(id => id !== null))];
    
    res.json({ browserIds });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get logs for specific browser
app.get('/api/logs/browser/:browserId', async (req, res) => {
  try {
    const { browserId } = req.params;
    const { limit = 50, skip = 0 } = req.query;
    
    const logs = await collection.find({
      $or: [
        { "msg": { $regex: new RegExp(`\\[Thread-\\d+\\]\\[${browserId}\\]`) } },
        { "message": { $regex: new RegExp(`\\[Thread-\\d+\\]\\[${browserId}\\]`) } }
      ]
    })
    .sort({ timestamp: -1 })
    .limit(parseInt(limit))
    .skip(parseInt(skip))
    .toArray();
    
    const processedLogs = logs.map(processLogEntry);
    
    res.json({ logs: processedLogs, count: processedLogs.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get log statistics for browser
app.get('/api/logs/browser/:browserId/stats', async (req, res) => {
  try {
    const { browserId } = req.params;
    
    const logs = await collection.find({
      $or: [
        { "msg": { $regex: new RegExp(`\\[Thread-\\d+\\]\\[${browserId}\\]`) } },
        { "message": { $regex: new RegExp(`\\[Thread-\\d+\\]\\[${browserId}\\]`) } }
      ]
    }).toArray();
    
    const stats = {
      totalLogs: logs.length,
      errorCount: 0,
      warnCount: 0,
      infoCount: 0,
      debugCount: 0,
      lastLogTime: logs.length > 0 ? logs[0].timestamp || logs[0].time : new Date(0).toISOString()
    };
    
    logs.forEach(log => {
      const level = mapLogLevel(log.level);
      switch (level) {
        case 'error': stats.errorCount++; break;
        case 'warn': stats.warnCount++; break;
        case 'info': stats.infoCount++; break;
        case 'debug': stats.debugCount++; break;
      }
    });
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all logs with browserId extraction
app.get('/api/logs', async (req, res) => {
  try {
    const { limit = 100, skip = 0, browserId } = req.query;
    
    let filter = {};
    if (browserId) {
      filter = {
        $or: [
          { "msg": { $regex: new RegExp(`\\[Thread-\\d+\\]\\[${browserId}\\]`) } },
          { "message": { $regex: new RegExp(`\\[Thread-\\d+\\]\\[${browserId}\\]`) } }
        ]
      };
    }
    
    const logs = await collection.find(filter)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .toArray();
    
    const processedLogs = logs.map(processLogEntry);
    
    res.json({ logs: processedLogs, count: processedLogs.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
async function start() {
  await connectDB();
  
  const PORT = 3001;
  app.listen(PORT, () => {
    console.log(`🚀 Simple Log Server running on port ${PORT}`);
    console.log(`📊 API: http://localhost:${PORT}/api`);
    console.log(`🔍 Browser IDs: http://localhost:${PORT}/api/logs/browsers`);
  });
}

start().catch(console.error);
