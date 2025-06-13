#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');
const fg = require('fast-glob');

/**
 * Codebase Summarizer Script v2.0
 * 
 * Production-ready version with:
 * - Clean API routes (no duplicates, meaningful routes only)
 * - Enhanced frontend detection
 * - Deeper utility analysis
 * - Service classification
 */

class CodebaseSummarizer {
    constructor() {
        this.summary = {
            modules: [],
            services: {
                businessServices: [],
                utilityServices: []
            },
            apiRoutes: {
                publicRoutes: [],
                internalRoutes: []
            },
            dbModels: [],
            utils: {
                byDomain: {},
                files: []
            },
            frameworks: {
                frontend: '',
                backend: ''
            },
            globalPatterns: []
        };
        
        this.projectRoot = process.cwd();
        this.apiRoutePatterns = new Set();
        this.internalRoutePatterns = new Set();
        this.businessServices = new Set();
        this.utilityServices = new Set();
        this.modelClasses = new Set();
        this.utilityAnalysis = new Map(); // filename -> {domain, functions}
    }

    /**
     * Main analysis function
     */
    async analyze() {
        console.log('🔍 Starting codebase analysis (v2.0)...');
        
        try {
            await this.detectFrameworksAndDependencies();
            await this.findTopLevelModules();
            await this.findServices();
            await this.findApiRoutes();
            await this.findDatabaseModels();
            await this.findUtilityFiles();
            await this.detectGlobalPatterns();
            
            // Clean and organize results
            this.cleanupResults();
            
            await this.writeOutput();
            
            console.log('✅ Analysis complete! Results written to code-review-summary.json');
        } catch (error) {
            console.error('❌ Error during analysis:', error.message);
            process.exit(1);
        }
    }

    /**
     * Enhanced framework detection including all major frontend frameworks
     */
    async detectFrameworksAndDependencies() {
        try {
            const packageJsonPath = path.join(this.projectRoot, 'package.json');
            const packageData = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
            
            const dependencies = { ...packageData.dependencies, ...packageData.devDependencies };
            
            // Detect backend frameworks
            const backendFrameworks = [];
            if (dependencies.express) backendFrameworks.push(`Express ${this.cleanVersion(dependencies.express)}`);
            if (dependencies.koa) backendFrameworks.push(`Koa ${this.cleanVersion(dependencies.koa)}`);
            if (dependencies.fastify) backendFrameworks.push(`Fastify ${this.cleanVersion(dependencies.fastify)}`);
            if (dependencies['@nestjs/core']) backendFrameworks.push(`NestJS ${this.cleanVersion(dependencies['@nestjs/core'])}`);
            if (dependencies.hapi) backendFrameworks.push(`Hapi ${this.cleanVersion(dependencies.hapi)}`);
            
            // Node.js version
            const nodeVersion = packageData.engines?.node || process.version;
            backendFrameworks.unshift(`Node.js ${nodeVersion.replace(/[>=^~]/g, '')}`);
            
            this.summary.frameworks.backend = backendFrameworks.join(', ');
            
            // Enhanced frontend framework detection
            const frontendFrameworks = [];
            if (dependencies.react) frontendFrameworks.push(`React ${this.cleanVersion(dependencies.react)}`);
            if (dependencies.vue) frontendFrameworks.push(`Vue ${this.cleanVersion(dependencies.vue)}`);
            if (dependencies['@angular/core']) frontendFrameworks.push(`Angular ${this.cleanVersion(dependencies['@angular/core'])}`);
            if (dependencies.next) frontendFrameworks.push(`Next.js ${this.cleanVersion(dependencies.next)}`);
            if (dependencies.nuxt) frontendFrameworks.push(`Nuxt.js ${this.cleanVersion(dependencies.nuxt)}`);
            if (dependencies.svelte) frontendFrameworks.push(`Svelte ${this.cleanVersion(dependencies.svelte)}`);
            if (dependencies['@remix-run/react']) frontendFrameworks.push(`Remix ${this.cleanVersion(dependencies['@remix-run/react'])}`);
            if (dependencies.gatsby) frontendFrameworks.push(`Gatsby ${this.cleanVersion(dependencies.gatsby)}`);
            if (dependencies.vite) frontendFrameworks.push(`Vite ${this.cleanVersion(dependencies.vite)}`);
            if (dependencies.webpack) frontendFrameworks.push(`Webpack ${this.cleanVersion(dependencies.webpack)}`);
            
            this.summary.frameworks.frontend = frontendFrameworks.join(', ') || 'None detected';
            
            // Store dependencies for pattern detection
            this.dependencies = dependencies;
            
        } catch (error) {
            console.warn('⚠️  Could not read package.json:', error.message);
            this.summary.frameworks.backend = 'Node.js (version unknown)';
            this.summary.frameworks.frontend = 'None detected';
            this.dependencies = {};
        }
    }

    /**
     * Clean version string helper
     */
    cleanVersion(version) {
        return version.replace(/[^0-9.]/g, '');
    }

    /**
     * Find top-level modules (folders inside /src/ or /packages/)
     */
    async findTopLevelModules() {
        const modulePaths = [
            'src/modules/*',
            'src/*',
            'packages/*',
            'apps/*'
        ];
        
        for (const pattern of modulePaths) {
            try {
                const dirs = await fg(pattern, {
                    cwd: this.projectRoot,
                    onlyDirectories: true,
                    deep: 1
                });
                
                dirs.forEach(dir => {
                    const moduleName = path.basename(dir);
                    // Exclude common non-module directories
                    if (!['node_modules', 'dist', 'build', 'coverage', 'test', 'tests', '__tests__', '.git', 'public', 'static'].includes(moduleName)) {
                        this.summary.modules.push(moduleName);
                    }
                });
            } catch (error) {
                // Directory doesn't exist, continue
            }
        }
    }

    /**
     * Find and classify services into business logic vs utilities
     */
    async findServices() {
        const servicePatterns = [
            '**/*Service.js',
            '**/*Service.ts',
            '**/*service.js',
            '**/*service.ts',
            '**/services/**/*.js',
            '**/services/**/*.ts',
            '**/*Util.js',
            '**/*Util.ts',
            '**/*util.js',
            '**/*util.ts',
            '**/*Helper.js',
            '**/*Helper.ts',
            '**/*helper.js',
            '**/*helper.ts'
        ];
        
        for (const pattern of servicePatterns) {
            try {
                const files = await fg(pattern, {
                    cwd: this.projectRoot,
                    ignore: ['node_modules/**', 'dist/**', 'build/**', 'coverage/**', 'test/**', 'tests/**']
                });
                
                for (const file of files) {
                    try {
                        const content = await fs.readFile(path.join(this.projectRoot, file), 'utf8');
                        this.classifyService(content, file);
                    } catch (error) {
                        // Skip files that can't be read
                    }
                }
            } catch (error) {
                // Pattern not found, continue
            }
        }
        
        this.summary.services.businessServices = Array.from(this.businessServices);
        this.summary.services.utilityServices = Array.from(this.utilityServices);
    }

    /**
     * Classify services into business vs utility based on name and content
     */
    classifyService(content, filePath) {
        const filename = path.basename(filePath, path.extname(filePath));
        
        // Extract class names
        const classMatches = content.match(/class\s+(\w+)/g);
        if (classMatches) {
            classMatches.forEach(match => {
                const className = match.replace('class ', '');
                if (this.isUtilityService(className, filename, content)) {
                    this.utilityServices.add(className);
                } else {
                    this.businessServices.add(className);
                }
            });
        }
        
        // Extract from filename if no class found
        if (!classMatches) {
            const serviceName = this.extractServiceNameFromFile(filename);
            if (serviceName) {
                if (this.isUtilityService(serviceName, filename, content)) {
                    this.utilityServices.add(serviceName);
                } else {
                    this.businessServices.add(serviceName);
                }
            }
        }
    }

    /**
     * Determine if a service is utility-based or business logic
     */
    isUtilityService(serviceName, filename, content) {
        const utilityKeywords = ['util', 'helper', 'common', 'shared', 'format', 'validate', 'parse', 'convert', 'transform', 'crypto', 'hash', 'logger', 'cache'];
        const businessKeywords = ['payment', 'user', 'order', 'product', 'booking', 'notification', 'chat', 'assessment', 'farm', 'livestock'];
        
        const lowerName = serviceName.toLowerCase();
        const lowerFile = filename.toLowerCase();
        const lowerContent = content.toLowerCase();
        
        // Check if it's explicitly a utility
        if (utilityKeywords.some(keyword => lowerName.includes(keyword) || lowerFile.includes(keyword))) {
            return true;
        }
        
        // Check if it's explicitly business logic
        if (businessKeywords.some(keyword => lowerName.includes(keyword) || lowerFile.includes(keyword))) {
            return false;
        }
        
        // Check content for utility patterns
        if (lowerContent.includes('format') || lowerContent.includes('validate') || lowerContent.includes('parse') || lowerContent.includes('transform')) {
            return true;
        }
        
        return false; // Default to business service
    }

    /**
     * Extract service name from filename
     */
    extractServiceNameFromFile(filename) {
        if (filename.includes('service') || filename.includes('Service') || filename.includes('util') || filename.includes('Util')) {
            return filename.charAt(0).toUpperCase() + filename.slice(1).replace(/[.-]/g, '').replace(/(service|util)$/i, 'Service');
        }
        return null;
    }

    /**
     * Find API routes with improved cleaning and categorization
     */
    async findApiRoutes() {
        const routePatterns = [
            '**/routes/**/*.js',
            '**/routes/**/*.ts',
            '**/controllers/**/*.js',
            '**/controllers/**/*.ts',
            '**/api/**/*.js',
            '**/api/**/*.ts',
            '**/*router*.js',
            '**/*router*.ts',
            '**/*route*.js',
            '**/*route*.ts'
        ];
        
        for (const pattern of routePatterns) {
            try {
                const files = await fg(pattern, {
                    cwd: this.projectRoot,
                    ignore: ['node_modules/**', 'dist/**', 'build/**', 'coverage/**']
                });
                
                for (const file of files) {
                    try {
                        const content = await fs.readFile(path.join(this.projectRoot, file), 'utf8');
                        this.extractCleanRoutes(content, file);
                    } catch (error) {
                        // Skip files that can't be read
                    }
                }
            } catch (error) {
                // Pattern not found, continue
            }
        }
        
        this.summary.apiRoutes.publicRoutes = Array.from(this.apiRoutePatterns);
        this.summary.apiRoutes.internalRoutes = Array.from(this.internalRoutePatterns);
    }

    /**
     * Extract and clean API routes
     */
    extractCleanRoutes(content, filePath) {
        const routeRegexes = [
            /router\.(get|post|put|patch|delete|use)\s*\(\s*['"`]([^'"`]+)['"`]/g,
            /app\.(get|post|put|patch|delete|use)\s*\(\s*['"`]([^'"`]+)['"`]/g,
            /\.route\s*\(\s*['"`]([^'"`]+)['"`]/g
        ];
        
        for (const regex of routeRegexes) {
            let match;
            while ((match = regex.exec(content)) !== null) {
                let route = match[2] || match[1];
                if (route && route.startsWith('/')) {
                    route = this.cleanRoute(route);
                    
                    if (this.isValidRoute(route)) {
                        if (this.isInternalRoute(route)) {
                            this.internalRoutePatterns.add(route);
                        } else {
                            this.apiRoutePatterns.add(route);
                        }
                    }
                }
            }
        }
    }

    /**
     * Clean route by removing/normalizing parameters
     */
    cleanRoute(route) {
        // Replace dynamic segments with normalized placeholders
        route = route.replace(/:[\w]+/g, ':id');
        route = route.replace(/\[.*?\]/g, ':id');
        
        // Remove query parameters
        route = route.split('?')[0];
        
        // Remove trailing slashes
        route = route.replace(/\/+$/, '');
        
        // Ensure it starts with /
        if (!route.startsWith('/')) {
            route = '/' + route;
        }
        
        return route || '/';
    }

    /**
     * Check if route is valid and meaningful
     */
    isValidRoute(route) {
        // Filter out overly generic or meaningless routes
        const invalidPatterns = [
            /^\/+$/,  // Just slashes
            /^\/(:id\/?)+$/,  // Only parameters
            /^\/middleware/i,  // Middleware routes
            /^\/test/i,  // Test routes
            /^\/health/i  // Health check routes (usually internal)
        ];
        
        if (invalidPatterns.some(pattern => pattern.test(route))) {
            return false;
        }
        
        // Must have at least one meaningful path segment
        const segments = route.split('/').filter(Boolean);
        const meaningfulSegments = segments.filter(segment => segment !== ':id' && segment.length > 1);
        
        return meaningfulSegments.length > 0;
    }

    /**
     * Determine if route is internal/admin vs public
     */
    isInternalRoute(route) {
        const internalPatterns = [
            /\/admin/i,
            /\/internal/i,
            /\/debug/i,
            /\/analytics/i,
            /\/metrics/i,
            /\/logs/i,
            /\/config/i,
            /\/cron/i,
            /\/webhook/i
        ];
        
        return internalPatterns.some(pattern => pattern.test(route));
    }

    /**
     * Find database models with enhanced detection
     */
    async findDatabaseModels() {
        const modelPatterns = [
            '**/*Model.js',
            '**/*Model.ts',
            '**/*model.js',
            '**/*model.ts',
            '**/models/**/*.js',
            '**/models/**/*.ts',
            '**/schemas/**/*.js',
            '**/schemas/**/*.ts',
            '**/entities/**/*.js',
            '**/entities/**/*.ts'
        ];
        
        for (const pattern of modelPatterns) {
            try {
                const files = await fg(pattern, {
                    cwd: this.projectRoot,
                    ignore: ['node_modules/**', 'dist/**', 'build/**', 'coverage/**', 'test/**', 'tests/**']
                });
                
                for (const file of files) {
                    try {
                        const content = await fs.readFile(path.join(this.projectRoot, file), 'utf8');
                        this.extractModelNames(content, file);
                    } catch (error) {
                        // Skip files that can't be read
                    }
                }
            } catch (error) {
                // Pattern not found, continue
            }
        }
        
        this.summary.dbModels = Array.from(this.modelClasses);
    }

    /**
     * Extract model names from various patterns
     */
    extractModelNames(content, filePath) {
        // Class-based models
        const classMatches = content.match(/class\s+(\w+)(?:\s+extends|\s+implements|\s*{)/g);
        if (classMatches) {
            classMatches.forEach(match => {
                const className = match.replace(/class\s+/, '').replace(/\s+(extends|implements).*/, '').replace(/\s*{.*/, '');
                if (className && !['Model', 'Entity', 'Schema'].includes(className)) {
                    this.modelClasses.add(className);
                }
            });
        }
        
        // Mongoose models
        const mongooseMatches = content.match(/mongoose\.model\s*\(\s*['"`](\w+)['"`]/g);
        if (mongooseMatches) {
            mongooseMatches.forEach(match => {
                const modelName = match.match(/['"`](\w+)['"`]/)[1];
                this.modelClasses.add(modelName);
            });
        }
        
        // Sequelize models
        const sequelizeDefine = content.match(/sequelize\.define\s*\(\s*['"`](\w+)['"`]/g);
        if (sequelizeDefine) {
            sequelizeDefine.forEach(match => {
                const modelName = match.match(/['"`](\w+)['"`]/)[1];
                this.modelClasses.add(modelName.charAt(0).toUpperCase() + modelName.slice(1));
            });
        }
        
        // Schema definitions
        const schemaMatches = content.match(/const\s+(\w+Schema)\s*=/g);
        if (schemaMatches) {
            schemaMatches.forEach(match => {
                const schemaName = match.match(/const\s+(\w+Schema)/)[1];
                const modelName = schemaName.replace('Schema', '');
                if (modelName) {
                    this.modelClasses.add(modelName);
                }
            });
        }
    }

    /**
     * Deep utility analysis with domain categorization
     */
    async findUtilityFiles() {
        const utilPatterns = [
            '**/utils/**/*.js',
            '**/utils/**/*.ts',
            '**/util/**/*.js',
            '**/util/**/*.ts',
            '**/helpers/**/*.js',
            '**/helpers/**/*.ts',
            '**/lib/**/*.js',
            '**/lib/**/*.ts',
            '**/*util*.js',
            '**/*util*.ts',
            '**/*helper*.js',
            '**/*helper*.ts'
        ];
        
        for (const pattern of utilPatterns) {
            try {
                const files = await fg(pattern, {
                    cwd: this.projectRoot,
                    ignore: ['node_modules/**', 'dist/**', 'build/**', 'coverage/**', 'test/**', 'tests/**']
                });
                
                for (const file of files) {
                    try {
                        const content = await fs.readFile(path.join(this.projectRoot, file), 'utf8');
                        await this.analyzeUtilityFile(file, content);
                    } catch (error) {
                        // Skip files that can't be read
                    }
                }
            } catch (error) {
                // Pattern not found, continue
            }
        }
        
        this.organizeUtilities();
    }

    /**
     * Analyze utility file content to extract functions and categorize by domain
     */
    async analyzeUtilityFile(filePath, content) {
        const filename = path.basename(filePath);
        const functions = this.extractFunctions(content);
        const domain = this.categorizeDomain(filename, functions, content);
        
        this.utilityAnalysis.set(filename, {
            domain,
            functions,
            path: filePath
        });
    }

    /**
     * Extract function names from utility files
     */
    extractFunctions(content) {
        const functions = new Set();
        
        // Function declarations
        const funcDeclarations = content.match(/function\s+(\w+)/g);
        if (funcDeclarations) {
            funcDeclarations.forEach(match => {
                const funcName = match.replace('function ', '');
                functions.add(funcName);
            });
        }
        
        // Arrow functions assigned to const/let
        const arrowFunctions = content.match(/(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(/g);
        if (arrowFunctions) {
            arrowFunctions.forEach(match => {
                const funcName = match.match(/(?:const|let|var)\s+(\w+)/)[1];
                functions.add(funcName);
            });
        }
        
        // Exported functions
        const exports = content.match(/exports?\.(\w+)/g);
        if (exports) {
            exports.forEach(match => {
                const funcName = match.replace(/exports?\./, '');
                functions.add(funcName);
            });
        }
        
        return Array.from(functions);
    }

    /**
     * Categorize utility by domain based on filename and content
     */
    categorizeDomain(filename, functions, content) {
        const domains = {
            'Date/Time': ['date', 'time', 'moment', 'format', 'parse'],
            'Validation': ['validate', 'check', 'verify', 'sanitize'],
            'String/Text': ['string', 'text', 'format', 'escape', 'trim'],
            'Math/Calculation': ['math', 'calculate', 'compute', 'sum', 'average'],
            'API/HTTP': ['api', 'http', 'request', 'response', 'fetch'],
            'Database': ['db', 'sql', 'query', 'connection'],
            'File/IO': ['file', 'read', 'write', 'upload', 'download'],
            'Crypto/Security': ['crypto', 'hash', 'encrypt', 'decrypt', 'jwt'],
            'Logging': ['log', 'debug', 'info', 'error', 'trace'],
            'Cache': ['cache', 'redis', 'memory', 'store'],
            'Auth': ['auth', 'login', 'token', 'permission', 'role'],
            'General': []
        };
        
        const lowerFilename = filename.toLowerCase();
        const lowerContent = content.toLowerCase();
        const allFunctions = functions.join(' ').toLowerCase();
        
        for (const [domain, keywords] of Object.entries(domains)) {
            if (domain === 'General') continue;
            
            if (keywords.some(keyword => 
                lowerFilename.includes(keyword) || 
                lowerContent.includes(keyword) || 
                allFunctions.includes(keyword)
            )) {
                return domain;
            }
        }
        
        return 'General';
    }

    /**
     * Organize utilities by domain
     */
    organizeUtilities() {
        const byDomain = {};
        const files = [];
        
        for (const [filename, analysis] of this.utilityAnalysis) {
            files.push({
                name: filename,
                domain: analysis.domain,
                functions: analysis.functions
            });
            
            if (!byDomain[analysis.domain]) {
                byDomain[analysis.domain] = [];
            }
            byDomain[analysis.domain].push({
                file: filename,
                functions: analysis.functions
            });
        }
        
        this.summary.utils = {
            byDomain,
            files
        };
    }

    /**
     * Detect global patterns with enhanced coverage
     */
    async detectGlobalPatterns() {
        const patterns = [];
        
        // Database patterns
        if (this.dependencies.mongoose) patterns.push('Mongoose ODM');
        if (this.dependencies.sequelize) patterns.push('Sequelize ORM');
        if (this.dependencies.prisma || this.dependencies['@prisma/client']) patterns.push('Prisma ORM');
        if (this.dependencies.typeorm) patterns.push('TypeORM');
        
        // Validation patterns
        if (this.dependencies.joi) patterns.push('Joi validation');
        if (this.dependencies.zod) patterns.push('Zod validation');
        if (this.dependencies.yup) patterns.push('Yup validation');
        if (this.dependencies.celebrate) patterns.push('Celebrate validation');
        
        // Authentication patterns
        if (this.dependencies.jsonwebtoken) patterns.push('JWT Authentication');
        if (this.dependencies.passport) patterns.push('Passport.js Authentication');
        if (this.dependencies['express-session']) patterns.push('Session-based Authentication');
        
        // Testing patterns
        if (this.dependencies.jest) patterns.push('Jest Testing');
        if (this.dependencies.mocha) patterns.push('Mocha Testing');
        if (this.dependencies.vitest) patterns.push('Vitest Testing');
        
        // State management
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
        
        // Real-time
        if (this.dependencies['socket.io']) patterns.push('Socket.IO');
        
        // GraphQL
        if (this.dependencies.graphql) patterns.push('GraphQL');
        
        // Additional code patterns
        await this.detectCodePatterns(patterns);
        
        this.summary.globalPatterns = patterns;
    }

    /**
     * Detect patterns from code analysis
     */
    async detectCodePatterns(patterns) {
        try {
            const files = await fg(['src/**/*.js', 'src/**/*.ts'], {
                cwd: this.projectRoot,
                ignore: ['node_modules/**', 'dist/**', 'build/**', 'coverage/**', 'test/**', 'tests/**']
            });
            
            const sampleContent = await Promise.all(
                files.slice(0, 50).map(async file => {
                    try {
                        return await fs.readFile(path.join(this.projectRoot, file), 'utf8');
                    } catch {
                        return '';
                    }
                })
            );
            
            const allCode = sampleContent.join('\n');
            
            if (allCode.includes('useEffect') || allCode.includes('useState')) patterns.push('React Hooks');
            if (allCode.includes('async') && allCode.includes('await')) patterns.push('Async/Await Pattern');
            if (allCode.includes('middleware') || allCode.includes('Middleware')) patterns.push('Middleware Pattern');
            if (allCode.includes('dependency injection') || allCode.includes('inject')) patterns.push('Dependency Injection');
            if (allCode.includes('interface ') && allCode.includes('implements ')) patterns.push('TypeScript Interfaces');
            
        } catch (error) {
            console.warn('⚠️  Could not analyze code patterns:', error.message);
        }
    }

    /**
     * Clean up and organize results
     */
    cleanupResults() {
        // Remove duplicates and sort
        this.summary.modules = [...new Set(this.summary.modules)].sort();
        this.summary.services.businessServices = [...new Set(this.summary.services.businessServices)].sort();
        this.summary.services.utilityServices = [...new Set(this.summary.services.utilityServices)].sort();
        this.summary.apiRoutes.publicRoutes = [...new Set(this.summary.apiRoutes.publicRoutes)].sort();
        this.summary.apiRoutes.internalRoutes = [...new Set(this.summary.apiRoutes.internalRoutes)].sort();
        this.summary.dbModels = [...new Set(this.summary.dbModels)].sort();
        this.summary.globalPatterns = [...new Set(this.summary.globalPatterns)].sort();
        
        // Limit results to reasonable numbers
        this.summary.modules = this.summary.modules.slice(0, 50);
        this.summary.services.businessServices = this.summary.services.businessServices.slice(0, 100);
        this.summary.services.utilityServices = this.summary.services.utilityServices.slice(0, 50);
        this.summary.apiRoutes.publicRoutes = this.summary.apiRoutes.publicRoutes.slice(0, 100);
        this.summary.apiRoutes.internalRoutes = this.summary.apiRoutes.internalRoutes.slice(0, 50);
        this.summary.dbModels = this.summary.dbModels.slice(0, 100);
    }

    /**
     * Write enhanced output to JSON file
     */
    async writeOutput() {
        const outputPath = path.join(this.projectRoot, 'code-review-summary.json');
        await fs.writeFile(outputPath, JSON.stringify(this.summary, null, 2), 'utf8');
        
        // Enhanced console output
        console.log('\n📊 Enhanced Codebase Summary:');
        console.log(`📁 Modules (${this.summary.modules.length}):`, this.summary.modules.slice(0, 10).join(', '), '...');
        console.log(`⚙️  Business Services (${this.summary.services.businessServices.length}):`, this.summary.services.businessServices.slice(0, 10).join(', '), '...');
        console.log(`🛠️  Utility Services (${this.summary.services.utilityServices.length}):`, this.summary.services.utilityServices.slice(0, 10).join(', '), '...');
        console.log(`🌐 Public Routes (${this.summary.apiRoutes.publicRoutes.length}):`, this.summary.apiRoutes.publicRoutes.slice(0, 5).join(', '), '...');
        console.log(`🔒 Internal Routes (${this.summary.apiRoutes.internalRoutes.length}):`, this.summary.apiRoutes.internalRoutes.slice(0, 5).join(', '), '...');
        console.log(`🗄️  DB Models (${this.summary.dbModels.length}):`, this.summary.dbModels.slice(0, 10).join(', '), '...');
        console.log(`📁 Utility Domains:`, Object.keys(this.summary.utils.byDomain).join(', '));
        console.log(`🏗️  Frameworks:`, this.summary.frameworks.backend, '|', this.summary.frameworks.frontend);
        console.log(`🎯 Patterns (${this.summary.globalPatterns.length}):`, this.summary.globalPatterns.join(', '));
    }
}

/**
 * Install required dependencies if not present
 */
async function ensureDependencies() {
    try {
        require('fast-glob');
    } catch (error) {
        console.log('📦 Installing required dependency: fast-glob...');
        const { execSync } = require('child_process');
        try {
            execSync('npm install fast-glob', { stdio: 'inherit' });
            console.log('✅ Dependencies installed!');
        } catch (installError) {
            console.error('❌ Failed to install dependencies. Please run: npm install fast-glob');
            process.exit(1);
        }
    }
}

/**
 * Main execution
 */
async function main() {
    console.log('🚀 Codebase Summarizer v2.0 (Production Ready)');
    console.log('===============================================\n');
    
    try {
        await ensureDependencies();
        const summarizer = new CodebaseSummarizer();
        await summarizer.analyze();
    } catch (error) {
        console.error('💥 Fatal error:', error.message);
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    main();
}

module.exports = CodebaseSummarizer;
