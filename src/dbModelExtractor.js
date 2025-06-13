import path from 'path';
import fs from 'fs/promises';
import fg from 'fast-glob';

export class DbModelExtractor {
  constructor(projectRoot, limit = 100) {
    this.projectRoot = projectRoot;
    this.limit = limit;
    this.models = new Set();
    this.modelSchemas = {}; // Enhanced: Store detailed field information
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

    // Return both model names and detailed schemas
    return {
      models: [...this.models].sort().slice(0, this.limit),
      schemas: this.modelSchemas
    };
  }

  async processFile(file) {
    try {
      const content = await fs.readFile(file, 'utf8');
      const filename = path.basename(file, path.extname(file));

      // 1️⃣ Extract ES6 class models
      const classMatches = [...content.matchAll(/class\s+([A-Za-z0-9_]+)/g)];
      classMatches.forEach(match => {
        const name = match[1];
        if (name && !['Model', 'Entity', 'Schema'].includes(name)) {
          this.models.add(name);
          // Extract detailed schema for the class
          this.extractClassSchema(content, name);
        }
      });

      // 2️⃣ Extract Mongoose models
      const mongooseMatches = [...content.matchAll(/mongoose\.model\s*\(\s*['"`]([^'"`]+)['"`]/g)];
      mongooseMatches.forEach(match => {
        const name = match[1];
        this.models.add(name);
        this.extractMongooseSchema(content, name);
      });

      // 3️⃣ Extract Sequelize models
      const sequelizeMatches = [...content.matchAll(/sequelize\.define\s*\(\s*['"`]([^'"`]+)['"`]/g)];
      sequelizeMatches.forEach(match => {
        const name = this.capitalize(match[1]);
        this.models.add(name);
        this.extractSequelizeSchema(content, name);
      });

      // 4️⃣ Extract Schema constants
      const schemaMatches = [...content.matchAll(/const\s+([A-Za-z0-9_]+Schema)\s*=/g)];
      schemaMatches.forEach(match => {
        const name = match[1].replace(/Schema$/, '');
        this.models.add(name);
        this.extractSchemaConstant(content, name, match[1]);
      });

      // 5️⃣ Extract TypeORM entities
      this.extractTypeORMEntities(content);

      // 6️⃣ Extract Prisma models
      this.extractPrismaModels(content);

    } catch {
      // Silent fail for unreadable files
    }
  }

  extractClassSchema(content, className) {
    // Extract TypeORM entity fields
    if (content.includes('@Entity') || content.includes('@Column')) {
      this.modelSchemas[className] = this.parseTypeORMSchema(content, className);
    }
    // Extract generic class properties
    else {
      this.modelSchemas[className] = this.parseGenericClassFields(content, className);
    }
  }

  extractMongooseSchema(content, modelName) {
    // Find mongoose.Schema() definition
    const schemaRegex = /new\s+(?:mongoose\.)?Schema\s*\(\s*\{([^}]+)\}/g;
    const match = schemaRegex.exec(content);
    
    if (match) {
      this.modelSchemas[modelName] = this.parseMongooseFields(match[1]);
    }
  }

  extractSequelizeSchema(content, modelName) {
    // Find sequelize.define() definition
    const defineRegex = new RegExp(`sequelize\\.define\\s*\\(\\s*['"\`]${modelName}['"\`],\\s*\\{([^}]+)\\}`, 'i');
    const match = defineRegex.exec(content);
    
    if (match) {
      this.modelSchemas[modelName] = this.parseSequelizeFields(match[1]);
    }
  }

  extractSchemaConstant(content, modelName, schemaName) {
    const schemaRegex = new RegExp(`const\\s+${schemaName}\\s*=\\s*new\\s+(?:mongoose\\.)?Schema\\s*\\(\\s*\\{([^}]+)\\}`, 'g');
    const match = schemaRegex.exec(content);
    
    if (match) {
      this.modelSchemas[modelName] = this.parseMongooseFields(match[1]);
    }
  }

  extractTypeORMEntities(content) {
    const entityMatches = content.matchAll(/@Entity\s*\(\s*['"`]?([^'"`\)]*?)['"`]?\s*\)[\s\S]*?class\s+([A-Za-z0-9_]+)/g);
    
    for (const match of entityMatches) {
      const tableName = match[1] || match[2];
      const className = match[2];
      
      this.models.add(className);
      this.modelSchemas[className] = this.parseTypeORMSchema(content, className);
    }
  }

  extractPrismaModels(content) {
    const modelMatches = content.matchAll(/model\s+([A-Za-z0-9_]+)\s*\{([^}]+)\}/g);
    
    for (const match of modelMatches) {
      const modelName = match[1];
      const fieldsDefinition = match[2];
      
      this.models.add(modelName);
      this.modelSchemas[modelName] = this.parsePrismaFields(fieldsDefinition);
    }
  }

  parseMongooseFields(fieldsDefinition) {
    const fields = {};
    
    // Parse field definitions like: fieldName: { type: String, required: true }
    const fieldMatches = fieldsDefinition.matchAll(/([a-zA-Z0-9_]+):\s*\{([^}]+)\}/g);
    for (const match of fieldMatches) {
      const fieldName = match[1].trim();
      const fieldDefinition = match[2];
      fields[fieldName] = this.parseMongooseFieldDefinition(fieldDefinition);
    }

    // Parse simple field definitions like: fieldName: String
    const simpleMatches = fieldsDefinition.matchAll(/([a-zA-Z0-9_]+):\s*([A-Za-z.]+)(?=,|$)/g);
    for (const match of simpleMatches) {
      const fieldName = match[1].trim();
      const fieldType = match[2].trim();
      if (!fields[fieldName]) {
        fields[fieldName] = this.normalizeMongooseType(fieldType);
      }
    }

    return fields;
  }

  parseMongooseFieldDefinition(definition) {
    const typeMatch = definition.match(/type:\s*([A-Za-z.]+)/);
    const requiredMatch = definition.match(/required:\s*(true|false)/);
    const defaultMatch = definition.match(/default:\s*([^,}]+)/);
    const enumMatch = definition.match(/enum:\s*\[([^\]]+)\]/);

    let type = typeMatch ? this.normalizeMongooseType(typeMatch[1]) : 'Unknown';
    
    if (enumMatch) {
      const enumValues = enumMatch[1].split(',').map(v => v.trim().replace(/['"]/g, ''));
      type = `Enum(${enumValues.join(', ')})`;
    }
    
    const modifiers = [];
    if (requiredMatch && requiredMatch[1] === 'true') {
      modifiers.push('required');
    }
    if (defaultMatch) {
      modifiers.push(`default: ${defaultMatch[1].trim()}`);
    }
    
    return modifiers.length > 0 ? `${type} (${modifiers.join(', ')})` : type;
  }

  parseSequelizeFields(fieldsDefinition) {
    const fields = {};
    
    const fieldMatches = fieldsDefinition.matchAll(/([a-zA-Z0-9_]+):\s*\{([^}]+)\}/g);
    for (const match of fieldMatches) {
      const fieldName = match[1].trim();
      const fieldDefinition = match[2];
      fields[fieldName] = this.parseSequelizeFieldDefinition(fieldDefinition);
    }

    return fields;
  }

  parseSequelizeFieldDefinition(definition) {
    const typeMatch = definition.match(/type:\s*([A-Za-z.()]+)/);
    const allowNullMatch = definition.match(/allowNull:\s*(true|false)/);
    const defaultValueMatch = definition.match(/defaultValue:\s*([^,}]+)/);

    let type = typeMatch ? this.normalizeSequelizeType(typeMatch[1]) : 'Unknown';
    
    const modifiers = [];
    if (allowNullMatch && allowNullMatch[1] === 'false') {
      modifiers.push('required');
    }
    if (defaultValueMatch) {
      modifiers.push(`default: ${defaultValueMatch[1].trim()}`);
    }

    return modifiers.length > 0 ? `${type} (${modifiers.join(', ')})` : type;
  }

  parseTypeORMSchema(content, className) {
    const fields = {};
    
    // Find the class definition
    const classRegex = new RegExp(`class\\s+${className}[^{]*\\{([\\s\\S]*?)\\n\\s*\\}`, 'g');
    const classMatch = classRegex.exec(content);
    
    if (!classMatch) return fields;
    
    const classBody = classMatch[1];
    
    // Parse @Column decorators
    const columnMatches = classBody.matchAll(/@Column\s*\(([^)]*)\)\s*([a-zA-Z0-9_]+):\s*([^;]+)/g);
    for (const match of columnMatches) {
      const columnOptions = match[1];
      const fieldName = match[2];
      const fieldType = match[3];
      
      fields[fieldName] = this.parseTypeORMField(fieldType, columnOptions);
    }

    // Parse simple property declarations
    const propertyMatches = classBody.matchAll(/([a-zA-Z0-9_]+):\s*([A-Za-z0-9_<>|\s]+);/g);
    for (const match of propertyMatches) {
      const fieldName = match[1];
      const fieldType = match[2];
      
      if (!fields[fieldName] && !fieldType.includes('()')) {
        fields[fieldName] = this.normalizeTypeScriptType(fieldType);
      }
    }

    return fields;
  }

  parseTypeORMField(fieldType, columnOptions) {
    let type = this.normalizeTypeScriptType(fieldType);
    
    const modifiers = [];
    if (columnOptions.includes('nullable: false')) {
      modifiers.push('required');
    }
    if (columnOptions.includes('default:')) {
      const defaultMatch = columnOptions.match(/default:\s*([^,}]+)/);
      if (defaultMatch) {
        modifiers.push(`default: ${defaultMatch[1].trim()}`);
      }
    }
    
    return modifiers.length > 0 ? `${type} (${modifiers.join(', ')})` : type;
  }

  parsePrismaFields(fieldsDefinition) {
    const fields = {};
    
    const fieldMatches = fieldsDefinition.matchAll(/([a-zA-Z0-9_]+)\s+([A-Za-z0-9_\[\]?]+)(?:\s+([^@\n]+))?/g);
    for (const match of fieldMatches) {
      const fieldName = match[1];
      const fieldType = match[2];
      const modifiers = match[3] || '';
      
      let type = this.normalizePrismaType(fieldType);
      
      const modifierList = [];
      if (modifiers.includes('@default')) {
        const defaultMatch = modifiers.match(/@default\(([^)]+)\)/);
        if (defaultMatch) {
          modifierList.push(`default: ${defaultMatch[1]}`);
        }
      }
      
      fields[fieldName] = modifierList.length > 0 ? `${type} (${modifierList.join(', ')})` : type;
    }

    return fields;
  }

  parseGenericClassFields(content, className) {
    const fields = {};
    
    const classRegex = new RegExp(`class\\s+${className}[^{]*\\{([\\s\\S]*?)\\n\\s*\\}`, 'g');
    const classMatch = classRegex.exec(content);
    
    if (!classMatch) return fields;
    
    const classBody = classMatch[1];
    
    // Parse property declarations
    const propertyMatches = classBody.matchAll(/(?:public|private|protected)?\s*([a-zA-Z0-9_]+):\s*([A-Za-z0-9_<>|\s]+);/g);
    for (const match of propertyMatches) {
      const fieldName = match[1];
      const fieldType = match[2];
      fields[fieldName] = this.normalizeTypeScriptType(fieldType);
    }

    return fields;
  }

  normalizeMongooseType(type) {
    const typeMap = {
      'String': 'String',
      'Number': 'Number',
      'Boolean': 'Boolean',
      'Date': 'Date',
      'ObjectId': 'ObjectId',
      'Mixed': 'Mixed',
      'Array': 'Array',
      'Buffer': 'Buffer'
    };
    
    return typeMap[type] || type || 'Unknown';
  }

  normalizeSequelizeType(type) {
    const typeMap = {
      'DataTypes.STRING': 'String',
      'DataTypes.INTEGER': 'Number',
      'DataTypes.FLOAT': 'Number',
      'DataTypes.DOUBLE': 'Number',
      'DataTypes.BOOLEAN': 'Boolean',
      'DataTypes.DATE': 'Date',
      'DataTypes.TEXT': 'Text',
      'DataTypes.JSON': 'JSON',
      'DataTypes.JSONB': 'JSONB',
      'DataTypes.ENUM': 'Enum',
      'DataTypes.UUID': 'UUID'
    };
    
    return typeMap[type] || type.replace(/DataTypes\./, '') || 'Unknown';
  }

  normalizePrismaType(type) {
    const typeMap = {
      'String': 'String',
      'Int': 'Number',
      'Float': 'Number',
      'Boolean': 'Boolean',
      'DateTime': 'Date',
      'Json': 'JSON',
      'Bytes': 'Buffer'
    };
    
    if (type.includes('?')) {
      return (typeMap[type.replace('?', '')] || type.replace('?', '')) + ' (optional)';
    }
    
    if (type.includes('[]')) {
      return (typeMap[type.replace('[]', '')] || type.replace('[]', '')) + '[]';
    }
    
    return typeMap[type] || type || 'Unknown';
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

  capitalize(name) {
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
}
