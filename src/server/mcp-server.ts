#!/usr/bin/env node

/**
 * Advanced Code Analysis MCP Server
 * Main entry point and MCP server implementation - Part 1
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { ConfigurationManager } from '@/config/index.js';
import { GraphDatabaseManager } from '@/graph/database.js';
import { AnalyzerFactory } from '@/analyzers/typescript.js';
import {
  AnalysisJob,
  AnalysisResult,
  CodeEntity,
  CodeRelationship,
  LanguageType
} from '@/types/index.js';
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import path from 'path';
import simpleGit from 'simple-git';
import glob from 'fast-glob';

/**
 * Advanced Code Analysis MCP Server
 */
class AdvancedCodeAnalysisMCPServer {
  private server: Server;
  private config: ConfigurationManager;
  private database: GraphDatabaseManager;
  private logger: winston.Logger;
  private activeJobs: Map<string, AnalysisJob> = new Map();
  private jobQueue: AnalysisJob[] = [];
  private isProcessingQueue = false;

  constructor() {
    // Initialize configuration
    this.config = new ConfigurationManager();
    
    // Setup logging
    this.setupLogging();
    
    // Initialize database
    this.database = new GraphDatabaseManager(
      this.config.getDatabaseConfig(),
      this.logger
    );

    // Initialize MCP server
    this.server = new Server(
      {
        name: 'advanced-code-analysis-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    this.setupServerHandlers();
  }

  /**
   * Setup Winston logging
   */
  private setupLogging(): void {
    const serverConfig = this.config.getServerConfig();
    
    const transports: winston.transport[] = [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      })
    ];

    if (serverConfig.logging.enableFileLogging) {
      transports.push(
        new winston.transports.File({
          filename: path.join(serverConfig.logging.logDirectory, 'error.log'),
          level: 'error',
          maxsize: parseInt(serverConfig.logging.maxFileSize) * 1024 * 1024,
          maxFiles: serverConfig.logging.maxFiles
        }),
        new winston.transports.File({
          filename: path.join(serverConfig.logging.logDirectory, 'combined.log'),
          maxsize: parseInt(serverConfig.logging.maxFileSize) * 1024 * 1024,
          maxFiles: serverConfig.logging.maxFiles
        })
      );
    }

    this.logger = winston.createLogger({
      level: serverConfig.logging.level,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports
    });

    this.logger.info('Advanced Code Analysis MCP Server initializing', {
      version: '1.0.0',
      nodeVersion: process.version
    });
  }

  /**
   * Setup MCP server request handlers
   */
  private setupServerHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'analyze_repository',
          description: 'Analyze a GitHub repository and generate knowledge graph',
          inputSchema: {
            type: 'object',
            properties: {
              repository_url: {
                type: 'string',
                description: 'GitHub repository URL to analyze'
              },
              branch: {
                type: 'string',
                description: 'Git branch to analyze (default: main)',
                default: 'main'
              },
              include_tests: {
                type: 'boolean',
                description: 'Include test files in analysis',
                default: false
              },
              include_private: {
                type: 'boolean',
                description: 'Include private members in analysis',
                default: false
              },
              parallel_workers: {
                type: 'number',
                description: 'Number of parallel workers for analysis',
                default: 8
              },
              enable_ai_insights: {
                type: 'boolean',
                description: 'Enable AI-powered code insights',
                default: true
              }
            },
            required: ['repository_url']
          }
        },
        {
          name: 'get_analysis_status',
          description: 'Get the status of an analysis job',
          inputSchema: {
            type: 'object',
            properties: {
              job_id: {
                type: 'string',
                description: 'Analysis job ID'
              }
            },
            required: ['job_id']
          }
        },
        {
          name: 'search_entities',
          description: 'Search for code entities in the knowledge graph',
          inputSchema: {
            type: 'object',
            properties: {
              graph_id: {
                type: 'string',
                description: 'Knowledge graph ID'
              },
              query: {
                type: 'string',
                description: 'Search query'
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results',
                default: 10
              }
            },
            required: ['graph_id', 'query']
          }
        }
      ]
    }));

    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: 'analysis://status',
          name: 'Analysis Status',
          description: 'Current status of the analysis server',
          mimeType: 'application/json'
        },
        {
          uri: 'analysis://health',
          name: 'Health Check',
          description: 'Health status of all system components',
          mimeType: 'application/json'
        }
      ]
    }));
  }

  /**
   * Initialize the server and database
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing MCP Server...');
      
      // Test database connection
      const isConnected = await this.database.testConnection();
      if (!isConnected) {
        throw new Error('Failed to connect to Neo4j database');
      }

      // Create database schema
      await this.database.createSchema();
      
      this.logger.info('MCP Server initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize MCP Server', { error });
      throw error;
    }
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    this.logger.info('MCP Server started and listening on stdio');
  }

  /**
   * Shutdown the server gracefully
   */
  async shutdown(): Promise<void> {
    try {
      this.logger.info('Shutting down MCP Server...');
      
      // Close database connection
      await this.database.close();
      
      // Clear active jobs
      this.activeJobs.clear();
      this.jobQueue.length = 0;
      
      this.logger.info('MCP Server shutdown complete');
    } catch (error) {
      this.logger.error('Error during shutdown', { error });
    }
  }
}

export default AdvancedCodeAnalysisMCPServer;