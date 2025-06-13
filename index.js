#!/usr/bin/env node

import { Summarizer } from './src/summarizer.js';
import minimist from 'minimist';
import fs from 'fs/promises';
import path from 'path';
import packageData from './package.json' assert { type: 'json' };
const { version } = packageData;


async function run() {
  console.log(`🚀 Codebase Summary Bot v${version}\n==============================`);

  const args = minimist(process.argv.slice(2));
  const projectRoot = process.cwd();

  const outputFile = args.output || 'codebase-summary.json';
  const limit = parseInt(args.limit || '100');

  try {
    const summarizer = new Summarizer({
      projectRoot,
      outputFile,
      limit
    });

    const summary = await summarizer.analyze();

    await fs.writeFile(
      path.join(projectRoot, outputFile),
      JSON.stringify(summary, null, 2),
      'utf8'
    );

    console.log(`✅ Summary written to ${outputFile}`);
  } catch (err) {
    console.error('💥 Summary failed:', err);
    process.exit(1);
  }
}

run();
