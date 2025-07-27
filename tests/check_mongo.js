const { MongoClient } = require('mongodb');

async function checkMongoData() {
  try {
    const client = new MongoClient('mongodb://localhost:27017');
    await client.connect();
    
    console.log('📊 Available databases:');
    const adminDb = client.db('admin');
    const databases = await adminDb.admin().listDatabases();
    databases.databases.forEach(db => {
      console.log(`  - ${db.name} (${db.sizeOnDisk} bytes)`);
    });
    
    console.log('\n🔍 Checking on-chain-inter-logs database:');
    const db = client.db('on-chain-inter-logs');
    const collections = await db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name));
    
    if (collections.find(c => c.name === 'activity_logs')) {
      const activityLogs = db.collection('activity_logs');
      const count = await activityLogs.countDocuments();
      console.log(`📈 activity_logs collection has ${count} documents`);
      
      if (count > 0) {
        const sample = await activityLogs.find().limit(3).toArray();
        console.log('Sample documents:', JSON.stringify(sample, null, 2));
      }
    }
    
    console.log('\n🔍 Checking logs database:');
    const logsDb = client.db('logs');
    const logsCollections = await logsDb.listCollections().toArray();
    console.log('Collections:', logsCollections.map(c => c.name));
    
    if (logsCollections.find(c => c.name === 'app_logs')) {
      const appLogs = logsDb.collection('app_logs');
      const count = await appLogs.countDocuments();
      console.log(`📈 app_logs collection has ${count} documents`);
    }
    
    await client.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkMongoData();
