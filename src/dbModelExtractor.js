import path from 'path';
import fs from 'fs/promises';
import fg from 'fast-glob';

export class DbModelExtractor {
  constructor(projectRoot, limit = 100) {
    this.projectRoot = projectRoot;
    this.limit = limit;
    this.models = new Set();
  }

  async extract() {
    const modelPatterns = [
      '**/models/**/*.{js,ts}',
      '**/schemas/**/*.{js,ts}',
      '**/entities/**/*.{js,ts}',
      '**/*Model.{js,ts}',
      '**/*Schema.{js,ts}'
    ];

    const files = await fg(modelPatterns, {
      cwd: this.projectRoot,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/coverage/**', '**/test*/**'],
      absolute: true
    });

    await Promise.all(files.map(file => this.processFile(file)));

    return [...this.models].sort().slice(0, this.limit);
  }

  async processFile(file) {
    try {
      const content = await fs.readFile(file, 'utf8');

      // 1️⃣ Extract ES6 class models
      const classMatches = [...content.matchAll(/class\s+([A-Za-z0-9_]+)/g)];
      classMatches.forEach(match => {
        const name = match[1];
        if (name && !['Model', 'Entity', 'Schema'].includes(name)) {
          this.models.add(name);
        }
      });

      // 2️⃣ Extract Mongoose models
      const mongooseMatches = [...content.matchAll(/mongoose\.model\s*\(\s*['"`]([^'"`]+)['"`]/g)];
      mongooseMatches.forEach(match => {
        const name = match[1];
        this.models.add(name);
      });

      // 3️⃣ Extract Sequelize models
      const sequelizeMatches = [...content.matchAll(/sequelize\.define\s*\(\s*['"`]([^'"`]+)['"`]/g)];
      sequelizeMatches.forEach(match => {
        const name = this.capitalize(name);
        this.models.add(name);
      });

      // 4️⃣ Extract Schema constants
      const schemaMatches = [...content.matchAll(/const\s+([A-Za-z0-9_]+Schema)\s*=/g)];
      schemaMatches.forEach(match => {
        const name = match[1].replace(/Schema$/, '');
        this.models.add(name);
      });

    } catch {
      // Silent fail for unreadable files
    }
  }

  capitalize(name) {
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
}
