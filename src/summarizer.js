import path from 'path';
import { FrameworkDetector } from './frameworkDetector.js';
import { ServiceClassifier } from './serviceClassifier.js';
import { ApiRouteExtractor } from './apiRouteExtractor.js';
import { DbModelExtractor } from './dbModelExtractor.js';
import { UtilityAnalyzer } from './utilityAnalyzer.js';
import { PatternDetector } from './patternDetector.js';
import { GitMetadata } from './gitMetadata.js';

export class Summarizer {
  constructor(config) {
    this.projectRoot = config.projectRoot;
    this.outputFile = config.outputFile;
    this.limit = config.limit;

    this.summary = {
      schemaVersion: '3.0.0',
      generatedAt: new Date().toISOString(),
      git: {},
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
  }

  async analyze() {
    console.log('🛠️ Starting Codebase Analysis');

    this.summary.git = await GitMetadata.extract(this.projectRoot);

    const frameworks = new FrameworkDetector(this.projectRoot);
    this.summary.frameworks = await frameworks.detect();

    const services = new ServiceClassifier(this.projectRoot, this.limit);
    const serviceSummary = await services.extract();
    this.summary.services = serviceSummary;

    const apis = new ApiRouteExtractor(this.projectRoot, this.limit);
    const apiSummary = await apis.extract();
    this.summary.apiRoutes = apiSummary;

    const models = new DbModelExtractor(this.projectRoot, this.limit);
    this.summary.dbModels = await models.extract();

    const utils = new UtilityAnalyzer(this.projectRoot, this.limit);
    const utilSummary = await utils.extract();
    this.summary.utils = utilSummary;

    const patterns = new PatternDetector(this.projectRoot, frameworks.dependencies);
    this.summary.globalPatterns = await patterns.extract();

    this.applyLimits();

    return this.summary;
  }

  applyLimits() {
    this.summary.modules = this.summary.modules.slice(0, this.limit);
    this.summary.services.businessServices = this.summary.services.businessServices.slice(0, this.limit);
    this.summary.services.utilityServices = this.summary.services.utilityServices.slice(0, this.limit);
    this.summary.apiRoutes.publicRoutes = this.summary.apiRoutes.publicRoutes.slice(0, this.limit);
    this.summary.apiRoutes.internalRoutes = this.summary.apiRoutes.internalRoutes.slice(0, this.limit);
    this.summary.dbModels = this.summary.dbModels.slice(0, this.limit);
  }
}
