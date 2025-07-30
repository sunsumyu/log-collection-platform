# Multi-Browser Log Collection Platform

一个基于 Fluentd + MongoDB + Elasticsearch + Kibana 的多浏览器日志收集整理过滤平台，支持按浏览器ID分流和多窗口显示。

## 🚀 功能特性

- **多浏览器支持**: 根据浏览器ID自动分流日志
- **实时监控**: WebSocket实时日志流
- **多窗口显示**: 每个浏览器ID独立显示窗口
- **搜索过滤**: 全文搜索和高级过滤
- **数据可视化**: 图表展示日志统计
- **导出功能**: 支持日志数据导出

## 🏗️ 技术架构

```
Node.js App → Winston Logger → MongoDB → Fluentd → Elasticsearch → Kibana
                                      ↓
                              (按browserId分流)
                                      ↓
                          browser1.logs, browser2.logs...
```

## 📦 安装部署

### 1. 克隆项目
```bash
git clone <repository-url>
cd log-collection-platform
```

### 2. 安装依赖
```bash
npm install
```

### 3. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env 文件配置数据库连接等
```

### 4. 使用 Docker Compose 启动服务
```bash
# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

### 5. 访问服务
- **Web Dashboard**: http://localhost:3000
- **Kibana**: http://localhost:5601
- **Elasticsearch**: http://localhost:9200
- **MongoDB**: mongodb://107.161.83.190:27017

## 🔧 手动启动（开发模式）

如果不使用 Docker，可以手动启动各个服务：

### 启动 MongoDB
```bash
mongod --dbpath ./data/db
```

### 启动 Elasticsearch
```bash
# 下载并启动 Elasticsearch 8.8.0
./bin/elasticsearch
```

### 启动 Kibana
```bash
# 下载并启动 Kibana 8.8.0
./bin/kibana
```

### 启动 Fluentd
```bash
# 安装 Fluentd 和插件
gem install fluentd
gem install fluent-plugin-elasticsearch
gem install fluent-plugin-mongo

# 启动 Fluentd
fluentd -c ./fluentd/conf/fluent.conf
```

### 启动 Web 应用
```bash
npm run dev
```

## 📊 使用方法

### 1. 发送日志到平台

#### 方法1: 通过 Winston (推荐)
```javascript
const winston = require('winston');
require('winston-mongodb');

const logger = winston.createLogger({
  transports: [
    new winston.transports.MongoDB({
      db: 'mongodb://admin:password@107.161.83.190:27017/logs?authSource=admin',
      collection: 'app_logs'
    })
  ]
});

// 发送日志
logger.info('任务开始', { 
  browserId: 'browser-001',
  action: 'task_start',
  metadata: { taskId: '12345' }
});
```

#### 方法2: 通过 API
```javascript
// POST /api/logs/test
fetch('/api/logs/test', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    browserId: 'browser-001',
    level: 'info',
    message: '测试日志消息',
    metadata: { source: 'api-test' }
  })
});
```

#### 方法3: 直接写入 MongoDB
```javascript
const { MongoClient } = require('mongodb');

const client = new MongoClient('mongodb://admin:password@107.161.83.190:27017');
const db = client.db('logs');
const collection = db.collection('app_logs');

await collection.insertOne({
  browserId: 'browser-001',
  level: 'info',
  message: '直接写入的日志',
  timestamp: new Date(),
  metadata: { source: 'direct' }
});
```

### 2. 查看日志

#### Web Dashboard
访问 http://localhost:3000 查看实时仪表板：
- 多浏览器窗口显示
- 实时日志流
- 统计图表
- 搜索功能

#### Kibana
访问 http://localhost:5601 进行高级分析：
- 创建索引模式: `logs-*`
- 按浏览器ID过滤: `browserId:"browser-001"`
- 时间范围分析
- 自定义仪表板

### 3. API 接口

#### 获取浏览器列表
```bash
GET /api/logs/browsers
```

#### 获取特定浏览器日志
```bash
GET /api/logs/browser/{browserId}?limit=100&level=error
```

#### 搜索日志
```bash
GET /api/logs/search?q=error&browserId=browser-001
```

#### 获取统计信息
```bash
GET /api/logs/browser/{browserId}/stats
```

## 🔍 Fluentd 配置说明

Fluentd 配置文件位于 `fluentd/conf/fluent.conf`，主要功能：

1. **数据源**: 从 MongoDB 读取日志
2. **分流**: 根据 `browserId` 字段分流
3. **输出**: 写入不同的 Elasticsearch 索引

```ruby
# 根据 browserId 分流
<match **>
  @type rewrite_tag_filter
  <rule>
    key browserId
    pattern ^(.+)$
    tag browser.${browserId}
  </rule>
</match>

# 输出到 Elasticsearch
<match browser.*>
  @type elasticsearch
  index_name logs-${tag[1]}-%Y.%m.%d
</match>
```

## 🛠️ 开发指南

### 项目结构
```
log-collection-platform/
├── src/
│   ├── index.js              # 主服务器
│   ├── services/
│   │   ├── LogService.js     # MongoDB 日志服务
│   │   └── ElasticsearchService.js  # ES 搜索服务
│   └── routes/
│       ├── logs.js           # 日志 API 路由
│       └── dashboard.js      # 仪表板 API
├── public/
│   ├── index.html           # 前端页面
│   └── dashboard.js         # 前端逻辑
├── fluentd/
│   ├── Dockerfile           # Fluentd 镜像
│   └── conf/fluent.conf     # Fluentd 配置
└── docker-compose.yml       # 服务编排
```

### 添加新功能

1. **新增日志字段**: 修改 `LogService.js` 中的数据模型
2. **新增 API**: 在 `routes/` 目录添加路由
3. **修改前端**: 更新 `public/dashboard.js`
4. **调整 Fluentd**: 修改 `fluentd/conf/fluent.conf`

## 🐛 故障排除

### 常见问题

1. **MongoDB 连接失败**
   ```bash
   # 检查 MongoDB 状态
   docker-compose logs mongodb
   
   # 重启 MongoDB
   docker-compose restart mongodb
   ```

2. **Elasticsearch 启动失败**
   ```bash
   # 检查内存设置
   docker stats
   
   # 调整 ES 内存限制
   # 编辑 docker-compose.yml 中的 ES_JAVA_OPTS
   ```

3. **Fluentd 无法连接**
   ```bash
   # 检查 Fluentd 日志
   docker-compose logs fluentd
   
   # 验证配置文件
   fluentd --dry-run -c ./fluentd/conf/fluent.conf
   ```

### 性能优化

1. **MongoDB 索引**
   ```javascript
   // 为常用查询字段创建索引
   db.app_logs.createIndex({ browserId: 1, timestamp: -1 });
   db.app_logs.createIndex({ level: 1, timestamp: -1 });
   ```

2. **Elasticsearch 映射**
   ```bash
   # 设置字段映射优化搜索
   PUT /logs-*/_mapping
   {
     "properties": {
       "browserId": { "type": "keyword" },
       "level": { "type": "keyword" },
       "message": { "type": "text", "analyzer": "standard" }
     }
   }
   ```

## 📝 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！
