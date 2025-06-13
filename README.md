# 🤖 Codebase Summary Bot

[![npm version](https://badge.fury.io/js/codebase-summary-bot.svg)](https://badge.fury.io/js/codebase-summary-bot)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub issues](https://img.shields.io/github/issues/libinvbabu/codebase-summarizer)](https://github.com/libinvbabu/codebase-summarizer/issues)
[![GitHub stars](https://img.shields.io/github/stars/libinvbabu/codebase-summarizer)](https://github.com/libinvbabu/codebase-summarizer/stargazers)
[![Build Status](https://github.com/libinvbabu/codebase-summarizer/workflows/CI/badge.svg)](https://github.com/libinvbabu/codebase-summarizer/actions)

> 🚀 **Next-generation codebase intelligence platform** for AI-powered code review, agent pipelines, onboarding, and repository analysis.

**Deep Metadata Extraction** • **Service Interaction Graphs** • **Business Logic Flow Analysis** • **API Payload Detection** • **Authentication Policy Mapping**

---

## ✨ Features

### 🔍 Core Analysis Engine

* Framework Detection (Node.js, Express, NestJS, React, Vue, Angular, etc.)
* Smart Service Classification (Business vs Utility)
* API Route & Method Extraction
* ORM Database Schema Analysis (Mongoose, Sequelize, Prisma, TypeORM)
* Utility Function Mapping by Domain
* Global Pattern Detection (Validation, State Management, Logging, etc.)
* Git Metadata Integration

### 🔎 Deep Metadata Extraction

* Service Interaction Graphs
* Schema Snapshots with full model field metadata
* API Payload Extraction from Joi, Celebrate, DTOs, Swagger
* Authentication Policy Mapping (JWT, Role, Middleware Chains)
* Business Logic Flow Analysis at method level
* ORM Field Metadata Extraction (with types, constraints, defaults)

### 🚀 AI & Integration Ready

* LLM-Optimized Output for AI Agents
* Fully pluggable into CI/CD or SaaS pipelines
* Modular Extractor Architecture for extensions
* Generates rich code knowledge graphs

---

## 🚀 Quick Start

### Installation

```bash
npm install -g codebase-summary-bot
# or use via npx
npx codebase-summary-bot
```

### Usage

```bash
codebase-summary-bot
codebase-summary-bot --output=./summary.json --limit=50
```

### CLI Options

| Option            | Description                     | Default                 | Example                    |
| ----------------- | ------------------------------- | ----------------------- | -------------------------- |
| `--output`        | Output file path                | `codebase-summary.json` | `--output=./analysis.json` |
| `--limit`         | Max items per category          | `100`                   | `--limit=50`               |
| `--format`        | Output format                   | `json`                  | `--format=yaml`            |
| `--exclude`       | Exclude patterns                | `node_modules,dist`     | `--exclude=tests,docs`     |
| `--deep-analysis` | Enable deep metadata extraction | `false`                 | `--deep-analysis`          |
| `--include-flows` | Extract business logic flows    | `true`                  | `--no-include-flows`       |

---

## 📊 Output Structure (JSON)

Generates fully structured LLM-optimized metadata. Major sections:

* `services`: businessServices & utilityServices
* `apiRoutes`: publicRoutes, internalRoutes
* `dbModels`: ORM models and schema definitions
* `utils`: Utility function mappings
* `frameworks`: Backend, Frontend, DB, Validation libraries
* `serviceDependencies`: Service-to-service call graphs
* `schemaSnapshots`: Full ORM models with field types
* `apiPayloads`: Request/Response payloads per API route
* `authPolicies`: Per-route auth detection
* `businessFlows`: Business logic flow per service

---

## 🌟 Use Cases

### AI/LLM Workflows

* AI Code Reviewers
* Codebase Context for LLM Agents
* Architecture Quality Gates
* AI-powered Refactoring

### Developer Productivity

* Instant Onboarding Docs
* Service Interaction Graphs
* API Documentation Extraction
* Code Navigation Assistance

### DevOps/Compliance

* Continuous Architecture Analysis
* Security Audit Surface Mapping
* Microservice Boundary Extraction
* API Surface Contracts

### Business Intelligence

* Business Logic Flow Visualization
* Change Impact Analysis
* Data Relationship Mapping
* Feature Planning Support

---

## 🔧 Supported Technologies

### ORMs

* Mongoose, Sequelize, Prisma, TypeORM

### API & Validation

* Express.js, NestJS, Joi, Celebrate, Yup, Swagger/OpenAPI, TypeScript DTOs

### Authentication

* JWT, Passport.js, Custom Middleware, Express Guards

### Backend

* Node.js, Express, NestJS, Koa, Fastify, Hapi

### Frontend (Basic detection only)

* React, Vue.js, Angular, Svelte, Next.js, Nuxt.js

### Languages

* JavaScript, TypeScript

---

## 🛠️ GitHub Action Integration

Example to run analysis in CI/CD pipeline:

```yaml
name: 🤖 Codebase Intelligence

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  analyze:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    
    steps:
      - name: 👅 Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: 📊 Generate codebase summary
        uses: libinvbabu/codebase-summarizer@v1
        with:
          output-path: 'codebase-summary.json'
          deep-analysis: true
          include-flows: true
      
      - name: 📤 Upload analysis
        uses: actions/upload-artifact@v3
        with:
          name: codebase-analysis
          path: codebase-summary.json
      
      - name: 🔍 Quality Gate Check
        run: |
          node scripts/check-architecture-compliance.js
      
      - name: 💬 Comment on PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const analysis = JSON.parse(fs.readFileSync('codebase-summary.json', 'utf8'));
            
            const comment = `## 🤖 Codebase Analysis
            **Services Analyzed:** ${analysis.services.businessServices.length} business, ${analysis.services.utilityServices.length} utility
            **API Endpoints:** ${analysis.apiRoutes.publicRoutes.length} public, ${analysis.apiRoutes.internalRoutes.length} internal
            **Database Models:** ${analysis.dbModels.length}
            **Authentication Policies:** ${Object.keys(analysis.authPolicies || {}).length} routes protected`;
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });
```

---

## 🔧 Architecture

Highly modular extraction architecture:

```
src/
├── summarizer.js
├── frameworkDetector.js
├── serviceClassifier.js
├── apiRouteExtractor.js
├── dbModelExtractor.js
├── utilityAnalyzer.js
├── patternDetector.js
├── gitMetadata.js
└── extractors/
    ├── serviceInteractionExtractor.js
    ├── schemaSnapshotExtractor.js
    ├── payloadExtractor.js
    ├── authPolicyExtractor.js
    └── businessLogicFlowExtractor.js
```

---

## 📚 Contributing

We welcome contributions!

### Local Dev Setup

```bash
git clone https://github.com/libinvbabu/codebase-summarizer.git
cd codebase-summarizer
npm install
npm test
npm run dev
npm run build
npm link
codebase-summary-bot --help
```

### Contribution Workflow

* Fork & Branch (`git checkout -b feature/xyz`)

* Follow coding standards

* Add tests

* Use conventional commits (`feat: add extractor`)

* Submit PR

* [Report Issues](https://github.com/libinvbabu/codebase-summarizer/issues)

* [Submit PRs](https://github.com/libinvbabu/codebase-summarizer/pulls)

---

## 🔄 Roadmap

### Near-term

* Python (Django, Flask, FastAPI)
* Java (Spring Boot)
* Real-time Analysis API
* Dependency Graph Visualization
* Test Coverage Mapping

### Long-term

* Rust, PHP, Laravel
* React Native Support
* Cloud Patterns
* AI-powered Code Smell Detection
* Security Pattern Extraction

---

## 📚 License

MIT License © 2025 [Libin V Babu](https://www.libin.in)

---

Author: Libin V Babu
GitHub: [https://github.com/libinvbabu/codebase-summarizer](https://github.com/libinvbabu/codebase-summarizer)
