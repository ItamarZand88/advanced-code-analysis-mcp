/**
 * Analysis Engine - Part 3 (continued)
 * Core analysis functionality for processing repositories
 */

import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import path from 'path';
import simpleGit from 'simple-git';
import glob from 'fast-glob';
import { AnalyzerFactory } from '@/analyzers/typescript.js';
import { LanguageType, CodeEntity, CodeRelationship, AnalysisJob } from '@/types/index.js';

export class AnalysisEngine {
  /**
   * Process the analysis job queue
   */
  static async processJobQueue(instance: any): Promise<void> {
    if (instance.isProcessingQueue || instance.jobQueue.length === 0) {
      return;
    }

    instance.isProcessingQueue = true;
    instance.logger.info('Starting job queue processing');

    while (instance.jobQueue.length > 0) {
      const job = instance.jobQueue.shift()!;
      
      try {
        await this.executeAnalysisJob(instance, job);
      } catch (error) {
        instance.logger.error('Job execution failed', { jobId: job.id, error });
        job.status = 'failed';
        job.error = error instanceof Error ? error.message : 'Unknown error';
        job.endTime = new Date();
      }
    }

    instance.isProcessingQueue = false;
    instance.logger.info('Job queue processing completed');
  }

  /**
   * Execute a single analysis job
   */
  static async executeAnalysisJob(instance: any, job: AnalysisJob): Promise<void> {
    try {
      instance.logger.info('Executing analysis job', { jobId: job.id });
      
      job.status = 'running';
      job.progress = 10;

      // Step 1: Clone repository
      const tempDir = await this.cloneRepository(instance, job.repositoryUrl, job.branch);
      job.progress = 20;

      // Step 2: Discover files
      const files = await this.discoverFiles(instance, tempDir, job.config);
      job.metadata.totalFiles = files.length;
      job.progress = 30;

      // Step 3: Analyze files
      const { entities, relationships } = await this.analyzeFiles(instance, files, job);
      job.metadata.entitiesFound = entities.length;
      job.metadata.relationshipsFound = relationships.length;
      job.progress = 80;

      // Step 4: Store in database
      const graphId = `${job.id}_${Date.now()}`;
      await instance.database.storeEntities(entities, graphId);
      await instance.database.storeRelationships(relationships, graphId);
      job.progress = 100;

      // Complete the job
      job.status = 'completed';
      job.endTime = new Date();
      job.results = {
        jobId: job.id,
        graphId,
        entities,
        relationships,
        metrics: await this.calculateBasicMetrics(entities, relationships),
        insights: [], // Would be populated by AI analysis
        summary: {
          overview: {
            totalFiles: job.metadata.totalFiles,
            totalEntities: entities.length,
            totalRelationships: relationships.length,
            languages: [...new Set(entities.map(e => e.language))],
            analysisTime: job.endTime.getTime() - job.startTime.getTime()
          },
          qualityScore: 75, // Placeholder
          topIssues: [],
          recommendations: [],
          trends: {
            complexity: 'stable',
            maintainability: 'stable',
            testCoverage: 'stable'
          }
        }
      };

      instance.logger.info('Analysis job completed successfully', { 
        jobId: job.id,
        entitiesFound: entities.length,
        relationshipsFound: relationships.length
      });

      // Clean up temporary directory
      await fs.rm(tempDir, { recursive: true, force: true });

    } catch (error) {
      instance.logger.error('Analysis job failed', { jobId: job.id, error });
      throw error;
    }
  }

  /**
   * Clone repository to temporary directory
   */
  static async cloneRepository(instance: any, repositoryUrl: string, branch: string): Promise<string> {
    const tempDir = path.join('/tmp', `analysis_${uuidv4()}`);
    
    instance.logger.debug('Cloning repository', { repositoryUrl, branch, tempDir });
    
    const git = simpleGit();
    await git.clone(repositoryUrl, tempDir, ['--branch', branch, '--depth', '1']);
    
    return tempDir;
  }

  /**
   * Discover files for analysis
   */
  static async discoverFiles(instance: any, repoPath: string, config: any): Promise<string[]> {
    const patterns = [
      '**/*.ts',
      '**/*.tsx',
      '**/*.js',
      '**/*.jsx'
    ];

    if (config.includeTests) {
      patterns.push(
        '**/*.test.ts',
        '**/*.test.js',
        '**/*.spec.ts',
        '**/*.spec.js'
      );
    }

    const files = await glob(patterns, {
      cwd: repoPath,
      absolute: true,
      ignore: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/.git/**'
      ]
    });

    // Filter by file size
    const filteredFiles: string[] = [];
    for (const file of files) {
      try {
        const stats = await fs.stat(file);
        if (stats.size <= config.maxFileSize) {
          filteredFiles.push(file);
        }
      } catch (error) {
        instance.logger.warn('Failed to stat file', { file, error });
      }
    }

    return filteredFiles;
  }

  /**
   * Analyze discovered files
   */
  static async analyzeFiles(instance: any, files: string[], job: AnalysisJob): Promise<{
    entities: CodeEntity[];
    relationships: CodeRelationship[];
  }> {
    const entities: CodeEntity[] = [];
    const relationships: CodeRelationship[] = [];
    
    const batchSize = Math.ceil(files.length / job.config.parallelWorkers);
    const batches: string[][] = [];
    
    for (let i = 0; i < files.length; i += batchSize) {
      batches.push(files.slice(i, i + batchSize));
    }

    // Process batches in parallel
    const batchPromises = batches.map(async (batch, index) => {
      const analyzer = AnalyzerFactory.createAnalyzer(LanguageType.TYPESCRIPT, job.config, instance.logger);
      const batchEntities: CodeEntity[] = [];
      
      for (const file of batch) {
        try {
          const fileEntities = await analyzer.analyzeFile(file);
          batchEntities.push(...fileEntities);
          
          job.metadata.processedFiles++;
          job.progress = 30 + Math.floor((job.metadata.processedFiles / job.metadata.totalFiles) * 40);
          
        } catch (error) {
          instance.logger.warn('File analysis failed', { file, error });
          job.metadata.skippedFiles++;
        }
      }
      
      return batchEntities;
    });

    const batchResults = await Promise.all(batchPromises);
    
    // Combine results
    for (const batchEntities of batchResults) {
      entities.push(...batchEntities);
    }

    // Extract relationships
    if (entities.length > 0) {
      const analyzer = AnalyzerFactory.createAnalyzer(LanguageType.TYPESCRIPT, job.config, instance.logger);
      const extractedRelationships = await analyzer.extractRelationships(entities);
      relationships.push(...extractedRelationships);
    }

    return { entities, relationships };
  }

  /**
   * Calculate basic metrics
   */
  static async calculateBasicMetrics(entities: CodeEntity[], relationships: CodeRelationship[]): Promise<any> {
    const fileCount = entities.filter(e => e.type === 'File').length;
    const functionCount = entities.filter(e => e.type === 'Function').length;
    const classCount = entities.filter(e => e.type === 'Class').length;
    
    const complexities = entities
      .filter(e => e.properties.cyclomaticComplexity)
      .map(e => e.properties.cyclomaticComplexity);
    
    const avgComplexity = complexities.length > 0 
      ? complexities.reduce((a, b) => a + b, 0) / complexities.length 
      : 1;

    return {
      overall: {
        score: 75, // Placeholder
        grade: 'B',
        maintainabilityIndex: 70,
        technicalDebt: 40
      },
      complexity: {
        averageCyclomaticComplexity: avgComplexity,
        maxCyclomaticComplexity: Math.max(...complexities, 1),
        averageCognitiveComplexity: avgComplexity * 1.2,
        maxCognitiveComplexity: Math.max(...complexities, 1) * 1.2,
        complexityDistribution: {
          low: complexities.filter(c => c <= 5).length,
          medium: complexities.filter(c => c > 5 && c <= 10).length,
          high: complexities.filter(c => c > 10).length
        }
      },
      architecture: {
        layerViolations: 0,
        circularDependencies: 0,
        couplingScore: 0.5,
        cohesionScore: 0.7,
        abstractionLevel: 0.6
      },
      testing: {
        totalTests: 0,
        testCoverage: 0,
        testQuality: 0,
        mockUsage: 0
      },
      counts: {
        files: fileCount,
        functions: functionCount,
        classes: classCount,
        relationships: relationships.length
      }
    };
  }
}

export class QueryProcessor {
  /**
   * Convert natural language to Cypher query (simplified)
   */
  static convertNaturalLanguageToCypher(query: string, graphId: string): string {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('most complex') || lowerQuery.includes('highest complexity')) {
      return `
        MATCH (e:CodeEntity {graphId: $graph_id})
        WHERE e.cyclomaticComplexity IS NOT NULL
        RETURN e.name, e.type, e.cyclomaticComplexity
        ORDER BY e.cyclomaticComplexity DESC
        LIMIT 10
      `;
    }
    
    if (lowerQuery.includes('circular dependen')) {
      return `
        MATCH (start:CodeEntity {graphId: $graph_id})-[r:CodeRelationship*2..5]->(start)
        WHERE ALL(rel in r WHERE rel.type IN ['DEPENDS_ON', 'IMPORTS'])
        RETURN [node in nodes(path(start, r, start)) | node.name] as cycle
        LIMIT 5
      `;
    }
    
    if (lowerQuery.includes('function') && lowerQuery.includes('count')) {
      return `
        MATCH (e:CodeEntity {graphId: $graph_id, type: 'Function'})
        RETURN count(e) as functionCount
      `;
    }

    if (lowerQuery.includes('test') && lowerQuery.includes('coverage')) {
      return `
        MATCH (e:CodeEntity {graphId: $graph_id})
        WHERE e.type = 'Function'
        RETURN 
          count(e) as totalFunctions,
          count(CASE WHEN e.filePath CONTAINS 'test' OR e.filePath CONTAINS 'spec' THEN 1 END) as testFunctions,
          (count(CASE WHEN e.filePath CONTAINS 'test' OR e.filePath CONTAINS 'spec' THEN 1 END) * 100.0 / count(e)) as testCoverage
      `;
    }

    if (lowerQuery.includes('class') && (lowerQuery.includes('large') || lowerQuery.includes('big'))) {
      return `
        MATCH (e:CodeEntity {graphId: $graph_id, type: 'Class'})
        RETURN e.name, e.filePath, (e.endLine - e.startLine) as lineCount
        ORDER BY lineCount DESC
        LIMIT 10
      `;
    }

    if (lowerQuery.includes('file') && lowerQuery.includes('size')) {
      return `
        MATCH (e:CodeEntity {graphId: $graph_id, type: 'File'})
        RETURN e.name, e.filePath, e.lineCount
        ORDER BY e.lineCount DESC
        LIMIT 10
      `;
    }
    
    // Default query
    return `
      MATCH (e:CodeEntity {graphId: $graph_id})
      RETURN e.name, e.type, e.filePath
      LIMIT 10
    `;
  }

  /**
   * Get server status
   */
  static async getServerStatus(instance: any): Promise<any> {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      activeJobs: instance.activeJobs.size,
      queueSize: instance.jobQueue.length,
      configuration: {
        maxConcurrentAnalyses: instance.config.getAnalysisConfig().parallelWorkers,
        supportedLanguages: ['TypeScript', 'JavaScript', 'Python', 'Java'],
        aiEnabled: instance.config.getAIConfig().enabled,
        databaseConnected: await instance.database.testConnection()
      }
    };
  }

  /**
   * Get health status
   */
  static async getHealthStatus(instance: any): Promise<any> {
    const dbHealth = await instance.database.getHealthStatus();
    const config = instance.config.getConfig();
    
    return {
      status: dbHealth.healthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      components: {
        database: dbHealth,
        configuration: {
          healthy: true,
          details: {
            environment: process.env.NODE_ENV || 'development',
            logLevel: config.server.logging.level,
            maxWorkers: config.analysis.parallelWorkers
          }
        },
        memory: {
          healthy: true,
          details: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB',
            external: Math.round(process.memoryUsage().external / 1024 / 1024) + ' MB'
          }
        },
        uptime: {
          healthy: true,
          details: {
            seconds: Math.floor(process.uptime()),
            formatted: this.formatUptime(process.uptime())
          }
        }
      }
    };
  }

  /**
   * Format uptime in human readable format
   */
  static formatUptime(uptimeSeconds: number): string {
    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = Math.floor(uptimeSeconds % 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0) parts.push(`${seconds}s`);

    return parts.join(' ') || '0s';
  }
}