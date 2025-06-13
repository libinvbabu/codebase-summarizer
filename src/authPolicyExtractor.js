import path from 'path';
import fs from 'fs/promises';
import fg from 'fast-glob';

export class AuthPolicyExtractor {
  constructor(projectRoot, limit = 100) {
    this.projectRoot = projectRoot;
    this.limit = limit;
    this.authPolicies = {};
  }

  async extract() {
    console.log('🔐 Extracting authentication policies...');
    
    // Find route/controller files
    const routePatterns = [
      '**/routes/**/*.{js,ts}',
      '**/controllers/**/*.{js,ts}',
      '**/api/**/*.{js,ts}',
      '**/*Controller.{js,ts}',
      '**/*controller.{js,ts}',
      '**/*Route.{js,ts}',
      '**/*route.{js,ts}'
    ];

    const files = await fg(routePatterns, {
      cwd: this.projectRoot,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/coverage/**', '**/test*/**'],
      absolute: true
    });

    await Promise.all(files.map(file => this.analyzeRouteFile(file)));

    return this.authPolicies;
  }

  async analyzeRouteFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      
      this.analyzeExpressMiddleware(content);
      this.analyzeNestJSGuards(content);
      this.analyzePassportStrategies(content);
      this.analyzeCustomAuthMiddleware(content);
      this.analyzeJWTMiddleware(content);
      
    } catch (error) {
      console.warn(`⚠️ Error analyzing auth policies in ${filePath}:`, error.message);
    }
  }

  analyzeExpressMiddleware(content) {
    // Route-level middleware: router.get('/path', middleware, handler)
    const routeMiddlewareMatches = content.matchAll(/(router|app)\.(get|post|put|patch|delete)\s*\(\s*['"](.*?)['"],\s*([^,)]+),\s*([^)]+)\)/g);
    
    for (const match of routeMiddlewareMatches) {
      const method = match[2].toUpperCase();
      const route = match[3];
      const middleware = match[4].trim();
      
      const fullRoute = `${method} ${route}`;
      const authPolicy = this.extractAuthPolicyFromMiddleware(middleware);
      
      if (authPolicy) {
        this.authPolicies[fullRoute] = authPolicy;
      }
    }

    // Router-level middleware: router.use(middleware)
    const routerMiddlewareMatches = content.matchAll(/(router|app)\.use\s*\(\s*([^)]+)\)/g);
    
    for (const match of routerMiddlewareMatches) {
      const middleware = match[2].trim();
      const authPolicy = this.extractAuthPolicyFromMiddleware(middleware);
      
      if (authPolicy) {
        // Apply to all routes in this router
        this.applyGlobalAuthPolicy(content, authPolicy);
      }
    }

    // Conditional middleware: router.use('/admin', adminAuth)
    const conditionalMiddlewareMatches = content.matchAll(/(router|app)\.use\s*\(\s*['"](.*?)['"],\s*([^)]+)\)/g);
    
    for (const match of conditionalMiddlewareMatches) {
      const basePath = match[2];
      const middleware = match[3].trim();
      const authPolicy = this.extractAuthPolicyFromMiddleware(middleware);
      
      if (authPolicy) {
        this.applyPathBasedAuthPolicy(content, basePath, authPolicy);
      }
    }
  }

  analyzeNestJSGuards(content) {
    // @UseGuards() decorator
    const guardMatches = content.matchAll(/@UseGuards\s*\(\s*([^)]+)\s*\)[\s\S]*?@(Get|Post|Put|Patch|Delete)\s*\(\s*['"](.*?)['"]?\s*\)/g);
    
    for (const match of guardMatches) {
      const guards = match[1];
      const method = match[2].toUpperCase();
      const route = match[3] || '';
      
      const fullRoute = `${method} ${route}`;
      const authPolicy = this.extractAuthPolicyFromNestJSGuards(guards);
      
      if (authPolicy) {
        this.authPolicies[fullRoute] = authPolicy;
      }
    }

    // Controller-level guards
    const controllerGuardMatches = content.matchAll(/@UseGuards\s*\(\s*([^)]+)\s*\)[\s\S]*?@Controller/g);
    
    for (const match of controllerGuardMatches) {
      const guards = match[1];
      const authPolicy = this.extractAuthPolicyFromNestJSGuards(guards);
      
      if (authPolicy) {
        this.applyControllerAuthPolicy(content, authPolicy);
      }
    }
  }

  analyzePassportStrategies(content) {
    // passport.authenticate() calls
    const passportMatches = content.matchAll(/passport\.authenticate\s*\(\s*['"](.*?)['"](?:,\s*\{([^}]*)\})?\s*\)/g);
    
    for (const match of passportMatches) {
      const strategy = match[1];
      const options = match[2];
      
      const authPolicy = this.extractAuthPolicyFromPassport(strategy, options);
      const routeContext = this.findRouteContext(content, match.index);
      
      if (authPolicy && routeContext) {
        this.authPolicies[routeContext] = authPolicy;
      }
    }
  }

  analyzeCustomAuthMiddleware(content) {
    // Custom auth function calls
    const customAuthMatches = content.matchAll(/(requireAuth|requireLogin|authenticate|authorize|checkAuth|verifyToken|isAuthenticated|isAuthorized)\s*\([^)]*\)/g);
    
    for (const match of customAuthMatches) {
      const authFunction = match[1];
      const authPolicy = this.normalizeCustomAuthFunction(authFunction);
      const routeContext = this.findRouteContext(content, match.index);
      
      if (authPolicy && routeContext) {
        this.authPolicies[routeContext] = authPolicy;
      }
    }

    // Role-based auth middleware
    const roleAuthMatches = content.matchAll(/(requireRole|hasRole|checkRole|requirePermission)\s*\(\s*['"](.*?)['"]?\s*\)/g);
    
    for (const match of roleAuthMatches) {
      const role = match[2];
      const authPolicy = `Role: ${role}`;
      const routeContext = this.findRouteContext(content, match.index);
      
      if (routeContext) {
        this.authPolicies[routeContext] = authPolicy;
      }
    }
  }

  analyzeJWTMiddleware(content) {
    // JWT middleware patterns
    const jwtMatches = content.matchAll(/(jwt|jwtAuth|verifyJWT|checkJWT|requireJWT|authenticateJWT)\s*\([^)]*\)/g);
    
    for (const match of jwtMatches) {
      const jwtFunction = match[1];
      const authPolicy = 'JWT Required';
      const routeContext = this.findRouteContext(content, match.index);
      
      if (routeContext) {
        this.authPolicies[routeContext] = authPolicy;
      }
    }

    // Express-jwt usage
    const expressJwtMatches = content.matchAll(/expressJwt\s*\(\s*\{([^}]+)\}/g);
    
    for (const match of expressJwtMatches) {
      const options = match[1];
      const authPolicy = this.parseExpressJwtOptions(options);
      
      // Apply to routes that use this middleware
      this.findRoutesUsingExpressJwt(content, authPolicy);
    }
  }

  extractAuthPolicyFromMiddleware(middleware) {
    // Clean up middleware string
    const cleanMiddleware = middleware.replace(/\s+/g, ' ').trim();
    
    // Common auth middleware patterns
    const authPatterns = {
      'authMiddleware.isAuthenticated': 'Authenticated',
      'authMiddleware.isAdmin': 'AdminOnly',
      'authMiddleware.isOwner': 'OwnerOnly',
      'authMiddleware.requireAuth': 'Authenticated',
      'requireAuth': 'Authenticated',
      'requireLogin': 'Authenticated',
      'isAuthenticated': 'Authenticated',
      'isAdmin': 'AdminOnly',
      'adminAuth': 'AdminOnly',
      'userAuth': 'UserAuth',
      'jwtAuth': 'JWT Required',
      'authenticate': 'Authenticated'
    };

    for (const [pattern, policy] of Object.entries(authPatterns)) {
      if (cleanMiddleware.includes(pattern)) {
        return policy;
      }
    }

    // Check for role-based patterns
    const roleMatch = cleanMiddleware.match(/role\s*\(\s*['"](.*?)['"]?\s*\)|requireRole\s*\(\s*['"](.*?)['"]?\s*\)/);
    if (roleMatch) {
      const role = roleMatch[1] || roleMatch[2];
      return `Role: ${role}`;
    }

    // Check for permission-based patterns
    const permissionMatch = cleanMiddleware.match(/permission\s*\(\s*['"](.*?)['"]?\s*\)|requirePermission\s*\(\s*['"](.*?)['"]?\s*\)/);
    if (permissionMatch) {
      const permission = permissionMatch[1] || permissionMatch[2];
      return `Permission: ${permission}`;
    }

    // Generic middleware that likely does auth
    if (cleanMiddleware.includes('auth') || cleanMiddleware.includes('Auth')) {
      return 'Custom Auth';
    }

    return null;
  }

  extractAuthPolicyFromNestJSGuards(guards) {
    const guardTypes = {
      'AuthGuard': 'Authenticated',
      'JwtAuthGuard': 'JWT Required',
      'LocalAuthGuard': 'Local Auth',
      'AdminGuard': 'AdminOnly',
      'RolesGuard': 'Role-based',
      'PermissionsGuard': 'Permission-based'
    };

    for (const [guardType, policy] of Object.entries(guardTypes)) {
      if (guards.includes(guardType)) {
        return policy;
      }
    }

    // Extract strategy from AuthGuard
    const strategyMatch = guards.match(/AuthGuard\s*\(\s*['"](.*?)['"]?\s*\)/);
    if (strategyMatch) {
      const strategy = strategyMatch[1];
      return `Auth Strategy: ${strategy}`;
    }

    return 'Custom Guard';
  }

  extractAuthPolicyFromPassport(strategy, options) {
    const strategyMap = {
      'local': 'Local Auth',
      'jwt': 'JWT Required',
      'google': 'Google OAuth',
      'facebook': 'Facebook OAuth',
      'github': 'GitHub OAuth',
      'twitter': 'Twitter OAuth',
      'linkedin': 'LinkedIn OAuth'
    };

    const basePolicy = strategyMap[strategy] || `Passport: ${strategy}`;

    if (options) {
      if (options.includes('session: false')) {
        return basePolicy + ' (Stateless)';
      }
    }

    return basePolicy;
  }

  normalizeCustomAuthFunction(authFunction) {
    const functionMap = {
      'requireAuth': 'Authenticated',
      'requireLogin': 'Authenticated',
      'authenticate': 'Authenticated',
      'authorize': 'Authorized',
      'checkAuth': 'Authenticated',
      'verifyToken': 'Token Required',
      'isAuthenticated': 'Authenticated',
      'isAuthorized': 'Authorized'
    };

    return functionMap[authFunction] || 'Custom Auth';
  }

  parseExpressJwtOptions(options) {
    let policy = 'JWT Required';
    
    if (options.includes('credentialsRequired: false')) {
      policy += ' (Optional)';
    }
    
    return policy;
  }

  findRouteContext(content, matchIndex) {
    // Find the nearest route definition before this middleware
    const beforeContent = content.substring(0, matchIndex);
    const routeMatch = beforeContent.match(/(router|app)\.(get|post|put|patch|delete)\s*\(\s*['"](.*?)['"](?:.*?)$/);
    
    if (routeMatch) {
      const method = routeMatch[2].toUpperCase();
      const route = routeMatch[3];
      return `${method} ${route}`;
    }

    // Check for NestJS route decorators
    const nestRouteMatch = beforeContent.match(/@(Get|Post|Put|Patch|Delete)\s*\(\s*['"](.*?)['"]?\s*\)(?:.*?)$/);
    if (nestRouteMatch) {
      const method = nestRouteMatch[1].toUpperCase();
      const route = nestRouteMatch[2] || '';
      return `${method} ${route}`;
    }
    
    return null;
  }

  applyGlobalAuthPolicy(content, authPolicy) {
    // Find all routes in this file and apply the policy
    const routeMatches = content.matchAll(/(router|app)\.(get|post|put|patch|delete)\s*\(\s*['"](.*?)['"],?/g);
    
    for (const match of routeMatches) {
      const method = match[2].toUpperCase();
      const route = match[3];
      const fullRoute = `${method} ${route}`;
      
      if (!this.authPolicies[fullRoute]) {
        this.authPolicies[fullRoute] = authPolicy;
      }
    }
  }

  applyPathBasedAuthPolicy(content, basePath, authPolicy) {
    // Find routes that match the base path
    const routeMatches = content.matchAll(/(router|app)\.(get|post|put|patch|delete)\s*\(\s*['"](.*?)['"],?/g);
    
    for (const match of routeMatches) {
      const method = match[2].toUpperCase();
      const route = match[3];
      const fullRoute = `${method} ${route}`;
      
      if (route.startsWith(basePath) && !this.authPolicies[fullRoute]) {
        this.authPolicies[fullRoute] = authPolicy;
      }
    }
  }

  applyControllerAuthPolicy(content, authPolicy) {
    // Find all NestJS routes in this controller
    const nestRouteMatches = content.matchAll(/@(Get|Post|Put|Patch|Delete)\s*\(\s*['"](.*?)['"]?\s*\)/g);
    
    for (const match of nestRouteMatches) {
      const method = match[1].toUpperCase();
      const route = match[2] || '';
      const fullRoute = `${method} ${route}`;
      
      if (!this.authPolicies[fullRoute]) {
        this.authPolicies[fullRoute] = authPolicy;
      }
    }
  }

  findRoutesUsingExpressJwt(content, authPolicy) {
    // This would require more sophisticated analysis to track middleware usage
    // For now, we'll apply it as a global policy if express-jwt is configured globally
    this.applyGlobalAuthPolicy(content, authPolicy);
  }
}
