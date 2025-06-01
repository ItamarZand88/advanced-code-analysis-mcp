/**
 * TypeScript/JavaScript Language Analyzer (continued)
 */

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