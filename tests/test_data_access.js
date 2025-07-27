const LogService = require('./src/services/LogService');
const { extractBrowserIdFromLog, getUniqueBrowserIds, filterLogsByBrowserId } = require('./src/utils/browserIdExtractor');

async function testDataAccess() {
  const logService = new LogService();
  await logService.initialize();
  
  if (logService.isConnected()) {
    console.log('✅ Connected to MongoDB');
    
    try {
      // 获取所有浏览器ID（基于hostname字段）
      const browserIds = await logService.collection.distinct('hostname');
      console.log('📊 Available hostnames (browsers):', browserIds);
      
      // 获取总日志数量
      const totalLogs = await logService.collection.countDocuments();
      console.log('📈 Total logs:', totalLogs);
      
      // 获取所有日志用于浏览器ID提取
      const allLogs = await logService.collection
        .find({})
        .sort({ time: -1 })
        .limit(100)
        .toArray();
      
      // 提取浏览器ID从消息内容
      const extractedBrowserIds = getUniqueBrowserIds(allLogs);
      console.log('🔍 Extracted browser IDs from messages:', extractedBrowserIds);
      
      // 显示带有提取的浏览器ID的日志
      console.log('📝 Recent logs with browser IDs:');
      allLogs.slice(0, 10).forEach(log => {
        const browserId = extractBrowserIdFromLog(log);
        console.log(`  - ${log.time}: ${browserId ? `[Browser:${browserId}]` : '[No ID]'} ${log.msg.substring(0, 100)}...`);
      });
      
      // 如果找到特定的浏览器ID，显示相关日志
      if (extractedBrowserIds.includes('16')) {
        const browser16Logs = filterLogsByBrowserId(allLogs, '16');
        console.log(`📊 Found ${browser16Logs.length} logs for browser ID 16`);
      }
      
    } catch (error) {
      console.error('❌ Error accessing data:', error.message);
    }
  } else {
    console.log('❌ Not connected to MongoDB');
  }
  
  await logService.close();
}

testDataAccess();
