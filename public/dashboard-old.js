"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var socket_io_client_1 = require("socket.io-client");
var LogDashboard = /** @class */ (function () {
    function LogDashboard() {
        this.socket = (0, socket_io_client_1.default)();
        this.browsers = new Map();
        this.charts = new Map();
        this.init();
    }
    LogDashboard.prototype.init = function () {
        this.setupSocketListeners();
        this.setupEventListeners();
        this.loadInitialData();
        this.startPeriodicUpdates();
    };
    LogDashboard.prototype.setupSocketListeners = function () {
        var _this = this;
        this.socket.on('connect', function () {
            _this.updateConnectionStatus(true);
        });
        this.socket.on('disconnect', function () {
            _this.updateConnectionStatus(false);
        });
        this.socket.on('log-update', function (logData) {
            _this.handleNewLog(logData);
        });
    };
    LogDashboard.prototype.setupEventListeners = function () {
        var _this = this;
        var refreshBtn = document.getElementById('refresh-btn');
        var clearLogsBtn = document.getElementById('clear-logs-btn');
        var searchBtn = document.getElementById('search-btn');
        var searchInput = document.getElementById('search-input');
        refreshBtn === null || refreshBtn === void 0 ? void 0 : refreshBtn.addEventListener('click', function () {
            _this.loadInitialData();
        });
        clearLogsBtn === null || clearLogsBtn === void 0 ? void 0 : clearLogsBtn.addEventListener('click', function () {
            _this.clearAllLogs();
        });
        searchBtn === null || searchBtn === void 0 ? void 0 : searchBtn.addEventListener('click', function () {
            _this.performSearch();
        });
        searchInput === null || searchInput === void 0 ? void 0 : searchInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                _this.performSearch();
            }
        });
    };
    LogDashboard.prototype.loadInitialData = function () {
        return __awaiter(this, void 0, void 0, function () {
            var overviewResponse, apiResponse, overviewData, overview, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, fetch('/api/overview')];
                    case 1:
                        overviewResponse = _a.sent();
                        return [4 /*yield*/, overviewResponse.json()];
                    case 2:
                        apiResponse = _a.sent();
                        overviewData = apiResponse.data || {};
                        overview = {
                            totalBrowsers: overviewData.totalBrowsers || 0,
                            browsers: overviewData.browsers || [],
                            // Pass through additional data from API
                            totalLogs: overviewData.totalLogs || 0,
                            errorCount: overviewData.errorCount || 0
                        };
                        this.updateOverviewStats(overview);
                        this.renderBrowserWindows(overview.browsers);
                        this.updateBrowserFilter(overview.browsers);
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        console.error('Error loading initial data:', error_1);
                        this.showError('Failed to load dashboard data');
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    LogDashboard.prototype.updateOverviewStats = function (overview) {
        var _a;
        var totalBrowsersEl = document.getElementById('total-browsers');
        var totalLogsEl = document.getElementById('total-logs');
        var totalErrorsEl = document.getElementById('total-errors');
        var activeSessionsEl = document.getElementById('active-sessions');
        if (totalBrowsersEl) {
            totalBrowsersEl.textContent = ((_a = overview.totalBrowsers) === null || _a === void 0 ? void 0 : _a.toString()) || '0';
        }
        // Get data from the API response (stored in overview)
        var apiData = overview;
        var totalLogs = apiData.totalLogs || 0;
        var totalErrors = apiData.errorCount || 0;
        // Calculate active sessions from browsers array
        var activeSessions = 0;
        var browsers = overview.browsers || [];
        browsers.forEach(function (browser) {
            var _a, _b;
            if ((_b = (_a = browser.byLevel) === null || _a === void 0 ? void 0 : _a.info) === null || _b === void 0 ? void 0 : _b.latestTimestamp) {
                var lastActivity = new Date(browser.byLevel.info.latestTimestamp);
                var fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
                if (lastActivity > fiveMinutesAgo) {
                    activeSessions++;
                }
            }
        });
        if (totalLogsEl)
            totalLogsEl.textContent = totalLogs.toLocaleString();
        if (totalErrorsEl)
            totalErrorsEl.textContent = totalErrors.toLocaleString();
        if (activeSessionsEl)
            activeSessionsEl.textContent = activeSessions.toString();
    };
    LogDashboard.prototype.renderBrowserWindows = function (browsers) {
        var _this = this;
        var grid = document.getElementById('browser-grid');
        if (!grid)
            return;
        grid.innerHTML = '';
        var browserArray = browsers || [];
        browserArray.forEach(function (browser) {
            var browserWindow = _this.createBrowserWindow(browser);
            grid.appendChild(browserWindow);
            _this.browsers.set(browser.browserId, browser);
            _this.createChart(browser.browserId, browser);
        });
    };
    LogDashboard.prototype.createBrowserWindow = function (browser) {
        var _a, _b, _c, _d, _e, _f;
        var div = document.createElement('div');
        div.className = 'browser-window';
        div.innerHTML = "\n            <div class=\"browser-header\">\n                <span class=\"browser-id\">".concat(browser.browserId, "</span>\n                <span class=\"log-count\">").concat(browser.total || 0, " logs</span>\n            </div>\n            <div class=\"browser-stats\">\n                <div class=\"stat\">\n                    <span class=\"label\">Errors:</span>\n                    <span class=\"value error\">").concat(((_b = (_a = browser.byLevel) === null || _a === void 0 ? void 0 : _a.error) === null || _b === void 0 ? void 0 : _b.count) || 0, "</span>\n                </div>\n                <div class=\"stat\">\n                    <span class=\"label\">Warnings:</span>\n                    <span class=\"value warning\">").concat(((_d = (_c = browser.byLevel) === null || _c === void 0 ? void 0 : _c.warn) === null || _d === void 0 ? void 0 : _d.count) || 0, "</span>\n                </div>\n                <div class=\"stat\">\n                    <span class=\"label\">Info:</span>\n                    <span class=\"value info\">").concat(((_f = (_e = browser.byLevel) === null || _e === void 0 ? void 0 : _e.info) === null || _f === void 0 ? void 0 : _f.count) || 0, "</span>\n                </div>\n            </div>\n            <canvas class=\"chart\" id=\"chart-").concat(browser.browserId, "\" width=\"300\" height=\"150\"></canvas>\n        ");
        return div;
    };
    LogDashboard.prototype.createChart = function (browserId, browser) {
        var canvas = document.getElementById("chart-".concat(browserId));
        if (!canvas)
            return;
        var ctx = canvas.getContext('2d');
        if (!ctx)
            return;
        // Simple chart rendering (placeholder for actual Chart.js implementation)
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    };
    LogDashboard.prototype.updateBrowserFilter = function (browsers) {
        var filter = document.getElementById('browser-filter');
        if (!filter)
            return;
        filter.innerHTML = '<option value="">All Browsers</option>';
        browsers.forEach(function (browser) {
            var option = document.createElement('option');
            option.value = browser.browserId;
            option.textContent = browser.browserId;
            filter.appendChild(option);
        });
    };
    LogDashboard.prototype.performSearch = function () {
        return __awaiter(this, void 0, void 0, function () {
            var searchInput, query, response, results, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        searchInput = document.getElementById('search-input');
                        query = searchInput === null || searchInput === void 0 ? void 0 : searchInput.value.trim();
                        if (!query) {
                            this.loadInitialData();
                            return [2 /*return*/];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, fetch("/api/logs/search?q=".concat(encodeURIComponent(query)))];
                    case 2:
                        response = _a.sent();
                        return [4 /*yield*/, response.json()];
                    case 3:
                        results = _a.sent();
                        this.displaySearchResults(results);
                        return [3 /*break*/, 5];
                    case 4:
                        error_2 = _a.sent();
                        console.error('Search error:', error_2);
                        this.showError('Search failed');
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    LogDashboard.prototype.displaySearchResults = function (results) {
        var resultsContainer = document.getElementById('search-results');
        if (!resultsContainer)
            return;
        resultsContainer.innerHTML = '';
        if (!results || results.length === 0) {
            resultsContainer.innerHTML = '<p>No results found</p>';
            return;
        }
        results.forEach(function (log) {
            var logDiv = document.createElement('div');
            logDiv.className = "log-entry ".concat(log.level);
            logDiv.innerHTML = "\n                <div class=\"log-timestamp\">".concat(new Date(log.timestamp).toLocaleString(), "</div>\n                <div class=\"log-level\">").concat(log.level.toUpperCase(), "</div>\n                <div class=\"log-message\">").concat(log.message, "</div>\n                ").concat(log.browserId ? "<div class=\"log-browser\">Browser: ".concat(log.browserId, "</div>") : '', "\n            ");
            resultsContainer.appendChild(logDiv);
        });
    };
    LogDashboard.prototype.handleNewLog = function (logData) {
        var notification = document.createElement('div');
        notification.className = 'log-notification';
        notification.innerHTML = "\n            <div class=\"notification-level ".concat(logData.level, "\">").concat(logData.level.toUpperCase(), "</div>\n            <div class=\"notification-message\">").concat(logData.message, "</div>\n            <div class=\"notification-browser\">").concat(logData.browserId || 'System', "</div>\n        ");
        var container = document.getElementById('notifications') || document.body;
        container.appendChild(notification);
        setTimeout(function () {
            notification.remove();
        }, 5000);
        this.loadInitialData();
    };
    LogDashboard.prototype.clearAllLogs = function () {
        return __awaiter(this, void 0, void 0, function () {
            var response, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!confirm('Are you sure you want to clear all logs?')) {
                            return [2 /*return*/];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, fetch('/api/logs', {
                                method: 'DELETE'
                            })];
                    case 2:
                        response = _a.sent();
                        if (response.ok) {
                            this.loadInitialData();
                            this.showSuccess('All logs cleared');
                        }
                        else {
                            this.showError('Failed to clear logs');
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        error_3 = _a.sent();
                        console.error('Clear logs error:', error_3);
                        this.showError('Failed to clear logs');
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    LogDashboard.prototype.updateConnectionStatus = function (connected) {
        var statusEl = document.getElementById('connection-status');
        if (statusEl) {
            statusEl.textContent = connected ? 'Connected' : 'Disconnected';
            statusEl.className = connected ? 'status connected' : 'status disconnected';
        }
    };
    LogDashboard.prototype.showError = function (message) {
        this.showNotification(message, 'error');
    };
    LogDashboard.prototype.showSuccess = function (message) {
        this.showNotification(message, 'success');
    };
    LogDashboard.prototype.showNotification = function (message, type) {
        var notification = document.createElement('div');
        notification.className = "notification ".concat(type);
        notification.textContent = message;
        var container = document.getElementById('notifications') || document.body;
        container.appendChild(notification);
        setTimeout(function () {
            notification.remove();
        }, 3000);
    };
    LogDashboard.prototype.startPeriodicUpdates = function () {
        var _this = this;
        setInterval(function () {
            _this.loadInitialData();
        }, 30000);
    };
    return LogDashboard;
}());
// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
    new LogDashboard();
});
