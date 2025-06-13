import path from 'path';
import fs from 'fs/promises';
import fg from 'fast-glob';

export class PatternDetector {
  constructor(projectRoot, dependencies = {}) {
    this.projectRoot = projectRoot;
    this.dependencies = dependencies;
  }

  async extract() {
    const patterns = [];

    // ORM detection
    if (this.dependencies.mongoose) patterns.push('Mongoose ODM');
    if (this.dependencies.sequelize) patterns.push('Sequelize ORM');
    if (this.dependencies.prisma || this.dependencies['@prisma/client']) patterns.push('Prisma ORM');
    if (this.dependencies.typeorm) patterns.push('TypeORM');

    // Validation libraries
    if (this.dependencies.joi) patterns.push('Joi validation');
    if (this.dependencies.zod) patterns.push('Zod validation');
    if (this.dependencies.yup) patterns.push('Yup validation');
    if (this.dependencies.celebrate) patterns.push('Celebrate validation');

    // Authentication
    if (this.dependencies.jsonwebtoken) patterns.push('JWT Authentication');
    if (this.dependencies.passport) patterns.push('Passport.js Authentication');
    if (this.dependencies['express-session']) patterns.push('Session-based Authentication');

    // Testing
    if (this.dependencies.jest) patterns.push('Jest Testing');
    if (this.dependencies.mocha) patterns.push('Mocha Testing');
    if (this.dependencies.vitest) patterns.push('Vitest Testing');

    // State management (frontend)
    if (this.dependencies.redux || this.dependencies['@reduxjs/toolkit']) patterns.push('Redux State Management');
    if (this.dependencies.zustand) patterns.push('Zustand State Management');

    // HTTP clients
    if (this.dependencies.axios) patterns.push('Axios HTTP Client');
    if (this.dependencies.ky) patterns.push('Ky HTTP Client');

    // Logging
    if (this.dependencies.winston) patterns.push('Winston Logging');
    if (this.dependencies.pino) patterns.push('Pino Logging');

    // Caching
    if (this.dependencies.redis || this.dependencies.ioredis) patterns.push('Redis Caching');

    // Realtime / WebSocket
    if (this.dependencies['socket.io']) patterns.push('Socket.IO');

    // GraphQL
    if (this.dependencies.graphql) patterns.push('GraphQL');

    // Now enrich via source code patterns
    const codePatterns = await this.scanSourcePatterns();
    patterns.push(...codePatterns);

    return [...new Set(patterns)].sort();
  }

  async scanSourcePatterns() {
    const detected = [];

    try {
      const files = await fg(['src/**/*.{js,ts}'], {
        cwd: this.projectRoot,
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/coverage/**', '**/test*/**'],
        absolute: true
      });

      const sampleFiles = files.slice(0, 50); // Limit to 50 for performance

      const fileContents = await Promise.all(
        sampleFiles.map(async (file) => {
          try {
            return await fs.readFile(file, 'utf8');
          } catch {
            return '';
          }
        })
      );

      const combined = fileContents.join('\n');

      // Light semantic code-based pattern detection
      if (combined.includes('useEffect') || combined.includes('useState')) detected.push('React Hooks');
      if (combined.includes('async') && combined.includes('await')) detected.push('Async/Await Pattern');
      if (combined.includes('middleware') || combined.includes('Middleware')) detected.push('Middleware Pattern');
      if (combined.includes('dependency injection') || combined.includes('inject')) detected.push('Dependency Injection');
      if (combined.includes('interface ') && combined.includes('implements ')) detected.push('TypeScript Interfaces');

    } catch {
      // Fail silently
    }

    return detected;
  }
}
