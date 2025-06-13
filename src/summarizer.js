import path from 'path';
import { FrameworkDetector } from './frameworkDetector.js';
import { ServiceClassifier } from './serviceClassifier.js';
import { ApiRouteExtractor } from './apiRouteExtractor.js';
import { DbModelExtractor } from './dbModelExtractor.js';
import { UtilityAnalyzer } from './utilityAnalyzer.js';
import { PatternDetector } from './patternDetector.js';
import { GitMetadata } from './gitMetadata.js';
// New extractors
import { ServiceInteractionExtractor } from './serviceInteractionExtractor.js';
import { SchemaSnapshotExtractor } from './schemaSnapshotExtractor.js';
import { PayloadExtractor } from './payloadExtractor.js';
import { AuthPolicyExtractor } from './authPolicyExtractor.js';
import { BusinessLogicFlowExtractor } from './businessLogicFlowExtractor.js';

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
      globalPatterns: [],
      // 🆕 New deep metadata fields
      serviceDependencies: {},
      schemaSnapshots: {},
      apiPayloads: {},
      authPolicies: {},
      businessFlows: {}
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
    const modelSummary = await models.extract();
    // Enhanced: Handle both model names and schemas
    this.summary.dbModels = modelSummary.models || modelSummary;
    this.summary.schemaSnapshots = modelSummary.schemas || {};

    const utils = new UtilityAnalyzer(this.projectRoot, this.limit);
    const utilSummary = await utils.extract();
    this.summary.utils = utilSummary;

    const patterns = new PatternDetector(this.projectRoot, frameworks.dependencies);
    this.summary.globalPatterns = await patterns.extract();

    // 🆕 New deep metadata extraction
    console.log('🔗 Analyzing service interactions...');
    const serviceInteractions = new ServiceInteractionExtractor(this.projectRoot, this.limit);
    this.summary.serviceDependencies = await serviceInteractions.extract();

    console.log('📦 Extracting API payloads...');
    const payloads = new PayloadExtractor(this.projectRoot, this.limit);
    this.summary.apiPayloads = await payloads.extract();

    console.log('🔐 Analyzing authentication policies...');
    const authPolicies = new AuthPolicyExtractor(this.projectRoot, this.limit);
    this.summary.authPolicies = await authPolicies.extract();

    console.log('🔄 Extracting business logic flows...');
    const businessFlows = new BusinessLogicFlowExtractor(this.projectRoot, this.limit);
    this.summary.businessFlows = await businessFlows.extract();

    // If we don't have schema snapshots from models, try the dedicated extractor
    if (Object.keys(this.summary.schemaSnapshots).length === 0) {
      console.log('🗂️ Extracting additional model schemas...');
      const schemaSnapshots = new SchemaSnapshotExtractor(this.projectRoot, this.limit);
      this.summary.schemaSnapshots = await schemaSnapshots.extract();
    }

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
