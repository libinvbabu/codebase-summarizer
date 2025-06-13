import path from 'path';
import fs from 'fs/promises';
import fg from 'fast-glob';

export class UtilityAnalyzer {
  constructor(projectRoot, limit = 100) {
    this.projectRoot = projectRoot;
    this.limit = limit;
    this.utilsByDomain = {};
    this.utilsFiles = [];
  }

  async extract() {
    const utilPatterns = [
      '**/utils/**/*.{js,ts}',
      '**/helpers/**/*.{js,ts}',
      '**/lib/**/*.{js,ts}',
      '**/*util*.{js,ts}',
      '**/*helper*.{js,ts}'
    ];

    const files = await fg(utilPatterns, {
      cwd: this.projectRoot,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/coverage/**', '**/test*/**'],
      absolute: true
    });

    await Promise.all(files.map(file => this.processFile(file)));

    return {
      byDomain: this.utilsByDomain,
      files: this.utilsFiles
    };
  }

  async processFile(file) {
    try {
      const content = await fs.readFile(file, 'utf8');
      const filename = path.basename(file);
      const domain = this.categorizeDomain(filename, content);
      const functions = this.extractFunctions(content);

      const fileSummary = { file: filename, functions };

      if (!this.utilsByDomain[domain]) {
        this.utilsByDomain[domain] = [];
      }
      this.utilsByDomain[domain].push(fileSummary);

      this.utilsFiles.push({
        name: filename,
        domain,
        functions
      });
    } catch {
      // Silent fail
    }
  }

  extractFunctions(content) {
    const functions = new Set();

    // Function declarations
    const matches1 = [...content.matchAll(/function\s+([A-Za-z0-9_]+)/g)];
    matches1.forEach(m => functions.add(m[1]));

    // Arrow function assignments
    const matches2 = [...content.matchAll(/(?:const|let|var)\s+([A-Za-z0-9_]+)\s*=\s*(?:async\s+)?\(/g)];
    matches2.forEach(m => functions.add(m[1]));

    // Module exports
    const matches3 = [...content.matchAll(/exports\.(\w+)/g)];
    matches3.forEach(m => functions.add(m[1]));

    return [...functions].sort().slice(0, this.limit);
  }

  categorizeDomain(filename, content) {
    const domains = {
      'Date/Time': ['date', 'time', 'moment', 'format', 'parse'],
      'Validation': ['validate', 'check', 'verify', 'sanitize'],
      'Crypto/Security': ['crypto', 'hash', 'encrypt', 'decrypt', 'jwt'],
      'Logging': ['log', 'logger', 'error', 'debug'],
      'Database': ['db', 'sql', 'query', 'model'],
      'API/HTTP': ['api', 'http', 'request', 'response', 'fetch'],
      'Math/Calculation': ['math', 'calc', 'sum', 'average'],
      'Cache': ['cache', 'redis'],
      'File/IO': ['file', 'read', 'write', 'upload', 'download'],
      'Auth': ['auth', 'token', 'permission'],
      'General': []
    };

    const lowerFile = filename.toLowerCase();
    const lowerContent = content.toLowerCase();

    for (const [domain, keywords] of Object.entries(domains)) {
      if (keywords.some(k => lowerFile.includes(k) || lowerContent.includes(k))) {
        return domain;
      }
    }
    return 'General';
  }
}
