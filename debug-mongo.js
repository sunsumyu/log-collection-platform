const { MongoClient } = require('mongodb');
require('dotenv').config();

async function debugMongoDB() {
  const uri = process.env.MONGODB_URI;
  console.log('🔗 Connecting to:', uri.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@'));
  
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected successfully');
    
    const db = client.db('on-chain-inter-logs');
    console.log('📊 Using database: on-chain-inter-logs');
    
    // 1. 列出所有数据库
    const adminDb = client.db().admin();
    const databases = await adminDb.listDatabases();
    console.log('\n📋 Available databases:');
    databases.databases.forEach(db => {
      console.log(`  - ${db.name} (${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
    });
    
    // 2. 列出当前数据库的所有集合
    const collections = await db.listCollections().toArray();
    console.log('\n📁 Collections in on-chain-inter-logs:');
    if (collections.length === 0) {
      console.log('  ❌ No collections found');
    } else {
      collections.forEach(col => {
        console.log(`  - ${col.name}`);
      });
    }
    
    // 3. 检查 activity_logs 集合
    const collection = db.collection('activity_logs');
    const count = await collection.countDocuments();
    console.log(`\n📈 Documents in activity_logs: ${count}`);
    
    if (count > 0) {
      // 获取前5条记录
      const samples = await collection.find({}).limit(5).toArray();
      console.log('\n📄 Sample documents:');
      samples.forEach((doc, index) => {
        console.log(`  ${index + 1}.`, JSON.stringify(doc, null, 2));
      });
      
      // 检查字段结构
      const pipeline = [
        { $limit: 100 },
        { $project: { 
          keys: { $objectToArray: "$$ROOT" } 
        }},
        { $unwind: "$keys" },
        { $group: { 
          _id: "$keys.k",
          count: { $sum: 1 },
          sampleValue: { $first: "$keys.v" }
        }},
        { $sort: { count: -1 }}
      ];
      
      const fieldAnalysis = await collection.aggregate(pipeline).toArray();
      console.log('\n🔍 Field analysis:');
      fieldAnalysis.forEach(field => {
        console.log(`  - ${field._id}: appears in ${field.count} docs, sample: ${JSON.stringify(field.sampleValue).substring(0, 50)}...`);
      });
    }
    
    // 4. 测试权限
    console.log('\n🔐 Testing permissions:');
    try {
      await collection.findOne({});
      console.log('  ✅ Read permission: OK');
    } catch (error) {
      console.log('  ❌ Read permission: FAILED -', error.message);
    }
    
    try {
      await collection.insertOne({ test: true, timestamp: new Date() });
      await collection.deleteOne({ test: true });
      console.log('  ✅ Write permission: OK');
    } catch (error) {
      console.log('  ❌ Write permission: FAILED -', error.message);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
    console.log('\n🔌 Connection closed');
  }
}

debugMongoDB().catch(console.error);
