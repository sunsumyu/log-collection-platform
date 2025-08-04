const { MongoClient } = require('mongodb');

async function debugMongoDB() {
  const uri = 'mongodb://admin:a123456789@107.161.83.190:27017/on-chain-inter-logs?authSource=admin';
  
  console.log('🔍 MongoDB连接诊断开始...');
  console.log('连接URI:', uri);
  
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
    socketTimeoutMS: 5000,
    maxPoolSize: 1,
    retryWrites: false
  });

  try {
    console.log('\n1️⃣ 尝试连接MongoDB...');
    await client.connect();
    console.log('✅ 连接成功!');
    
    console.log('\n2️⃣ 测试ping命令...');
    const adminDb = client.db().admin();
    const pingResult = await adminDb.ping();
    console.log('✅ Ping成功:', pingResult);
    
    console.log('\n3️⃣ 检查数据库...');
    const db = client.db('on-chain-inter-logs');
    
    console.log('\n4️⃣ 列出所有集合...');
    const collections = await db.listCollections().toArray();
    console.log('📁 集合列表:', collections.map(c => c.name));
    
    if (collections.length === 0) {
      console.log('⚠️  数据库中没有集合，这可能是查询不到数据的原因');
    }
    
    console.log('\n5️⃣ 检查activity_logs集合...');
    const logsCollection = db.collection('activity_logs');
    
    const count = await logsCollection.countDocuments();
    console.log('📊 activity_logs集合文档数量:', count);
    
    if (count === 0) {
      console.log('⚠️  activity_logs集合为空，这是查询不到数据的原因');
      console.log('💡 建议：');
      console.log('   1. 检查是否有数据写入');
      console.log('   2. 确认集合名称是否正确');
      console.log('   3. 检查数据库名称是否正确');
    } else {
      console.log('\n6️⃣ 查看前5条记录...');
      const samples = await logsCollection.find({}).limit(5).toArray();
      console.log('📄 样本数据:');
      samples.forEach((doc, index) => {
        console.log(`   ${index + 1}. ${JSON.stringify(doc, null, 2)}`);
      });
    }
    
    console.log('\n7️⃣ 检查索引...');
    const indexes = await logsCollection.indexes();
    console.log('🔍 索引列表:', indexes);
    
  } catch (error) {
    console.error('\n❌ 连接失败:');
    console.error('错误类型:', error.name);
    console.error('错误信息:', error.message);
    
    if (error.message.includes('closed')) {
      console.error('\n🔍 连接被关闭的可能原因:');
      console.error('1. MongoDB服务器重启或停止');
      console.error('2. 网络连接不稳定');
      console.error('3. 防火墙阻止连接');
      console.error('4. MongoDB配置变化');
    }
    
    if (error.message.includes('ETIMEDOUT')) {
      console.error('\n🔍 连接超时的可能原因:');
      console.error('1. 网络延迟过高');
      console.error('2. MongoDB服务器负载过高');
      console.error('3. 防火墙或路由问题');
    }
    
  } finally {
    try {
      await client.close();
      console.log('\n🔐 连接已关闭');
    } catch (closeError) {
      console.error('关闭连接时出错:', closeError.message);
    }
  }
}

debugMongoDB();
