#!/usr/bin/env node

/**
 * Advanced Code Analysis MCP Server
 * Main entry point - connects all components together
 */

import AdvancedCodeAnalysisMCPServer from './server/mcp-server.js';
import { MCPToolHandlers } from './server/tool-handlers.js';
import { AnalysisEngine, QueryProcessor } from './server/analysis-engine.js';
import { v4 as uuidv4 } from 'uuid';

// Extend the main server class with additional functionality
class CompleteAnalysisServer extends AdvancedCodeAnalysisMCPServer {
  constructor() {
    super();
    this.bindMethods();
  }

  /**
   * Bind methods from helper classes to this instance
   */
  private bindMethods(): void {
    // Bind tool handlers
    this.analyzeRepository = MCPToolHandlers.analyzeRepository.bind(null, this);
    this.getAnalysisStatus = MCPToolHandlers.getAnalysisStatus.bind(null, this);
    this.searchEntities = MCPToolHandlers.searchEntities.bind(null, this);
    this.findDependencies = MCPToolHandlers.findDependencies.bind(null, this);
    this.findCircularDependencies = MCPToolHandlers.findCircularDependencies.bind(null, this);
    this.getGraphStatistics = MCPToolHandlers.getGraphStatistics.bind(null, this);
    this.queryNaturalLanguage = MCPToolHandlers.queryNaturalLanguage.bind(null, this);
    this.getComplexityAnalysis = MCPToolHandlers.getComplexityAnalysis.bind(null, this);

    // Bind analysis engine methods
    this.processJobQueue = AnalysisEngine.processJobQueue.bind(null, this);
    this.executeAnalysisJob = AnalysisEngine.executeAnalysisJob.bind(null, this);

    // Bind query processor methods
    this.convertNaturalLanguageToCypher = QueryProcessor.convertNaturalLanguageToCypher;
    this.getServerStatus = QueryProcessor.getServerStatus.bind(null, this);
    this.getHealthStatus = QueryProcessor.getHealthStatus.bind(null, this);
  }

  /**
   * Generate unique job ID
   */
  generateJobId(): string {
    return uuidv4();
  }

  /**
   * Enhanced setup that includes all handlers
   */
  protected setupServerHandlers(): void {
    // Call parent setup first
    super.setupServerHandlers();
    
    // Add complete tool handlers
    MCPToolHandlers.setupToolHandlers(this.server, this);
  }

  // Method declarations for TypeScript
  analyzeRepository!: (args: any) => Promise<any>;
  getAnalysisStatus!: (args: any) => Promise<any>;
  searchEntities!: (args: any) => Promise<any>;
  findDependencies!: (args: any) => Promise<any>;
  findCircularDependencies!: (args: any) => Promise<any>;
  getGraphStatistics!: (args: any) => Promise<any>;
  queryNaturalLanguage!: (args: any) => Promise<any>;
  getComplexityAnalysis!: (args: any) => Promise<any>;
  processJobQueue!: () => Promise<void>;
  executeAnalysisJob!: (job: any) => Promise<void>;
  convertNaturalLanguageToCypher!: (query: string, graphId: string) => string;
  getServerStatus!: () => Promise<any>;
  getHealthStatus!: () => Promise<any>;
}

/**
 * Main function to start the server
 */
async function main(): Promise<void> {
  let server: CompleteAnalysisServer | null = null;

  try {
    console.log('🚀 Starting Advanced Code Analysis MCP Server...');
    
    // Create server instance
    server = new CompleteAnalysisServer();
    
    // Initialize
    await server.initialize();
    
    // Setup graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n📴 Received ${signal}, shutting down gracefully...`);
      if (server) {
        await server.shutdown();
      }
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('uncaughtException', (error) => {
      console.error('💥 Uncaught Exception:', error);
      if (server) {
        server.shutdown().finally(() => process.exit(1));
      } else {
        process.exit(1);
      }
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
      // Don't exit on unhandled rejection, just log it
    });

    // Start the server
    await server.start();
    
    console.log('✅ MCP Server is running and ready to accept connections');
    console.log('📡 Listening on stdio transport');
    console.log('🔗 Connect via your MCP client to start analyzing code repositories');
    
  } catch (error) {
    console.error('💥 Failed to start server:', error);
    
    if (server) {
      await server.shutdown();
    }
    
    process.exit(1);
  }
}

// Handle CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}

// Export for potential programmatic usage
export { CompleteAnalysisServer };
export default CompleteAnalysisServer;