/**
 * Core type definitions for the Advanced Code Analysis MCP Server
 */

// =================== ENUMS ===================

export enum AnalysisLevel {
  SYNTACTIC = 'syntactic',
  SEMANTIC = 'semantic',
  ARCHITECTURAL = 'architectural',
  BEHAVIORAL = 'behavioral',
  EVOLUTIONARY = 'evolutionary',
  AI_INSIGHTS = 'ai_insights'
}

export enum NodeType {
  FILE = 'File',
  FUNCTION = 'Function',
  CLASS = 'Class',
  INTERFACE = 'Interface',
  VARIABLE = 'Variable',
  PACKAGE = 'Package',
  MODULE = 'Module',
  COMPONENT = 'Component',
  HOOK = 'Hook',
  ENDPOINT = 'Endpoint',
  DATABASE_TABLE = 'DatabaseTable',
  CONFIG = 'Config',
  TEST = 'Test',
  DESIGN_PATTERN = 'DesignPattern',
  ARCHITECTURE_LAYER = 'ArchitectureLayer',
  DEPENDENCY = 'Dependency',
  COMMIT = 'Commit',
  ISSUE = 'Issue',
  DOCUMENTATION = 'Documentation',
  PERFORMANCE_BOTTLENECK = 'PerformanceBottleneck',
  SECURITY_VULNERABILITY = 'SecurityVulnerability'
}

export enum RelationshipType {
  IMPORTS = 'IMPORTS',
  EXPORTS = 'EXPORTS',
  CALLS = 'CALLS',
  INHERITS = 'INHERITS',
  IMPLEMENTS = 'IMPLEMENTS',
  CONTAINS = 'CONTAINS',
  DEPENDS_ON = 'DEPENDS_ON',
  USES = 'USES',
  MODIFIES = 'MODIFIES',
  ACCESSES = 'ACCESSES',
  TESTS = 'TESTS',
  DOCUMENTS = 'DOCUMENTS',
  SIMILAR_TO = 'SIMILAR_TO',
  AFFECTS = 'AFFECTS',
  TRIGGERS = 'TRIGGERS',
  OPTIMIZES = 'OPTIMIZES',
  REPLACES = 'REPLACES',
  CONFIGURES = 'CONFIGURES',
  DEPLOYS_TO = 'DEPLOYS_TO',
  MONITORS = 'MONITORS'
}

export enum LanguageType {
  TYPESCRIPT = 'typescript',
  JAVASCRIPT = 'javascript',
  PYTHON = 'python',
  JAVA = 'java',
  CSHARP = 'csharp',
  CPP = 'cpp',
  RUST = 'rust',
  GO = 'go',
  PHP = 'php',
  RUBY = 'ruby',
  SQL = 'sql',
  HTML = 'html',
  CSS = 'css',
  YAML = 'yaml',
  JSON = 'json',
  DOCKERFILE = 'dockerfile'
}

// =================== CORE INTERFACES ===================

export interface CodeEntity {
  id: string;
  name: string;
  type: NodeType;
  language: LanguageType;
  filePath: string;
  startLine: number;
  endLine: number;
  properties: Record<string, any>;
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    version: string;
    hash: string;
  };
}

export interface CodeRelationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: RelationshipType;
  properties: Record<string, any>;
  strength: number; // 0-1
  confidence: number; // 0-1
  metadata: {
    createdAt: Date;
    detectionMethod: 'static' | 'dynamic' | 'ai' | 'heuristic';
  };
}

export interface AnalysisJob {
  id: string;
  repositoryUrl: string;
  branch: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0-100
  startTime: Date;
  endTime?: Date;
  config: AnalysisConfig;
  results?: AnalysisResult;
  error?: string;
  metadata: {
    totalFiles: number;
    processedFiles: number;
    skippedFiles: number;
    entitiesFound: number;
    relationshipsFound: number;
  };
}

export interface AnalysisResult {
  jobId: string;
  graphId: string;
  entities: CodeEntity[];
  relationships: CodeRelationship[];
  metrics: QualityMetrics;
  insights: AIInsight[];
  summary: AnalysisSummary;
}

// =================== CONFIGURATION INTERFACES ===================

export interface DatabaseConfig {
  uri: string;
  username: string;
  password: string;
  database: string;
  timeout: number;
  maxConnectionPoolSize: number;
  connectionAcquisitionTimeout: number;
  maxConnectionLifetime: number;
  memoryLimit: string;
  pageCache: string;
  batchSize: number;
  enableQueryLogging: boolean;
  slowQueryThreshold: number;
}

export interface AnalysisConfig {
  levels: AnalysisLevel[];
  includeTests: boolean;
  includeDocumentation: boolean;
  includeDependencies: boolean;
  maxFileSize: number;
  timeoutPerFile: number;
  parallelWorkers: number;
  enableCaching: boolean;
  cacheDirectory: string;
  supportedLanguages: LanguageType[];
  complexityThresholds: {
    function: number;
    class: number;
    file: number;
    module: number;
  };
  qualityMetrics: {
    enableCyclomaticComplexity: boolean;
    enableCognitiveComplexity: boolean;
    enableMaintainabilityIndex: boolean;
    enableTestCoverage: boolean;
    enableDuplicationDetection: boolean;
    enableSecurityAnalysis: boolean;
  };
}

export interface AIConfig {
  enabled: boolean;
  provider: 'openai' | 'anthropic' | 'local';
  model: string;
  apiKey?: string;
  baseUrl?: string;
  maxTokens: number;
  temperature: number;
  features: {
    codeExplanation: boolean;
    patternDetection: boolean;
    codeSmellDetection: boolean;
    improvementSuggestions: boolean;
    architecturalAnalysis: boolean;
    securityAnalysis: boolean;
    performanceAnalysis: boolean;
  };
}

export interface ServerConfig {
  host: string;
  port: number;
  cors: {
    enabled: boolean;
    origins: string[];
  };
  rateLimit: {
    enabled: boolean;
    windowMs: number;
    maxRequests: number;
  };
  authentication: {
    enabled: boolean;
    provider: 'jwt' | 'oauth' | 'api-key';
    secret?: string;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    enableFileLogging: boolean;
    logDirectory: string;
    maxFileSize: string;
    maxFiles: number;
  };
}

export interface SystemConfig {
  database: DatabaseConfig;
  analysis: AnalysisConfig;
  ai: AIConfig;
  server: ServerConfig;
  performance: {
    maxConcurrentAnalyses: number;
    memoryLimit: string;
    cpuLimit: number;
    enableProfiling: boolean;
    enableMetrics: boolean;
    metricsPort: number;
  };
  storage: {
    enableCompression: boolean;
    retentionDays: number;
    backupEnabled: boolean;
    backupSchedule: string;
  };
}

// =================== QUALITY METRICS ===================

export interface QualityMetrics {
  overall: {
    score: number; // 0-100
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    maintainabilityIndex: number;
    technicalDebt: number; // hours
  };
  complexity: {
    averageCyclomaticComplexity: number;
    maxCyclomaticComplexity: number;
    averageCognitiveComplexity: number;
    maxCognitiveComplexity: number;
    complexityDistribution: Record<string, number>;
  };
  architecture: {
    layerViolations: number;
    circularDependencies: number;
    couplingScore: number;
    cohesionScore: number;
    abstractionLevel: number;
  };
  testing: {
    totalTests: number;
    testCoverage: number;
    testQuality: number;
    mockUsage: number;
  };
  security: {
    vulnerabilities: SecurityVulnerability[];
    securityScore: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  };
  performance: {
    bottlenecks: PerformanceBottleneck[];
    algorithmicComplexity: Record<string, string>;
    memoryUsageEstimate: number;
  };
  documentation: {
    coveragePercentage: number;
    qualityScore: number;
    outdatedDocs: number;
  };
}

export interface SecurityVulnerability {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  location: {
    file: string;
    line: number;
  };
  recommendation: string;
  cveIds?: string[];
}

export interface PerformanceBottleneck {
  id: string;
  type: 'cpu' | 'memory' | 'io' | 'network';
  location: string;
  impact: number; // 1-10
  description: string;
  suggestion: string;
}

// =================== AI INSIGHTS ===================

export interface AIInsight {
  id: string;
  type: 'pattern' | 'smell' | 'improvement' | 'architecture' | 'security' | 'performance';
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  confidence: number; // 0-1
  affectedEntities: string[];
  recommendations: string[];
  codeExamples?: {
    current: string;
    improved: string;
  };
  metadata: {
    detectedBy: string;
    detectionTime: Date;
    relevanceScore: number;
  };
}

// =================== QUERY INTERFACES ===================

export interface QueryResult {
  query: string;
  results: any[];
  executionTime: number;
  interpretation: string;
  visualizations: Visualization[];
  suggestions: string[];
}

export interface Visualization {
  type: 'graph' | 'tree' | 'metrics' | 'timeline';
  data: any;
  config: any;
}

export interface AnalysisSummary {
  overview: {
    totalFiles: number;
    totalEntities: number;
    totalRelationships: number;
    languages: string[];
    analysisTime: number;
  };
  qualityScore: number;
  topIssues: AIInsight[];
  recommendations: string[];
  trends: {
    complexity: 'increasing' | 'decreasing' | 'stable';
    maintainability: 'improving' | 'degrading' | 'stable';
    testCoverage: 'increasing' | 'decreasing' | 'stable';
  };
}

// =================== MCP PROTOCOL TYPES ===================

export interface MCPRequest {
  method: string;
  params?: any;
}

export interface MCPResponse {
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
}

export interface MCPResource {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
}

// =================== ERROR TYPES ===================

export class AnalysisError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AnalysisError';
  }
}

export class DatabaseError extends Error {
  constructor(
    message: string,
    public query?: string,
    public parameters?: any
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class AIError extends Error {
  constructor(
    message: string,
    public provider?: string,
    public model?: string
  ) {
    super(message);
    this.name = 'AIError';
  }
}
