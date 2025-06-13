import path from 'path';
import fs from 'fs/promises';
import fg from 'fast-glob';

export class ServiceClassifier {
  constructor(projectRoot, limit = 100) {
    this.projectRoot = projectRoot;
    this.limit = limit;
    this.businessServices = new Set();
    this.utilityServices = new Set();
  }

  async extract() {
    const servicePatterns = [
      '**/*Service.{js,ts}',
      '**/services/**/*.{js,ts}',
      '**/*Util.{js,ts}',
      '**/*Helper.{js,ts}',
      '**/*utils*.{js,ts}',
      '**/*helper*.{js,ts}',
      '**/*util*.{js,ts}'
    ];

    const files = await fg(servicePatterns, {
      cwd: this.projectRoot,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/coverage/**', '**/test*/**'],
      absolute: true
    });

    await Promise.all(files.map(file => this.classifyFile(file)));

    return {
      businessServices: [...this.businessServices].sort().slice(0, this.limit),
      utilityServices: [...this.utilityServices].sort().slice(0, this.limit)
    };
  }

  async classifyFile(file) {
    try {
      const content = await fs.readFile(file, 'utf8');
      const filename = path.basename(file);

      // Attempt class extraction
      const classNames = [...content.matchAll(/class\s+([A-Za-z0-9_]+)/g)].map(m => m[1]);

      if (classNames.length > 0) {
        for (const className of classNames) {
          this.classifyName(className, filename, content);
        }
      } else {
        const fileServiceName = this.inferNameFromFilename(filename);
        if (fileServiceName) {
          this.classifyName(fileServiceName, filename, content);
        }
      }
    } catch {
      // Silent fail for unreadable files
    }
  }

  classifyName(name, filename, content) {
    const businessHints = ['payment', 'user', 'order', 'farm', 'livestock', 'lead', 'chat', 'assessment'];
    const utilityHints = ['util', 'helper', 'common', 'format', 'validate', 'parse', 'convert', 'crypto', 'logger', 'cache'];

    const nameLower = name.toLowerCase();
    const fileLower = filename.toLowerCase();
    const contentLower = content.toLowerCase();

    if (utilityHints.some(hint => nameLower.includes(hint) || fileLower.includes(hint))) {
      this.utilityServices.add(name);
      return;
    }

    if (businessHints.some(hint => nameLower.includes(hint) || fileLower.includes(hint))) {
      this.businessServices.add(name);
      return;
    }

    // Content-based heuristic fallback
    if (contentLower.includes('format') || contentLower.includes('validate') || contentLower.includes('parse')) {
      this.utilityServices.add(name);
    } else {
      this.businessServices.add(name);
    }
  }

  inferNameFromFilename(filename) {
    const cleanName = filename.replace(/\.(js|ts)$/, '');
    if (cleanName.length > 2) {
      return cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
    }
    return null;
  }
}
