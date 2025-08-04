const { MongoClient } = require('mongodb');

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

async function testBrowserIdExtraction() {
  const client = new MongoClient('mongodb://107.161.83.190:27017/on-chain-inter-logs');
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db('on-chain-inter-logs');
    const collection = db.collection('activity_logs');
    
    // Search for logs containing [Thread-0][number] pattern
    const threadLogs = await collection.find({
      $or: [
        { "msg": { $regex: /\[Thread-\d+\]\[\d+\]/ } },
        { "message": { $regex: /\[Thread-\d+\]\[\d+\]/ } }
      ]
    }).limit(10).toArray();
    
    console.log(`\n🔍 Found ${threadLogs.length} logs with [Thread-X][Y] pattern`);
    
    if (threadLogs.length > 0) {
      console.log('\n📊 Thread logs analysis:');
      console.log('='.repeat(50));
      
      threadLogs.forEach((log, index) => {
        const messageText = log.message || log.msg || '';
        const browserId = extractBrowserId(messageText);
        const level = mapLogLevel(log.level);
        
        console.log(`\nThread Log ${index + 1}:`);
        console.log(`  Level: ${log.level} → ${level}`);
        console.log(`  Message: ${messageText.substring(0, 150)}${messageText.length > 150 ? '...' : ''}`);
        console.log(`  Extracted Browser ID: ${browserId || 'None'}`);
        console.log(`  Timestamp: ${log.timestamp || log.time || 'N/A'}`);
      });
    }
    
    // Get a few sample logs for general analysis
    const logs = await collection.find({}).limit(10).toArray();
    
    console.log('\n📊 Sample logs analysis:');
    console.log('='.repeat(50));
    
    logs.forEach((log, index) => {
      const messageText = log.message || log.msg || '';
      const browserId = extractBrowserId(messageText);
      const level = mapLogLevel(log.level);
      
      console.log(`\nLog ${index + 1}:`);
      console.log(`  Level: ${log.level} → ${level}`);
      console.log(`  Message: ${messageText.substring(0, 100)}${messageText.length > 100 ? '...' : ''}`);
      console.log(`  Extracted Browser ID: ${browserId || 'None'}`);
      console.log(`  Timestamp: ${log.timestamp || log.time || 'N/A'}`);
    });
    
    // Count logs with browser IDs
    const logsWithBrowserId = logs.filter(log => {
      const messageText = log.message || log.msg || '';
      return extractBrowserId(messageText) !== null;
    });
    
    console.log('\n📈 Summary:');
    console.log('='.repeat(50));
    console.log(`Total logs checked: ${logs.length}`);
    console.log(`Logs with Browser ID: ${logsWithBrowserId.length}`);
    console.log(`Logs without Browser ID: ${logs.length - logsWithBrowserId.length}`);
    
    if (logsWithBrowserId.length > 0) {
      const browserIds = [...new Set(logsWithBrowserId.map(log => {
        const messageText = log.message || log.msg || '';
        return extractBrowserId(messageText);
      }))];
      console.log(`Unique Browser IDs found: ${browserIds.join(', ')}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

testBrowserIdExtraction();
