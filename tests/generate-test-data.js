const LogService = require('./src/services/LogService');

async function generateTestData() {
    const logService = new LogService();
    
    try {
        console.log('🔄 Initializing LogService...');
        await logService.initialize();
        
        if (!logService.isConnected()) {
            console.error('❌ Failed to connect to database');
            return;
        }
        
        console.log('✅ Connected to database');
        
        // Sample browser IDs and log data
        const browserIds = ['chrome-session-001', 'firefox-session-002', 'safari-session-003'];
        const logLevels = ['info', 'warn', 'error', 'debug'];
        const actions = ['page-load', 'click', 'form-submit', 'api-call', 'error', 'navigation'];
        const messages = {
            info: [
                'Page loaded successfully',
                'User clicked button',
                'Form submitted successfully',
                'API call completed'
            ],
            warn: [
                'Slow page load detected',
                'Deprecated API usage',
                'Large resource detected'
            ],
            error: [
                'Failed to load resource',
                'JavaScript error occurred',
                'Network timeout',
                'Invalid user input'
            ],
            debug: [
                'Debug: Component mounted',
                'Debug: State updated',
                'Debug: Event triggered'
            ]
        };
        
        console.log('📝 Generating test logs...');
        
        // Generate logs for each browser
        for (const browserId of browserIds) {
            const logCount = Math.floor(Math.random() * 15) + 5; // 5-20 logs per browser
            
            for (let i = 0; i < logCount; i++) {
                const level = logLevels[Math.floor(Math.random() * logLevels.length)];
                const messagePool = messages[level];
                const message = messagePool[Math.floor(Math.random() * messagePool.length)];
                const action = actions[Math.floor(Math.random() * actions.length)];
                
                // Random timestamp within last 24 hours
                const timestamp = new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000);
                
                await logService.logMessage(level, message, {
                    browserId,
                    timestamp,
                    metadata: {
                        action,
                        url: `https://example.com/page${Math.floor(Math.random() * 10)}`,
                        userAgent: browserId.includes('chrome') ? 'Chrome/91.0.4472.124' : 
                                  browserId.includes('firefox') ? 'Firefox/89.0' : 'Safari/14.1.1',
                        sessionId: `${browserId}-${Date.now()}`,
                        pageTitle: `Test Page ${Math.floor(Math.random() * 5) + 1}`,
                        responseTime: Math.floor(Math.random() * 2000) + 100
                    }
                });
            }
            
            console.log(`✅ Generated ${logCount} logs for ${browserId}`);
        }
        
        console.log('🎉 Test data generation complete!');
        console.log('🌐 Visit http://localhost:3000 to see the logs');
        
    } catch (error) {
        console.error('❌ Error generating test data:', error);
    } finally {
        await logService.close();
    }
}

// Run the script
if (require.main === module) {
    generateTestData();
}

module.exports = generateTestData;
