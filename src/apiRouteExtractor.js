import path from 'path';
import fs from 'fs/promises';
import fg from 'fast-glob';

export class ApiRouteExtractor {
  constructor(projectRoot, limit = 100) {
    this.projectRoot = projectRoot;
    this.limit = limit;
    this.publicRoutes = new Set();
    this.internalRoutes = new Set();
  }

  async extract() {
    const routePatterns = [
      '**/routes/**/*.{js,ts}',
      '**/controllers/**/*.{js,ts}',
      '**/api/**/*.{js,ts}',
      '**/*router*.{js,ts}',
      '**/*route*.{js,ts}'
    ];

    const files = await fg(routePatterns, {
      cwd: this.projectRoot,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/coverage/**', '**/test*/**'],
      absolute: true
    });

    await Promise.all(files.map(file => this.processFile(file)));

    return {
      publicRoutes: [...this.publicRoutes].sort().slice(0, this.limit),
      internalRoutes: [...this.internalRoutes].sort().slice(0, this.limit)
    };
  }

  async processFile(file) {
    try {
      const content = await fs.readFile(file, 'utf8');
      const routeRegexes = [
        /router\.(get|post|put|patch|delete|use)\s*\(\s*['"`]([^'"`]+)['"`]/g,
        /app\.(get|post|put|patch|delete|use)\s*\(\s*['"`]([^'"`]+)['"`]/g,
        /\.route\s*\(\s*['"`]([^'"`]+)['"`]/g
      ];

      for (const regex of routeRegexes) {
        let match;
        while ((match = regex.exec(content)) !== null) {
          let route = match[2] || match[1];
          if (!route.startsWith('/')) continue;
          route = this.normalizeRoute(route);
          if (this.isValid(route)) {
            if (this.isInternal(route)) {
              this.internalRoutes.add(route);
            } else {
              this.publicRoutes.add(route);
            }
          }
        }
      }
    } catch {
      // Silent fail for unreadable files
    }
  }

  normalizeRoute(route) {
    route = route.replace(/:[^\/]+/g, ':id');
    route = route.replace(/\[.*?\]/g, ':id');
    route = route.split('?')[0];
    route = route.replace(/\/+$/, '');
    return route || '/';
  }

  isValid(route) {
    const skip = [
      /^\/+$/,
      /^\/(:id\/?)+$/,
      /^\/middleware/i,
      /^\/test/i,
      /^\/health/i
    ];
    return !skip.some(pattern => pattern.test(route));
  }

  isInternal(route) {
    const internal = [
      /\/admin/i, /\/internal/i, /\/debug/i, /\/metrics/i, /\/analytics/i, /\/cron/i, /\/webhook/i, /\/logs/i
    ];
    return internal.some(pattern => pattern.test(route));
  }
}
