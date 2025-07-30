// TypeScript Log Dashboard with Object-Oriented Design
// Clean implementation to replace the existing JavaScript dashboard
var LogLevel;
(function (LogLevel) {
    LogLevel["ALL"] = "all";
    LogLevel["ERROR"] = "error";
    LogLevel["WARN"] = "warn";
    LogLevel["INFO"] = "info";
    LogLevel["DEBUG"] = "debug";
})(LogLevel || (LogLevel = {}));
class RealTimeLogManager {
    constructor() {
        this.logWindows = new Map();
        this.containerElement = null;
        this.browserEntryMarkerPattern = /BaseTaskExecutor\.ts:211.*theoriq runSingleTaskTest-TaskIndex/;
        this.initializeContainer();
    }
    initializeContainer() {
        // Find the main container
        let mainContainer = document.querySelector('.container');
        if (!mainContainer) {
            mainContainer = document.querySelector('main');
        }
        if (!mainContainer) {
            console.error('No main container found for real-time logs');
            return;
        }
        // Check if real-time section already exists
        let existingSection = document.getElementById('real-time-logs-container');
        if (existingSection) {
            this.containerElement = existingSection;
            console.log('Real-time logs container already exists');
            return;
        }
        // Create real-time logs section
        const realTimeSection = document.createElement('div');
        realTimeSection.className = 'bg-white p-6 rounded-lg shadow mb-6';
        realTimeSection.innerHTML = `
            <h2 class="text-xl font-bold mb-4">🔴 实时浏览器日志窗口</h2>
            <p class="text-gray-600 mb-4">根据 MongoDB 中检测到的活跃浏览器自动创建实时日志显示窗口</p>
            <div id="real-time-logs-container" class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <!-- 动态浏览器日志窗口将在这里创建 -->
            </div>
        `;
        mainContainer.appendChild(realTimeSection);
        this.containerElement = document.getElementById('real-time-logs-container');
        if (this.containerElement) {
            console.log('Real-time logs container created successfully');
        }
        else {
            console.error('Failed to create real-time-logs-container');
        }
    }
    createLogWindow(browserId) {
        if (!this.containerElement) {
            console.error('Real-time logs container not available');
            return false;
        }
        if (this.logWindows.has(browserId)) {
            console.log(`Log window for browser ${browserId} already exists`);
            return true;
        }
        const windowElement = this.createWindowElement(browserId);
        this.containerElement.appendChild(windowElement);
        const logWindow = {
            browserId,
            element: windowElement,
            currentFilter: LogLevel.ALL,
            updateInterval: null
        };
        this.logWindows.set(browserId, logWindow);
        this.setupLogLevelFilters(logWindow);
        this.startLogUpdates(logWindow);
        console.log(`Created real-time log window for browser ${browserId}`);
        return true;
    }
    createWindowElement(browserId) {
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
            <div class="mb-3 flex space-x-2">
                <button class="log-level-btn px-3 py-1 text-xs rounded border active" data-browser="${browserId}" data-level="${LogLevel.ALL}">全部</button>
                <button class="log-level-btn px-3 py-1 text-xs rounded border" data-browser="${browserId}" data-level="${LogLevel.ERROR}">错误</button>
                <button class="log-level-btn px-3 py-1 text-xs rounded border" data-browser="${browserId}" data-level="${LogLevel.WARN}">警告</button>
                <button class="log-level-btn px-3 py-1 text-xs rounded border" data-browser="${browserId}" data-level="${LogLevel.INFO}">信息</button>
                <button class="log-level-btn px-3 py-1 text-xs rounded border" data-browser="${browserId}" data-level="${LogLevel.DEBUG}">调试</button>
            </div>
            <div id="logs-${browserId}" class="bg-gray-900 text-white p-3 rounded h-96 overflow-y-auto font-mono text-sm">
                <div class="text-gray-400">等待日志数据...</div>
            </div>
            <div class="mt-2 text-xs text-gray-500">
                最后更新: <span id="last-update-${browserId}">--</span>
            </div>
        `;
        return windowDiv;
    }
    setupLogLevelFilters(logWindow) {
        const levelButtons = logWindow.element.querySelectorAll('.log-level-btn');
        levelButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.target;
                const level = target.dataset.level;
                const browser = target.dataset.browser;
                if (browser !== logWindow.browserId)
                    return;
                // Update active button
                levelButtons.forEach(b => b.classList.remove('active'));
                target.classList.add('active');
                // Update filter and refresh logs immediately
                logWindow.currentFilter = level;
                this.updateLogsForWindow(logWindow);
                console.log(`Filter changed to ${level} for browser ${browser}`);
            });
        });
    }
    startLogUpdates(logWindow) {
        // Clear existing interval if any
        if (logWindow.updateInterval) {
            clearInterval(logWindow.updateInterval);
        }
        // Start new interval with 1-second updates
        logWindow.updateInterval = setInterval(() => {
            this.updateLogsForWindow(logWindow);
        }, 1000);
        // Initial load
        this.updateLogsForWindow(logWindow);
    }
    async updateLogsForWindow(logWindow) {
        try {
            let url = `/api/logs/browser/${logWindow.browserId}?limit=100`;
            if (logWindow.currentFilter !== LogLevel.ALL) {
                url += `&level=${logWindow.currentFilter}`;
            }
            const response = await fetch(url);
            const data = await response.json();
            let logs = data.logs || [];
            // Filter logs to only show after the latest browser entry marker
            logs = this.filterLogsAfterLatestMarker(logs);
            const logsContainer = document.getElementById(`logs-${logWindow.browserId}`);
            const lastUpdateElement = document.getElementById(`last-update-${logWindow.browserId}`);
            if (logsContainer && logs.length > 0) {
                // Clear and add new logs
                logsContainer.innerHTML = '';
                logs.slice(0, 20).forEach((log) => {
                    const logDiv = document.createElement('div');
                    logDiv.className = 'mb-1 text-xs';
                    const time = this.parseUTCTime(log.timestamp);
                    const logLevel = log.level.toUpperCase();
                    const levelColor = this.getLevelColorClass(log.level);
                    logDiv.innerHTML = `
                        <span class="text-gray-400">${time}</span>
                        <span class="${levelColor} font-bold ml-2">[${logLevel}]</span>
                        <span class="text-white ml-2">${this.truncateMessage(log.message, 80)}</span>
                    `;
                    logsContainer.appendChild(logDiv);
                });
                // Auto scroll to bottom
                logsContainer.scrollTop = logsContainer.scrollHeight;
            }
            else if (logsContainer) {
                logsContainer.innerHTML = '<div class="text-gray-400">没有找到符合条件的日志...</div>';
            }
            if (lastUpdateElement) {
                lastUpdateElement.textContent = new Date().toLocaleTimeString();
            }
        }
        catch (error) {
            console.error(`Error updating logs for browser ${logWindow.browserId}:`, error);
        }
    }
    filterLogsAfterLatestMarker(logs) {
        let latestMarkerIndex = -1;
        // Search from the end (most recent) to find the latest marker
        for (let i = logs.length - 1; i >= 0; i--) {
            if (logs[i].message && this.browserEntryMarkerPattern.test(logs[i].message)) {
                latestMarkerIndex = i;
                break;
            }
        }
        // If marker found, return logs after the marker (including the marker)
        if (latestMarkerIndex >= 0) {
            return logs.slice(latestMarkerIndex);
        }
        // If no marker found, return all logs
        return logs;
    }
    parseUTCTime(ts) {
        if (!ts)
            return '';
        const date = new Date(ts.endsWith('Z') ? ts : ts + 'Z');
        return date.toLocaleTimeString();
    }
    getLevelColorClass(level) {
        switch (level.toLowerCase()) {
            case 'error': return 'text-red-400';
            case 'warn': return 'text-yellow-400';
            case 'info': return 'text-blue-400';
            case 'debug': return 'text-gray-400';
            default: return 'text-white';
        }
    }
    truncateMessage(message, maxLength) {
        if (message.length <= maxLength)
            return message;
        return message.substring(0, maxLength) + '...';
    }
    removeLogWindow(browserId) {
        const logWindow = this.logWindows.get(browserId);
        if (logWindow) {
            if (logWindow.updateInterval) {
                clearInterval(logWindow.updateInterval);
            }
            logWindow.element.remove();
            this.logWindows.delete(browserId);
            console.log(`Removed real-time log window for browser ${browserId}`);
        }
    }
    pauseAllUpdates() {
        this.logWindows.forEach(logWindow => {
            if (logWindow.updateInterval) {
                clearInterval(logWindow.updateInterval);
                logWindow.updateInterval = null;
            }
        });
    }
    resumeAllUpdates() {
        this.logWindows.forEach(logWindow => {
            this.startLogUpdates(logWindow);
        });
    }
}
class LogDashboard {
    constructor() {
        this.showMainThread = true;
        this.currentBrowserId = null;
        this.browserDetectionInterval = null;
        this.visibilityListener = null;
        this.browsers = new Map();
        this.realTimeLogManager = new RealTimeLogManager();
        this.init();
    }
    init() {
        this.setupEventListeners();
        this.loadInitialData();
        this.startPeriodicUpdates();
        this.startRealTimeBrowserDetection();
        this.setupVisibilityListener();
        this.updateConnectionStatus(true);
    }
    setupVisibilityListener() {
        if (!this.visibilityListener) {
            this.visibilityListener = () => {
                if (document.hidden) {
                    this.realTimeLogManager.pauseAllUpdates();
                }
                else {
                    this.realTimeLogManager.resumeAllUpdates();
                }
            };
            document.addEventListener('visibilitychange', this.visibilityListener);
        }
    }
    setupEventListeners() {
        // Browser filter change
        const browserFilter = document.getElementById('browser-filter');
        if (browserFilter) {
            browserFilter.addEventListener('change', (e) => {
                const target = e.target;
                if (target.value) {
                    this.viewBrowserLogs(target.value);
                }
                else {
                    this.viewAllLogs();
                    this.currentBrowserId = null;
                }
            });
        }
        // MainThread toggle
        const mainThreadToggle = document.getElementById('mainthread-toggle');
        if (mainThreadToggle) {
            mainThreadToggle.addEventListener('change', (e) => {
                const target = e.target;
                this.showMainThread = target.checked;
                if (this.currentBrowserId) {
                    this.viewBrowserLogs(this.currentBrowserId);
                }
            });
        }
        // Search functionality
        const searchBtn = document.getElementById('search-btn');
        const searchInput = document.getElementById('search-input');
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
        // Refresh and clear buttons
        const refreshBtn = document.getElementById('refresh-btn');
        const clearLogsBtn = document.getElementById('clear-logs-btn');
        refreshBtn === null || refreshBtn === void 0 ? void 0 : refreshBtn.addEventListener('click', () => {
            this.loadInitialData();
        });
        clearLogsBtn === null || clearLogsBtn === void 0 ? void 0 : clearLogsBtn.addEventListener('click', () => {
            this.clearAllLogs();
        });
    }
    async loadInitialData() {
        try {
            // Show loading state
            this.showLoadingState();
            // Get browser IDs first
            const browsersResponse = await fetch('/api/logs/browsers');
            const browsersData = await browsersResponse.json();
            const browserIds = browsersData.browserIds || [];
            // Load browser stats in parallel with limited data
            const browserPromises = browserIds.slice(0, 5).map(async (browserId) => {
                try {
                    const statsResponse = await fetch(`/api/logs/browser/${browserId}/stats?recent=true`);
                    const stats = await statsResponse.json();
                    return {
                        browserId,
                        total: stats.totalLogs || 0,
                        byLevel: {
                            error: { count: stats.errorCount || 0 },
                            warn: { count: stats.warnCount || 0 },
                            info: { count: stats.infoCount || 0 },
                            debug: { count: stats.debugCount || 0 }
                        }
                    };
                }
                catch (error) {
                    console.error(`Error loading stats for browser ${browserId}:`, error);
                    return {
                        browserId,
                        total: 0,
                        byLevel: { error: { count: 0 }, warn: { count: 0 }, info: { count: 0 }, debug: { count: 0 } }
                    };
                }
            });
            const browsers = await Promise.all(browserPromises);
            const totalLogs = browsers.reduce((sum, b) => sum + b.total, 0);
            const totalErrors = browsers.reduce((sum, b) => sum + b.byLevel.error.count, 0);
            const overview = {
                totalBrowsers: browserIds.length,
                browsers,
                totalLogs,
                errorCount: totalErrors
            };
            this.updateOverviewStats(overview);
            this.renderBrowserWindows(overview.browsers);
            this.updateBrowserFilter(overview.browsers);
            // Create real-time log windows for detected browsers
            this.createRealTimeLogWindows(browsers);
            this.hideLoadingState();
        }
        catch (error) {
            console.error('Error loading initial data:', error);
            this.hideLoadingState();
        }
    }
    showLoadingState() {
        const statsElements = ['total-browsers', 'total-logs', 'total-errors', 'active-sessions'];
        statsElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.innerHTML = '<div class="animate-pulse bg-gray-200 h-6 w-12 rounded"></div>';
            }
        });
    }
    hideLoadingState() {
        // Loading state will be hidden when actual data is updated
    }
    createRealTimeLogWindows(browsers) {
        browsers.forEach(browser => {
            const success = this.realTimeLogManager.createLogWindow(browser.browserId);
            if (success) {
                console.log(`Real-time log window created for browser ${browser.browserId}`);
            }
            else {
                console.error(`Failed to create real-time log window for browser ${browser.browserId}`);
            }
        });
    }
    startRealTimeBrowserDetection() {
        if (this.browserDetectionInterval) {
            clearInterval(this.browserDetectionInterval);
        }
        this.browserDetectionInterval = setInterval(async () => {
            await this.detectAndCreateBrowserWindows();
        }, 5000);
        this.detectAndCreateBrowserWindows();
    }
    async detectAndCreateBrowserWindows() {
        try {
            const browsersResponse = await fetch('/api/logs/browsers');
            const browsersData = await browsersResponse.json();
            const browserIds = browsersData.browserIds || [];
            for (const browserId of browserIds) {
                this.realTimeLogManager.createLogWindow(browserId);
            }
        }
        catch (error) {
            console.error('Error detecting browsers:', error);
        }
    }
    startPeriodicUpdates() {
        setInterval(() => {
            this.loadInitialData();
        }, 10000);
    }
    updateConnectionStatus(connected) {
        const statusIndicator = document.getElementById('status-indicator');
        const statusText = document.getElementById('status-text');
        if (statusIndicator && statusText) {
            if (connected) {
                statusIndicator.className = 'w-3 h-3 rounded-full bg-green-500';
                statusText.textContent = 'Connected';
            }
            else {
                statusIndicator.className = 'w-3 h-3 rounded-full bg-red-500';
                statusText.textContent = 'Disconnected';
            }
        }
    }
    updateOverviewStats(overview) {
        var _a, _b, _c, _d;
        const totalBrowsersEl = document.getElementById('total-browsers');
        const totalLogsEl = document.getElementById('total-logs');
        const totalErrorsEl = document.getElementById('total-errors');
        const activeSessionsEl = document.getElementById('active-sessions');
        if (totalBrowsersEl) {
            totalBrowsersEl.textContent = ((_a = overview.totalBrowsers) === null || _a === void 0 ? void 0 : _a.toString()) || '0';
        }
        if (totalLogsEl) {
            totalLogsEl.textContent = ((_b = overview.totalLogs) === null || _b === void 0 ? void 0 : _b.toString()) || '0';
        }
        if (totalErrorsEl) {
            totalErrorsEl.textContent = ((_c = overview.errorCount) === null || _c === void 0 ? void 0 : _c.toString()) || '0';
        }
        if (activeSessionsEl) {
            activeSessionsEl.textContent = ((_d = overview.totalBrowsers) === null || _d === void 0 ? void 0 : _d.toString()) || '0';
        }
    }
    renderBrowserWindows(browsers) {
        const gridContainer = document.getElementById('browser-grid');
        if (!gridContainer)
            return;
        gridContainer.innerHTML = '';
        browsers.forEach(browser => {
            const windowElement = this.createBrowserWindow(browser);
            gridContainer.appendChild(windowElement);
        });
    }
    createBrowserWindow(browser) {
        var _a, _b, _c, _d;
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
                    <span class="text-red-600">${((_a = browser.byLevel.error) === null || _a === void 0 ? void 0 : _a.count) || 0}</span>
                </div>
                <div class="flex justify-between">
                    <span>Warnings:</span>
                    <span class="text-yellow-600">${((_b = browser.byLevel.warn) === null || _b === void 0 ? void 0 : _b.count) || 0}</span>
                </div>
                <div class="flex justify-between">
                    <span>Info:</span>
                    <span class="text-blue-600">${((_c = browser.byLevel.info) === null || _c === void 0 ? void 0 : _c.count) || 0}</span>
                </div>
                <div class="flex justify-between">
                    <span>Debug:</span>
                    <span class="text-gray-600">${((_d = browser.byLevel.debug) === null || _d === void 0 ? void 0 : _d.count) || 0}</span>
                </div>
            </div>
            <div class="flex space-x-2">
                <button class="view-logs-btn bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm" data-browser-id="${browser.browserId}">
                    View Logs
                </button>
                <button class="clear-browser-logs-btn bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm" data-browser-id="${browser.browserId}">
                    Clear
                </button>
            </div>
        `;
        return windowDiv;
    }
    updateBrowserFilter(browsers) {
        const browserFilter = document.getElementById('browser-filter');
        if (!browserFilter)
            return;
        // Clear existing options except "All Browsers"
        browserFilter.innerHTML = '<option value="">All Browsers</option>';
        browsers.forEach(browser => {
            const option = document.createElement('option');
            option.value = browser.browserId;
            option.textContent = `Browser ${browser.browserId}`;
            browserFilter.appendChild(option);
        });
    }
    // Placeholder methods for functionality that will be implemented
    viewBrowserLogs(browserId) {
        console.log(`Viewing logs for browser ${browserId}`);
        this.currentBrowserId = browserId;
    }
    viewAllLogs() {
        console.log('Viewing all logs');
    }
    performSearch() {
        const searchInput = document.getElementById('search-input');
        const searchTerm = (searchInput === null || searchInput === void 0 ? void 0 : searchInput.value) || '';
        console.log(`Performing search for: ${searchTerm}`);
    }
    clearAllLogs() {
        console.log('Clearing all logs');
    }
}
// Initialize the dashboard when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new LogDashboard();
});
// Export for potential external use
window.LogDashboard = LogDashboard;
