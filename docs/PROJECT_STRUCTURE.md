# Log Collection Platform - Project Structure

## 📁 Organized Project Structure

```
log-collection-platform/
├── 📁 src/
│   ├── 📁 config/              # Configuration files
│   │   └── index.ts           # Centralized configuration
│   ├── 📁 controllers/        # Request handlers
│   │   └── LogController.ts   # Log-related endpoints
│   ├── 📁 middleware/         # Express middleware
│   │   ├── errorHandler.ts    # Error handling middleware
│   │   └── validation.ts      # Request validation
│   ├── 📁 routes/             # Route definitions
│   │   └── index.ts           # Centralized routes
│   ├── 📁 services/           # Business logic
│   │   ├── LogService.ts      # MongoDB operations
│   │   └── ElasticsearchService.ts # Elasticsearch operations
│   ├── 📁 types/              # TypeScript type definitions
│   │   └── index.ts           # Centralized types
│   ├── 📁 utils/              # Utility functions
│   └── app.ts                 # Main application file
├── 📁 public/                 # Static frontend files
│   ├── dashboard.js           # Dashboard JavaScript
│   └── index.html             # Main dashboard page
├── 📁 tests/                  # Test files
├── 📁 docs/                   # Documentation
│   └── PROJECT_STRUCTURE.md   # This file
├── 📁 fluentd/                # Fluentd configuration
├── 📁 dist/                   # Compiled JavaScript (auto-generated)
├── .env.example               # Environment variables template
├── docker-compose.yml         # Docker services configuration
├── Dockerfile                 # Application container
├── tsconfig.json              # TypeScript configuration
└── package.json               # Dependencies and scripts
```

## 🏗️ Architecture Overview

### **Clean Architecture Principles**
- **Controllers**: Handle HTTP requests/responses
- **Services**: Business logic and data operations
- **Middleware**: Cross-cutting concerns (validation, error handling)
- **Types**: Centralized type definitions
- **Config**: Environment-based configuration

### **Separation of Concerns**
- **Configuration**: Environment variables and settings
- **Business Logic**: Services handle core functionality
- **HTTP Layer**: Controllers and routes handle web requests
- **Error Handling**: Centralized error management
- **Validation**: Input validation and sanitization

## 🚀 Key Improvements

### **1. Type Safety**
- Centralized type definitions in `src/types/`
- Strict TypeScript configuration
- Proper interface definitions

### **2. Error Handling**
- Global error handler middleware
- Consistent error responses
- Proper logging with Pino

### **3. Code Organization**
- Feature-based folder structure
- Single responsibility principle
- Reusable components

### **4. Configuration Management**
- Environment-based configuration
- Centralized config file
- Type-safe configuration

### **5. API Design**
- RESTful API structure
- Consistent response format
- Proper HTTP status codes
- Input validation

## 📋 Available Scripts

```bash
npm run build        # Compile TypeScript
npm run start        # Start production server
npm run dev          # Start development server with hot reload
npm run test         # Run tests
npm run type-check   # Type checking without compilation
npm run docker:up    # Start Docker services
npm run docker:down  # Stop Docker services
```

## 🔧 Environment Variables

Create `.env` file based on `.env.example`:

```bash
PORT=3000
MONGODB_URI=mongodb://107.161.83.190:27017/on-chain-inter-logs
ELASTICSEARCH_URL=http://localhost:9200
LOG_LEVEL=info
```

## 🎯 Next Steps

1. **Testing**: Add comprehensive test suites
2. **Documentation**: Add API documentation
3. **Monitoring**: Add health checks and metrics
4. **Security**: Add authentication and authorization
5. **Performance**: Add caching and optimization
