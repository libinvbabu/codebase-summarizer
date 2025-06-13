import path from 'path';
import fs from 'fs/promises';
import fg from 'fast-glob';

export class SchemaSnapshotExtractor {
  constructor(projectRoot, limit = 100) {
    this.projectRoot = projectRoot;
    this.limit = limit;
    this.schemas = {};
  }

  async extract() {
    console.log('🗂️ Extracting model schemas...');
    
    // Find model files
    const modelPatterns = [
      '**/models/**/*.{js,ts}',
      '**/model/**/*.{js,ts}',
      '**/*Model.{js,ts}',
      '**/*model.{js,ts}',
      '**/schemas/**/*.{js,ts}',
      '**/schema/**/*.{js,ts}'
    ];

    const files = await fg(modelPatterns, {
      cwd: this.projectRoot,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/coverage/**', '**/test*/**'],
      absolute: true
    });

    await Promise.all(files.map(file => this.analyzeModelFile(file)));

    return this.schemas;
  }

  async analyzeModelFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const filename = path.basename(filePath, path.extname(filePath));
      
      // Try different ORM patterns
      this.analyzeSequelizeModel(content, filename);
      this.analyzeMongooseModel(content, filename);
      this.analyzePrismaModel(content, filename);
      this.analyzeTypeORMModel(content, filename);
      this.analyzeGenericModel(content, filename);
      
    } catch (error) {
      console.warn(`⚠️ Error analyzing model file ${filePath}:`, error.message);
    }
  }

  analyzeSequelizeModel(content, filename) {
    // Sequelize.define() pattern
    const defineMatches = content.matchAll(/sequelize\.define\s*\(\s*['"](.*?)['"],\s*\{([^}]+)\}/g);
    for (const match of defineMatches) {
      const modelName = match[1];
      const schemaDefinition = match[2];
      this.schemas[modelName] = this.parseSequelizeSchema(schemaDefinition);
    }

    // Model.init() pattern
    const initMatches = content.matchAll(/([A-Za-z0-9_]+)\.init\s*\(\s*\{([^}]+)\}/g);
    for (const match of initMatches) {
      const modelName = match[1];
      const schemaDefinition = match[2];
      this.schemas[modelName] = this.parseSequelizeSchema(schemaDefinition);
    }
  }

  analyzeMongooseModel(content, filename) {
    // mongoose.Schema() pattern
    const schemaMatches = content.matchAll(/new\s+mongoose\.Schema\s*\(\s*\{([^}]+)\}/g);
    for (const match of schemaMatches) {
      const schemaDefinition = match[1];
      const modelName = this.extractModelNameFromFile(filename, content);
      if (modelName) {
        this.schemas[modelName] = this.parseMongooseSchema(schemaDefinition);
      }
    }

    // Schema() constructor pattern
    const constructorMatches = content.matchAll(/new\s+Schema\s*\(\s*\{([^}]+)\}/g);
    for (const match of constructorMatches) {
      const schemaDefinition = match[1];
      const modelName = this.extractModelNameFromFile(filename, content);
      if (modelName) {
        this.schemas[modelName] = this.parseMongooseSchema(schemaDefinition);
      }
    }
  }

  analyzePrismaModel(content, filename) {
    // Prisma model definitions (from generated client or schema)
    const modelMatches = content.matchAll(/model\s+([A-Za-z0-9_]+)\s*\{([^}]+)\}/g);
    for (const match of modelMatches) {
      const modelName = match[1];
      const schemaDefinition = match[2];
      this.schemas[modelName] = this.parsePrismaSchema(schemaDefinition);
    }
  }

  analyzeTypeORMModel(content, filename) {
    // TypeORM Entity decorators
    const entityMatch = content.match(/@Entity\s*\(\s*['"](.*?)['"]?\s*\)/);
    const className = content.match(/class\s+([A-Za-z0-9_]+)/);
    
    if (entityMatch || className) {
      const modelName = entityMatch ? entityMatch[1] : (className ? className[1] : filename);
      this.schemas[modelName] = this.parseTypeORMSchema(content);
    }
  }

  analyzeGenericModel(content, filename) {
    // Generic class-based models
    const classMatch = content.match(/class\s+([A-Za-z0-9_]+(?:Model)?)/);
    if (classMatch) {
      const modelName = classMatch[1];
      const fields = this.parseGenericClassFields(content);
      if (Object.keys(fields).length > 0) {
        this.schemas[modelName] = fields;
      }
    }
  }

  parseSequelizeSchema(schemaDefinition) {
    const fields = {};
    
    // Parse field definitions
    const fieldMatches = schemaDefinition.matchAll(/([a-zA-Z0-9_]+):\s*\{([^}]+)\}/g);
    for (const match of fieldMatches) {
      const fieldName = match[1];
      const fieldDefinition = match[2];
      fields[fieldName] = this.parseSequelizeField(fieldDefinition);
    }

    // Simple field definitions
    const simpleMatches = schemaDefinition.matchAll(/([a-zA-Z0-9_]+):\s*([A-Za-z.]+)/g);
    for (const match of simpleMatches) {
      const fieldName = match[1];
      const fieldType = match[2];
      if (!fields[fieldName]) {
        fields[fieldName] = this.normalizeSequelizeType(fieldType);
      }
    }

    return fields;
  }

  parseSequelizeField(fieldDefinition) {
    const typeMatch = fieldDefinition.match(/type:\s*([A-Za-z.()]+)/);
    const allowNullMatch = fieldDefinition.match(/allowNull:\s*(true|false)/);
    const defaultValueMatch = fieldDefinition.match(/defaultValue:\s*([^,}]+)/);

    let type = typeMatch ? this.normalizeSequelizeType(typeMatch[1]) : 'Unknown';
    
    if (allowNullMatch && allowNullMatch[1] === 'false') {
      type += ' (required)';
    }
    
    if (defaultValueMatch) {
      type += ` (default: ${defaultValueMatch[1].trim()})`;
    }

    return type;
  }

  parseMongooseSchema(schemaDefinition) {
    const fields = {};
    
    // Parse field definitions
    const fieldMatches = schemaDefinition.matchAll(/([a-zA-Z0-9_]+):\s*\{([^}]+)\}/g);
    for (const match of fieldMatches) {
      const fieldName = match[1];
      const fieldDefinition = match[2];
      fields[fieldName] = this.parseMongooseField(fieldDefinition);
    }

    // Simple field definitions
    const simpleMatches = schemaDefinition.matchAll(/([a-zA-Z0-9_]+):\s*([A-Za-z.]+)/g);
    for (const match of simpleMatches) {
      const fieldName = match[1];
      const fieldType = match[2];
      if (!fields[fieldName]) {
        fields[fieldName] = this.normalizeMongooseType(fieldType);
      }
    }

    return fields;
  }

  parseMongooseField(fieldDefinition) {
    const typeMatch = fieldDefinition.match(/type:\s*([A-Za-z.]+)/);
    const requiredMatch = fieldDefinition.match(/required:\s*(true|false)/);
    const defaultMatch = fieldDefinition.match(/default:\s*([^,}]+)/);
    const enumMatch = fieldDefinition.match(/enum:\s*\[([^\]]+)\]/);

    let type = typeMatch ? this.normalizeMongooseType(typeMatch[1]) : 'Unknown';
    
    if (enumMatch) {
      const enumValues = enumMatch[1].split(',').map(v => v.trim().replace(/['"]/g, ''));
      type = `Enum(${enumValues.join(', ')})`;
    }
    
    if (requiredMatch && requiredMatch[1] === 'true') {
      type += ' (required)';
    }
    
    if (defaultMatch) {
      type += ` (default: ${defaultMatch[1].trim()})`;
    }

    return type;
  }

  parsePrismaSchema(schemaDefinition) {
    const fields = {};
    
    const fieldMatches = schemaDefinition.matchAll(/([a-zA-Z0-9_]+)\s+([A-Za-z0-9_\[\]?]+)(?:\s+([^@\n]+))?/g);
    for (const match of fieldMatches) {
      const fieldName = match[1];
      const fieldType = match[2];
      const modifiers = match[3] || '';
      
      let type = this.normalizePrismaType(fieldType);
      
      if (modifiers.includes('@default')) {
        const defaultMatch = modifiers.match(/@default\(([^)]+)\)/);
        if (defaultMatch) {
          type += ` (default: ${defaultMatch[1]})`;
        }
      }
      
      fields[fieldName] = type;
    }

    return fields;
  }

  parseTypeORMSchema(content) {
    const fields = {};
    
    // Parse column decorators
    const columnMatches = content.matchAll(/@Column\s*\(([^)]*)\)\s*([a-zA-Z0-9_]+):\s*([^;]+)/g);
    for (const match of columnMatches) {
      const columnDef = match[1];
      const fieldName = match[2];
      const fieldType = match[3];
      
      fields[fieldName] = this.normalizeTypeORMType(fieldType, columnDef);
    }

    // Parse simple property declarations
    const propertyMatches = content.matchAll(/([a-zA-Z0-9_]+):\s*([A-Za-z0-9_<>|\s]+);/g);
    for (const match of propertyMatches) {
      const fieldName = match[1];
      const fieldType = match[2];
      
      if (!fields[fieldName] && !fieldType.includes('()')) {
        fields[fieldName] = this.normalizeTypeScriptType(fieldType);
      }
    }

    return fields;
  }

  parseGenericClassFields(content) {
    const fields = {};
    
    // Parse property declarations
    const propertyMatches = content.matchAll(/(?:public|private|protected)?\s*([a-zA-Z0-9_]+):\s*([A-Za-z0-9_<>|\s]+);/g);
    for (const match of propertyMatches) {
      const fieldName = match[1];
      const fieldType = match[2];
      fields[fieldName] = this.normalizeTypeScriptType(fieldType);
    }

    return fields;
  }

  extractModelNameFromFile(filename, content) {
    // Try to extract from mongoose.model() call
    const modelMatch = content.match(/mongoose\.model\s*\(\s*['"](.*?)['"]/) || content.match(/export\s+.*?=\s*mongoose\.model\s*\(\s*['"](.*?)['"]]/);
    if (modelMatch) {
      return modelMatch[1];
    }

    // Try to extract from class name
    const classMatch = content.match(/class\s+([A-Za-z0-9_]+)/);
    if (classMatch) {
      return classMatch[1];
    }

    // Fall back to filename
    return filename.charAt(0).toUpperCase() + filename.slice(1).replace(/model$/i, '');
  }

  normalizeSequelizeType(type) {
    const typeMap = {
      'DataTypes.STRING': 'String',
      'DataTypes.INTEGER': 'Number',
      'DataTypes.FLOAT': 'Number',
      'DataTypes.BOOLEAN': 'Boolean',
      'DataTypes.DATE': 'Date',
      'DataTypes.TEXT': 'Text',
      'DataTypes.JSON': 'JSON',
      'DataTypes.ENUM': 'Enum'
    };
    
    return typeMap[type] || type.replace(/DataTypes\./, '') || 'Unknown';
  }

  normalizeMongooseType(type) {
    const typeMap = {
      'String': 'String',
      'Number': 'Number',
      'Boolean': 'Boolean',
      'Date': 'Date',
      'ObjectId': 'ObjectId',
      'Mixed': 'Mixed',
      'Array': 'Array'
    };
    
    return typeMap[type] || type || 'Unknown';
  }

  normalizePrismaType(type) {
    const typeMap = {
      'String': 'String',
      'Int': 'Number',
      'Float': 'Number',
      'Boolean': 'Boolean',
      'DateTime': 'Date',
      'Json': 'JSON'
    };
    
    if (type.includes('?')) {
      return (typeMap[type.replace('?', '')] || type.replace('?', '')) + ' (optional)';
    }
    
    if (type.includes('[]')) {
      return (typeMap[type.replace('[]', '')] || type.replace('[]', '')) + '[]';
    }
    
    return typeMap[type] || type || 'Unknown';
  }

  normalizeTypeORMType(type, columnDef = '') {
    let normalizedType = this.normalizeTypeScriptType(type);
    
    if (columnDef.includes('nullable: false')) {
      normalizedType += ' (required)';
    }
    
    return normalizedType;
  }

  normalizeTypeScriptType(type) {
    const cleanType = type.trim().replace(/\s*\|\s*null/, '').replace(/\s*\|\s*undefined/, '');
    
    const typeMap = {
      'string': 'String',
      'number': 'Number',
      'boolean': 'Boolean',
      'Date': 'Date'
    };
    
    return typeMap[cleanType] || cleanType || 'Unknown';
  }
}
