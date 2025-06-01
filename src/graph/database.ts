/**
 * Neo4j Graph Database Manager for Advanced Code Analysis
 */

import neo4j, { Driver, Session, Result, Record } from 'neo4j-driver';
import { DatabaseConfig, CodeEntity, CodeRelationship, DatabaseError } from '@/types/index.js';
import winston from 'winston';

export class GraphDatabaseManager {
  private driver: Driver;
  private config: DatabaseConfig;
  private logger: winston.Logger;

  constructor(config: DatabaseConfig, logger?: winston.Logger) {
    this.config = config;
    this.logger = logger || winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [new winston.transports.Console()]
    });

    this.initializeDriver();
  }

  /**
   * Initialize Neo4j driver with configuration
   */
  private initializeDriver(): void {
    try {
      this.driver = neo4j.driver(
        this.config.uri,
        neo4j.auth.basic(this.config.username, this.config.password),
        {
          maxConnectionPoolSize: this.config.maxConnectionPoolSize,
          connectionAcquisitionTimeout: this.config.connectionAcquisitionTimeout,
          maxConnectionLifetime: this.config.maxConnectionLifetime,
          logging: this.config.enableQueryLogging ? {
            level: 'debug',
            logger: (level, message) => this.logger.log(level, message)
          } : undefined
        }
      );

      this.logger.info('Neo4j driver initialized successfully', {
        uri: this.config.uri,
        database: this.config.database
      });
    } catch (error) {
      this.logger.error('Failed to initialize Neo4j driver', { error });
      throw new DatabaseError('Failed to initialize Neo4j driver', undefined, { error });
    }
  }

  /**
   * Test database connectivity
   */
  async testConnection(): Promise<boolean> {
    const session = this.driver.session({ database: this.config.database });
    
    try {
      await session.run('RETURN 1 as test');
      this.logger.info('Database connection test successful');
      return true;
    } catch (error) {
      this.logger.error('Database connection test failed', { error });
      return false;
    } finally {
      await session.close();
    }
  }

  /**
   * Create database schema with constraints and indexes
   */
  async createSchema(): Promise<void> {
    const session = this.driver.session({ database: this.config.database });
    
    try {
      this.logger.info('Creating database schema...');

      // Create constraints
      await this.createConstraints(session);
      
      // Create indexes
      await this.createIndexes(session);
      
      // Create full-text search indexes
      await this.createFullTextIndexes(session);

      this.logger.info('Database schema created successfully');
    } catch (error) {
      this.logger.error('Failed to create database schema', { error });
      throw new DatabaseError('Failed to create database schema', undefined, { error });
    } finally {
      await session.close();
    }
  }

  /**
   * Create database constraints
   */
  private async createConstraints(session: Session): Promise<void> {
    const constraints = [
      // Entity constraints
      'CREATE CONSTRAINT entity_id_unique IF NOT EXISTS FOR (e:CodeEntity) REQUIRE e.id IS UNIQUE',
      'CREATE CONSTRAINT file_path_unique IF NOT EXISTS FOR (f:File) REQUIRE f.filePath IS UNIQUE',
      'CREATE CONSTRAINT function_qualified_name IF NOT EXISTS FOR (fn:Function) REQUIRE fn.qualifiedName IS UNIQUE',
      'CREATE CONSTRAINT class_qualified_name IF NOT EXISTS FOR (c:Class) REQUIRE c.qualifiedName IS UNIQUE',
      
      // Relationship constraints
      'CREATE CONSTRAINT relationship_id_unique IF NOT EXISTS FOR ()-[r:CodeRelationship]-() REQUIRE r.id IS UNIQUE',
      
      // Analysis job constraints
      'CREATE CONSTRAINT job_id_unique IF NOT EXISTS FOR (j:AnalysisJob) REQUIRE j.id IS UNIQUE'
    ];

    for (const constraint of constraints) {
      try {
        await session.run(constraint);
        this.logger.debug('Created constraint', { constraint });
      } catch (error) {
        this.logger.warn('Failed to create constraint (may already exist)', { constraint, error });
      }
    }
  }

  /**
   * Create database indexes for performance
   */
  private async createIndexes(session: Session): Promise<void> {
    const indexes = [
      // Entity indexes
      'CREATE INDEX entity_type_index IF NOT EXISTS FOR (e:CodeEntity) ON (e.type)',
      'CREATE INDEX entity_language_index IF NOT EXISTS FOR (e:CodeEntity) ON (e.language)',
      'CREATE INDEX entity_graph_id_index IF NOT EXISTS FOR (e:CodeEntity) ON (e.graphId)',
      'CREATE INDEX file_extension_index IF NOT EXISTS FOR (f:File) ON (f.extension)',
      
      // Complexity indexes
      'CREATE INDEX function_complexity_index IF NOT EXISTS FOR (fn:Function) ON (fn.cyclomaticComplexity)',
      'CREATE INDEX class_coupling_index IF NOT EXISTS FOR (c:Class) ON (c.couplingScore)',
      
      // Relationship indexes
      'CREATE INDEX relationship_type_index IF NOT EXISTS FOR ()-[r:CodeRelationship]-() ON (r.type)',
      'CREATE INDEX relationship_strength_index IF NOT EXISTS FOR ()-[r:CodeRelationship]-() ON (r.strength)',
      'CREATE INDEX relationship_graph_id_index IF NOT EXISTS FOR ()-[r:CodeRelationship]-() ON (r.graphId)',
      
      // Composite indexes for complex queries
      'CREATE INDEX entity_type_language_index IF NOT EXISTS FOR (e:CodeEntity) ON (e.type, e.language)',
      'CREATE INDEX entity_type_complexity_index IF NOT EXISTS FOR (e:CodeEntity) ON (e.type, e.complexity)',
      'CREATE INDEX relationship_type_strength_index IF NOT EXISTS FOR ()-[r:CodeRelationship]-() ON (r.type, r.strength)',
      
      // Temporal indexes
      'CREATE INDEX entity_created_at_index IF NOT EXISTS FOR (e:CodeEntity) ON (e.createdAt)',
      'CREATE INDEX relationship_created_at_index IF NOT EXISTS FOR ()-[r:CodeRelationship]-() ON (r.createdAt)'
    ];

    for (const index of indexes) {
      try {
        await session.run(index);
        this.logger.debug('Created index', { index });
      } catch (error) {
        this.logger.warn('Failed to create index (may already exist)', { index, error });
      }
    }
  }

  /**
   * Create full-text search indexes
   */
  private async createFullTextIndexes(session: Session): Promise<void> {
    const fullTextIndexes = [
      'CREATE FULLTEXT INDEX entity_search IF NOT EXISTS FOR (e:CodeEntity) ON EACH [e.name, e.description, e.docstring]',
      'CREATE FULLTEXT INDEX code_search IF NOT EXISTS FOR (f:Function|c:Class|i:Interface) ON EACH [f.name, c.name, i.name, f.docstring, c.docstring, i.docstring]',
      'CREATE FULLTEXT INDEX file_content_search IF NOT EXISTS FOR (f:File) ON EACH [f.name, f.filePath]'
    ];

    for (const index of fullTextIndexes) {
      try {
        await session.run(index);
        this.logger.debug('Created full-text index', { index });
      } catch (error) {
        this.logger.warn('Failed to create full-text index (may already exist)', { index, error });
      }
    }
  }

  /**
   * Store analysis entities in batches
   */
  async storeEntities(entities: CodeEntity[], graphId: string): Promise<void> {
    const session = this.driver.session({ database: this.config.database });
    const batchSize = this.config.batchSize;
    
    try {
      this.logger.info('Storing entities', { count: entities.length, graphId });

      for (let i = 0; i < entities.length; i += batchSize) {
        const batch = entities.slice(i, i + batchSize);
        await this.storeEntityBatch(session, batch, graphId);
        
        this.logger.debug('Stored entity batch', { 
          batch: Math.floor(i / batchSize) + 1, 
          total: Math.ceil(entities.length / batchSize),
          entities: batch.length 
        });
      }

      this.logger.info('All entities stored successfully', { count: entities.length });
    } catch (error) {
      this.logger.error('Failed to store entities', { error, graphId });
      throw new DatabaseError('Failed to store entities', undefined, { error, graphId });
    } finally {
      await session.close();
    }
  }

  /**
   * Store a batch of entities
   */
  private async storeEntityBatch(session: Session, entities: CodeEntity[], graphId: string): Promise<void> {
    const query = `
      UNWIND $entities AS entity
      CREATE (e:CodeEntity)
      SET e = entity.properties,
          e.id = entity.id,
          e.name = entity.name,
          e.type = entity.type,
          e.language = entity.language,
          e.filePath = entity.filePath,
          e.startLine = entity.startLine,
          e.endLine = entity.endLine,
          e.graphId = $graphId,
          e.createdAt = datetime(entity.metadata.createdAt),
          e.updatedAt = datetime(entity.metadata.updatedAt),
          e.version = entity.metadata.version,
          e.hash = entity.metadata.hash
      RETURN count(e) as created
    `;

    try {
      const result = await session.run(query, { entities, graphId });
      const created = result.records[0]?.get('created') || 0;
      this.logger.debug('Entity batch stored', { created });
    } catch (error) {
      this.logger.error('Failed to store entity batch', { error, entitiesCount: entities.length });
      throw error;
    }
  }

  /**
   * Store analysis relationships in batches
   */
  async storeRelationships(relationships: CodeRelationship[], graphId: string): Promise<void> {
    const session = this.driver.session({ database: this.config.database });
    const batchSize = this.config.batchSize;
    
    try {
      this.logger.info('Storing relationships', { count: relationships.length, graphId });

      for (let i = 0; i < relationships.length; i += batchSize) {
        const batch = relationships.slice(i, i + batchSize);
        await this.storeRelationshipBatch(session, batch, graphId);
        
        this.logger.debug('Stored relationship batch', { 
          batch: Math.floor(i / batchSize) + 1, 
          total: Math.ceil(relationships.length / batchSize),
          relationships: batch.length 
        });
      }

      this.logger.info('All relationships stored successfully', { count: relationships.length });
    } catch (error) {
      this.logger.error('Failed to store relationships', { error, graphId });
      throw new DatabaseError('Failed to store relationships', undefined, { error, graphId });
    } finally {
      await session.close();
    }
  }

  /**
   * Store a batch of relationships
   */
  private async storeRelationshipBatch(session: Session, relationships: CodeRelationship[], graphId: string): Promise<void> {
    const query = `
      UNWIND $relationships AS rel
      MATCH (source:CodeEntity {id: rel.sourceId, graphId: $graphId})
      MATCH (target:CodeEntity {id: rel.targetId, graphId: $graphId})
      CREATE (source)-[r:CodeRelationship]->(target)
      SET r = rel.properties,
          r.id = rel.id,
          r.type = rel.type,
          r.strength = rel.strength,
          r.confidence = rel.confidence,
          r.graphId = $graphId,
          r.createdAt = datetime(rel.metadata.createdAt),
          r.detectionMethod = rel.metadata.detectionMethod
      RETURN count(r) as created
    `;

    try {
      const result = await session.run(query, { relationships, graphId });
      const created = result.records[0]?.get('created') || 0;
      this.logger.debug('Relationship batch stored', { created });
    } catch (error) {
      this.logger.error('Failed to store relationship batch', { error, relationshipsCount: relationships.length });
      throw error;
    }
  }

  /**
   * Execute a Cypher query
   */
  async executeQuery(query: string, parameters: Record<string, any> = {}): Promise<Record[]> {
    const session = this.driver.session({ database: this.config.database });
    
    try {
      const startTime = Date.now();
      const result = await session.run(query, parameters);
      const executionTime = Date.now() - startTime;
      
      if (executionTime > this.config.slowQueryThreshold) {
        this.logger.warn('Slow query detected', { query, executionTime, parameters });
      }
      
      this.logger.debug('Query executed', { executionTime, recordCount: result.records.length });
      return result.records;
    } catch (error) {
      this.logger.error('Query execution failed', { error, query, parameters });
      throw new DatabaseError('Query execution failed', query, parameters);
    } finally {
      await session.close();
    }
  }

  /**
   * Search entities using full-text search
   */
  async searchEntities(searchTerm: string, graphId: string, limit: number = 10): Promise<CodeEntity[]> {
    const query = `
      CALL db.index.fulltext.queryNodes("entity_search", $searchTerm)
      YIELD node, score
      WHERE node.graphId = $graphId
      RETURN node
      ORDER BY score DESC
      LIMIT $limit
    `;

    try {
      const records = await this.executeQuery(query, { searchTerm, graphId, limit });
      return records.map(record => this.recordToEntity(record.get('node')));
    } catch (error) {
      this.logger.error('Entity search failed', { error, searchTerm, graphId });
      throw new DatabaseError('Entity search failed', query, { searchTerm, graphId, limit });
    }
  }

  /**
   * Find dependencies for an entity
   */
  async findDependencies(
    entityId: string, 
    direction: 'incoming' | 'outgoing' | 'both' = 'both'
  ): Promise<CodeRelationship[]> {
    let relationshipPattern = '';
    
    switch (direction) {
      case 'incoming':
        relationshipPattern = '()-[r:CodeRelationship]->(entity)';
        break;
      case 'outgoing':
        relationshipPattern = '(entity)-[r:CodeRelationship]->()';
        break;
      case 'both':
        relationshipPattern = '(entity)-[r:CodeRelationship]-()';
        break;
    }
    
    const query = `
      MATCH (entity:CodeEntity {id: $entityId})
      MATCH ${relationshipPattern}
      RETURN r
      ORDER BY r.strength DESC
    `;

    try {
      const records = await this.executeQuery(query, { entityId });
      return records.map(record => this.recordToRelationship(record.get('r')));
    } catch (error) {
      this.logger.error('Find dependencies failed', { error, entityId, direction });
      throw new DatabaseError('Find dependencies failed', query, { entityId, direction });
    }
  }

  /**
   * Find circular dependencies in the graph
   */
  async findCircularDependencies(graphId: string, maxCycles: number = 10): Promise<string[][]> {
    const query = `
      MATCH (start:CodeEntity {graphId: $graphId})-[r:CodeRelationship*2..10]->(start)
      WHERE ALL(rel in r WHERE rel.type IN ['DEPENDS_ON', 'IMPORTS', 'CALLS'])
      WITH [node in nodes(path(start, r, start)) | node.name] as cycle
      RETURN DISTINCT cycle
      LIMIT $maxCycles
    `;

    try {
      const records = await this.executeQuery(query, { graphId, maxCycles });
      return records.map(record => record.get('cycle'));
    } catch (error) {
      this.logger.error('Find circular dependencies failed', { error, graphId });
      throw new DatabaseError('Find circular dependencies failed', query, { graphId, maxCycles });
    }
  }

  /**
   * Get graph statistics
   */
  async getGraphStatistics(graphId: string): Promise<any> {
    const query = `
      MATCH (n:CodeEntity {graphId: $graphId})
      OPTIONAL MATCH (n)-[r:CodeRelationship {graphId: $graphId}]->()
      RETURN 
        count(DISTINCT n) as totalNodes,
        count(DISTINCT r) as totalRelationships,
        collect(DISTINCT n.type) as nodeTypes,
        collect(DISTINCT r.type) as relationshipTypes,
        collect(DISTINCT n.language) as languages,
        avg(n.complexity) as avgComplexity,
        max(n.complexity) as maxComplexity
    `;

    try {
      const records = await this.executeQuery(query, { graphId });
      const record = records[0];
      
      if (!record) {
        return {
          totalNodes: 0,
          totalRelationships: 0,
          nodeTypes: [],
          relationshipTypes: [],
          languages: []
        };
      }

      return {
        totalNodes: record.get('totalNodes').toNumber(),
        totalRelationships: record.get('totalRelationships').toNumber(),
        nodeTypes: record.get('nodeTypes').filter(Boolean),
        relationshipTypes: record.get('relationshipTypes').filter(Boolean),
        languages: record.get('languages').filter(Boolean),
        avgComplexity: record.get('avgComplexity'),
        maxComplexity: record.get('maxComplexity')
      };
    } catch (error) {
      this.logger.error('Get graph statistics failed', { error, graphId });
      throw new DatabaseError('Get graph statistics failed', query, { graphId });
    }
  }

  /**
   * Delete a graph and all its entities
   */
  async deleteGraph(graphId: string): Promise<void> {
    const session = this.driver.session({ database: this.config.database });
    
    try {
      this.logger.info('Deleting graph', { graphId });

      // Delete relationships first
      await session.run(
        'MATCH ()-[r:CodeRelationship {graphId: $graphId}]-() DELETE r',
        { graphId }
      );

      // Delete entities
      await session.run(
        'MATCH (n:CodeEntity {graphId: $graphId}) DELETE n',
        { graphId }
      );

      this.logger.info('Graph deleted successfully', { graphId });
    } catch (error) {
      this.logger.error('Failed to delete graph', { error, graphId });
      throw new DatabaseError('Failed to delete graph', undefined, { error, graphId });
    } finally {
      await session.close();
    }
  }

  /**
   * Convert Neo4j record to CodeEntity
   */
  private recordToEntity(node: any): CodeEntity {
    return {
      id: node.properties.id,
      name: node.properties.name,
      type: node.properties.type,
      language: node.properties.language,
      filePath: node.properties.filePath,
      startLine: node.properties.startLine?.toNumber() || 0,
      endLine: node.properties.endLine?.toNumber() || 0,
      properties: node.properties.properties || {},
      metadata: {
        createdAt: new Date(node.properties.createdAt),
        updatedAt: new Date(node.properties.updatedAt),
        version: node.properties.version,
        hash: node.properties.hash
      }
    };
  }

  /**
   * Convert Neo4j record to CodeRelationship
   */
  private recordToRelationship(relationship: any): CodeRelationship {
    return {
      id: relationship.properties.id,
      sourceId: relationship.start.toString(),
      targetId: relationship.end.toString(),
      type: relationship.properties.type,
      properties: relationship.properties.properties || {},
      strength: relationship.properties.strength || 0,
      confidence: relationship.properties.confidence || 0,
      metadata: {
        createdAt: new Date(relationship.properties.createdAt),
        detectionMethod: relationship.properties.detectionMethod
      }
    };
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    try {
      await this.driver.close();
      this.logger.info('Database connection closed');
    } catch (error) {
      this.logger.error('Failed to close database connection', { error });
      throw new DatabaseError('Failed to close database connection', undefined, { error });
    }
  }

  /**
   * Get database health status
   */
  async getHealthStatus(): Promise<{ healthy: boolean; details: any }> {
    try {
      const isConnected = await this.testConnection();
      
      if (!isConnected) {
        return { healthy: false, details: { connection: 'failed' } };
      }

      const session = this.driver.session({ database: this.config.database });
      
      try {
        // Get basic database info
        const result = await session.run('CALL dbms.components() YIELD name, versions, edition');
        const components = result.records.map(record => ({
          name: record.get('name'),
          versions: record.get('versions'),
          edition: record.get('edition')
        }));

        return {
          healthy: true,
          details: {
            connection: 'successful',
            database: this.config.database,
            components
          }
        };
      } finally {
        await session.close();
      }
    } catch (error) {
      this.logger.error('Health check failed', { error });
      return { 
        healthy: false, 
        details: { 
          connection: 'failed', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        } 
      };
    }
  }
}

export default GraphDatabaseManager;