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
    private activeBrowserWindows: Map<string, HTMLElement> = new Map();
    private logUpdateIntervals: Map<string, NodeJS.Timeout> = new Map();
    private browserDetectionInterval: NodeJS.Timeout | null = null;

    constructor() {
        this.browsers = new Map<string, BrowserStats>();
        this.charts = new Map<string, Chart>();
        this.init();
    }

    private init(): void {
        this.setupEventListeners();
        this.loadInitialData();
        this.startPeriodicUpdates();
        this.startRealTimeBrowserDetection();
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
                } else {
                    // 选择"All Browsers"时显示所有日志
                    this.viewAllLogs();
                    this.currentBrowserId = null;
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
            logDiv.className = `log-entry mb-2 p-2 border-l-4 ${this.getLevelClass(log.level)}`;
            
            // Simple one-line format: time + level + browser + message
            const time = new Date(log.timestamp).toLocaleString();
            const level = log.level.toUpperCase();
            const browserInfo = log.isMainThread ? '[MainThread]' : (log.browserId ? `[Browser ${log.browserId}]` : '');
            
            logDiv.innerHTML = `
                <div class="text-xs text-gray-300">${time}</div>
                <div class="font-bold ${this.getLevelColorClass(log.level)}">[${level}] ${browserInfo}</div>
                <div class="text-white">${this.formatLogMessage(log.message)}</div>
            `;
            resultsContainer.appendChild(logDiv);
        });
    }

    private getLevelColor(level: string): string {
        switch (level.toLowerCase()) {
            case 'error': return 'red';
            case 'warn': return 'yellow';
            case 'info': return 'blue';
            case 'debug': return 'gray';
            default: return 'gray';
        }
    }

    private getLevelColorClass(level: string): string {
        switch (level.toLowerCase()) {
            case 'error': return 'text-red-300';
            case 'warn': return 'text-yellow-300';
            case 'info': return 'text-blue-300';
            case 'debug': return 'text-gray-300';
            default: return 'text-gray-300';
        }
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

    private clearLogDisplay(): void {
        const resultsContainer = document.getElementById('search-results');
        if (resultsContainer) {
            resultsContainer.innerHTML = '<p class="text-gray-500">请选择浏览器查看日志</p>';
        }
    }

    private async viewAllLogs(): Promise<void> {
        try {
            // Get all browser IDs first
            const browsersResponse = await fetch('/api/logs/browsers');
            const browsersData = await browsersResponse.json();
            const browserIds = browsersData.browserIds || [];
            
            // Fetch logs from all browsers
            let allLogs: LogEntry[] = [];
            
            for (const browserId of browserIds) {
                try {
                    const response = await fetch(`/api/logs/browser/${browserId}?limit=50`);
                    const data = await response.json();
                    const logs = data.logs || [];
                    allLogs = allLogs.concat(logs);
                } catch (error) {
                    console.error(`Error fetching logs for browser ${browserId}:`, error);
                }
            }
            
            // Sort logs by timestamp (newest first)
            allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            
            // Mark mainthread logs for toggle and formatting
            allLogs = allLogs.map((log: LogEntry) => ({ ...log, isMainThread: !log.browserId }));
            
            this.displaySearchResults(allLogs);
            this.showSuccess(`显示所有浏览器日志 (${allLogs.length} 条)`);
        } catch (error) {
            console.error('Error viewing all logs:', error);
            this.showError('Failed to load all logs');
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
        // Update dashboard every 30 seconds
        setInterval(() => {
            this.loadInitialData();
        }, 30000);
    }

private startRealTimeBrowserDetection(): void {
    // Check for new browsers every 5 seconds
    this.browserDetectionInterval = setInterval(() => {
        this.detectAndCreateBrowserWindows();
    }, 5000);
    
    // Initial detection
    this.detectAndCreateBrowserWindows();
}

private async detectAndCreateBrowserWindows(): Promise<void> {
    try {
        const response = await fetch('/api/logs/browsers');
        const data = await response.json();
        const currentBrowserIds = data.browserIds || [];
        
        // Create windows for new browsers
        for (const browserId of currentBrowserIds) {
            if (!this.activeBrowserWindows.has(browserId)) {
                this.createBrowserLogWindow(browserId);
            }
        }
        
        // Remove windows for browsers that are no longer active
        for (const [browserId, windowElement] of this.activeBrowserWindows) {
            if (!currentBrowserIds.includes(browserId)) {
                this.removeBrowserLogWindow(browserId);
            }
        }
    } catch (error) {
        console.error('Error detecting browsers:', error);
    }
}

private createBrowserLogWindow(browserId: string): void {
    const container = document.getElementById('real-time-logs-container');
    if (!container) {
        // Create container if it doesn't exist
        this.createRealTimeLogsContainer();
        return this.createBrowserLogWindow(browserId);
    }
    
    const windowDiv = document.createElement('div');
    windowDiv.id = `browser-window-${browserId}`;
    windowDiv.className = 'bg-white rounded-lg shadow-lg p-4 mb-4';
    windowDiv.innerHTML = `
        <div class="flex justify-between items-center mb-3">
            <h3 class="text-lg font-bold text-gray-800">Browser ${browserId} - 实时日志</h3>
            <div class="flex items-center space-x-2">
                <span class="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <span class="text-sm text-gray-500">实时</span>
            </div>
        </div>
        <div id="logs-${browserId}" class="bg-gray-900 text-white p-3 rounded h-64 overflow-y-auto font-mono text-sm">
            <div class="text-gray-400">等待日志数据...</div>
        </div>
        <div class="mt-2 text-xs text-gray-500">
            最后更新: <span id="last-update-${browserId}">--</span>
        </div>
    `;
    
    container.appendChild(windowDiv);
    this.activeBrowserWindows.set(browserId, windowDiv);
    
    // Start real-time log updates for this browser
    this.startLogUpdatesForBrowser(browserId);
    
    this.showSuccess(`已为 Browser ${browserId} 创建实时日志窗口`);
}

private removeBrowserLogWindow(browserId: string): void {
    const windowElement = this.activeBrowserWindows.get(browserId);
    if (windowElement) {
        windowElement.remove();
        this.activeBrowserWindows.delete(browserId);
    }
    
    // Stop log updates
    const interval = this.logUpdateIntervals.get(browserId);
    if (interval) {
        clearInterval(interval);
        this.logUpdateIntervals.delete(browserId);
    }
    
    this.showSuccess(`Browser ${browserId} 日志窗口已关闭`);
}

private createRealTimeLogsContainer(): void {
    const mainContainer = document.querySelector('.container');
    if (!mainContainer) return;
    
    const containerDiv = document.createElement('div');
    containerDiv.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow mb-6">
            <h2 class="text-xl font-bold mb-4">🔴 实时浏览器日志窗口</h2>
            <p class="text-gray-600 mb-4">根据 MongoDB 中检测到的活跃浏览器自动创建实时日志显示窗口</p>
            <div id="real-time-logs-container" class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <!-- 动态浏览器日志窗口将在这里创建 -->
            </div>
        </div>
    `;
    
    mainContainer.appendChild(containerDiv);
}

private startLogUpdatesForBrowser(browserId: string): void {
    // Update logs every 2 seconds for real-time effect
    const interval = setInterval(async () => {
        await this.updateBrowserLogs(browserId);
    }, 2000);
    
    this.logUpdateIntervals.set(browserId, interval);
    
    // Initial load
    this.updateBrowserLogs(browserId);
}

private async updateBrowserLogs(browserId: string): Promise<void> {
    try {
        const response = await fetch(`/api/logs/browser/${browserId}?limit=20`);
        const data = await response.json();
        const logs = data.logs || [];
        
        const logsContainer = document.getElementById(`logs-${browserId}`);
        const lastUpdateElement = document.getElementById(`last-update-${browserId}`);
        
        if (logsContainer && logs.length > 0) {
            // Clear and add new logs
            logsContainer.innerHTML = '';
            
            logs.slice(0, 10).forEach((log: LogEntry) => {
                const logDiv = document.createElement('div');
                logDiv.className = 'mb-1 text-xs';
                
                const time = this.parseUTCTime(log.timestamp);
                const level = log.level.toUpperCase();
                const levelColor = this.getLevelColorClass(log.level).replace('text-', '');
                
                logDiv.innerHTML = `
                    <span class="text-gray-400">${time}</span>
                    <span class="${this.getLevelColorClass(log.level)} font-bold ml-2">[${level}]</span>
                    <span class="text-white ml-2">${this.truncateMessage(log.message, 80)}</span>
                `;
                
                logsContainer.appendChild(logDiv);
            });
            
            // Auto scroll to bottom
            logsContainer.scrollTop = logsContainer.scrollHeight;
        }
        
        if (lastUpdateElement) {
            lastUpdateElement.textContent = new Date().toLocaleTimeString();
        }
    } catch (error) {
        console.error(`Error updating logs for browser ${browserId}:`, error);
    }
}

private parseUTCTime(ts: string): string {
    if (!ts) return '';
    const date = new Date(ts.endsWith('Z') ? ts : ts + 'Z');
    return date.toLocaleTimeString();
}

private truncateMessage(message: string, maxLength: number): string {
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength) + '...';
}

}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new LogDashboard();
});
