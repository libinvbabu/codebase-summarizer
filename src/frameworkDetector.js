import fs from 'fs/promises';
import path from 'path';

export class FrameworkDetector {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.dependencies = {};
  }

  async detect() {
    let backend = [];
    let frontend = [];

    const packageJsonPath = path.join(this.projectRoot, 'package.json');
    try {
      const packageRaw = await fs.readFile(packageJsonPath, 'utf8');
      const packageData = JSON.parse(packageRaw);
      const dependencies = {
        ...(packageData.dependencies || {}),
        ...(packageData.devDependencies || {})
      };

      this.dependencies = dependencies;

      backend = this.detectBackend(dependencies);
      frontend = this.detectFrontend(dependencies);
    } catch (err) {
      console.warn('⚠️ Could not parse package.json:', err.message);
    }

    return {
      backend: backend.join(', ') || 'Unknown',
      frontend: frontend.join(', ') || 'None detected',
      dependencies: this.dependencies // we pass this downstream for PatternDetector
    };
  }

  detectBackend(deps) {
    const backend = [];
    const clean = v => v.replace(/[^0-9.]/g, '');

    if (deps.express) backend.push(`Express ${clean(deps.express)}`);
    if (deps.koa) backend.push(`Koa ${clean(deps.koa)}`);
    if (deps.fastify) backend.push(`Fastify ${clean(deps.fastify)}`);
    if (deps['@nestjs/core']) backend.push(`NestJS ${clean(deps['@nestjs/core'])}`);
    if (deps.hapi) backend.push(`Hapi ${clean(deps.hapi)}`);
    if (deps['apollo-server']) backend.push(`Apollo GraphQL ${clean(deps['apollo-server'])}`);
    if (deps.prisma || deps['@prisma/client']) backend.push('Prisma ORM');
    if (deps.typeorm) backend.push('TypeORM');

    return [`Node.js`, ...backend];
  }

  detectFrontend(deps) {
    const frontend = [];
    const clean = v => v.replace(/[^0-9.]/g, '');

    if (deps.react) frontend.push(`React ${clean(deps.react)}`);
    if (deps.next) frontend.push(`Next.js ${clean(deps.next)}`);
    if (deps.vue) frontend.push(`Vue ${clean(deps.vue)}`);
    if (deps.nuxt) frontend.push(`Nuxt.js ${clean(deps.nuxt)}`);
    if (deps['@angular/core']) frontend.push(`Angular ${clean(deps['@angular/core'])}`);
    if (deps.svelte) frontend.push(`Svelte ${clean(deps.svelte)}`);
    if (deps['@remix-run/react']) frontend.push(`Remix`);
    if (deps.gatsby) frontend.push(`Gatsby`);
    if (deps.vite) frontend.push(`Vite`);
    if (deps.webpack) frontend.push(`Webpack`);

    return frontend;
  }
}
