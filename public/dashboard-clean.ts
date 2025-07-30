// TypeScript Log Dashboard with Object-Oriented Design
// Clean implementation to replace the existing JavaScript dashboard

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
    hostname?: string;
    url?: string;
}

interface RealTimeLogWindow {
    browserId: string;
    element: HTMLElement;
    currentFilter: string;
    updateInterval: NodeJS.Timeout | null;
}

interface SearchFilters {
    searchTerm: string;
    browserId: string;
    hostname: string;
    dateFrom: string;
    dateTo: string;
    logLevel: string;
}

enum LogLevel {
    ALL = 'all',
    ERROR = 'error',
    WARN = 'warn',
    INFO = 'info',
    DEBUG = 'debug'
}

class RealTimeLogManager {
    private logWindows: Map<string, RealTimeLogWindow> = new Map();
    private containerElement: HTMLElement | null = null;
    private browserEntryMarkerPattern = /BaseTaskExecutor\.ts:211.*theoriq runSingleTaskTest-TaskIndex/;

    constructor() {
        this.initializeContainer();
    }

    private initializeContainer(): void {
        this.containerElement = document.getElementById('real-time-logs-container');
        if (!this.containerElement) {
            console.error('Real-time logs container not found');
        }
    }

    public createLogWindow(browserId: string): boolean {
        if (this.logWindows.has(browserId)) {
            return true;
        }

        if (!this.containerElement) {
            console.error('Container element not available');
            return false;
        }

        try {
            const windowElement = this.createWindowElement(browserId);
            this.containerElement.appendChild(windowElement);

            const logWindow: RealTimeLogWindow = {
                browserId,
                element: windowElement,
                currentFilter: 'all',
                updateInterval: null
            };

            this.logWindows.set(browserId, logWindow);
            this.setupLogLevelFilters(logWindow);
            this.startLogUpdates(logWindow);

            return true;
        } catch (error) {
            console.error(`Failed to create log window for ${browserId}:`, error);
            return false;
        }
    }

    private createWindowElement(browserId: string): HTMLElement {
        const windowDiv = document.createElement('div');
        windowDiv.className = 'real-time-log-window bg-white rounded-lg shadow-lg p-4 mb-4';
        windowDiv.id = `real-time-window-${browserId}`;

        windowDiv.innerHTML = `
            <div class="flex justify-between items-center mb-3">
                <h4 class="text-md font-semibold">Real-time Logs - Browser ${browserId}</h4>
                <div class="log-level-filters flex space-x-1">
                    <button class="filter-btn active" data-level="all">All</button>
                    <button class="filter-btn" data-level="error">Error</button>
                    <button class="filter-btn" data-level="warn">Warn</button>
                    <button class="filter-btn" data-level="info">Info</button>
                    <button class="filter-btn" data-level="debug">Debug</button>
                </div>
            </div>
            <div class="log-content bg-gray-50 rounded p-3 h-64 overflow-y-auto font-mono text-sm" id="log-content-${browserId}">
                <div class="text-gray-500 text-center">Loading logs...</div>
            </div>
        `;

        return windowDiv;
    }

    private setupLogLevelFilters(logWindow: RealTimeLogWindow): void {
        const filterButtons = logWindow.element.querySelectorAll('.filter-btn');
        filterButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                const level = target.getAttribute('data-level') || 'all';
                
                // Update active state
                filterButtons.forEach(btn => btn.classList.remove('active'));
                target.classList.add('active');
                
                // Update filter
                logWindow.currentFilter = level;
                this.updateLogsForWindow(logWindow);
            });
        });
    }

    private startLogUpdates(logWindow: RealTimeLogWindow): void {
        // Initial load
        this.updateLogsForWindow(logWindow);
        
        // Set up periodic updates
        logWindow.updateInterval = setInterval(() => {
            this.updateLogsForWindow(logWindow);
        }, 2000);
    }

    private async updateLogsForWindow(logWindow: RealTimeLogWindow): Promise<void> {
        try {
            const response = await fetch(`/api/logs/browser/${logWindow.browserId}`);
            const logs: LogEntry[] = await response.json();
            
            // Filter logs after latest browser entry marker
            const filteredLogs = this.filterLogsAfterLatestMarker(logs);
            
            // Apply level filter
            const levelFilteredLogs = logWindow.currentFilter === 'all' 
                ? filteredLogs 
                : filteredLogs.filter(log => log.level === logWindow.currentFilter);

            const logContent = document.getElementById(`log-content-${logWindow.browserId}`);
            if (logContent) {
                if (levelFilteredLogs.length === 0) {
                    logContent.innerHTML = '<div class="text-gray-500 text-center">No logs found</div>';
                } else {
                    logContent.innerHTML = levelFilteredLogs
                        .slice(-20) // Show latest 20 logs
                        .map(log => `
                            <div class="log-entry mb-1 p-1 rounded ${this.getLevelColorClass(log.level)}">
                                <span class="text-xs text-gray-500">${this.parseUTCTime(log.timestamp)}</span>
                                <span class="font-semibold ml-2">[${log.level.toUpperCase()}]</span>
                                <span class="ml-2">${this.truncateMessage(log.message, 100)}</span>
                            </div>
                        `).join('');
                    
                    // Auto-scroll to bottom
                    logContent.scrollTop = logContent.scrollHeight;
                }
            }
        } catch (error) {
            console.error(`Error updating logs for ${logWindow.browserId}:`, error);
        }
    }

    private filterLogsAfterLatestMarker(logs: LogEntry[]): LogEntry[] {
        let latestMarkerIndex = -1;
        
        for (let i = logs.length - 1; i >= 0; i--) {
            if (this.browserEntryMarkerPattern.test(logs[i].message)) {
                latestMarkerIndex = i;
                break;
            }
        }
        
        return latestMarkerIndex >= 0 ? logs.slice(latestMarkerIndex + 1) : logs;
    }

    private parseUTCTime(ts: string): string {
        try {
            return new Date(ts).toLocaleTimeString();
        } catch {
            return ts;
        }
    }

    private getLevelColorClass(level: string): string {
        const colorMap: { [key: string]: string } = {
            error: 'bg-red-100 border-l-4 border-red-500',
            warn: 'bg-yellow-100 border-l-4 border-yellow-500',
            info: 'bg-blue-100 border-l-4 border-blue-500',
            debug: 'bg-gray-100 border-l-4 border-gray-500'
        };
        return colorMap[level] || 'bg-gray-100';
    }

    private truncateMessage(message: string, maxLength: number): string {
        return message.length > maxLength ? message.substring(0, maxLength) + '...' : message;
    }

    public removeLogWindow(browserId: string): void {
        const logWindow = this.logWindows.get(browserId);
        if (logWindow) {
            if (logWindow.updateInterval) {
                clearInterval(logWindow.updateInterval);
            }
            logWindow.element.remove();
            this.logWindows.delete(browserId);
        }
    }

    public pauseAllUpdates(): void {
        this.logWindows.forEach(window => {
            if (window.updateInterval) {
                clearInterval(window.updateInterval);
                window.updateInterval = null;
            }
        });
    }

    public resumeAllUpdates(): void {
        this.logWindows.forEach(window => {
            if (!window.updateInterval) {
                this.startLogUpdates(window);
            }
        });
    }
}

class LogSearchManager {
    private searchResults: LogEntry[] = [];
    private currentGroupBy: 'none' | 'hostname' | 'date' = 'none';

    constructor() {
        this.setupAdvancedSearchUI();
    }

    private setupAdvancedSearchUI(): void {
        const searchContainer = document.getElementById('search-container');
        if (!searchContainer) return;

        // Add advanced search controls
        const advancedControls = document.createElement('div');
        advancedControls.className = 'advanced-search-controls mt-4 p-4 bg-gray-50 rounded-lg';
        advancedControls.innerHTML = `
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Hostname</label>
                    <input type="text" id="hostname-filter" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="Filter by hostname">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Date From</label>
                    <input type="date" id="date-from-filter" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Date To</label>
                    <input type="date" id="date-to-filter" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Log Level</label>
                    <select id="level-filter" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                        <option value="">All Levels</option>
                        <option value="error">Error</option>
                        <option value="warn">Warning</option>
                        <option value="info">Info</option>
                        <option value="debug">Debug</option>
                    </select>
                </div>
            </div>
            <div class="mt-4 flex justify-between items-center">
                <div class="flex space-x-2">
                    <button id="group-by-hostname" class="px-3 py-2 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600">Group by Hostname</button>
                    <button id="group-by-date" class="px-3 py-2 bg-green-500 text-white rounded-md text-sm hover:bg-green-600">Group by Date</button>
                    <button id="clear-grouping" class="px-3 py-2 bg-gray-500 text-white rounded-md text-sm hover:bg-gray-600">Clear Grouping</button>
                </div>
                <button id="advanced-search-btn" class="px-4 py-2 bg-purple-500 text-white rounded-md text-sm hover:bg-purple-600">Advanced Search</button>
            </div>
        `;

        searchContainer.appendChild(advancedControls);
        this.setupAdvancedSearchListeners();
    }

    private setupAdvancedSearchListeners(): void {
        const groupByHostnameBtn = document.getElementById('group-by-hostname');
        const groupByDateBtn = document.getElementById('group-by-date');
        const clearGroupingBtn = document.getElementById('clear-grouping');
        const advancedSearchBtn = document.getElementById('advanced-search-btn');

        groupByHostnameBtn?.addEventListener('click', () => {
            this.currentGroupBy = 'hostname';
            this.renderSearchResults();
        });

        groupByDateBtn?.addEventListener('click', () => {
            this.currentGroupBy = 'date';
            this.renderSearchResults();
        });

        clearGroupingBtn?.addEventListener('click', () => {
            this.currentGroupBy = 'none';
            this.renderSearchResults();
        });

        advancedSearchBtn?.addEventListener('click', () => {
            this.performAdvancedSearch();
        });
    }

    public async performSearch(searchTerm: string, browserId?: string): Promise<void> {
        this.showSearchLoading();

        try {
            const params = new URLSearchParams({
                q: searchTerm,
                ...(browserId && { browserId })
            });

            const response = await fetch(`/api/logs/search?${params}`);
            if (!response.ok) {
                throw new Error(`Search failed: ${response.statusText}`);
            }

            this.searchResults = await response.json();
            this.renderSearchResults();
        } catch (error) {
            console.error('Search error:', error);
            this.showSearchError('Search failed. Please try again.');
        }
    }

    private async performAdvancedSearch(): Promise<void> {
        const filters = this.getSearchFilters();
        this.showSearchLoading();

        try {
            const params = new URLSearchParams();
            Object.entries(filters).forEach(([key, value]) => {
                if (value) params.append(key, value);
            });

            const response = await fetch(`/api/logs/search?${params}`);
            if (!response.ok) {
                throw new Error(`Advanced search failed: ${response.statusText}`);
            }

            this.searchResults = await response.json();
            this.renderSearchResults();
        } catch (error) {
            console.error('Advanced search error:', error);
            this.showSearchError('Advanced search failed. Please try again.');
        }
    }

    private getSearchFilters(): SearchFilters {
        return {
            searchTerm: (document.getElementById('search-input') as HTMLInputElement)?.value || '',
            browserId: (document.getElementById('browser-filter') as HTMLSelectElement)?.value || '',
            hostname: (document.getElementById('hostname-filter') as HTMLInputElement)?.value || '',
            dateFrom: (document.getElementById('date-from-filter') as HTMLInputElement)?.value || '',
            dateTo: (document.getElementById('date-to-filter') as HTMLInputElement)?.value || '',
            logLevel: (document.getElementById('level-filter') as HTMLSelectElement)?.value || ''
        };
    }

    private renderSearchResults(): void {
        const resultsContainer = document.getElementById('search-results');
        if (!resultsContainer) return;

        if (this.searchResults.length === 0) {
            resultsContainer.innerHTML = `
                <div class="text-gray-500 text-center py-8">
                    <span class="text-4xl mb-2 block">🔍</span>
                    <p>No logs found matching your search criteria</p>
                </div>
            `;
            return;
        }

        resultsContainer.innerHTML = `
            <div class="search-results-header mb-4">
                <h3 class="text-lg font-semibold">Search Results (${this.searchResults.length} logs found)</h3>
                <p class="text-sm text-gray-600">Grouping: ${this.currentGroupBy === 'none' ? 'None' : this.currentGroupBy}</p>
            </div>
            <div class="search-results-content max-h-96 overflow-y-auto"></div>
        `;

        const contentContainer = resultsContainer.querySelector('.search-results-content') as HTMLElement;
        
        if (this.currentGroupBy === 'none') {
            this.renderFlatResults(contentContainer);
        } else {
            this.renderGroupedResults(contentContainer);
        }
    }

    private renderFlatResults(container: HTMLElement): void {
        container.innerHTML = this.searchResults
            .map((log, index) => this.createLogElement(log, index).outerHTML)
            .join('');
    }

    private renderGroupedResults(container: HTMLElement): void {
        const groups = this.groupLogs();
        
        container.innerHTML = Object.entries(groups)
            .map(([groupKey, logs]) => `
                <div class="group-section mb-6">
                    <h4 class="text-md font-semibold mb-3 p-2 bg-gray-100 rounded">${groupKey} (${logs.length} logs)</h4>
                    <div class="group-logs space-y-2">
                        ${logs.map((log, index) => this.createLogElement(log, index, true).outerHTML).join('')}
                    </div>
                </div>
            `).join('');
    }

    private groupLogs(): { [key: string]: LogEntry[] } {
        const groups: { [key: string]: LogEntry[] } = {};

        this.searchResults.forEach(log => {
            let groupKey: string;
            
            if (this.currentGroupBy === 'hostname') {
                groupKey = log.hostname || 'Unknown Hostname';
            } else if (this.currentGroupBy === 'date') {
                groupKey = new Date(log.timestamp).toDateString();
            } else {
                groupKey = 'All Logs';
            }

            if (!groups[groupKey]) {
                groups[groupKey] = [];
            }
            groups[groupKey].push(log);
        });

        return groups;
    }

    private createLogElement(log: LogEntry, index: number, compact: boolean = false): HTMLElement {
        const logDiv = document.createElement('div');
        logDiv.className = `log-entry p-3 border rounded-lg ${this.getLevelColorClass(log.level)} ${compact ? 'text-sm' : ''}`;
        
        const searchTerm = (document.getElementById('search-input') as HTMLInputElement)?.value || '';
        const highlightedMessage = this.highlightSearchTerm(log.message);

        logDiv.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <div class="flex items-center space-x-2">
                    <span class="log-level font-semibold px-2 py-1 rounded text-xs ${this.getLevelColorClass(log.level)}">${log.level.toUpperCase()}</span>
                    ${log.browserId ? `<span class="browser-id text-xs bg-gray-200 px-2 py-1 rounded">Browser ${log.browserId}</span>` : ''}
                    ${log.hostname ? `<span class="hostname text-xs bg-blue-100 px-2 py-1 rounded">${log.hostname}</span>` : ''}
                </div>
                <span class="timestamp text-xs text-gray-500">${new Date(log.timestamp).toLocaleString()}</span>
            </div>
            <div class="log-message ${compact ? 'text-sm' : ''}">${highlightedMessage}</div>
            ${log.metadata ? `<div class="metadata mt-2 text-xs text-gray-600">Metadata: ${JSON.stringify(log.metadata, null, 2)}</div>` : ''}
        `;

        return logDiv;
    }

    private highlightSearchTerm(message: string): string {
        const searchTerm = (document.getElementById('search-input') as HTMLInputElement)?.value || '';
        if (!searchTerm.trim()) return message;

        const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return message.replace(regex, '<mark class="bg-yellow-200">$1</mark>');
    }

    private getLevelColorClass(level: string): string {
        const colorMap: { [key: string]: string } = {
            error: 'border-red-300 bg-red-50',
            warn: 'border-yellow-300 bg-yellow-50',
            info: 'border-blue-300 bg-blue-50',
            debug: 'border-gray-300 bg-gray-50'
        };
        return colorMap[level] || 'border-gray-300 bg-gray-50';
    }

    private showSearchLoading(): void {
        const resultsContainer = document.getElementById('search-results');
        if (resultsContainer) {
            resultsContainer.innerHTML = `
                <div class="text-center py-8">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p class="text-gray-500">Searching logs...</p>
                </div>
            `;
        }
    }

    private showSearchError(message: string): void {
        const resultsContainer = document.getElementById('search-results');
        if (resultsContainer) {
            resultsContainer.innerHTML = `
                <div class="text-center py-8">
                    <span class="text-4xl mb-2 block text-red-500">⚠️</span>
                    <p class="text-red-600">${message}</p>
                </div>
            `;
        }
    }
}

class LogDashboard {
    private browsers: Map<string, BrowserStats>;
    private showMainThread: boolean = true;
    private currentBrowserId: string | null = null;
    private browserDetectionInterval: NodeJS.Timeout | null = null;
    private realTimeLogManager: RealTimeLogManager;
    private searchManager: LogSearchManager;
    private visibilityListener: (() => void) | null = null;

    constructor() {
        this.browsers = new Map<string, BrowserStats>();
        this.realTimeLogManager = new RealTimeLogManager();
        this.searchManager = new LogSearchManager();
        this.init();
    }

    private async init(): Promise<void> {
        this.setupEventListeners();
        this.setupVisibilityListener();
        await this.loadInitialData();
        this.startRealTimeBrowserDetection();
        this.startPeriodicUpdates();
        this.updateConnectionStatus(true);
    }
    
    private setupVisibilityListener(): void {
        if (!this.visibilityListener) {
            this.visibilityListener = () => {
                if (document.hidden) {
                    this.realTimeLogManager.pauseAllUpdates();
                } else {
                    this.realTimeLogManager.resumeAllUpdates();
                }
            };
            document.addEventListener('visibilitychange', this.visibilityListener);
        }
    }

    private setupEventListeners(): void {
        // Browser filter change
        const browserFilter = document.getElementById('browser-filter') as HTMLSelectElement;
        browserFilter?.addEventListener('change', (e) => {
            const target = e.target as HTMLSelectElement;
            this.currentBrowserId = target.value || null;
        });

        // Search functionality
        const searchBtn = document.getElementById('search-btn');
        const searchInput = document.getElementById('search-input') as HTMLInputElement;
        
        searchBtn?.addEventListener('click', () => this.performSearch());
        searchInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performSearch();
            }
        });

        // Clear logs functionality
        const clearAllBtn = document.getElementById('clear-all-logs');
        clearAllBtn?.addEventListener('click', () => this.clearAllLogs());

        // View all logs functionality
        const viewAllBtn = document.getElementById('view-all-logs');
        viewAllBtn?.addEventListener('click', () => this.viewAllLogs());

        // Dynamic event delegation for browser window buttons
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
    }

    private async loadInitialData(): Promise<void> {
        try {
            this.showLoadingState();
            
            const response = await fetch('/api/logs/overview');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const overview: OverviewData = await response.json();
            
            // Update browsers map
            this.browsers.clear();
            overview.browsers.forEach(browser => {
                this.browsers.set(browser.browserId, browser);
            });
            
            // Update UI
            this.updateOverviewStats(overview);
            this.renderBrowserWindows(overview.browsers);
            this.updateBrowserFilter(overview.browsers);
            this.createRealTimeLogWindows(overview.browsers);
            
            this.hideLoadingState();
        } catch (error) {
            console.error('Error loading initial data:', error);
            this.hideLoadingState();
        }
    }
    
    private showLoadingState(): void {
        const statsElements = ['total-browsers', 'total-logs', 'total-errors', 'active-sessions'];
        statsElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.innerHTML = '<div class="animate-pulse bg-gray-200 h-6 w-12 rounded"></div>';
            }
        });
    }
    
    private hideLoadingState(): void {
        // Loading state will be hidden when actual data is updated
    }
    
    private createRealTimeLogWindows(browsers: BrowserStats[]): void {
        browsers.forEach(browser => {
            const success = this.realTimeLogManager.createLogWindow(browser.browserId);
            if (success) {
                console.log(`Real-time log window created for browser ${browser.browserId}`);
            } else {
                console.error(`Failed to create real-time log window for browser ${browser.browserId}`);
            }
        });
    }
    
    private startRealTimeBrowserDetection(): void {
        if (this.browserDetectionInterval) {
            clearInterval(this.browserDetectionInterval);
        }
        
        this.browserDetectionInterval = setInterval(async () => {
            await this.detectAndCreateBrowserWindows();
        }, 5000);
        
        this.detectAndCreateBrowserWindows();
    }

    private async detectAndCreateBrowserWindows(): Promise<void> {
        try {
            const response = await fetch('/api/logs/overview');
            const overview: OverviewData = await response.json();
            
            for (const browser of overview.browsers) {
                const browserId = browser.browserId;
                if (!this.browsers.has(browserId)) {
                    this.browsers.set(browserId, browser);
                    this.realTimeLogManager.createLogWindow(browserId);
                }
            }
        } catch (error) {
            console.error('Error detecting browsers:', error);
        }
    }
    
    private startPeriodicUpdates(): void {
        setInterval(() => {
            this.loadInitialData();
        }, 10000);
    }
    
    private updateConnectionStatus(connected: boolean): void {
        const statusIndicator = document.getElementById('status-indicator');
        const statusText = document.getElementById('status-text');
        
        if (statusIndicator && statusText) {
            if (connected) {
                statusIndicator.className = 'w-3 h-3 rounded-full bg-green-500';
                statusText.textContent = 'Connected';
            } else {
                statusIndicator.className = 'w-3 h-3 rounded-full bg-red-500';
                statusText.textContent = 'Disconnected';
            }
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

    private updateBrowserFilter(browsers: BrowserStats[]): void {
        const browserFilter = document.getElementById('browser-filter') as HTMLSelectElement;
        if (!browserFilter) return;

        // Clear existing options except "All Browsers"
        browserFilter.innerHTML = '<option value="">All Browsers</option>';
        
        browsers.forEach(browser => {
            const option = document.createElement('option');
            option.value = browser.browserId;
            option.textContent = `Browser ${browser.browserId}`;
            browserFilter.appendChild(option);
        });
    }

    // Search and log management methods
    private viewBrowserLogs(browserId: string): void {
        console.log(`Viewing logs for browser ${browserId}`);
        this.currentBrowserId = browserId;
    }

    private viewAllLogs(): void {
        console.log('Viewing all logs');
    }

    private async performSearch(): Promise<void> {
        const searchInput = document.getElementById('search-input') as HTMLInputElement;
        const browserFilter = document.getElementById('browser-filter') as HTMLSelectElement;
        const searchTerm = searchInput?.value || '';
        const browserId = browserFilter?.value || '';
        
        if (!searchTerm.trim()) {
            this.showSearchMessage('Please enter a search term');
            return;
        }
        
        await this.searchManager.performSearch(searchTerm, browserId);
    }
    
    private showSearchMessage(message: string): void {
        const resultsContainer = document.getElementById('search-results');
        if (resultsContainer) {
            resultsContainer.innerHTML = `
                <div class="text-gray-500 text-center py-8">
                    <span class="text-4xl mb-2 block">🔍</span>
                    <p>${message}</p>
                </div>
            `;
        }
    }

    private clearAllLogs(): void {
        console.log('Clearing all logs');
    }

    private clearBrowserLogs(browserId: string): void {
        console.log(`Clearing logs for browser ${browserId}`);
    }
}

// Initialize the dashboard when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new LogDashboard();
});

// Export for potential external use
(window as any).LogDashboard = LogDashboard;
