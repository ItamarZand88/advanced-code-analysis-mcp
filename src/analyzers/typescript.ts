
import * as ts from 'typescript';
import { promises as fs } from 'fs';
import { extname, basename } from 'path';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import {
  CodeEntity,
  CodeRelationship,
  LanguageType,
  NodeType,
  RelationshipType,
  AnalysisConfig
} from '@/types/index.js';
import winston from 'winston';

export abstract class LanguageAnalyzer {
  protected language: LanguageType;
  protected config: AnalysisConfig;
  protected logger: winston.Logger;

  constructor(language: LanguageType, config: AnalysisConfig, logger?: winston.Logger) {
    this.language = language;
    this.config = config;
    this.logger = logger || winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [new winston.transports.Console()]
    });
  }

  abstract analyzeFile(filePath: string): Promise<CodeEntity[]>;
  abstract extractRelationships(entities: CodeEntity[]): Promise<CodeRelationship[]>;
  abstract calculateComplexity(entity: CodeEntity): Promise<number>;
  abstract detectPatterns(entities: CodeEntity[]): Promise<any[]>;
  abstract validateSyntax(content: string): Promise<boolean>;
}

export class TypeScriptAnalyzer extends LanguageAnalyzer {
  private program: ts.Program | null = null;
  private checker: ts.TypeChecker | null = null;
  private sourceFiles: Map<string, ts.SourceFile> = new Map();

  constructor(config: AnalysisConfig, logger?: winston.Logger) {
    super(LanguageType.TYPESCRIPT, config, logger);
  }

  /**
   * Analyze a single TypeScript/JavaScript file
   */
  async analyzeFile(filePath: string): Promise<CodeEntity[]> {
    try {
      this.logger.debug('Analyzing file', { filePath });

      // Read file content
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Validate syntax first
      const isValidSyntax = await this.validateSyntax(content);
      if (!isValidSyntax) {
        this.logger.warn('File has syntax errors, skipping detailed analysis', { filePath });
        return [];
      }

      // Create source file
      const sourceFile = ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.Latest,
        true,
        this.getScriptKind(filePath)
      );

      this.sourceFiles.set(filePath, sourceFile);

      // Extract entities
      const entities: CodeEntity[] = [];
      
      // Add file entity
      entities.push(await this.createFileEntity(sourceFile, filePath));
      
      // Extract different types of code entities
      entities.push(...await this.extractFunctions(sourceFile, filePath));
      entities.push(...await this.extractClasses(sourceFile, filePath));
      entities.push(...await this.extractInterfaces(sourceFile, filePath));
      entities.push(...await this.extractVariables(sourceFile, filePath));
      entities.push(...await this.extractComponents(sourceFile, filePath));
      entities.push(...await this.extractHooks(sourceFile, filePath));

      this.logger.debug('File analysis completed', { 
        filePath, 
        entitiesFound: entities.length 
      });

      return entities;
    } catch (error) {
      this.logger.error('File analysis failed', { error, filePath });
      throw error;
    }
  }

  /**
   * Create file entity
   */
  private async createFileEntity(sourceFile: ts.SourceFile, filePath: string): Promise<CodeEntity> {
    const stats = await fs.stat(filePath);
    const content = sourceFile.getFullText();
    
    return {
      id: uuidv4(),
      name: basename(filePath),
      type: NodeType.FILE,
      language: this.getLanguageFromExtension(filePath),
      filePath,
      startLine: 1,
      endLine: sourceFile.getLineAndCharacterOfPosition(sourceFile.getEnd()).line + 1,
      properties: {
        extension: extname(filePath),
        sizeBytes: stats.size,
        lineCount: sourceFile.getLineAndCharacterOfPosition(sourceFile.getEnd()).line + 1,
        encoding: 'utf-8',
        complexity: await this.calculateFileComplexity(sourceFile),
        imports: this.extractImports(sourceFile),
        exports: this.extractExports(sourceFile)
      },
      metadata: {
        createdAt: new Date(),
        updatedAt: stats.mtime,
        version: '1.0',
        hash: this.calculateContentHash(content)
      }
    };
  }

  /**
   * Extract function declarations and expressions
   */
  private async extractFunctions(sourceFile: ts.SourceFile, filePath: string): Promise<CodeEntity[]> {
    const functions: CodeEntity[] = [];

    const visit = (node: ts.Node) => {
      if (ts.isFunctionDeclaration(node) || 
          ts.isMethodDeclaration(node) ||
          ts.isArrowFunction(node) ||
          ts.isFunctionExpression(node)) {
        
        const functionEntity = this.createFunctionEntity(node, sourceFile, filePath);
        if (functionEntity) {
          functions.push(functionEntity);
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return functions;
  }

  /**
   * Create function entity from AST node
   */
  private createFunctionEntity(node: ts.Node, sourceFile: ts.SourceFile, filePath: string): CodeEntity | null {
    try {
      const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
      
      let name = 'anonymous';
      let isAsync = false;
      let isExported = false;
      let parameters: any[] = [];
      let returnType = 'any';

      if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
        name = node.name?.getText() || 'anonymous';
        isAsync = node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) || false;
        isExported = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) || false;
        
        if (node.parameters) {
          parameters = node.parameters.map(param => ({
            name: param.name.getText(),
            type: param.type?.getText() || 'any',
            optional: !!param.questionToken,
            hasDefault: !!param.initializer
          }));
        }

        if (node.type) {
          returnType = node.type.getText();
        }
      } else if (ts.isArrowFunction(node)) {
        // Try to get name from variable declaration
        const parent = node.parent;
        if (ts.isVariableDeclaration(parent)) {
          name = parent.name.getText();
        } else if (ts.isPropertyAssignment(parent)) {
          name = parent.name.getText();
        }

        parameters = node.parameters.map(param => ({
          name: param.name.getText(),
          type: param.type?.getText() || 'any',
          optional: !!param.questionToken,
          hasDefault: !!param.initializer
        }));

        if (node.type) {
          returnType = node.type.getText();
        }
      }

      const cyclomaticComplexity = this.calculateCyclomaticComplexity(node);
      const cognitiveComplexity = this.calculateCognitiveComplexity(node);

      return {
        id: uuidv4(),
        name,
        type: NodeType.FUNCTION,
        language: this.language,
        filePath,
        startLine: start.line + 1,
        endLine: end.line + 1,
        properties: {
          qualifiedName: `${filePath}::${name}`,
          isAsync,
          isExported,
          parameters,
          returnType,
          cyclomaticComplexity,
          cognitiveComplexity,
          linesOfCode: end.line - start.line + 1,
          parameterCount: parameters.length,
          isGenerator: ts.isFunctionDeclaration(node) ? !!node.asteriskToken : false,
          docstring: this.extractDocstring(node)
        },
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          version: '1.0',
          hash: this.calculateContentHash(node.getText())
        }
      };
    } catch (error) {
      this.logger.error('Failed to create function entity', { error, filePath });
      return null;
    }
  }

  /**
   * Extract class declarations
   */
  private async extractClasses(sourceFile: ts.SourceFile, filePath: string): Promise<CodeEntity[]> {
    const classes: CodeEntity[] = [];

    const visit = (node: ts.Node) => {
      if (ts.isClassDeclaration(node)) {
        const classEntity = this.createClassEntity(node, sourceFile, filePath);
        if (classEntity) {
          classes.push(classEntity);
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return classes;
  }

  /**
   * Create class entity from AST node
   */
  private createClassEntity(node: ts.ClassDeclaration, sourceFile: ts.SourceFile, filePath: string): CodeEntity | null {
    try {
      const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
      const name = node.name?.getText() || 'AnonymousClass';

      const methods: string[] = [];
      const properties: string[] = [];
      const inheritance: string[] = [];

      // Extract heritage clauses (extends, implements)
      if (node.heritageClauses) {
        for (const clause of node.heritageClauses) {
          for (const type of clause.types) {
            if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
              inheritance.push(`extends ${type.getText()}`);
            } else if (clause.token === ts.SyntaxKind.ImplementsKeyword) {
              inheritance.push(`implements ${type.getText()}`);
            }
          }
        }
      }

      // Extract members
      for (const member of node.members) {
        if (ts.isMethodDeclaration(member) || ts.isGetAccessorDeclaration(member) || ts.isSetAccessorDeclaration(member)) {
          methods.push(member.name?.getText() || 'anonymous');
        } else if (ts.isPropertyDeclaration(member)) {
          properties.push(member.name?.getText() || 'anonymous');
        }
      }

      const isAbstract = node.modifiers?.some(m => m.kind === ts.SyntaxKind.AbstractKeyword) || false;
      const isExported = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) || false;

      return {
        id: uuidv4(),
        name,
        type: NodeType.CLASS,
        language: this.language,
        filePath,
        startLine: start.line + 1,
        endLine: end.line + 1,
        properties: {
          qualifiedName: `${filePath}::${name}`,
          isAbstract,
          isExported,
          methods,
          properties,
          inheritance,
          methodCount: methods.length,
          propertyCount: properties.length,
          inheritanceDepth: inheritance.filter(h => h.startsWith('extends')).length,
          linesOfCode: end.line - start.line + 1,
          docstring: this.extractDocstring(node)
        },
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          version: '1.0',
          hash: this.calculateContentHash(node.getText())
        }
      };
    } catch (error) {
      this.logger.error('Failed to create class entity', { error, filePath });
      return null;
    }
  }

  /**
   * Extract interface declarations
   */
  private async extractInterfaces(sourceFile: ts.SourceFile, filePath: string): Promise<CodeEntity[]> {
    const interfaces: CodeEntity[] = [];

    const visit = (node: ts.Node) => {
      if (ts.isInterfaceDeclaration(node)) {
        const interfaceEntity = this.createInterfaceEntity(node, sourceFile, filePath);
        if (interfaceEntity) {
          interfaces.push(interfaceEntity);
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return interfaces;
  }

  /**
   * Create interface entity from AST node
   */
  private createInterfaceEntity(node: ts.InterfaceDeclaration, sourceFile: ts.SourceFile, filePath: string): CodeEntity | null {
    try {
      const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
      const name = node.name.getText();

      const members: string[] = [];
      const inheritance: string[] = [];

      // Extract heritage clauses (extends)
      if (node.heritageClauses) {
        for (const clause of node.heritageClauses) {
          for (const type of clause.types) {
            inheritance.push(`extends ${type.getText()}`);
          }
        }
      }

      // Extract members
      for (const member of node.members) {
        if (ts.isPropertySignature(member) || ts.isMethodSignature(member)) {
          members.push(member.name?.getText() || 'anonymous');
        }
      }

      const isExported = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) || false;

      return {
        id: uuidv4(),
        name,
        type: NodeType.INTERFACE,
        language: this.language,
        filePath,
        startLine: start.line + 1,
        endLine: end.line + 1,
        properties: {
          qualifiedName: `${filePath}::${name}`,
          isExported,
          members,
          inheritance,
          memberCount: members.length,
          linesOfCode: end.line - start.line + 1,
          docstring: this.extractDocstring(node)
        },
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          version: '1.0',
          hash: this.calculateContentHash(node.getText())
        }
      };
    } catch (error) {
      this.logger.error('Failed to create interface entity', { error, filePath });
      return null;
    }
  }

  /**
   * Extract variable declarations
   */
  private async extractVariables(sourceFile: ts.SourceFile, filePath: string): Promise<CodeEntity[]> {
    const variables: CodeEntity[] = [];

    const visit = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node)) {
        const variableEntity = this.createVariableEntity(node, sourceFile, filePath);
        if (variableEntity) {
          variables.push(variableEntity);
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return variables;
  }

  /**
   * Create variable entity from AST node
   */
  private createVariableEntity(node: ts.VariableDeclaration, sourceFile: ts.SourceFile, filePath: string): CodeEntity | null {
    try {
      const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
      const name = node.name.getText();

      const parent = node.parent;
      let isConst = false;
      let isExported = false;

      if (ts.isVariableDeclarationList(parent)) {
        isConst = (parent.flags & ts.NodeFlags.Const) !== 0;
        
        const grandParent = parent.parent;
        if (ts.isVariableStatement(grandParent)) {
          isExported = grandParent.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) || false;
        }
      }

      return {
        id: uuidv4(),
        name,
        type: NodeType.VARIABLE,
        language: this.language,
        filePath,
        startLine: start.line + 1,
        endLine: end.line + 1,
        properties: {
          qualifiedName: `${filePath}::${name}`,
          type: node.type?.getText() || 'any',
          isConst,
          isExported,
          hasInitializer: !!node.initializer,
          defaultValue: node.initializer?.getText()?.substring(0, 100) // Truncate long values
        },
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          version: '1.0',
          hash: this.calculateContentHash(node.getText())
        }
      };
    } catch (error) {
      this.logger.error('Failed to create variable entity', { error, filePath });
      return null;
    }
  }

  /**
   * Extract React components
   */
  private async extractComponents(sourceFile: ts.SourceFile, filePath: string): Promise<CodeEntity[]> {
    const components: CodeEntity[] = [];

    const visit = (node: ts.Node) => {
      // Function components
      if ((ts.isFunctionDeclaration(node) || ts.isArrowFunction(node)) && this.isReactComponent(node)) {
        const componentEntity = this.createComponentEntity(node, sourceFile, filePath);
        if (componentEntity) {
          components.push(componentEntity);
        }
      }

      // Class components
      if (ts.isClassDeclaration(node) && this.isReactClassComponent(node)) {
        const componentEntity = this.createClassComponentEntity(node, sourceFile, filePath);
        if (componentEntity) {
          components.push(componentEntity);
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return components;
  }

  /**
   * Extract React hooks
   */
  private async extractHooks(sourceFile: ts.SourceFile, filePath: string): Promise<CodeEntity[]> {
    const hooks: CodeEntity[] = [];

    const visit = (node: ts.Node) => {
      if ((ts.isFunctionDeclaration(node) || ts.isArrowFunction(node)) && this.isReactHook(node)) {
        const hookEntity = this.createHookEntity(node, sourceFile, filePath);
        if (hookEntity) {
          hooks.push(hookEntity);
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return hooks;
  }

  /**
   * Extract relationships between entities
   */
  async extractRelationships(entities: CodeEntity[]): Promise<CodeRelationship[]> {
    const relationships: CodeRelationship[] = [];

    // Extract import/export relationships
    relationships.push(...await this.extractImportRelationships(entities));

    // Extract function call relationships
    relationships.push(...await this.extractCallRelationships(entities));

    // Extract inheritance relationships
    relationships.push(...await this.extractInheritanceRelationships(entities));

    // Extract containment relationships
    relationships.push(...await this.extractContainmentRelationships(entities));

    return relationships;
  }

  /**
   * Extract import/export relationships
   */
  private async extractImportRelationships(entities: CodeEntity[]): Promise<CodeRelationship[]> {
    const relationships: CodeRelationship[] = [];

    for (const entity of entities) {
      if (entity.type === NodeType.FILE && entity.properties.imports) {
        for (const importInfo of entity.properties.imports) {
          relationships.push({
            id: uuidv4(),
            sourceId: entity.id,
            targetId: importInfo.moduleId || uuidv4(), // We'll resolve this later
            type: RelationshipType.IMPORTS,
            properties: {
              importType: importInfo.type,
              specifiers: importInfo.specifiers,
              alias: importInfo.alias
            },
            strength: 0.8,
            confidence: 0.9,
            metadata: {
              createdAt: new Date(),
              detectionMethod: 'static'
            }
          });
        }
      }
    }

    return relationships;
  }

  /**
   * Extract function call relationships
   */
  private async extractCallRelationships(entities: CodeEntity[]): Promise<CodeRelationship[]> {
    const relationships: CodeRelationship[] = [];
    
    // This would require more sophisticated analysis
    // For now, return empty array
    return relationships;
  }

  /**
   * Extract inheritance relationships
   */
  private async extractInheritanceRelationships(entities: CodeEntity[]): Promise<CodeRelationship[]> {
    const relationships: CodeRelationship[] = [];

    for (const entity of entities) {
      if ((entity.type === NodeType.CLASS || entity.type === NodeType.INTERFACE) && 
          entity.properties.inheritance) {
        for (const inheritance of entity.properties.inheritance) {
          const relType = inheritance.startsWith('extends') ? 
            RelationshipType.INHERITS : RelationshipType.IMPLEMENTS;

          relationships.push({
            id: uuidv4(),
            sourceId: entity.id,
            targetId: uuidv4(), // We'll resolve this later
            type: relType,
            properties: {
              inheritanceType: inheritance
            },
            strength: 0.9,
            confidence: 0.8,
            metadata: {
              createdAt: new Date(),
              detectionMethod: 'static'
            }
          });
        }
      }
    }

    return relationships;
  }

  /**
   * Extract containment relationships
   */
  private async extractContainmentRelationships(entities: CodeEntity[]): Promise<CodeRelationship[]> {
    const relationships: CodeRelationship[] = [];

    const fileEntities = entities.filter(e => e.type === NodeType.FILE);
    const codeEntities = entities.filter(e => e.type !== NodeType.FILE);

    for (const fileEntity of fileEntities) {
      for (const codeEntity of codeEntities) {
        if (codeEntity.filePath === fileEntity.filePath) {
          relationships.push({
            id: uuidv4(),
            sourceId: fileEntity.id,
            targetId: codeEntity.id,
            type: RelationshipType.CONTAINS,
            properties: {
              containmentType: `file_contains_${codeEntity.type.toLowerCase()}`
            },
            strength: 1.0,
            confidence: 1.0,
            metadata: {
              createdAt: new Date(),
              detectionMethod: 'static'
            }
          });
        }
      }
    }

    return relationships;
  }

  /**
   * Calculate complexity metrics
   */
  async calculateComplexity(entity: CodeEntity): Promise<number> {
    return entity.properties.cyclomaticComplexity || 1;
  }

  /**
   * Detect code patterns
   */
  async detectPatterns(entities: CodeEntity[]): Promise<any[]> {
    const patterns: any[] = [];

    // Detect singleton pattern
    const singletons = this.detectSingletonPattern(entities);
    patterns.push(...singletons);

    // Detect factory pattern
    const factories = this.detectFactoryPattern(entities);
    patterns.push(...factories);

    return patterns;
  }

  /**
   * Validate syntax
   */
  async validateSyntax(content: string): Promise<boolean> {
    try {
      const sourceFile = ts.createSourceFile(
        'temp.ts',
        content,
        ts.ScriptTarget.Latest,
        true
      );

      // Check for syntax errors
      const diagnostics = sourceFile.parseDiagnostics;
      return diagnostics.length === 0;
    } catch {
      return false;
    }
  }

  // =================== HELPER METHODS ===================

  private getScriptKind(filePath: string): ts.ScriptKind {
    const ext = extname(filePath);
    switch (ext) {
      case '.ts': return ts.ScriptKind.TS;
      case '.tsx': return ts.ScriptKind.TSX;
      case '.js': return ts.ScriptKind.JS;
      case '.jsx': return ts.ScriptKind.JSX;
      default: return ts.ScriptKind.TS;
    }
  }

  private getLanguageFromExtension(filePath: string): LanguageType {
    const ext = extname(filePath);
    return ext === '.ts' || ext === '.tsx' ? LanguageType.TYPESCRIPT : LanguageType.JAVASCRIPT;
  }

  private calculateContentHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private calculateCyclomaticComplexity(node: ts.Node): number {
    let complexity = 1; // Base complexity

    const visit = (n: ts.Node) => {
      if (ts.isIfStatement(n) ||
          ts.isWhileStatement(n) ||
          ts.isDoStatement(n) ||
          ts.isForStatement(n) ||
          ts.isForInStatement(n) ||
          ts.isForOfStatement(n) ||
          ts.isSwitchStatement(n) ||
          ts.isConditionalExpression(n) ||
          ts.isCatchClause(n)) {
        complexity++;
      } else if (ts.isCaseClause(n)) {
        complexity++;
      } else if (ts.isBinaryExpression(n) && 
                 (n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
                  n.operatorToken.kind === ts.SyntaxKind.BarBarToken)) {
        complexity++;
      }

      ts.forEachChild(n, visit);
    };

    visit(node);
    return complexity;
  }

  private calculateCognitiveComplexity(node: ts.Node): number {
    let complexity = 0;
    let nestingLevel = 0;

    const visit = (n: ts.Node, currentNesting: number) => {
      let increment = 0;
      let newNesting = currentNesting;

      if (ts.isIfStatement(n) ||
          ts.isSwitchStatement(n) ||
          ts.isWhileStatement(n) ||
          ts.isDoStatement(n) ||
          ts.isForStatement(n) ||
          ts.isForInStatement(n) ||
          ts.isForOfStatement(n)) {
        increment = 1 + currentNesting;
        newNesting = currentNesting + 1;
      } else if (ts.isCatchClause(n)) {
        increment = 1 + currentNesting;
        newNesting = currentNesting + 1;
      } else if (ts.isConditionalExpression(n)) {
        increment = 1 + currentNesting;
      } else if (ts.isBinaryExpression(n) && 
                 (n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
                  n.operatorToken.kind === ts.SyntaxKind.BarBarToken)) {
        increment = 1;
      }

      complexity += increment;
      ts.forEachChild(n, (child) => visit(child, newNesting));
    };

    visit(node, 0);
    return complexity;
  }

  private async calculateFileComplexity(sourceFile: ts.SourceFile): Promise<number> {
    let totalComplexity = 0;
    let functionCount = 0;

    const visit = (node: ts.Node) => {
      if (ts.isFunctionDeclaration(node) || 
          ts.isMethodDeclaration(node) ||
          ts.isArrowFunction(node)) {
        totalComplexity += this.calculateCyclomaticComplexity(node);
        functionCount++;
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return functionCount > 0 ? totalComplexity / functionCount : 1;
  }

  private extractImports(sourceFile: ts.SourceFile): any[] {
    const imports: any[] = [];

    const visit = (node: ts.Node) => {
      if (ts.isImportDeclaration(node)) {
        const moduleSpecifier = node.moduleSpecifier.getText().replace(/['\"]/g, '');
        const specifiers: string[] = [];

        if (node.importClause) {
          if (node.importClause.name) {
            specifiers.push(node.importClause.name.getText());
          }

          if (node.importClause.namedBindings) {
            if (ts.isNamespaceImport(node.importClause.namedBindings)) {
              specifiers.push(`* as ${node.importClause.namedBindings.name.getText()}`);
            } else if (ts.isNamedImports(node.importClause.namedBindings)) {
              for (const element of node.importClause.namedBindings.elements) {
                specifiers.push(element.name.getText());
              }
            }
          }
        }

        imports.push({
          type: 'es6',
          module: moduleSpecifier,
          specifiers
        });
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return imports;
  }

  private extractExports(sourceFile: ts.SourceFile): any[] {
    const exports: any[] = [];

    const visit = (node: ts.Node) => {
      if (ts.isExportDeclaration(node)) {
        const moduleSpecifier = node.moduleSpecifier?.getText().replace(/['\"]/g, '');
        const specifiers: string[] = [];

        if (node.exportClause && ts.isNamedExports(node.exportClause)) {
          for (const element of node.exportClause.elements) {
            specifiers.push(element.name.getText());
          }
        }

        exports.push({
          type: 'named',
          module: moduleSpecifier,
          specifiers
        });
      } else if (node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
        if (ts.isFunctionDeclaration(node)) {
          exports.push({
            type: 'function',
            name: node.name?.getText()
          });
        } else if (ts.isClassDeclaration(node)) {
          exports.push({
            type: 'class',
            name: node.name?.getText()
          });
        } else if (ts.isVariableStatement(node)) {
          for (const declaration of node.declarationList.declarations) {
            exports.push({
              type: 'variable',
              name: declaration.name.getText`
}
  private extractExports(sourceFile: ts.SourceFile): any[] {
    const exports: any[] = [];

    const visit = (node: ts.Node) => {
      if (ts.isExportDeclaration(node)) {
        const moduleSpecifier = node.moduleSpecifier?.getText().replace(/['"]/g, '');
        const specifiers: string[] = [];

        if (node.exportClause && ts.isNamedExports(node.exportClause)) {
          for (const element of node.exportClause.elements) {
            specifiers.push(element.name.getText());
          }
        }

        exports.push({
          type: 'named',
          module: moduleSpecifier,
          specifiers
        });
      } else if (node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
        if (ts.isFunctionDeclaration(node)) {
          exports.push({
            type: 'function',
            name: node.name?.getText()
          });
        } else if (ts.isClassDeclaration(node)) {
          exports.push({
            type: 'class',
            name: node.name?.getText()
          });
        } else if (ts.isVariableStatement(node)) {
          for (const declaration of node.declarationList.declarations) {
            exports.push({
              type: 'variable',
              name: declaration.name.getText()
            });
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return exports;
  }

  private extractDocstring(node: ts.Node): string | undefined {
    const sourceFile = node.getSourceFile();
    const fullText = sourceFile.getFullText();
    const nodeStart = node.getFullStart();
    
    // Look for JSDoc comments before the node
    const beforeText = fullText.substring(0, nodeStart);
    const jsdocMatch = beforeText.match(/\/\*\*([\s\S]*?)\*\/\s*$/);
    
    if (jsdocMatch) {
      return jsdocMatch[1]
        .split('\n')
        .map(line => line.replace(/^\s*\*\s?/, ''))
        .join('\n')
        .trim();
    }

    return undefined;
  }

  private isReactComponent(node: ts.Node): boolean {
    // Check if function returns JSX
    if (ts.isFunctionDeclaration(node) || ts.isArrowFunction(node)) {
      const name = this.getFunctionName(node);
      
      // Component names should start with uppercase
      if (name && /^[A-Z]/.test(name)) {
        // TODO: Check if it returns JSX elements
        return true;
      }
    }
    
    return false;
  }

  private isReactClassComponent(node: ts.ClassDeclaration): boolean {
    // Check if extends React.Component or Component
    if (node.heritageClauses) {
      for (const clause of node.heritageClauses) {
        if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
          for (const type of clause.types) {
            const typeName = type.getText();
            if (typeName.includes('Component') || typeName.includes('React.Component')) {
              return true;
            }
          }
        }
      }
    }
    
    return false;
  }

  private isReactHook(node: ts.Node): boolean {
    const name = this.getFunctionName(node);
    return name ? name.startsWith('use') && name.length > 3 && /^use[A-Z]/.test(name) : false;
  }

  private getFunctionName(node: ts.Node): string | undefined {
    if (ts.isFunctionDeclaration(node)) {
      return node.name?.getText();
    } else if (ts.isArrowFunction(node)) {
      const parent = node.parent;
      if (ts.isVariableDeclaration(parent)) {
        return parent.name.getText();
      } else if (ts.isPropertyAssignment(parent)) {
        return parent.name.getText();
      }
    }
    return undefined;
  }

  private createComponentEntity(node: ts.Node, sourceFile: ts.SourceFile, filePath: string): CodeEntity | null {
    try {
      const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
      const name = this.getFunctionName(node) || 'AnonymousComponent';

      return {
        id: uuidv4(),
        name,
        type: NodeType.COMPONENT,
        language: this.language,
        filePath,
        startLine: start.line + 1,
        endLine: end.line + 1,
        properties: {
          qualifiedName: `${filePath}::${name}`,
          componentType: 'functional',
          hasProps: this.hasProps(node),
          hasState: this.hasState(node),
          hasEffects: this.hasEffects(node),
          complexity: this.calculateCyclomaticComplexity(node),
          linesOfCode: end.line - start.line + 1,
          docstring: this.extractDocstring(node)
        },
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          version: '1.0',
          hash: this.calculateContentHash(node.getText())
        }
      };
    } catch (error) {
      this.logger.error('Failed to create component entity', { error, filePath });
      return null;
    }
  }

  private createClassComponentEntity(node: ts.ClassDeclaration, sourceFile: ts.SourceFile, filePath: string): CodeEntity | null {
    try {
      const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
      const name = node.name?.getText() || 'AnonymousComponent';

      return {
        id: uuidv4(),
        name,
        type: NodeType.COMPONENT,
        language: this.language,
        filePath,
        startLine: start.line + 1,
        endLine: end.line + 1,
        properties: {
          qualifiedName: `${filePath}::${name}`,
          componentType: 'class',
          hasProps: true, // Class components always have props
          hasState: this.hasStateInClass(node),
          hasLifecycleMethods: this.hasLifecycleMethods(node),
          complexity: this.calculateCyclomaticComplexity(node),
          linesOfCode: end.line - start.line + 1,
          docstring: this.extractDocstring(node)
        },
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          version: '1.0',
          hash: this.calculateContentHash(node.getText())
        }
      };
    } catch (error) {
      this.logger.error('Failed to create class component entity', { error, filePath });
      return null;
    }
  }

  private createHookEntity(node: ts.Node, sourceFile: ts.SourceFile, filePath: string): CodeEntity | null {
    try {
      const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
      const name = this.getFunctionName(node) || 'anonymousHook';

      return {
        id: uuidv4(),
        name,
        type: NodeType.HOOK,
        language: this.language,
        filePath,
        startLine: start.line + 1,
        endLine: end.line + 1,
        properties: {
          qualifiedName: `${filePath}::${name}`,
          hookType: this.getHookType(name),
          dependencies: this.extractHookDependencies(node),
          complexity: this.calculateCyclomaticComplexity(node),
          linesOfCode: end.line - start.line + 1,
          docstring: this.extractDocstring(node)
        },
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          version: '1.0',
          hash: this.calculateContentHash(node.getText())
        }
      };
    } catch (error) {
      this.logger.error('Failed to create hook entity', { error, filePath });
      return null;
    }
  }

  private hasProps(node: ts.Node): boolean {
    if (ts.isFunctionDeclaration(node) || ts.isArrowFunction(node)) {
      return node.parameters.length > 0;
    }
    return false;
  }

  private hasState(node: ts.Node): boolean {
    // Check for useState hook usage
    const text = node.getText();
    return text.includes('useState') || text.includes('useReducer');
  }

  private hasEffects(node: ts.Node): boolean {
    // Check for useEffect hook usage
    const text = node.getText();
    return text.includes('useEffect') || text.includes('useLayoutEffect');
  }

  private hasStateInClass(node: ts.ClassDeclaration): boolean {
    // Check for state property or setState calls
    const text = node.getText();
    return text.includes('this.state') || text.includes('this.setState');
  }

  private hasLifecycleMethods(node: ts.ClassDeclaration): boolean {
    const lifecycleMethods = [
      'componentDidMount',
      'componentDidUpdate',
      'componentWillUnmount',
      'shouldComponentUpdate',
      'getSnapshotBeforeUpdate'
    ];

    for (const member of node.members) {
      if (ts.isMethodDeclaration(member)) {
        const methodName = member.name?.getText();
        if (methodName && lifecycleMethods.includes(methodName)) {
          return true;
        }
      }
    }

    return false;
  }

  private getHookType(name: string): string {
    if (name.startsWith('useState')) return 'state';
    if (name.startsWith('useEffect')) return 'effect';
    if (name.startsWith('useContext')) return 'context';
    if (name.startsWith('useReducer')) return 'reducer';
    if (name.startsWith('useMemo')) return 'memo';
    if (name.startsWith('useCallback')) return 'callback';
    return 'custom';
  }

  private extractHookDependencies(node: ts.Node): string[] {
    // This would require more sophisticated analysis
    // For now, return empty array
    return [];
  }

  private detectSingletonPattern(entities: CodeEntity[]): any[] {
    const singletons: any[] = [];

    for (const entity of entities) {
      if (entity.type === NodeType.CLASS) {
        const text = entity.properties.text || '';
        
        // Look for singleton indicators
        if (text.includes('private constructor') || 
            text.includes('static instance') ||
            text.includes('getInstance')) {
          singletons.push({
            type: 'singleton',
            entity: entity.id,
            confidence: 0.8,
            indicators: ['private constructor', 'static instance', 'getInstance']
          });
        }
      }
    }

    return singletons;
  }

  private detectFactoryPattern(entities: CodeEntity[]): any[] {
    const factories: any[] = [];

    for (const entity of entities) {
      if (entity.type === NodeType.FUNCTION || entity.type === NodeType.CLASS) {
        const name = entity.name.toLowerCase();
        
        // Look for factory indicators
        if (name.includes('factory') || 
            name.includes('create') ||
            name.includes('build')) {
          factories.push({
            type: 'factory',
            entity: entity.id,
            confidence: 0.6,
            indicators: ['naming pattern']
          });
        }
      }
    }

    return factories;
  }
}

// =================== PYTHON ANALYZER STUB ===================

export class PythonAnalyzer extends LanguageAnalyzer {
  constructor(config: AnalysisConfig, logger?: winston.Logger) {
    super(LanguageType.PYTHON, config, logger);
  }

  async analyzeFile(filePath: string): Promise<CodeEntity[]> {
    // TODO: Implement Python AST analysis
    this.logger.info('Python analysis not yet implemented', { filePath });
    return [];
  }

  async extractRelationships(entities: CodeEntity[]): Promise<CodeRelationship[]> {
    return [];
  }

  async calculateComplexity(entity: CodeEntity): Promise<number> {
    return 1;
  }

  async detectPatterns(entities: CodeEntity[]): Promise<any[]> {
    return [];
  }

  async validateSyntax(content: string): Promise<boolean> {
    return true;
  }
}

// =================== JAVA ANALYZER STUB ===================

export class JavaAnalyzer extends LanguageAnalyzer {
  constructor(config: AnalysisConfig, logger?: winston.Logger) {
    super(LanguageType.JAVA, config, logger);
  }

  async analyzeFile(filePath: string): Promise<CodeEntity[]> {
    // TODO: Implement Java analysis
    this.logger.info('Java analysis not yet implemented', { filePath });
    return [];
  }

  async extractRelationships(entities: CodeEntity[]): Promise<CodeRelationship[]> {
    return [];
  }

  async calculateComplexity(entity: CodeEntity): Promise<number> {
    return 1;
  }

  async detectPatterns(entities: CodeEntity[]): Promise<any[]> {
    return [];
  }

  async validateSyntax(content: string): Promise<boolean> {
    return true;
  }
}

// =================== ANALYZER FACTORY ===================

export class AnalyzerFactory {
  private static analyzers: Map<LanguageType, new (config: AnalysisConfig, logger?: winston.Logger) => LanguageAnalyzer> = new Map([
    [LanguageType.TYPESCRIPT, TypeScriptAnalyzer],
    [LanguageType.JAVASCRIPT, TypeScriptAnalyzer], // Same analyzer for JS
    [LanguageType.PYTHON, PythonAnalyzer],
    [LanguageType.JAVA, JavaAnalyzer]
  ]);

  static createAnalyzer(language: LanguageType, config: AnalysisConfig, logger?: winston.Logger): LanguageAnalyzer {
    const AnalyzerClass = this.analyzers.get(language);
    
    if (!AnalyzerClass) {
      throw new Error(`Unsupported language: ${language}`);
    }

    return new AnalyzerClass(config, logger);
  }

  static getSupportedLanguages(): LanguageType[] {
    return Array.from(this.analyzers.keys());
  }

  static isLanguageSupported(language: LanguageType): boolean {
    return this.analyzers.has(language);
  }
}

export default TypeScriptAnalyzer;
