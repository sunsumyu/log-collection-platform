// Browser-compatible Log Dashboard
class LogDashboard {
    constructor() {
        this.browsers = new Map();
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadInitialData();
        this.startPeriodicUpdates();
        this.updateConnectionStatus(true);
    }

    setupEventListeners() {
        const refreshBtn = document.getElementById('refresh-btn');
        const clearLogsBtn = document.getElementById('clear-logs-btn');
        const searchBtn = document.getElementById('search-btn');
        const searchInput = document.getElementById('search-input');

        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.loadInitialData();
            });
        }

        if (clearLogsBtn) {
            clearLogsBtn.addEventListener('click', () => {
                this.clearAllLogs();
            });
        }

        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                this.performSearch();
            });
        }

        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.performSearch();
                }
            });
        }
    }

    async loadInitialData() {
        try {
            console.log('Loading initial data...');
            
            // Get browser IDs first
            const browsersResponse = await fetch('/api/logs/browsers');
            const browsersData = await browsersResponse.json();
            const browserIds = browsersData.browserIds || [];
            
            console.log('Browser IDs:', browserIds);
            
            // Get stats for each browser
            const browsers = [];
            let totalLogs = 0;
            let totalErrors = 0;
            
            for (const browserId of browserIds) {
                try {
                    const statsResponse = await fetch(`/api/logs/browser/${browserId}/stats`);
                    const stats = await statsResponse.json();
                    
                    console.log(`Stats for browser ${browserId}:`, stats);
                    
                    browsers.push({
                        browserId: browserId,
                        total: stats.totalLogs || 0,
                        byLevel: {
                            error: { count: stats.errorCount || 0 },
                            warn: { count: stats.warnCount || 0 },
                            info: { count: stats.infoCount || 0 },
                            debug: { count: stats.debugCount || 0 }
                        }
                    });
                    
                    totalLogs += stats.totalLogs || 0;
                    totalErrors += stats.errorCount || 0;
                } catch (error) {
                    console.error(`Error loading stats for browser ${browserId}:`, error);
                }
            }
            
            const overview = {
                totalBrowsers: browserIds.length,
                browsers: browsers,
                totalLogs: totalLogs,
                errorCount: totalErrors
            };
            
            console.log('Overview data:', overview);
            
            this.updateOverviewStats(overview);
            this.renderBrowserWindows(overview.browsers);
            this.updateBrowserFilter(overview.browsers);
            
        } catch (error) {
            console.error('Error loading initial data:', error);
            this.showError('Failed to load dashboard data');
        }
    }

    updateOverviewStats(overview) {
        const totalBrowsersEl = document.getElementById('total-browsers');
        const totalLogsEl = document.getElementById('total-logs');
        const totalErrorsEl = document.getElementById('total-errors');
        const activeSessionsEl = document.getElementById('active-sessions');

        if (totalBrowsersEl) {
            totalBrowsersEl.textContent = overview.totalBrowsers?.toString() || '0';
        }
        
        if (totalLogsEl) {
            totalLogsEl.textContent = overview.totalLogs?.toString() || '0';
        }
        
        if (totalErrorsEl) {
            totalErrorsEl.textContent = overview.errorCount?.toString() || '0';
        }
        
        if (activeSessionsEl) {
            activeSessionsEl.textContent = overview.totalBrowsers?.toString() || '0';
        }
    }

    renderBrowserWindows(browsers) {
        const gridContainer = document.getElementById('browser-grid');
        if (!gridContainer) return;

        gridContainer.innerHTML = '';
        
        browsers.forEach(browser => {
            const windowElement = this.createBrowserWindow(browser);
            gridContainer.appendChild(windowElement);
            this.createChart(browser.browserId, browser);
        });
    }

    createBrowserWindow(browser) {
        const windowDiv = document.createElement('div');
        windowDiv.className = 'browser-window bg-white rounded-lg shadow-lg p-6';
        
        windowDiv.innerHTML = `
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-semibold">Browser ${browser.browserId}</h3>
                <span class="text-sm text-gray-500">${browser.total} logs</span>
            </div>
            <div class="space-y-2 mb-4">
                <div class="flex justify-between">
                    <span>Errors:</span>
                    <span class="text-red-600">${browser.byLevel.error?.count || 0}</span>
                </div>
                <div class="flex justify-between">
                    <span>Warnings:</span>
                    <span class="text-yellow-600">${browser.byLevel.warn?.count || 0}</span>
                </div>
                <div class="flex justify-between">
                    <span>Info:</span>
                    <span class="text-blue-600">${browser.byLevel.info?.count || 0}</span>
                </div>
                <div class="flex justify-between">
                    <span>Debug:</span>
                    <span class="text-gray-600">${browser.byLevel.debug?.count || 0}</span>
                </div>
            </div>
            <div class="flex space-x-2 mb-4">
                <button class="view-logs-btn bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm" data-browser-id="${browser.browserId}">
                    View Logs
                </button>
                <button class="clear-browser-logs-btn bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm" data-browser-id="${browser.browserId}">
                    Clear
                </button>
            </div>
            <canvas id="chart-${browser.browserId}" width="300" height="200"></canvas>
        `;
        
        // Add event listeners for the buttons
        const viewLogsBtn = windowDiv.querySelector('.view-logs-btn');
        const clearBtn = windowDiv.querySelector('.clear-browser-logs-btn');
        
        if (viewLogsBtn) {
            viewLogsBtn.addEventListener('click', () => {
                this.viewBrowserLogs(browser.browserId);
            });
        }
        
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearBrowserLogs(browser.browserId);
            });
        }
        
        return windowDiv;
    }

    createChart(browserId, browser) {
        const canvas = document.getElementById(`chart-${browserId}`);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Simple bar chart
        const data = [
            browser.byLevel.error?.count || 0,
            browser.byLevel.warn?.count || 0,
            browser.byLevel.info?.count || 0,
            browser.byLevel.debug?.count || 0
        ];
        
        const colors = ['#ef4444', '#f59e0b', '#3b82f6', '#6b7280'];
        const maxValue = Math.max(...data, 1);
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        data.forEach((value, index) => {
            const barHeight = (value / maxValue) * 150;
            const x = index * 70 + 20;
            const y = 180 - barHeight;
            
            ctx.fillStyle = colors[index];
            ctx.fillRect(x, y, 50, barHeight);
            
            ctx.fillStyle = '#000';
            ctx.font = '12px Arial';
            ctx.fillText(value.toString(), x + 20, y - 5);
        });
    }

    updateBrowserFilter(browsers) {
        const filter = document.getElementById('browser-filter');
        if (!filter) return;

        // Clear existing options except "All Browsers"
        filter.innerHTML = '<option value="">All Browsers</option>';
        
        browsers.forEach(browser => {
            const option = document.createElement('option');
            option.value = browser.browserId;
            option.textContent = `Browser ${browser.browserId}`;
            filter.appendChild(option);
        });
    }

    async performSearch() {
        const searchInput = document.getElementById('search-input');
        const browserFilter = document.getElementById('browser-filter');
        const query = searchInput?.value.trim();
        const selectedBrowser = browserFilter?.value;
        
        if (!query && !selectedBrowser) {
            this.loadInitialData();
            return;
        }

        try {
            let url = '/api/logs';
            const params = new URLSearchParams();
            
            if (selectedBrowser) {
                url = `/api/logs/browser/${selectedBrowser}`;
                params.append('limit', '50');
            } else if (query) {
                url = '/api/logs/search';
                params.append('q', query);
            }
            
            const fullUrl = params.toString() ? `${url}?${params.toString()}` : url;
            const response = await fetch(fullUrl);
            const data = await response.json();
            
            const results = data.logs || data.data || data;
            this.displaySearchResults(results);
        } catch (error) {
            console.error('Search error:', error);
            this.showError('Search failed');
        }
    }

    displaySearchResults(results) {
        const resultsContainer = document.getElementById('search-results');
        if (!resultsContainer) return;

        resultsContainer.innerHTML = '';
        
        if (!results || results.length === 0) {
            resultsContainer.innerHTML = '<p class="text-gray-500">No results found</p>';
            return;
        }

        results.forEach(log => {
            const logDiv = document.createElement('div');
            logDiv.className = `log-entry p-3 border-l-4 mb-2 level-${log.level}`;
            logDiv.innerHTML = `
                <div class="flex justify-between items-start">
                    <div class="flex-1">
                        <div class="flex items-center space-x-2 mb-1">
                            <span class="text-xs font-medium px-2 py-1 rounded ${this.getLevelClass(log.level)}">${log.level.toUpperCase()}</span>
                            <span class="text-xs text-gray-500">${new Date(log.timestamp).toLocaleString()}</span>
                            ${log.browserId ? `<span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Browser ${log.browserId}</span>` : ''}
                        </div>
                        <div class="text-sm text-gray-800">${log.message}</div>
                    </div>
                </div>
            `;
            resultsContainer.appendChild(logDiv);
        });
    }

    getLevelClass(level) {
        switch (level) {
            case 'error': return 'bg-red-100 text-red-800';
            case 'warn': return 'bg-yellow-100 text-yellow-800';
            case 'info': return 'bg-blue-100 text-blue-800';
            case 'debug': return 'bg-gray-100 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    }

    async viewBrowserLogs(browserId) {
        try {
            const response = await fetch(`/api/logs/browser/${browserId}?limit=20`);
            const data = await response.json();
            const logs = data.logs || [];
            
            this.displaySearchResults(logs);
            this.showSuccess(`Showing logs for Browser ${browserId}`);
        } catch (error) {
            console.error('Error viewing browser logs:', error);
            this.showError('Failed to load browser logs');
        }
    }

    async clearBrowserLogs(browserId) {
        if (!confirm(`Are you sure you want to clear logs for Browser ${browserId}?`)) {
            return;
        }

        try {
            const response = await fetch(`/api/logs?browserId=${browserId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                this.loadInitialData();
                this.showSuccess(`Logs cleared for Browser ${browserId}`);
            } else {
                this.showError('Failed to clear browser logs');
            }
        } catch (error) {
            console.error('Error clearing browser logs:', error);
            this.showError('Failed to clear browser logs');
        }
    }

    async clearAllLogs() {
        if (!confirm('Are you sure you want to clear all logs?')) {
            return;
        }

        try {
            const response = await fetch('/api/logs', {
                method: 'DELETE'
            });
            
            if (response.ok) {
                this.loadInitialData();
                this.showSuccess('All logs cleared');
            } else {
                this.showError('Failed to clear logs');
            }
        } catch (error) {
            console.error('Clear logs error:', error);
            this.showError('Failed to clear logs');
        }
    }

    updateConnectionStatus(connected) {
        const statusIndicator = document.getElementById('status-indicator');
        const statusText = document.getElementById('status-text');
        
        if (statusIndicator) {
            statusIndicator.className = connected ? 'w-3 h-3 rounded-full bg-green-500' : 'w-3 h-3 rounded-full bg-red-500';
        }
        
        if (statusText) {
            statusText.textContent = connected ? 'Connected' : 'Disconnected';
        }
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showNotification(message, type) {
        const notification = document.createElement('div');
        const bgColor = type === 'error' ? 'bg-red-500' : type === 'success' ? 'bg-green-500' : 'bg-blue-500';
        notification.className = `fixed top-4 right-4 ${bgColor} text-white px-4 py-2 rounded shadow-lg z-50`;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    startPeriodicUpdates() {
        setInterval(() => {
            this.loadInitialData();
        }, 30000); // Update every 30 seconds
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing Log Dashboard...');
    new LogDashboard();
});
