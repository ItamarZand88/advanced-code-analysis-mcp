/**
 * Configuration management system for the Advanced Code Analysis MCP Server
 */

import { z } from 'zod';
import { config } from 'dotenv';
import { 
  SystemConfig, 
  AnalysisLevel, 
  LanguageType,
  DatabaseConfig,
  AnalysisConfig,
  AIConfig,
  ServerConfig
} from '@/types/index.js';

// Load environment variables
config();

// =================== VALIDATION SCHEMAS ===================

const DatabaseConfigSchema = z.object({
  uri: z.string().url(),
  username: z.string().min(1),
  password: z.string().min(1),
  database: z.string().min(1),
  timeout: z.number().positive(),
  maxConnectionPoolSize: z.number().positive(),
  connectionAcquisitionTimeout: z.number().positive(),
  maxConnectionLifetime: z.number().positive(),
  memoryLimit: z.string(),
  pageCache: z.string(),
  batchSize: z.number().positive(),
  enableQueryLogging: z.boolean(),
  slowQueryThreshold: z.number().positive()
});

const AnalysisConfigSchema = z.object({
  levels: z.array(z.nativeEnum(AnalysisLevel)),
  includeTests: z.boolean(),
  includeDocumentation: z.boolean(),
  includeDependencies: z.boolean(),
  maxFileSize: z.number().positive(),
  timeoutPerFile: z.number().positive(),
  parallelWorkers: z.number().positive(),
  enableCaching: z.boolean(),
  cacheDirectory: z.string(),
  supportedLanguages: z.array(z.nativeEnum(LanguageType)),
  complexityThresholds: z.object({
    function: z.number().positive(),
    class: z.number().positive(),
    file: z.number().positive(),
    module: z.number().positive()
  }),
  qualityMetrics: z.object({
    enableCyclomaticComplexity: z.boolean(),
    enableCognitiveComplexity: z.boolean(),
    enableMaintainabilityIndex: z.boolean(),
    enableTestCoverage: z.boolean(),
    enableDuplicationDetection: z.boolean(),
    enableSecurityAnalysis: z.boolean()
  })
});

const AIConfigSchema = z.object({
  enabled: z.boolean(),
  provider: z.enum(['openai', 'anthropic', 'local']),
  model: z.string(),
  apiKey: z.string().optional(),
  baseUrl: z.string().url().optional(),
  maxTokens: z.number().positive(),
  temperature: z.number().min(0).max(2),
  features: z.object({
    codeExplanation: z.boolean(),
    patternDetection: z.boolean(),
    codeSmellDetection: z.boolean(),
    improvementSuggestions: z.boolean(),
    architecturalAnalysis: z.boolean(),
    securityAnalysis: z.boolean(),
    performanceAnalysis: z.boolean()
  })
});

const ServerConfigSchema = z.object({
  host: z.string(),
  port: z.number().positive(),
  cors: z.object({
    enabled: z.boolean(),
    origins: z.array(z.string())
  }),
  rateLimit: z.object({
    enabled: z.boolean(),
    windowMs: z.number().positive(),
    maxRequests: z.number().positive()
  }),
  authentication: z.object({
    enabled: z.boolean(),
    provider: z.enum(['jwt', 'oauth', 'api-key']),
    secret: z.string().optional()
  }),
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']),
    enableFileLogging: z.boolean(),
    logDirectory: z.string(),
    maxFileSize: z.string(),
    maxFiles: z.number().positive()
  })
});

const SystemConfigSchema = z.object({
  database: DatabaseConfigSchema,
  analysis: AnalysisConfigSchema,
  ai: AIConfigSchema,
  server: ServerConfigSchema,
  performance: z.object({
    maxConcurrentAnalyses: z.number().positive(),
    memoryLimit: z.string(),
    cpuLimit: z.number().min(1).max(100),
    enableProfiling: z.boolean(),
    enableMetrics: z.boolean(),
    metricsPort: z.number().positive()
  }),
  storage: z.object({
    enableCompression: z.boolean(),
    retentionDays: z.number().positive(),
    backupEnabled: z.boolean(),
    backupSchedule: z.string()
  })
});

// =================== DEFAULT CONFIGURATIONS ===================

const DEFAULT_DATABASE_CONFIG: DatabaseConfig = {
  uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
  username: process.env.NEO4J_USERNAME || 'neo4j',
  password: process.env.NEO4J_PASSWORD || 'password',
  database: process.env.NEO4J_DATABASE || 'codeanalysis',
  timeout: parseInt(process.env.NEO4J_TIMEOUT || '60'),
  maxConnectionPoolSize: parseInt(process.env.NEO4J_MAX_POOL_SIZE || '50'),
  connectionAcquisitionTimeout: parseInt(process.env.NEO4J_ACQUISITION_TIMEOUT || '60'),
  maxConnectionLifetime: parseInt(process.env.NEO4J_MAX_LIFETIME || '3600'),
  memoryLimit: process.env.NEO4J_MEMORY_LIMIT || '4G',
  pageCache: process.env.NEO4J_PAGE_CACHE || '2G',
  batchSize: parseInt(process.env.NEO4J_BATCH_SIZE || '1000'),
  enableQueryLogging: process.env.NEO4J_QUERY_LOGGING === 'true',
  slowQueryThreshold: parseInt(process.env.NEO4J_SLOW_QUERY_THRESHOLD || '1000')
};

const DEFAULT_ANALYSIS_CONFIG: AnalysisConfig = {
  levels: [
    AnalysisLevel.SYNTACTIC,
    AnalysisLevel.SEMANTIC,
    AnalysisLevel.ARCHITECTURAL,
    AnalysisLevel.AI_INSIGHTS
  ],
  includeTests: process.env.INCLUDE_TESTS === 'true',
  includeDocumentation: process.env.INCLUDE_DOCUMENTATION === 'true',
  includeDependencies: process.env.INCLUDE_DEPENDENCIES !== 'false',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB
  timeoutPerFile: parseInt(process.env.TIMEOUT_PER_FILE || '30'),
  parallelWorkers: parseInt(process.env.PARALLEL_WORKERS || '8'),
  enableCaching: process.env.ENABLE_CACHING !== 'false',
  cacheDirectory: process.env.CACHE_DIRECTORY || './cache',
  supportedLanguages: [
    LanguageType.TYPESCRIPT,
    LanguageType.JAVASCRIPT,
    LanguageType.PYTHON,
    LanguageType.JAVA,
    LanguageType.CSHARP,
    LanguageType.GO,
    LanguageType.RUST
  ],
  complexityThresholds: {
    function: parseInt(process.env.FUNCTION_COMPLEXITY_THRESHOLD || '10'),
    class: parseInt(process.env.CLASS_COMPLEXITY_THRESHOLD || '20'),
    file: parseInt(process.env.FILE_COMPLEXITY_THRESHOLD || '500'),
    module: parseInt(process.env.MODULE_COMPLEXITY_THRESHOLD || '1000')
  },
  qualityMetrics: {
    enableCyclomaticComplexity: process.env.ENABLE_CYCLOMATIC_COMPLEXITY !== 'false',
    enableCognitiveComplexity: process.env.ENABLE_COGNITIVE_COMPLEXITY !== 'false',
    enableMaintainabilityIndex: process.env.ENABLE_MAINTAINABILITY_INDEX !== 'false',
    enableTestCoverage: process.env.ENABLE_TEST_COVERAGE !== 'false',
    enableDuplicationDetection: process.env.ENABLE_DUPLICATION_DETECTION !== 'false',
    enableSecurityAnalysis: process.env.ENABLE_SECURITY_ANALYSIS !== 'false'
  }
};

const DEFAULT_AI_CONFIG: AIConfig = {
  enabled: process.env.ENABLE_AI_INSIGHTS !== 'false',
  provider: (process.env.AI_PROVIDER as 'openai' | 'anthropic' | 'local') || 'openai',
  model: process.env.AI_MODEL || 'gpt-4',
  apiKey: process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY,
  baseUrl: process.env.AI_BASE_URL,
  maxTokens: parseInt(process.env.AI_MAX_TOKENS || '4096'),
  temperature: parseFloat(process.env.AI_TEMPERATURE || '0.1'),
  features: {
    codeExplanation: process.env.AI_CODE_EXPLANATION !== 'false',
    patternDetection: process.env.AI_PATTERN_DETECTION !== 'false',
    codeSmellDetection: process.env.AI_CODE_SMELL_DETECTION !== 'false',
    improvementSuggestions: process.env.AI_IMPROVEMENT_SUGGESTIONS !== 'false',
    architecturalAnalysis: process.env.AI_ARCHITECTURAL_ANALYSIS !== 'false',
    securityAnalysis: process.env.AI_SECURITY_ANALYSIS !== 'false',
    performanceAnalysis: process.env.AI_PERFORMANCE_ANALYSIS !== 'false'
  }
};

const DEFAULT_SERVER_CONFIG: ServerConfig = {
  host: process.env.SERVER_HOST || '0.0.0.0',
  port: parseInt(process.env.SERVER_PORT || '3000'),
  cors: {
    enabled: process.env.CORS_ENABLED !== 'false',
    origins: process.env.CORS_ORIGINS?.split(',') || ['*']
  },
  rateLimit: {
    enabled: process.env.RATE_LIMIT_ENABLED === 'true',
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100')
  },
  authentication: {
    enabled: process.env.ENABLE_AUTHENTICATION === 'true',
    provider: (process.env.AUTH_PROVIDER as 'jwt' | 'oauth' | 'api-key') || 'jwt',
    secret: process.env.JWT_SECRET || process.env.API_KEY
  },
  logging: {
    level: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
    enableFileLogging: process.env.ENABLE_FILE_LOGGING === 'true',
    logDirectory: process.env.LOG_DIRECTORY || './logs',
    maxFileSize: process.env.LOG_MAX_FILE_SIZE || '10MB',
    maxFiles: parseInt(process.env.LOG_MAX_FILES || '5')
  }
};

export const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  database: DEFAULT_DATABASE_CONFIG,
  analysis: DEFAULT_ANALYSIS_CONFIG,
  ai: DEFAULT_AI_CONFIG,
  server: DEFAULT_SERVER_CONFIG,
  performance: {
    maxConcurrentAnalyses: parseInt(process.env.MAX_CONCURRENT_ANALYSES || '5'),
    memoryLimit: process.env.MEMORY_LIMIT || '8GB',
    cpuLimit: parseInt(process.env.CPU_LIMIT || '80'),
    enableProfiling: process.env.ENABLE_PROFILING === 'true',
    enableMetrics: process.env.ENABLE_METRICS !== 'false',
    metricsPort: parseInt(process.env.METRICS_PORT || '9090')
  },
  storage: {
    enableCompression: process.env.ENABLE_COMPRESSION !== 'false',
    retentionDays: parseInt(process.env.RETENTION_DAYS || '90'),
    backupEnabled: process.env.BACKUP_ENABLED === 'true',
    backupSchedule: process.env.BACKUP_SCHEDULE || '0 2 * * *'
  }
};

// =================== CONFIGURATION MANAGER ===================

export class ConfigurationManager {
  private config: SystemConfig;
  private readonly configPath?: string;

  constructor(customConfig?: Partial<SystemConfig>, configPath?: string) {
    this.configPath = configPath;
    this.config = this.mergeConfigs(DEFAULT_SYSTEM_CONFIG, customConfig || {});
    this.validateConfig();
  }

  /**
   * Get the current system configuration
   */
  getConfig(): SystemConfig {
    return { ...this.config };
  }

  /**
   * Update configuration with new values
   */
  updateConfig(updates: Partial<SystemConfig>): void {
    this.config = this.mergeConfigs(this.config, updates);
    this.validateConfig();
  }

  /**
   * Get database configuration
   */
  getDatabaseConfig(): DatabaseConfig {
    return { ...this.config.database };
  }

  /**
   * Get analysis configuration
   */
  getAnalysisConfig(): AnalysisConfig {
    return { ...this.config.analysis };
  }

  /**
   * Get AI configuration
   */
  getAIConfig(): AIConfig {
    return { ...this.config.ai };
  }

  /**
   * Get server configuration
   */
  getServerConfig(): ServerConfig {
    return { ...this.config.server };
  }

  /**
   * Validate the current configuration
   */
  private validateConfig(): void {
    try {
      SystemConfigSchema.parse(this.config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`);
        throw new Error(`Configuration validation failed:\n${issues.join('\n')}`);
      }
      throw error;
    }
  }

  /**
   * Deep merge two configuration objects
   */
  private mergeConfigs(base: SystemConfig, override: Partial<SystemConfig>): SystemConfig {
    const merged = { ...base };

    for (const [key, value] of Object.entries(override)) {
      if (value !== undefined) {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          (merged as any)[key] = { ...(merged as any)[key], ...value };
        } else {
          (merged as any)[key] = value;
        }
      }
    }

    return merged;
  }

  /**
   * Load configuration from file
   */
  static async fromFile(filePath: string): Promise<ConfigurationManager> {
    try {
      const { readFile } = await import('fs/promises');
      const configData = await readFile(filePath, 'utf-8');
      const parsedConfig = JSON.parse(configData);
      return new ConfigurationManager(parsedConfig, filePath);
    } catch (error) {
      throw new Error(`Failed to load configuration from ${filePath}: ${error}`);
    }
  }

  /**
   * Save configuration to file
   */
  async saveToFile(filePath?: string): Promise<void> {
    const targetPath = filePath || this.configPath;
    if (!targetPath) {
      throw new Error('No file path specified for saving configuration');
    }

    try {
      const { writeFile, mkdir } = await import('fs/promises');
      const { dirname } = await import('path');
      
      // Ensure directory exists
      await mkdir(dirname(targetPath), { recursive: true });
      
      // Save configuration
      await writeFile(targetPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      throw new Error(`Failed to save configuration to ${targetPath}: ${error}`);
    }
  }

  /**
   * Get configuration for specific environment
   */
  static getEnvironmentConfig(): SystemConfig {
    const env = process.env.NODE_ENV || 'development';
    
    const envOverrides: Record<string, Partial<SystemConfig>> = {
      development: {
        server: {
          ...DEFAULT_SERVER_CONFIG,
          logging: {
            ...DEFAULT_SERVER_CONFIG.logging,
            level: 'debug',
            enableFileLogging: true
          }
        },
        performance: {
          maxConcurrentAnalyses: 3,
          memoryLimit: '4GB',
          cpuLimit: 70,
          enableProfiling: true,
          enableMetrics: true,
          metricsPort: 9090
        }
      },
      
      production: {
        server: {
          ...DEFAULT_SERVER_CONFIG,
          logging: {
            ...DEFAULT_SERVER_CONFIG.logging,
            level: 'info',
            enableFileLogging: true
          }
        },
        performance: {
          maxConcurrentAnalyses: 10,
          memoryLimit: '16GB',
          cpuLimit: 85,
          enableProfiling: false,
          enableMetrics: true,
          metricsPort: 9090
        }
      },
      
      testing: {
        database: {
          ...DEFAULT_DATABASE_CONFIG,
          database: 'codeanalysis_test',
          batchSize: 100
        },
        analysis: {
          ...DEFAULT_ANALYSIS_CONFIG,
          parallelWorkers: 2,
          maxFileSize: 1048576 // 1MB
        },
        ai: {
          ...DEFAULT_AI_CONFIG,
          enabled: false
        }
      }
    };

    const manager = new ConfigurationManager(envOverrides[env] || {});
    return manager.getConfig();
  }

  /**
   * Check if configuration is valid for the current environment
   */
  validateEnvironment(): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check database connection
    if (!this.config.database.uri || !this.config.database.username) {
      issues.push('Database configuration is incomplete');
    }

    // Check AI configuration
    if (this.config.ai.enabled && !this.config.ai.apiKey) {
      issues.push('AI is enabled but no API key is provided');
    }

    // Check resource limits
    if (this.config.performance.maxConcurrentAnalyses > 20) {
      issues.push('Maximum concurrent analyses seems too high (>20)');
    }

    // Check disk space for caching
    if (this.config.analysis.enableCaching && !this.config.analysis.cacheDirectory) {
      issues.push('Caching is enabled but no cache directory is specified');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }
}

// =================== EXPORTS ===================

export { SystemConfigSchema, DatabaseConfigSchema, AnalysisConfigSchema, AIConfigSchema, ServerConfigSchema };
export default ConfigurationManager;