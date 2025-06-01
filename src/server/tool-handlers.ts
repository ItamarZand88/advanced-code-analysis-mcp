/**
 * MCP Server Tool Handlers - Part 2
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

// This is a continuation of the AdvancedCodeAnalysisMCPServer class
// Add these methods to the main class

export class MCPToolHandlers {
  /**
   * Complete the server handlers setup
   */
  static setupToolHandlers(server: any, instance: any): void {
    // Handle resource reading
    server.setRequestHandler('ReadResourceRequestSchema', async (request: any) => {
      const { uri } = request.params;

      switch (uri) {
        case 'analysis://status':
          return {
            contents: [{
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(await instance.getServerStatus(), null, 2)
            }]
          };

        case 'analysis://health':
          return {
            contents: [{
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(await instance.getHealthStatus(), null, 2)
            }]
          };

        default:
          throw new McpError(ErrorCode.InvalidRequest, `Unknown resource: ${uri}`);
      }
    });

    // Handle tool calls
    server.setRequestHandler('CallToolRequestSchema', async (request: any) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'analyze_repository':
            return await instance.analyzeRepository(args);

          case 'get_analysis_status':
            return await instance.getAnalysisStatus(args);

          case 'search_entities':
            return await instance.searchEntities(args);

          case 'find_dependencies':
            return await instance.findDependencies(args);

          case 'find_circular_dependencies':
            return await instance.findCircularDependencies(args);

          case 'get_graph_statistics':
            return await instance.getGraphStatistics(args);

          case 'query_natural_language':
            return await instance.queryNaturalLanguage(args);

          case 'get_complexity_analysis':
            return await instance.getComplexityAnalysis(args);

          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        instance.logger.error('Tool execution failed', { tool: name, error, args });
        
        if (error instanceof McpError) {
          throw error;
        }
        
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    });
  }

  /**
   * Analyze repository tool
   */
  static async analyzeRepository(instance: any, args: any): Promise<any> {
    const {
      repository_url,
      branch = 'main',
      include_tests = false,
      include_private = false,
      parallel_workers = 8,
      enable_ai_insights = true
    } = args;

    if (!repository_url) {
      throw new McpError(ErrorCode.InvalidParams, 'repository_url is required');
    }

    instance.logger.info('Starting repository analysis', {
      repository_url,
      branch,
      include_tests,
      include_private,
      parallel_workers,
      enable_ai_insights
    });

    const jobId = instance.generateJobId();
    const job = {
      id: jobId,
      repositoryUrl: repository_url,
      branch,
      status: 'pending',
      progress: 0,
      startTime: new Date(),
      config: {
        ...instance.config.getAnalysisConfig(),
        includeTests: include_tests,
        includeDocumentation: include_private,
        parallelWorkers: parallel_workers
      },
      metadata: {
        totalFiles: 0,
        processedFiles: 0,
        skippedFiles: 0,
        entitiesFound: 0,
        relationshipsFound: 0
      }
    };

    instance.activeJobs.set(jobId, job);
    instance.jobQueue.push(job);

    // Start processing queue if not already processing
    if (!instance.isProcessingQueue) {
      instance.processJobQueue();
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          message: 'Analysis job started successfully',
          job_id: jobId,
          status: 'pending',
          estimated_time: '5-30 minutes depending on repository size'
        }, null, 2)
      }]
    };
  }

  /**
   * Get analysis status tool
   */
  static async getAnalysisStatus(instance: any, args: any): Promise<any> {
    const { job_id } = args;

    if (!job_id) {
      throw new McpError(ErrorCode.InvalidParams, 'job_id is required');
    }

    const job = instance.activeJobs.get(job_id);
    if (!job) {
      throw new McpError(ErrorCode.InvalidParams, `Job ${job_id} not found`);
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(job, null, 2)
      }]
    };
  }

  /**
   * Search entities tool
   */
  static async searchEntities(instance: any, args: any): Promise<any> {
    const { graph_id, query, limit = 10 } = args;

    if (!graph_id || !query) {
      throw new McpError(ErrorCode.InvalidParams, 'graph_id and query are required');
    }

    try {
      const entities = await instance.database.searchEntities(query, graph_id, limit);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            message: `Found ${entities.length} entities`,
            entities,
            query,
            graph_id
          }, null, 2)
        }]
      };
    } catch (error) {
      instance.logger.error('Entity search failed', { error, graph_id, query });
      throw new McpError(ErrorCode.InternalError, `Entity search failed: ${error}`);
    }
  }

  /**
   * Find dependencies tool
   */
  static async findDependencies(instance: any, args: any): Promise<any> {
    const { graph_id, entity_id, direction = 'both' } = args;

    if (!graph_id || !entity_id) {
      throw new McpError(ErrorCode.InvalidParams, 'graph_id and entity_id are required');
    }

    try {
      const dependencies = await instance.database.findDependencies(entity_id, direction);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            message: `Found ${dependencies.length} dependencies`,
            dependencies,
            entity_id,
            direction
          }, null, 2)
        }]
      };
    } catch (error) {
      instance.logger.error('Find dependencies failed', { error, graph_id, entity_id });
      throw new McpError(ErrorCode.InternalError, `Find dependencies failed: ${error}`);
    }
  }

  /**
   * Find circular dependencies tool
   */
  static async findCircularDependencies(instance: any, args: any): Promise<any> {
    const { graph_id, max_cycles = 10 } = args;

    if (!graph_id) {
      throw new McpError(ErrorCode.InvalidParams, 'graph_id is required');
    }

    try {
      const cycles = await instance.database.findCircularDependencies(graph_id, max_cycles);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            message: `Found ${cycles.length} circular dependencies`,
            cycles,
            graph_id
          }, null, 2)
        }]
      };
    } catch (error) {
      instance.logger.error('Find circular dependencies failed', { error, graph_id });
      throw new McpError(ErrorCode.InternalError, `Find circular dependencies failed: ${error}`);
    }
  }

  /**
   * Get graph statistics tool
   */
  static async getGraphStatistics(instance: any, args: any): Promise<any> {
    const { graph_id } = args;

    if (!graph_id) {
      throw new McpError(ErrorCode.InvalidParams, 'graph_id is required');
    }

    try {
      const statistics = await instance.database.getGraphStatistics(graph_id);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            message: 'Graph statistics retrieved successfully',
            statistics,
            graph_id
          }, null, 2)
        }]
      };
    } catch (error) {
      instance.logger.error('Get graph statistics failed', { error, graph_id });
      throw new McpError(ErrorCode.InternalError, `Get graph statistics failed: ${error}`);
    }
  }

  /**
   * Natural language query tool
   */
  static async queryNaturalLanguage(instance: any, args: any): Promise<any> {
    const { graph_id, query } = args;

    if (!graph_id || !query) {
      throw new McpError(ErrorCode.InvalidParams, 'graph_id and query are required');
    }

    // Convert natural language to basic Cypher queries
    const cypherQuery = instance.convertNaturalLanguageToCypher(query, graph_id);
    
    try {
      const results = await instance.database.executeQuery(cypherQuery, { graph_id });
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            message: 'Natural language query processed',
            original_query: query,
            cypher_query: cypherQuery,
            results: results.slice(0, 10), // Limit results
            total_results: results.length
          }, null, 2)
        }]
      };
    } catch (error) {
      instance.logger.error('Natural language query failed', { error, graph_id, query });
      throw new McpError(ErrorCode.InternalError, `Natural language query failed: ${error}`);
    }
  }

  /**
   * Get complexity analysis tool
   */
  static async getComplexityAnalysis(instance: any, args: any): Promise<any> {
    const { graph_id } = args;

    if (!graph_id) {
      throw new McpError(ErrorCode.InvalidParams, 'graph_id is required');
    }

    try {
      const complexityQuery = `
        MATCH (e:CodeEntity {graphId: $graph_id})
        WHERE e.cyclomaticComplexity IS NOT NULL
        RETURN 
          e.type as entityType,
          e.name as entityName,
          e.cyclomaticComplexity as complexity,
          e.filePath as filePath
        ORDER BY e.cyclomaticComplexity DESC
        LIMIT 20
      `;

      const results = await instance.database.executeQuery(complexityQuery, { graph_id });
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            message: 'Complexity analysis completed',
            high_complexity_entities: results,
            graph_id
          }, null, 2)
        }]
      };
    } catch (error) {
      instance.logger.error('Complexity analysis failed', { error, graph_id });
      throw new McpError(ErrorCode.InternalError, `Complexity analysis failed: ${error}`);
    }
  }
}