# Codebase Summary Bot

Production-grade codebase summarizer for AI-powered code review, agent pipelines, onboarding, and repository intelligence.

> Optimized for LLMs, AI agents, and automated code reviewers
> Fully modular architecture, SaaS-ready, CI/CD friendly
> Supports JavaScript, TypeScript, monorepos, and modern stacks

---

## Features

* Framework detection (frontend + backend)
* Business vs Utility service classification
* API route extraction (public vs internal)
* Database models & schemas extraction
* Utility function extraction + domain classification
* Global pattern detection (ORMs, auth, validation, state management, logging, etc)
* Git metadata capture (SHA, branch, remote)
* Fully pluggable as GitHub Action or SaaS microservice
* LLM-optimized output for AI reviewers

---

## Installation

```bash
npm install -g codebase-summary-bot
```

Or clone the repo directly:

```bash
git clone https://github.com/YOUR-ORG/codebase-summary-bot.git
cd codebase-summary-bot
npm install
```

---

## Usage

From your project root directory:

```bash
codebase-summary-bot
```

### CLI Options:

| Option     | Description            | Default                 |
| ---------- | ---------------------- | ----------------------- |
| `--output` | Output file path       | `codebase-summary.json` |
| `--limit`  | Max items per category | `100`                   |

Example:

```bash
codebase-summary-bot --output=./summary.json --limit=50
```

---

## Output Structure

The bot generates a fully LLM-ready JSON summary:

```json
{
  "schemaVersion": "3.0.0",
  "generatedAt": "...",
  "git": {
    "sha": "...",
    "branch": "...",
    "remote": "..."
  },
  "modules": [...],
  "services": {
    "businessServices": [...],
    "utilityServices": [...]
  },
  "apiRoutes": {
    "publicRoutes": [...],
    "internalRoutes": [...]
  },
  "dbModels": [...],
  "utils": {
    "byDomain": {...},
    "files": [...]
  },
  "frameworks": {
    "frontend": "...",
    "backend": "..."
  },
  "globalPatterns": [...]
}
```

---

## Use Cases

* Feed into AI code reviewers
* Boost LLM agents with repository context
* Automated pull request quality gates
* Onboarding docs for new engineers
* SaaS pipeline integrations

---

## GitHub Action (Coming soon)

You can embed Codebase Summary Bot into your CI:

```yaml
name: Codebase Summary

on:
  push:
    branches:
      - main

jobs:
  summarize:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: your-org/codebase-summary-bot@v3
```

---

## Technology Stack

* Node.js (async / promise-based)
* Fast-glob (fast concurrent filesystem traversal)
* Modular extractor architecture
* SaaS extensible design

---

## License

MIT License — Fully open-source for personal & commercial use.

---

## Credits

Built and designed for modern AI-native development pipelines.
