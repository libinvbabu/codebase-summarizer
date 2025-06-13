import path from 'path';
import fs from 'fs/promises';
import fg from 'fast-glob';

export class PayloadExtractor {
  constructor(projectRoot, limit = 100) {
    this.projectRoot = projectRoot;
    this.limit = limit;
    this.payloads = {};
  }

  async extract() {
    console.log('📦 Extracting API payloads...');
    
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

    return this.payloads;
  }

  async analyzeRouteFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      
      // Analyze different route patterns
      this.analyzeExpressRoutes(content);
      this.analyzeJoiValidation(content);
      this.analyzeCelebrateValidation(content);
      this.analyzeYupValidation(content);
      this.analyzeTypeScriptDTOs(content);
      this.analyzeSwaggerDocs(content);
      
    } catch (error) {
      console.warn(`⚠️ Error analyzing route file ${filePath}:`, error.message);
    }
  }

  analyzeExpressRoutes(content) {
    // Express route patterns: router.get('/path', handler)
    const routeMatches = content.matchAll(/(router|app)\.(get|post|put|patch|delete)\s*\(\s*['"](.*?)['"],?\s*([^)]+)\)/g);
    
    for (const match of routeMatches) {
      const method = match[2].toUpperCase();
      const route = match[3];
      const handlerCode = match[4];
      
      const fullRoute = `${method} ${route}`;
      
      if (!this.payloads[fullRoute]) {
        this.payloads[fullRoute] = {
          request: {},
          response: {}
        };
      }
      
      // Try to extract payload info from handler
      this.analyzeHandlerCode(handlerCode, this.payloads[fullRoute]);
    }
  }

  analyzeJoiValidation(content) {
    // Joi validation patterns
    const joiSchemas = content.matchAll(/const\s+(\w+Schema)\s*=\s*Joi\.object\s*\(\s*\{([^}]+)\}/g);
    
    for (const match of joiSchemas) {
      const schemaName = match[1];
      const schemaDefinition = match[2];
      const parsedSchema = this.parseJoiSchema(schemaDefinition);
      
      // Try to find routes that use this schema
      this.linkSchemaToRoutes(content, schemaName, parsedSchema);
    }
  }

  analyzeCelebrateValidation(content) {
    // Celebrate validation patterns
    const celebrateMatches = content.matchAll(/celebrate\s*\(\s*\{([^}]+)\}/g);
    
    for (const match of celebrateMatches) {
      const validationDefinition = match[1];
      const payload = this.parseCelebrateValidation(validationDefinition);
      
      // Find associated route
      const routeContext = this.findRouteContext(content, match.index);
      if (routeContext && payload) {
        if (!this.payloads[routeContext]) {
          this.payloads[routeContext] = { request: {}, response: {} };
        }
        Object.assign(this.payloads[routeContext], payload);
      }
    }
  }

  analyzeYupValidation(content) {
    // Yup validation patterns
    const yupSchemas = content.matchAll(/yup\.object\s*\(\s*\{([^}]+)\}/g);
    
    for (const match of yupSchemas) {
      const schemaDefinition = match[1];
      const parsedSchema = this.parseYupSchema(schemaDefinition);
      
      // Context-based linking would be implemented here
    }
  }

  analyzeTypeScriptDTOs(content) {
    // TypeScript interface/type definitions
    const interfaceMatches = content.matchAll(/interface\s+(\w+(?:Request|Response|DTO))\s*\{([^}]+)\}/g);
    
    for (const match of interfaceMatches) {
      const interfaceName = match[1];
      const interfaceDefinition = match[2];
      const parsedInterface = this.parseTypeScriptInterface(interfaceDefinition);
      
      // Try to link to routes based on naming conventions
      this.linkTypeScriptDTOToRoutes(content, interfaceName, parsedInterface);
    }

    // Type aliases
    const typeMatches = content.matchAll(/type\s+(\w+(?:Request|Response|DTO))\s*=\s*\{([^}]+)\}/g);
    
    for (const match of typeMatches) {
      const typeName = match[1];
      const typeDefinition = match[2];
      const parsedType = this.parseTypeScriptInterface(typeDefinition);
      
      this.linkTypeScriptDTOToRoutes(content, typeName, parsedType);
    }
  }

  analyzeSwaggerDocs(content) {
    // Swagger/OpenAPI documentation comments
    const swaggerMatches = content.matchAll(/\/\*\*[^*]*@swagger[^*]*\*\/\s*(?:router|app)\.(get|post|put|patch|delete)\s*\(\s*['"](.*?)['"]]/g);
    
    for (const match of swaggerMatches) {
      const method = match[1].toUpperCase();
      const route = match[2];
      const swaggerComment = match[0];
      
      const fullRoute = `${method} ${route}`;
      const payload = this.parseSwaggerComment(swaggerComment);
      
      if (payload) {
        this.payloads[fullRoute] = payload;
      }
    }
  }

  parseJoiSchema(schemaDefinition) {
    const fields = {};
    
    const fieldMatches = schemaDefinition.matchAll(/([a-zA-Z0-9_]+):\s*Joi\.(\w+)\(\)/g);
    for (const match of fieldMatches) {
      const fieldName = match[1];
      const fieldType = this.normalizeJoiType(match[2]);
      fields[fieldName] = fieldType;
    }
    
    return fields;
  }

  parseCelebrateValidation(validationDefinition) {
    const payload = { request: {}, response: {} };
    
    // Parse body validation
    const bodyMatch = validationDefinition.match(/body:\s*Joi\.object\s*\(\s*\{([^}]+)\}/);
    if (bodyMatch) {
      payload.request = this.parseJoiSchema(bodyMatch[1]);
    }
    
    // Parse query validation
    const queryMatch = validationDefinition.match(/query:\s*Joi\.object\s*\(\s*\{([^}]+)\}/);
    if (queryMatch) {
      payload.request = { ...payload.request, ...this.parseJoiSchema(queryMatch[1]) };
    }
    
    // Parse params validation
    const paramsMatch = validationDefinition.match(/params:\s*Joi\.object\s*\(\s*\{([^}]+)\}/);
    if (paramsMatch) {
      payload.request = { ...payload.request, ...this.parseJoiSchema(paramsMatch[1]) };
    }
    
    return payload;
  }

  parseYupSchema(schemaDefinition) {
    const fields = {};
    
    const fieldMatches = schemaDefinition.matchAll(/([a-zA-Z0-9_]+):\s*yup\.(\w+)\(\)/g);
    for (const match of fieldMatches) {
      const fieldName = match[1];
      const fieldType = this.normalizeYupType(match[2]);
      fields[fieldName] = fieldType;
    }
    
    return fields;
  }

  parseTypeScriptInterface(interfaceDefinition) {
    const fields = {};
    
    const fieldMatches = interfaceDefinition.matchAll(/([a-zA-Z0-9_]+)(\?)?:\s*([^;,\n]+)/g);
    for (const match of fieldMatches) {
      const fieldName = match[1];
      const isOptional = match[2] === '?';
      const fieldType = match[3].trim();
      
      fields[fieldName] = isOptional ? `${fieldType} (optional)` : fieldType;
    }
    
    return fields;
  }

  parseSwaggerComment(swaggerComment) {
    const payload = { request: {}, response: {} };
    
    // Parse request body schema from swagger
    const requestBodyMatch = swaggerComment.match(/requestBody:[\s\S]*?schema:[\s\S]*?properties:\s*\{([^}]+)\}/);
    if (requestBodyMatch) {
      payload.request = this.parseSwaggerProperties(requestBodyMatch[1]);
    }
    
    // Parse response schema
    const responseMatch = swaggerComment.match(/responses:[\s\S]*?200:[\s\S]*?schema:[\s\S]*?properties:\s*\{([^}]+)\}/);
    if (responseMatch) {
      payload.response = this.parseSwaggerProperties(responseMatch[1]);
    }
    
    return payload;
  }

  parseSwaggerProperties(propertiesDefinition) {
    const fields = {};
    
    const propertyMatches = propertiesDefinition.matchAll(/([a-zA-Z0-9_]+):\s*\{\s*type:\s*['"](.*?)['"](?:\s*,\s*description:\s*['"](.*?)['"])?\s*\}/g);
    for (const match of propertyMatches) {
      const fieldName = match[1];
      const fieldType = match[2];
      const description = match[3];
      
      fields[fieldName] = description ? `${fieldType} (${description})` : fieldType;
    }
    
    return fields;
  }

  analyzeHandlerCode(handlerCode, payload) {
    // Look for req.body destructuring
    const bodyDestructureMatch = handlerCode.match(/\{\s*([^}]+)\s*\}\s*=\s*req\.body/);
    if (bodyDestructureMatch) {
      const fields = bodyDestructureMatch[1].split(',').map(f => f.trim());
      for (const field of fields) {
        payload.request[field] = 'unknown';
      }
    }
    
    // Look for res.json() calls
    const responseMatches = handlerCode.matchAll(/res\.json\s*\(\s*\{([^}]+)\}/g);
    for (const match of responseMatches) {
      const responseFields = this.parseObjectLiteral(match[1]);
      Object.assign(payload.response, responseFields);
    }
  }

  parseObjectLiteral(objectContent) {
    const fields = {};
    
    const fieldMatches = objectContent.matchAll(/([a-zA-Z0-9_]+):\s*([^,}]+)/g);
    for (const match of fieldMatches) {
      const fieldName = match[1];
      const fieldValue = match[2].trim();
      
      // Try to infer type from value
      let type = 'unknown';
      if (fieldValue.startsWith('"') || fieldValue.startsWith("'")) {
        type = 'string';
      } else if (!isNaN(fieldValue)) {
        type = 'number';
      } else if (fieldValue === 'true' || fieldValue === 'false') {
        type = 'boolean';
      }
      
      fields[fieldName] = type;
    }
    
    return fields;
  }

  findRouteContext(content, matchIndex) {
    // Find the nearest route definition before this validation
    const beforeContent = content.substring(0, matchIndex);
    const routeMatch = beforeContent.match(/(router|app)\.(get|post|put|patch|delete)\s*\(\s*['"](.*?)['"](?:.*?)$/);
    
    if (routeMatch) {
      const method = routeMatch[2].toUpperCase();
      const route = routeMatch[3];
      return `${method} ${route}`;
    }
    
    return null;
  }

  linkSchemaToRoutes(content, schemaName, schema) {
    // Find routes that reference this schema
    const usageMatches = content.matchAll(new RegExp(`${schemaName}|validate\\s*\\(\\s*${schemaName}\\s*\\)`, 'g'));
    
    for (const match of usageMatches) {
      const routeContext = this.findRouteContext(content, match.index);
      if (routeContext) {
        if (!this.payloads[routeContext]) {
          this.payloads[routeContext] = { request: {}, response: {} };
        }
        Object.assign(this.payloads[routeContext].request, schema);
      }
    }
  }

  linkTypeScriptDTOToRoutes(content, interfaceName, interfaceSchema) {
    // Link based on naming conventions
    const routeHint = this.extractRouteFromInterfaceName(interfaceName);
    
    if (routeHint) {
      // Try to find matching routes
      const routeMatches = content.matchAll(/(router|app)\.(get|post|put|patch|delete)\s*\(\s*['"](.*?)['"],?/g);
      
      for (const match of routeMatches) {
        const method = match[2].toUpperCase();
        const route = match[3];
        const fullRoute = `${method} ${route}`;
        
        if (route.includes(routeHint) || routeHint.includes(route.replace(/[^\w]/g, ''))) {
          if (!this.payloads[fullRoute]) {
            this.payloads[fullRoute] = { request: {}, response: {} };
          }
          
          if (interfaceName.includes('Request')) {
            Object.assign(this.payloads[fullRoute].request, interfaceSchema);
          } else if (interfaceName.includes('Response')) {
            Object.assign(this.payloads[fullRoute].response, interfaceSchema);
          }
        }
      }
    }
  }

  extractRouteFromInterfaceName(interfaceName) {
    // Extract route hints from interface names like CreateOrderRequest -> order
    const cleaned = interfaceName
      .replace(/Request|Response|DTO/g, '')
      .replace(/^(Create|Update|Delete|Get)/, '')
      .toLowerCase();
    
    return cleaned;
  }

  normalizeJoiType(joiType) {
    const typeMap = {
      'string': 'string',
      'number': 'number',
      'boolean': 'boolean',
      'date': 'date',
      'array': 'array',
      'object': 'object'
    };
    
    return typeMap[joiType.toLowerCase()] || joiType;
  }

  normalizeYupType(yupType) {
    const typeMap = {
      'string': 'string',
      'number': 'number',
      'boolean': 'boolean',
      'date': 'date',
      'array': 'array',
      'object': 'object'
    };
    
    return typeMap[yupType.toLowerCase()] || yupType;
  }
}
