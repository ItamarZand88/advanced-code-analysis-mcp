# Advanced Code Analysis MCP Server

🚀 **Advanced code analysis system with knowledge graph and AI insights**

A sophisticated MCP Server that combines Neo4j knowledge graphs, AI-powered analysis, and advanced static analysis for large-scale code projects.

## ✨ Key Features

- 🧠 **AI-Powered Analysis** with GPT-4/Claude for advanced insights
- 📊 **Advanced Knowledge Graph** with Neo4j for complex relationships
- 🔍 **Natural Language Queries** with no learning curve
- 🏗️ **Deep Architectural Analysis** 
- ⚡ **Parallel Processing** for large projects
- 🛡️ **Automated Security Analysis**
- 📈 **Comprehensive Quality Metrics**

## 🎯 Performance Targets

- **Up to 10M lines of code** in under 30 minutes
- **10+ concurrent analyses** 
- **Query response time < 1 second** for most queries
- **95%+ accuracy** in entity and relationship detection

## 🚀 Quick Setup

### System Requirements
- Node.js 18+
- Docker & Docker Compose
- 8GB+ RAM
- 100GB+ disk space

### Setup with Docker

```bash
# Clone the project
git clone https://github.com/ItamarZand88/advanced-code-analysis-mcp.git
cd advanced-code-analysis-mcp

# Setup environment configuration
cp .env.example .env
# Edit .env with your settings

# Run the system
docker-compose up -d

# Check status
curl http://localhost:3000/health
```

### Local Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run in development
npm run dev

# Run in production
npm start
```

## 📖 Basic Usage

### Repository Analysis

```typescript
import { MCPServer } from './dist/index.js';

const server = new MCPServer();

// Start analysis
const result = await server.analyzeRepository(
  'https://github.com/microsoft/vscode',
  'main',
  {
    includeTests: true,
    enableAIInsights: true,
    parallelWorkers: 8
  }
);

console.log(`Job ID: ${result.jobId}`);
```

### Natural Language Queries

```typescript
// Example queries
const queries = [
  'Show me the most complex functions in the system',
  'Find circular dependencies',
  'Which files are missing tests?',
  'Show me potential security vulnerabilities',
  'What are the main architectural patterns?'
];

for (const query of queries) {
  const result = await server.queryGraph(query, graphId);
  console.log(result.interpretation);
}
```

### Advanced API

```typescript
// Complexity analysis
const complexity = await server.getComplexityAnalysis(graphId);

// Dependency analysis
const dependencies = await server.getDependencyAnalysis(graphId);

// Quality assessment
const quality = await server.getQualityMetrics(graphId);

// Security analysis
const security = await server.getSecurityAnalysis(graphId);
```

## 🔧 Advanced Configuration

### Analysis Settings

```javascript
// .env
MAX_CONCURRENT_ANALYSES=10
PARALLEL_WORKERS=16
MAX_FILE_SIZE=50485760  // 50MB
INCLUDE_TESTS=true
ENABLE_AI_INSIGHTS=true
```

### AI Configuration

```javascript
AI_PROVIDER=openai
AI_MODEL=gpt-4
OPENAI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here
```

### Neo4j Configuration

```javascript
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=secure_password
NEO4J_DATABASE=codeanalysis
```

## 📊 Monitoring and Metrics

- **Neo4j Browser**: http://localhost:7474
- **Grafana Dashboard**: http://localhost:3001 (admin/admin)
- **Prometheus Metrics**: http://localhost:9091
- **Health Check**: http://localhost:3000/health

## 🎨 Usage Examples

### 1. Enterprise Code Audit
```
Analyze our main system for security issues and code smells
```

### 2. Developer Onboarding
```
Show me the core components and how they interact
```

### 3. Refactoring Planning
```
Find the most tightly coupled components and suggest where to break dependencies
```

### 4. Performance Analysis
```
Find bottlenecks and inefficient algorithms
```

## 🛠️ Development

### Running Tests

```bash
npm test
npm run test:watch
npm run test:coverage
```

### Code Quality and Linting

```bash
npm run lint
npm run lint:fix
npm run format
```

### Production Build

```bash
npm run build
npm run docker:build
```

## 📚 Additional Documentation

- [📖 API Documentation](./docs/api.md)
- [🏗️ Architecture Guide](./docs/architecture.md)
- [🔧 Configuration Reference](./docs/configuration.md)
- [🚀 Deployment Guide](./docs/deployment.md)
- [🤝 Contributing Guidelines](./CONTRIBUTING.md)

## 🤝 Contributing

1. Fork the project
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

## 🙋‍♂️ Support

- 📧 Email: support@code-analysis.com
- 💬 Discord: [Community Server](https://discord.gg/code-analysis)
- 🐛 Issues: [GitHub Issues](https://github.com/ItamarZand88/advanced-code-analysis-mcp/issues)
- 📖 Documentation: [Full Docs](https://docs.code-analysis.com)

---

**⭐ Don't forget to star the project if it helps you!**