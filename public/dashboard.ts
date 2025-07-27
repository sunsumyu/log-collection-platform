// Browser-compatible dashboard without external dependencies

interface BrowserStats {
    browserId: string;
    total: number;
    byLevel: {
        [key: string]: {
            count: number;
            latestTimestamp?: string;
        };
    };
}

interface OverviewData {
    totalBrowsers: number;
    browsers: BrowserStats[];
    totalLogs?: number;
    errorCount?: number;
}

interface LogEntry {
    level: string;
    message: string;
    timestamp: string;
    metadata?: any;
    browserId?: string;
    isMainThread?: boolean;
}

interface Chart {
    destroy(): void;
    update(): void;
}

class LogDashboard {
    private browsers: Map<string, BrowserStats>;
    private charts: Map<string, Chart>;
    private showMainThread: boolean = true;
    private currentBrowserId: string | null = null;

    constructor() {
        this.browsers = new Map<string, BrowserStats>();
        this.charts = new Map<string, Chart>();
        this.init();
    }

    private init(): void {
        this.setupEventListeners();
        this.loadInitialData();
        this.startPeriodicUpdates();
        this.updateConnectionStatus(true); // Always show as connected for HTTP polling
    }

    private setupEventListeners(): void {
        // Browser filter change
        const browserFilter = document.getElementById('browser-filter') as HTMLSelectElement;
        if (browserFilter) {
            browserFilter.addEventListener('change', (e) => {
                const target = e.target as HTMLSelectElement;
                // 直接触发加载该浏览器日志
                if (target.value) {
                    this.viewBrowserLogs(target.value);
                }
            });
        }

        // MainThread toggle
        const mainThreadToggle = document.getElementById('mainthread-toggle') as HTMLInputElement;
        if (mainThreadToggle) {
            mainThreadToggle.addEventListener('change', (e) => {
                const target = e.target as HTMLInputElement;
                this.showMainThread = target.checked;
                // Refresh current view if a browser is selected
                if (this.currentBrowserId) {
                    this.viewBrowserLogs(this.currentBrowserId);
                }
            });
        }

        // Search functionality
        const searchBtn = document.getElementById('search-btn');
        const searchInput = document.getElementById('search-input') as HTMLInputElement;
        
        if (searchBtn && searchInput) {
            searchBtn.addEventListener('click', () => {
                this.performSearch();
            });
            
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.performSearch();
                }
            });
        }

        // Clear all logs
        const clearAllBtn = document.getElementById('clear-all-logs');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => {
                this.clearAllLogs();
            });
        }

        // Dynamic event delegation for browser-specific buttons
        document.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            
            if (target.classList.contains('view-logs-btn')) {
                const browserId = target.getAttribute('data-browser-id');
                if (browserId) {
                    this.viewBrowserLogs(browserId);
                }
            }
            
            if (target.classList.contains('clear-browser-logs-btn')) {
                const browserId = target.getAttribute('data-browser-id');
                if (browserId) {
                    this.clearBrowserLogs(browserId);
                }
            }
        });

        const refreshBtn = document.getElementById('refresh-btn') as HTMLButtonElement;
        const clearLogsBtn = document.getElementById('clear-logs-btn') as HTMLButtonElement;

        refreshBtn?.addEventListener('click', () => {
            this.loadInitialData();
        });

        clearLogsBtn?.addEventListener('click', () => {
            this.clearAllLogs();
        });
    }

    private async loadInitialData(): Promise<void> {
        try {
            // Get browser IDs first
            const browsersResponse = await fetch('/api/logs/browsers');
            const browsersData = await browsersResponse.json();
            const browserIds = browsersData.browserIds || [];
            
            // Get stats for each browser
            const browsers: BrowserStats[] = [];
            let totalLogs = 0;
            let totalErrors = 0;
            
            for (const browserId of browserIds) {
                try {
                    const statsResponse = await fetch(`/api/logs/browser/${browserId}/stats`);
                    const stats = await statsResponse.json();
                    
                    browsers.push({
                        browserId,
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
            
            const overview: OverviewData = {
                totalBrowsers: browserIds.length,
                browsers,
                totalLogs,
                errorCount: totalErrors
            };
            
            this.updateOverviewStats(overview);
            this.renderBrowserWindows(overview.browsers);
            this.updateBrowserFilter(overview.browsers);
            
        } catch (error) {
            console.error('Error loading initial data:', error);
            this.showError('Failed to load dashboard data');
        }
    }

    private updateOverviewStats(overview: OverviewData): void {
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

    private renderBrowserWindows(browsers: BrowserStats[]): void {
        const gridContainer = document.getElementById('browser-grid');
        if (!gridContainer) return;

        gridContainer.innerHTML = '';
        
        browsers.forEach(browser => {
            const windowElement = this.createBrowserWindow(browser);
            gridContainer.appendChild(windowElement);
            this.createChart(browser.browserId, browser);
        });
    }

    private createBrowserWindow(browser: BrowserStats): HTMLElement {
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
        const viewLogsBtn = windowDiv.querySelector('.view-logs-btn') as HTMLButtonElement;
        const clearBtn = windowDiv.querySelector('.clear-browser-logs-btn') as HTMLButtonElement;
        
        viewLogsBtn?.addEventListener('click', () => {
            this.viewBrowserLogs(browser.browserId);
        });
        
        clearBtn?.addEventListener('click', () => {
            this.clearBrowserLogs(browser.browserId);
        });
        
        return windowDiv;
    }

    private createChart(browserId: string, browser: BrowserStats): void {
        // Simple chart creation - you can enhance this with Chart.js
        const canvas = document.getElementById(`chart-${browserId}`) as HTMLCanvasElement;
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
            
            ctx.fillStyle = colors[index] || '#6b7280';
            ctx.fillRect(x, y, 50, barHeight);
            
            ctx.fillStyle = '#000';
            ctx.font = '12px Arial';
            ctx.fillText(value.toString(), x + 20, y - 5);
        });
    }

    private updateBrowserFilter(browsers: BrowserStats[]): void {
        const filter = document.getElementById('browser-filter') as HTMLSelectElement;
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

    private async performSearch(): Promise<void> {
        const searchInput = document.getElementById('search-input') as HTMLInputElement;
        const browserFilter = document.getElementById('browser-filter') as HTMLSelectElement;
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
                // Get logs for specific browser
                url = `/api/logs/browser/${selectedBrowser}`;
                params.append('limit', '50');
            } else if (query) {
                // Global search
                url = '/api/logs/search';
                params.append('q', query);
            }
            
            const fullUrl = params.toString() ? `${url}?${params.toString()}` : url;
            const response = await fetch(fullUrl);
            const data = await response.json();
            
            // Handle different response formats
            const results = data.logs || data.data || data;
            this.displaySearchResults(results);
        } catch (error) {
            console.error('Search error:', error);
            this.showError('Search failed');
        }
    }

    private displaySearchResults(results: LogEntry[]): void {
        const resultsContainer = document.getElementById('search-results');
        if (!resultsContainer) return;

        // Filter mainthread logs if toggle is off
        let filteredResults = results;
        if (!this.showMainThread) {
            filteredResults = results.filter(log => !log.isMainThread);
        }

        resultsContainer.innerHTML = '';
        
        if (!filteredResults || filteredResults.length === 0) {
            resultsContainer.innerHTML = '<p class="text-gray-500">无日志</p>';
            return;
        }

        filteredResults.forEach((log: LogEntry) => {
            const logDiv = document.createElement('div');
            logDiv.className = `log-entry px-2 py-1 mb-1 rounded border-l-4 ${this.getLevelClass(log.level)}`;
            // VSCode/debug style formatting
            const time = new Date(log.timestamp).toLocaleTimeString();
            const level = log.level.toUpperCase().padEnd(5);
            const browser = log.isMainThread ? '<span class="text-xs bg-gray-600 text-white px-2 py-1 rounded ml-2">MainThread</span>' : (log.browserId ? `<span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded ml-2">Browser ${log.browserId}</span>` : '');
            logDiv.innerHTML = `
                <span class="font-mono text-xs text-gray-400">${time}</span>
                <span class="font-mono text-xs font-bold ml-2">${level}</span>
                ${browser}
                <span class="ml-2">${this.formatLogMessage(log.message)}</span>
            `;
            resultsContainer.appendChild(logDiv);
        });
    }

    private formatLogMessage(msg: string): string {
        // Try to format multi-line or structured logs for readability
        if (!msg) return '';
        if (msg.startsWith('{') || msg.startsWith('[')) {
            try {
                return `<pre class='inline whitespace-pre-wrap'>${JSON.stringify(JSON.parse(msg), null, 2)}</pre>`;
            } catch {
                return msg;
            }
        }
        return msg.replace(/\n/g, '<br>');
    }

    private getLevelClass(level: string): string {
        switch (level) {
            case 'error': return 'bg-red-100 text-red-800';
            case 'warn': return 'bg-yellow-100 text-yellow-800';
            case 'info': return 'bg-blue-100 text-blue-800';
            case 'debug': return 'bg-gray-100 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    }

    private async viewBrowserLogs(browserId: string): Promise<void> {
        try {
            this.currentBrowserId = browserId;
            // Fetch logs, including mainthread logs
            const response = await fetch(`/api/logs/browser/${browserId}?limit=50&includeMainThread=true`);
            const data = await response.json();
            let logs = data.logs || [];
            // Mark mainthread logs for toggle and formatting
            logs = logs.map((log: LogEntry) => ({ ...log, isMainThread: !log.browserId }));
            this.displaySearchResults(logs);
            this.showSuccess(`显示 Browser ${browserId} 日志`);
        } catch (error) {
            console.error('Error viewing browser logs:', error);
            this.showError('Failed to load browser logs');
        }
    }

    private async clearBrowserLogs(browserId: string): Promise<void> {
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

    private showNewLogNotification(message: string): void {
        // Create notification
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-white border-l-4 border-blue-500 p-4 shadow-lg rounded z-50';
        notification.innerHTML = `
            <div class="flex items-center">
                <div class="flex-1">
                    <div class="text-sm font-medium text-gray-900">Update</div>
                    <div class="text-xs text-gray-500">${message}</div>
                </div>
            </div>
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    private async clearAllLogs(): Promise<void> {
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

    private updateConnectionStatus(connected: boolean): void {
        const statusIndicator = document.getElementById('status-indicator');
        const statusText = document.getElementById('status-text');
        
        if (statusIndicator) {
            statusIndicator.className = connected ? 'w-3 h-3 rounded-full bg-green-500' : 'w-3 h-3 rounded-full bg-red-500';
        }
        
        if (statusText) {
            statusText.textContent = connected ? 'Connected' : 'Disconnected';
        }
    }

    private showError(message: string): void {
        this.showNotification(message, 'error');
    }

    private showSuccess(message: string): void {
        this.showNotification(message, 'success');
    }

    private showNotification(message: string, type: 'error' | 'success' | 'info'): void {
        const notification = document.createElement('div');
        const bgColor = type === 'error' ? 'bg-red-500' : type === 'success' ? 'bg-green-500' : 'bg-blue-500';
        notification.className = `fixed top-4 right-4 ${bgColor} text-white px-4 py-2 rounded shadow-lg z-50`;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    private startPeriodicUpdates(): void {
        setInterval(() => {
            this.loadInitialData();
        }, 30000); // Update every 30 seconds
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new LogDashboard();
});
