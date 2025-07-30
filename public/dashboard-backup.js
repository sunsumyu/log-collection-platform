// Browser-compatible dashboard without external dependencies
class LogDashboard {
    constructor() {
        this.showMainThread = true;
        this.selectedLevel = '';
        this.currentBrowserId = null;
        this.activeBrowserWindows = new Map();
        this.logUpdateIntervals = new Map();
        this.browserDetectionInterval = null;
        this.browsers = new Map();
        this.charts = new Map();
        this.browserLogFilters = new Map(); // Store active filter for each browser
        this.init();
    }
    init() {
        this.setupEventListeners();
        this.loadInitialData();
        this.startPeriodicUpdates();
        this.startRealTimeBrowserDetection();
        this.updateConnectionStatus(true); // Always show as connected for HTTP polling
    }
    setupEventListeners() {
        // Browser filter change
        const browserFilter = document.getElementById('browser-filter');
        if (browserFilter) {
            browserFilter.addEventListener('change', (e) => {
                const target = e.target;
                // 直接触发加载该浏览器日志
                if (target.value) {
                    this.viewBrowserLogs(target.value);
                }
                else {
                    // 选择"All Browsers"时显示所有日志
                    this.viewAllLogs();
                    this.currentBrowserId = null;
                }
            });
        }
        // Level filter change
        const levelFilter = document.getElementById('level-filter');
        if (levelFilter) {
            levelFilter.addEventListener('change', (e) => {
                const target = e.target;
                this.selectedLevel = target.value;
                // Refresh current view with new level filter
                if (this.currentBrowserId) {
                    this.viewBrowserLogs(this.currentBrowserId);
                } else {
                    this.performSearch();
                }
            });
        }
        // MainThread toggle
        const mainThreadToggle = document.getElementById('mainthread-toggle');
        if (mainThreadToggle) {
            mainThreadToggle.addEventListener('change', (e) => {
                const target = e.target;
                this.showMainThread = target.checked;
                // Refresh current view if a browser is selected
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
        // Clear all logs
        const clearAllBtn = document.getElementById('clear-all-logs');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => {
                this.clearAllLogs();
            });
        }
        // Dynamic event delegation for browser-specific buttons
        document.addEventListener('click', (e) => {
            const target = e.target;
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
            
            // Get browser IDs first (fast query)
            const browsersResponse = await fetch('/api/logs/browsers');
            const browsersData = await browsersResponse.json();
            const browserIds = browsersData.browserIds || [];
            
            // Update basic stats immediately
            this.updateOverviewStats({
                totalBrowsers: browserIds.length,
                browsers: [],
                totalLogs: 0,
                errorCount: 0
            });
            
            // Load browser stats in parallel with limited data
            const browserPromises = browserIds.slice(0, 5).map(async (browserId) => {
                try {
                    // Use lighter stats endpoint with recent data only
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
                } catch (error) {
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
            
            // Load remaining browsers in background if there are more
            if (browserIds.length > 5) {
                this.loadRemainingBrowsersInBackground(browserIds.slice(5));
            }
            
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
    async loadRemainingBrowsersInBackground(remainingBrowserIds) {
        // Load remaining browsers in chunks to avoid overwhelming the server
        const chunkSize = 3;
        for (let i = 0; i < remainingBrowserIds.length; i += chunkSize) {
            const chunk = remainingBrowserIds.slice(i, i + chunkSize);
            const browserPromises = chunk.map(async (browserId) => {
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
                } catch (error) {
                    console.error(`Error loading background stats for browser ${browserId}:`, error);
                    return null;
                }
            });
            
            const browsers = (await Promise.all(browserPromises)).filter(b => b !== null);
            if (browsers.length > 0) {
                // Update browser filter and grid with new browsers
                this.updateBrowserFilter(browsers, true); // append mode
                this.renderBrowserWindows(browsers, true); // append mode
            }
            
            // Small delay between chunks to prevent server overload
            await new Promise(resolve => setTimeout(resolve, 500));
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
            this.createChart(browser.browserId, browser);
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
        viewLogsBtn === null || viewLogsBtn === void 0 ? void 0 : viewLogsBtn.addEventListener('click', () => {
            this.viewBrowserLogs(browser.browserId);
        });
        clearBtn === null || clearBtn === void 0 ? void 0 : clearBtn.addEventListener('click', () => {
            this.clearBrowserLogs(browser.browserId);
        });
        return windowDiv;
    }
    createChart(browserId, browser) {
        var _a, _b, _c, _d;
        // Simple chart creation - you can enhance this with Chart.js
        const canvas = document.getElementById(`chart-${browserId}`);
        if (!canvas)
            return;
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return;
        // Simple bar chart
        const data = [
            ((_a = browser.byLevel.error) === null || _a === void 0 ? void 0 : _a.count) || 0,
            ((_b = browser.byLevel.warn) === null || _b === void 0 ? void 0 : _b.count) || 0,
            ((_c = browser.byLevel.info) === null || _c === void 0 ? void 0 : _c.count) || 0,
            ((_d = browser.byLevel.debug) === null || _d === void 0 ? void 0 : _d.count) || 0
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
    updateBrowserFilter(browsers) {
        const filter = document.getElementById('browser-filter');
        if (!filter)
            return;
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
        const query = searchInput === null || searchInput === void 0 ? void 0 : searchInput.value.trim();
        const selectedBrowser = browserFilter === null || browserFilter === void 0 ? void 0 : browserFilter.value;
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
            }
            else if (query) {
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
        }
        catch (error) {
            console.error('Search error:', error);
            this.showError('Search failed');
        }
    }
    displaySearchResults(results) {
        const resultsContainer = document.getElementById('search-results');
        if (!resultsContainer)
            return;
        // Filter mainthread logs if toggle is off
        let filteredResults = results;
        if (!this.showMainThread) {
            filteredResults = results.filter(log => !log.isMainThread);
        }
        // Filter by selected level if specified
        if (this.selectedLevel) {
            filteredResults = filteredResults.filter(log => log.level && log.level.toLowerCase() === this.selectedLevel.toLowerCase());
        }
        resultsContainer.innerHTML = '';
        if (!filteredResults || filteredResults.length === 0) {
            resultsContainer.innerHTML = '<p class="text-gray-500">无日志</p>';
            return;
        }
        filteredResults.forEach((log) => {
            const logDiv = document.createElement('div');
            logDiv.className = `log-entry mb-1 p-3 rounded-md ${this.getLogEntryClass(log.level)} hover:bg-opacity-80 transition-colors duration-200`;
            
            // Format time in a more compact way
            const time = new Date(log.timestamp).toLocaleString('zh-CN', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            
            const level = log.level.toUpperCase();
            const browserInfo = log.isMainThread ? '[MainThread]' : (log.browserId ? `[Browser ${log.browserId}]` : '');
            
            // Merge all information into a single line with better spacing and contrast
            logDiv.innerHTML = `
                <div class="font-mono text-sm leading-relaxed">
                    <span class="${this.getTimeClass()}">${time}</span>
                    <span class="mx-2 font-bold ${this.getLevelColorClass(log.level)} px-2 py-1 rounded text-xs">${level}</span>
                    <span class="${this.getBrowserInfoClass(log.isMainThread)} font-medium">${browserInfo}</span>
                    <span class="ml-2 ${this.getMessageClass()}">${this.formatLogMessage(log.message)}</span>
                </div>
            `;
            resultsContainer.appendChild(logDiv);
        });
    }
    getLevelColor(level) {
        switch (level.toLowerCase()) {
            case 'error': return 'red';
            case 'warn': return 'yellow';
            case 'info': return 'blue';
            case 'debug': return 'gray';
            default: return 'gray';
        }
    }
    getLevelColorClass(level) {
        switch (level.toLowerCase()) {
            case 'error': return 'text-red-300';
            case 'warn': return 'text-yellow-300';
            case 'info': return 'text-blue-300';
            case 'debug': return 'text-gray-300';
            default: return 'text-gray-300';
        }
    }
    formatLogMessage(msg) {
        // Try to format multi-line or structured logs for readability
        if (!msg)
            return '';
        if (msg.startsWith('{') || msg.startsWith('[')) {
            try {
                return `<pre class='inline whitespace-pre-wrap'>${JSON.stringify(JSON.parse(msg), null, 2)}</pre>`;
            }
            catch (_a) {
                return msg;
            }
        }
        return msg.replace(/\n/g, '<br>');
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
    
    getLogEntryClass(level) {
        switch (level.toLowerCase()) {
            case 'error': return 'bg-gray-800 border-l-4 border-red-400';
            case 'warn': return 'bg-gray-800 border-l-4 border-yellow-400';
            case 'info': return 'bg-gray-800 border-l-4 border-blue-400';
            case 'debug': return 'bg-gray-800 border-l-4 border-gray-400';
            default: return 'bg-gray-800 border-l-4 border-gray-400';
        }
    }
    
    getTimeClass() {
        return 'text-gray-300 font-medium';
    }
    
    getBrowserInfoClass(isMainThread) {
        return isMainThread ? 'text-purple-300' : 'text-cyan-300';
    }
    
    getMessageClass() {
        return 'text-white font-medium';
    }
    clearLogDisplay() {
        const resultsContainer = document.getElementById('search-results');
        if (resultsContainer) {
            resultsContainer.innerHTML = '<p class="text-gray-500">请选择浏览器查看日志</p>';
        }
    }
    async viewAllLogs() {
        try {
            // Get all browser IDs first
            const browsersResponse = await fetch('/api/logs/browsers');
            const browsersData = await browsersResponse.json();
            const browserIds = browsersData.browserIds || [];
            // Fetch logs from all browsers
            let allLogs = [];
            for (const browserId of browserIds) {
                try {
                    const response = await fetch(`/api/logs/browser/${browserId}?limit=50`);
                    const data = await response.json();
                    const logs = data.logs || [];
                    allLogs = allLogs.concat(logs);
                }
                catch (error) {
                    console.error(`Error fetching logs for browser ${browserId}:`, error);
                }
            }
            // Sort logs by timestamp (newest first)
            allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            // Mark mainthread logs for toggle and formatting
            allLogs = allLogs.map((log) => (Object.assign(Object.assign({}, log), { isMainThread: !log.browserId })));
            this.displaySearchResults(allLogs);
            this.showSuccess(`显示所有浏览器日志 (${allLogs.length} 条)`);
        }
        catch (error) {
            console.error('Error viewing all logs:', error);
            this.showError('Failed to load all logs');
        }
    }
    async viewBrowserLogs(browserId) {
        try {
            this.currentBrowserId = browserId;
            // Fetch logs, including mainthread logs
            const response = await fetch(`/api/logs/browser/${browserId}?limit=50&includeMainThread=true`);
            const data = await response.json();
            let logs = data.logs || [];
            // Mark mainthread logs for toggle and formatting
            logs = logs.map((log) => (Object.assign(Object.assign({}, log), { isMainThread: !log.browserId })));
            this.displaySearchResults(logs);
            this.showSuccess(`显示 Browser ${browserId} 日志`);
        }
        catch (error) {
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
            }
            else {
                this.showError('Failed to clear browser logs');
            }
        }
        catch (error) {
            console.error('Error clearing browser logs:', error);
            this.showError('Failed to clear browser logs');
        }
    }
    showNewLogNotification(message) {
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
            }
            else {
                this.showError('Failed to clear logs');
            }
        }
        catch (error) {
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
        // Update dashboard every 30 seconds
        setInterval(() => {
            this.loadInitialData();
        }, 30000);
    }
    startRealTimeBrowserDetection() {
        // Check for new browsers every 5 seconds
        this.browserDetectionInterval = setInterval(() => {
            this.detectAndCreateBrowserWindows();
        }, 5000);
        // Initial detection
        this.detectAndCreateBrowserWindows();
    }
    async detectAndCreateBrowserWindows() {
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
        }
        catch (error) {
            console.error('Error detecting browsers:', error);
        }
    }
    createBrowserLogWindow(browserId) {
        const container = document.getElementById('real-time-logs-container');
        if (!container) {
            // Create container if it doesn't exist
            this.createRealTimeLogsContainer();
            
            // Check if container was successfully created after creation attempt
            const newContainer = document.getElementById('real-time-logs-container');
            if (!newContainer) {
                console.error('Failed to create real-time-logs-container');
                return null;
            }
            
            // Use the newly created container instead of recursing
            return this.createBrowserLogWindowWithContainer(browserId, newContainer);
        }
        
        return this.createBrowserLogWindowWithContainer(browserId, container);
    }
    
    createBrowserLogWindowWithContainer(browserId, container) {
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
            <button class="log-level-btn px-3 py-1 text-xs rounded border active" data-browser="${browserId}" data-level="all">全部</button>
            <button class="log-level-btn px-3 py-1 text-xs rounded border" data-browser="${browserId}" data-level="error">错误</button>
            <button class="log-level-btn px-3 py-1 text-xs rounded border" data-browser="${browserId}" data-level="warn">警告</button>
            <button class="log-level-btn px-3 py-1 text-xs rounded border" data-browser="${browserId}" data-level="info">信息</button>
            <button class="log-level-btn px-3 py-1 text-xs rounded border" data-browser="${browserId}" data-level="debug">调试</button>
        </div>
        <div id="logs-${browserId}" class="bg-gray-900 text-white p-3 rounded h-96 overflow-y-auto font-mono text-sm">
            <div class="text-gray-400">等待日志数据...</div>
        </div>
        <div class="mt-2 text-xs text-gray-500">
            最后更新: <span id="last-update-${browserId}">--</span>
        </div>
    `;
        container.appendChild(windowDiv);
        
        // Add event listeners for log level filter buttons
        const levelButtons = windowDiv.querySelectorAll('.log-level-btn');
        levelButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.target;
                const level = target.dataset.level;
                const browser = target.dataset.browser;
                
                // Update active button
                levelButtons.forEach(b => b.classList.remove('active'));
                target.classList.add('active');
                
                // Store the filter state for this browser
                this.browserLogFilters.set(browser, level);
                
                // Update logs with filter immediately
                this.updateBrowserLogsWithFilter(browser, level);
            });
        });
        
        // Initialize filter state for this browser
        this.browserLogFilters.set(browserId, 'all');
        
        // Start log updates for this browser
        this.startLogUpdatesForBrowser(browserId);
        this.activeBrowserWindows.set(browserId, windowDiv);
        return windowDiv;
    }
    removeBrowserLogWindow(browserId) {
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
    filterLogsAfterLatestMarker(logs) {
        // Find the latest browser entry marker log
        const markerPattern = /BaseTaskExecutor\.ts:211.*theoriq runSingleTaskTest-TaskIndex/;
        let latestMarkerIndex = -1;
        
        // Search from the end (most recent) to find the latest marker
        for (let i = logs.length - 1; i >= 0; i--) {
            if (logs[i].message && markerPattern.test(logs[i].message)) {
                latestMarkerIndex = i;
                break;
            }
        }
        
        // If marker found, return logs after the marker (including the marker)
        if (latestMarkerIndex >= 0) {
            return logs.slice(latestMarkerIndex).slice(0, 20); // Limit to 20 most recent
        }
        
        // If no marker found, return the most recent 20 logs
        return logs.slice(0, 20);
    }
    async updateBrowserLogsWithFilter(browserId, level) {
        try {
            let url = `/api/logs/browser/${browserId}?limit=100`;
            if (level && level !== 'all') {
                url += `&level=${level}`;
            }
            const response = await fetch(url);
            const data = await response.json();
            let logs = data.logs || [];
            
            // Filter logs to only show after the latest browser entry marker
            logs = this.filterLogsAfterLatestMarker(logs);
            
            const logsContainer = document.getElementById(`logs-${browserId}`);
            const lastUpdateElement = document.getElementById(`last-update-${browserId}`);
            
            if (logsContainer && logs.length > 0) {
                // Clear and add new logs
                logsContainer.innerHTML = '';
                logs.slice(0, 10).forEach((log) => {
                    const logDiv = document.createElement('div');
                    logDiv.className = 'mb-1 text-xs';
                    const time = this.parseUTCTime(log.timestamp);
                    const logLevel = log.level.toUpperCase();
                    const levelColor = this.getLevelColorClass(log.level).replace('text-', '');
                    logDiv.innerHTML = `
                        <span class="text-gray-400">${time}</span>
                        <span class="${this.getLevelColorClass(log.level)} font-bold ml-2">[${logLevel}]</span>
                        <span class="text-white ml-2">${this.truncateMessage(log.message, 80)}</span>
                    `;
                    logsContainer.appendChild(logDiv);
                });
                // Auto scroll to bottom
                logsContainer.scrollTop = logsContainer.scrollHeight;
            } else if (logsContainer) {
                logsContainer.innerHTML = '<div class="text-gray-400">没有找到符合条件的日志...</div>';
            }
            
            if (lastUpdateElement) {
                lastUpdateElement.textContent = new Date().toLocaleTimeString();
            }
        } catch (error) {
            console.error(`Error updating filtered logs for browser ${browserId}:`, error);
        }
    }
    createRealTimeLogsContainer() {
        const mainContainer = document.querySelector('.container');
        if (!mainContainer)
            return;
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
    startLogUpdatesForBrowser(browserId) {
        // Update logs every 1 second for more real-time effect
        const interval = setInterval(async () => {
            try {
                await this.updateBrowserLogs(browserId);
            } catch (error) {
                console.error(`Error in real-time update for browser ${browserId}:`, error);
            }
        }, 1000); // Reduced from 2000ms to 1000ms for faster updates
        
        this.logUpdateIntervals.set(browserId, interval);
        
        // Initial load
        this.updateBrowserLogs(browserId);
        
        // Add visibility change listener to pause/resume updates when tab is not visible
        if (!this.visibilityListener) {
            this.visibilityListener = () => {
                if (document.hidden) {
                    // Pause updates when tab is hidden
                    this.pauseAllLogUpdates();
                } else {
                    // Resume updates when tab becomes visible
                    this.resumeAllLogUpdates();
                }
            };
            document.addEventListener('visibilitychange', this.visibilityListener);
        }
    }
    pauseAllLogUpdates() {
        this.logUpdateIntervals.forEach((interval, browserId) => {
            clearInterval(interval);
        });
    }
    resumeAllLogUpdates() {
        this.logUpdateIntervals.forEach((interval, browserId) => {
            // Restart the interval for each browser
            this.startLogUpdatesForBrowser(browserId);
        });
    }
    async updateBrowserLogs(browserId) {
        try {
            // Get current filter for this browser
            const currentFilter = this.browserLogFilters.get(browserId) || 'all';
            
            // Get more logs to find the latest browser entry marker
            let url = `/api/logs/browser/${browserId}?limit=100`;
            if (currentFilter && currentFilter !== 'all') {
                url += `&level=${currentFilter}`;
            }
            
            const response = await fetch(url);
            const data = await response.json();
            let logs = data.logs || [];
            
            // Filter logs to only show after the latest browser entry marker
            logs = this.filterLogsAfterLatestMarker(logs);
            const logsContainer = document.getElementById(`logs-${browserId}`);
            const lastUpdateElement = document.getElementById(`last-update-${browserId}`);
            if (logsContainer && logs.length > 0) {
                // Clear and add new logs
                logsContainer.innerHTML = '';
                logs.slice(0, 10).forEach((log) => {
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
        }
        catch (error) {
            console.error(`Error updating logs for browser ${browserId}:`, error);
        }
    }
    parseUTCTime(ts) {
        if (!ts)
            return '';
        const date = new Date(ts.endsWith('Z') ? ts : ts + 'Z');
        return date.toLocaleTimeString();
    }
    truncateMessage(message, maxLength) {
        if (message.length <= maxLength)
            return message;
        return message.substring(0, maxLength) + '...';
    }
}
// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new LogDashboard();
});
