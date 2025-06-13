import path from 'path';
import fs from 'fs/promises';
import fg from 'fast-glob';

export class ServiceInteractionExtractor {
  constructor(projectRoot, limit = 100) {
    this.projectRoot = projectRoot;
    this.limit = limit;
    this.serviceDependencies = {};
  }

  async extract() {
    console.log('🔗 Analyzing service interactions...');
    
    // Find service files
    const servicePatterns = [
      '**/services/**/*.{js,ts}',
      '**/*Service.{js,ts}',
      '**/*service.{js,ts}'
    ];

    const files = await fg(servicePatterns, {
      cwd: this.projectRoot,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/coverage/**', '**/test*/**'],
      absolute: true
    });

    await Promise.all(files.map(file => this.analyzeServiceFile(file)));

    return this.serviceDependencies;
  }

  async analyzeServiceFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const filename = path.basename(filePath, path.extname(filePath));
      
      // Extract service name from filename or class definition
      const serviceName = this.extractServiceName(filename, content);
      if (!serviceName) return;

      const dependencies = new Set();

      // 1. Analyze imports for service dependencies
      this.analyzeImports(content, dependencies);

      // 2. Analyze constructor injections
      this.analyzeConstructorInjections(content, dependencies);

      // 3. Analyze direct instantiations
      this.analyzeDirectInstantiations(content, dependencies);

      // 4. Analyze method calls
      this.analyzeMethodCalls(content, dependencies);

      if (dependencies.size > 0) {
        this.serviceDependencies[serviceName] = Array.from(dependencies).sort();
      }
    } catch (error) {
      console.warn(`⚠️ Error analyzing service file ${filePath}:`, error.message);
    }
  }

  extractServiceName(filename, content) {
    // Try to extract from class definition first
    const classMatch = content.match(/(?:export\s+)?class\s+([A-Za-z0-9_]+(?:Service|Controller))/);
    if (classMatch) {
      return classMatch[1];
    }

    // Fall back to filename
    if (filename.toLowerCase().includes('service') || filename.toLowerCase().includes('controller')) {
      return filename.charAt(0).toUpperCase() + filename.slice(1);
    }

    return null;
  }

  analyzeImports(content, dependencies) {
    // ES6 imports
    const importMatches = content.matchAll(/import\s+.*?from\s+['"](.*?)['"]/g);
    for (const match of importMatches) {
      const importPath = match[1];
      if (this.isServiceImport(importPath)) {
        const serviceName = this.extractServiceNameFromPath(importPath);
        if (serviceName) dependencies.add(serviceName);
      }
    }

    // CommonJS requires
    const requireMatches = content.matchAll(/require\s*\(\s*['"](.*?)['"]\s*\)/g);
    for (const match of requireMatches) {
      const requirePath = match[1];
      if (this.isServiceImport(requirePath)) {
        const serviceName = this.extractServiceNameFromPath(requirePath);
        if (serviceName) dependencies.add(serviceName);
      }
    }
  }

  analyzeConstructorInjections(content, dependencies) {
    // TypeScript/ES6 constructor parameter injection
    const constructorMatch = content.match(/constructor\s*\([^)]*\)\s*{([^}]+)}/);
    if (constructorMatch) {
      const constructorBody = constructorMatch[1];
      
      // Look for this.serviceProperty assignments
      const injectionMatches = constructorBody.matchAll(/this\.(\w*[Ss]ervice\w*)\s*=/g);
      for (const match of injectionMatches) {
        const serviceName = this.normalizeServiceName(match[1]);
        if (serviceName) dependencies.add(serviceName);
      }
    }

    // Parameter injection patterns
    const paramMatches = content.matchAll(/constructor\s*\([^)]*(\w+Service|\w+Controller)[^)]*\)/g);
    for (const match of paramMatches) {
      const fullMatch = match[0];
      const serviceParams = fullMatch.matchAll(/(\w+Service|\w+Controller)/g);
      for (const serviceMatch of serviceParams) {
        const serviceName = this.normalizeServiceName(serviceMatch[1]);
        if (serviceName) dependencies.add(serviceName);
      }
    }
  }

  analyzeDirectInstantiations(content, dependencies) {
    // new ServiceClass() patterns
    const instantiationMatches = content.matchAll(/new\s+([A-Za-z0-9_]+(?:Service|Controller))\s*\(/g);
    for (const match of instantiationMatches) {
      const serviceName = match[1];
      dependencies.add(serviceName);
    }
  }

  analyzeMethodCalls(content, dependencies) {
    // this.serviceProperty.method() calls
    const methodCallMatches = content.matchAll(/this\.(\w*[Ss]ervice\w*)\.[\w.]+\(/g);
    for (const match of methodCallMatches) {
      const serviceName = this.normalizeServiceName(match[1]);
      if (serviceName) dependencies.add(serviceName);
    }

    // Direct service calls like PaymentService.process()
    const staticCallMatches = content.matchAll(/([A-Za-z0-9_]+(?:Service|Controller))\.[\w.]+\(/g);
    for (const match of staticCallMatches) {
      const serviceName = match[1];
      dependencies.add(serviceName);
    }
  }

  isServiceImport(importPath) {
    return importPath.includes('service') || 
           importPath.includes('Service') || 
           importPath.includes('controller') ||
           importPath.includes('Controller') ||
           importPath.includes('/services/');
  }

  extractServiceNameFromPath(importPath) {
    const parts = importPath.split('/');
    const filename = parts[parts.length - 1];
    
    // Remove file extensions
    const cleanName = filename.replace(/\.(js|ts)$/, '');
    
    if (cleanName.includes('Service') || cleanName.includes('Controller')) {
      return this.normalizeServiceName(cleanName);
    }
    
    return null;
  }

  normalizeServiceName(name) {
    // Convert camelCase to PascalCase and ensure it ends with Service/Controller
    const normalized = name.charAt(0).toUpperCase() + name.slice(1);
    
    if (normalized.toLowerCase().includes('service') || normalized.toLowerCase().includes('controller')) {
      return normalized;
    }
    
    return normalized.endsWith('Service') || normalized.endsWith('Controller') ? normalized : normalized + 'Service';
  }
}
