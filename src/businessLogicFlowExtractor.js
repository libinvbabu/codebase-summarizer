import path from 'path';
import fs from 'fs/promises';
import fg from 'fast-glob';

export class BusinessLogicFlowExtractor {
  constructor(projectRoot, limit = 100) {
    this.projectRoot = projectRoot;
    this.limit = limit;
    this.businessFlows = {};
  }

  async extract() {
    console.log('🔄 Extracting business logic flows...');
    
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

    return this.businessFlows;
  }

  async analyzeServiceFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const filename = path.basename(filePath, path.extname(filePath));
      
      const serviceName = this.extractServiceName(filename, content);
      if (!serviceName) return;

      const methods = this.extractServiceMethods(content);
      const flows = {};

      for (const method of methods) {
        const flow = this.analyzeMethodFlow(content, method);
        if (flow.length > 0) {
          flows[method] = flow;
        }
      }

      if (Object.keys(flows).length > 0) {
        this.businessFlows[serviceName] = flows;
      }
    } catch (error) {
      console.warn(`⚠️ Error analyzing business flow in ${filePath}:`, error.message);
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

  extractServiceMethods(content) {
    const methods = [];

    // Extract method definitions (both function and arrow function styles)
    const methodMatches = content.matchAll(/(?:async\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{/g);
    
    for (const match of methodMatches) {
      const methodName = match[1];
      
      // Filter out constructor and common non-business methods
      if (!this.isBusinessMethod(methodName)) {
        continue;
      }
      
      methods.push(methodName);
    }

    // Extract arrow function methods
    const arrowMethodMatches = content.matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{/g);
    
    for (const match of arrowMethodMatches) {
      const methodName = match[1];
      
      if (this.isBusinessMethod(methodName)) {
        methods.push(methodName);
      }
    }

    return [...new Set(methods)]; // Remove duplicates
  }

  isBusinessMethod(methodName) {
    // Filter out constructor, getters, setters, and common utility methods
    const excludePatterns = [
      'constructor',
      'toString',
      'valueOf',
      'init',
      'setup',
      'configure',
      'destroy',
      'close'
    ];

    const excludePrefixes = ['get', 'set', '_', '__'];
    
    return !excludePatterns.includes(methodName) && 
           !excludePrefixes.some(prefix => methodName.startsWith(prefix)) &&
           methodName.length > 2;
  }

  analyzeMethodFlow(content, methodName) {
    const flow = [];
    
    // Find the method body
    const methodRegex = new RegExp(
      `(?:async\\s+)?${methodName}\\s*\\([^)]*\\)\\s*(?::\\s*[^{]+)?\\s*\\{([\\s\\S]*?)\\n\\s*\\}`,
      'g'
    );
    
    const methodMatch = methodRegex.exec(content);
    if (!methodMatch) return flow;
    
    const methodBody = methodMatch[1];
    
    // Extract flow steps
    this.extractValidationSteps(methodBody, flow);
    this.extractServiceCalls(methodBody, flow);
    this.extractDatabaseOperations(methodBody, flow);
    this.extractExternalAPICalls(methodBody, flow);
    this.extractBusinessLogicSteps(methodBody, flow);
    this.extractNotificationSteps(methodBody, flow);
    this.extractErrorHandling(methodBody, flow);
    
    return flow;
  }

  extractValidationSteps(methodBody, flow) {
    // Validation patterns
    const validationPatterns = [
      /validate\w*\s*\(/g,
      /check\w*\s*\(/g,
      /verify\w*\s*\(/g,
      /joi\.validate/g,
      /\.isValid\s*\(/g,
      /throw new.*?ValidationError/g,
      /if\s*\([^)]*\)\s*\{\s*throw/g
    ];

    for (const pattern of validationPatterns) {
      const matches = methodBody.matchAll(pattern);
      for (const match of matches) {
        const step = this.extractStepDescription(methodBody, match.index, 'validation');
        if (step && !flow.includes(step)) {
          flow.push(step);
        }
      }
    }
  }

  extractServiceCalls(methodBody, flow) {
    // Service method calls
    const serviceCallMatches = methodBody.matchAll(/(?:this\.)?(\w*[Ss]ervice\w*)\.(\w+)\s*\(/g);
    
    for (const match of serviceCallMatches) {
      const serviceName = match[1];
      const methodName = match[2];
      const step = `Call ${serviceName}.${methodName}()`;
      if (!flow.includes(step)) {
        flow.push(step);
      }
    }

    // Direct service instantiation and calls
    const directCallMatches = methodBody.matchAll(/new\s+([A-Za-z0-9_]+Service)\s*\([^)]*\)\.(\w+)\s*\(/g);
    
    for (const match of directCallMatches) {
      const serviceName = match[1];
      const methodName = match[2];
      const step = `Call ${serviceName}.${methodName}()`;
      if (!flow.includes(step)) {
        flow.push(step);
      }
    }
  }

  extractDatabaseOperations(methodBody, flow) {
    // Database operation patterns
    const dbPatterns = [
      { pattern: /\.save\s*\(/g, action: 'Save to database' },
      { pattern: /\.create\s*\(/g, action: 'Create database record' },
      { pattern: /\.update\s*\(/g, action: 'Update database record' },
      { pattern: /\.delete\s*\(/g, action: 'Delete from database' },
      { pattern: /\.find\s*\(/g, action: 'Query database' },
      { pattern: /\.findOne\s*\(/g, action: 'Find database record' },
      { pattern: /\.findById\s*\(/g, action: 'Find record by ID' },
      { pattern: /\.insert\s*\(/g, action: 'Insert into database' },
      { pattern: /\.remove\s*\(/g, action: 'Remove from database' },
      { pattern: /\.aggregate\s*\(/g, action: 'Database aggregation' }
    ];

    for (const { pattern, action } of dbPatterns) {
      const matches = methodBody.matchAll(pattern);
      for (const match of matches) {
        if (!flow.includes(action)) {
          flow.push(action);
        }
      }
    }

    // SQL queries
    const sqlMatches = methodBody.matchAll(/(SELECT|INSERT|UPDATE|DELETE)\s+/gi);
    for (const match of sqlMatches) {
      const operation = match[1].toLowerCase();
      const step = `Execute ${operation} query`;
      if (!flow.includes(step)) {
        flow.push(step);
      }
    }
  }

  extractExternalAPICalls(methodBody, flow) {
    // HTTP client calls
    const httpPatterns = [
      /axios\.\w+\s*\(/g,
      /fetch\s*\(/g,
      /request\s*\(/g,
      /\.get\s*\(\s*['"`]/g,
      /\.post\s*\(\s*['"`]/g,
      /\.put\s*\(\s*['"`]/g,
      /\.delete\s*\(\s*['"`]/g
    ];

    for (const pattern of httpPatterns) {
      const matches = methodBody.matchAll(pattern);
      for (const match of matches) {
        const step = 'Call external API';
        if (!flow.includes(step)) {
          flow.push(step);
        }
      }
    }
  }

  extractBusinessLogicSteps(methodBody, flow) {
    // Business logic patterns
    const businessPatterns = [
      { pattern: /calculate\w*\s*\(/gi, action: 'Calculate' },
      { pattern: /process\w*\s*\(/gi, action: 'Process' },
      { pattern: /generate\w*\s*\(/gi, action: 'Generate' },
      { pattern: /transform\w*\s*\(/gi, action: 'Transform data' },
      { pattern: /format\w*\s*\(/gi, action: 'Format data' },
      { pattern: /parse\w*\s*\(/gi, action: 'Parse data' },
      { pattern: /encrypt\w*\s*\(/gi, action: 'Encrypt data' },
      { pattern: /decrypt\w*\s*\(/gi, action: 'Decrypt data' },
      { pattern: /hash\w*\s*\(/gi, action: 'Hash data' },
      { pattern: /compare\w*\s*\(/gi, action: 'Compare data' }
    ];

    for (const { pattern, action } of businessPatterns) {
      const matches = methodBody.matchAll(pattern);
      for (const match of matches) {
        if (!flow.some(step => step.includes(action))) {
          flow.push(action);
        }
      }
    }

    // Payment processing
    const paymentMatches = methodBody.matchAll(/(charge|payment|refund|billing)/gi);
    for (const match of paymentMatches) {
      const step = 'Process payment';
      if (!flow.includes(step)) {
        flow.push(step);
      }
    }
  }

  extractNotificationSteps(methodBody, flow) {
    // Notification patterns
    const notificationPatterns = [
      /send\w*\s*\(/gi,
      /notify\w*\s*\(/gi,
      /email\w*\s*\(/gi,
      /sms\w*\s*\(/gi,
      /push\w*\s*\(/gi,
      /alert\w*\s*\(/gi,
      /message\w*\s*\(/gi
    ];

    for (const pattern of notificationPatterns) {
      const matches = methodBody.matchAll(pattern);
      for (const match of matches) {
        const step = 'Send notification';
        if (!flow.includes(step)) {
          flow.push(step);
        }
      }
    }
  }

  extractErrorHandling(methodBody, flow) {
    // Error handling patterns
    const errorPatterns = [
      /try\s*\{/g,
      /catch\s*\(/g,
      /throw\s+new/g,
      /\.catch\s*\(/g
    ];

    let hasErrorHandling = false;
    for (const pattern of errorPatterns) {
      if (pattern.test(methodBody)) {
        hasErrorHandling = true;
        break;
      }
    }

    if (hasErrorHandling) {
      flow.push('Handle errors');
    }
  }

  extractStepDescription(methodBody, matchIndex, type) {
    // Extract context around the match to create a meaningful description
    const lines = methodBody.split('\n');
    let lineIndex = 0;
    let currentIndex = 0;
    
    // Find the line containing the match
    for (let i = 0; i < lines.length; i++) {
      if (currentIndex + lines[i].length >= matchIndex) {
        lineIndex = i;
        break;
      }
      currentIndex += lines[i].length + 1; // +1 for newline
    }
    
    const line = lines[lineIndex]?.trim();
    if (!line) return null;
    
    // Extract meaningful description from the line
    if (type === 'validation') {
      if (line.includes('validate')) {
        return 'Validate input data';
      }
      if (line.includes('check')) {
        return 'Check conditions';
      }
      if (line.includes('verify')) {
        return 'Verify data';
      }
    }
    
    return null;
  }

  generateMarkdownFlow(serviceName, flows) {
    let markdown = `### ${serviceName} Flow:\n\n`;
    
    for (const [methodName, steps] of Object.entries(flows)) {
      markdown += `#### ${methodName}():\n`;
      for (const step of steps) {
        markdown += `- ${step}\n`;
      }
      markdown += '\n';
    }
    
    return markdown;
  }
}
