const http = require('http');

function testAPI(path, description) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          console.log(`✅ ${description}`);
          console.log(`   Status: ${res.statusCode}`);
          console.log(`   Response:`, JSON.stringify(jsonData, null, 2).substring(0, 200) + '...');
          console.log('');
          resolve(jsonData);
        } catch (error) {
          console.log(`❌ ${description}`);
          console.log(`   Status: ${res.statusCode}`);
          console.log(`   Error parsing JSON:`, error.message);
          console.log(`   Raw response:`, data.substring(0, 200));
          console.log('');
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.log(`❌ ${description}`);
      console.log(`   Connection error:`, error.message);
      console.log('');
      reject(error);
    });

    req.end();
  });
}

async function runTests() {
  console.log('🧪 Testing Log Collection Platform APIs\n');
  
  try {
    // Test 1: Overview API
    await testAPI('/api/overview', 'GET /api/overview');
    
    // Test 2: Logs API
    await testAPI('/api/logs', 'GET /api/logs');
    
    // Test 3: Logs with limit
    await testAPI('/api/logs?limit=5', 'GET /api/logs?limit=5');
    
    // Test 4: Browser IDs
    await testAPI('/api/logs/browsers', 'GET /api/logs/browsers');
    
    // Test 5: Health check
    await testAPI('/api/health', 'GET /api/health');
    
    console.log('🎉 All tests completed!');
    
  } catch (error) {
    console.log('💥 Test suite failed:', error.message);
  }
}

runTests();
