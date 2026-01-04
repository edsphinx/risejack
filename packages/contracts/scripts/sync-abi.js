#!/usr/bin/env node
/* global console, process */
/**
 * Sync Contract ABI Script
 *
 * Copies the compiled ABI from contracts/out to the web frontend.
 * Run this after forge build or as part of the deploy script.
 *
 * Usage: node scripts/sync-abi.js
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const webDir = join(rootDir, '..', '..', 'apps', 'web');

// Source: Compiled contract output
const sourceFile = join(rootDir, 'out', 'VyreJack.sol', 'VyreJack.json');

// Destination: Web app lib folder
const destDir = join(webDir, 'src', 'lib', 'abi');
const destFile = join(destDir, 'VyreJack.json');

console.log('📋 Syncing VyreJack ABI to frontend...');
console.log(`   Source: ${sourceFile}`);
console.log(`   Dest:   ${destFile}`);

try {
  // Read compiled contract
  const compiled = JSON.parse(readFileSync(sourceFile, 'utf8'));

  // Extract just the ABI (no bytecode, etc.)
  const abiOnly = {
    abi: compiled.abi,
    // Also include some useful metadata
    contractName: 'VyreJack',
    sourceName: 'src/VyreJack.sol',
    // Include compiler version for reference
    compiler: compiled.metadata?.compiler?.version || 'unknown',
    lastUpdated: new Date().toISOString(),
  };

  // Ensure destination directory exists
  mkdirSync(destDir, { recursive: true });

  // Write ABI file
  writeFileSync(destFile, JSON.stringify(abiOnly, null, 2));

  console.log('✅ ABI synced successfully!');
  console.log(`   ABI has ${compiled.abi.length} entries`);

  // Also export as TypeScript for type safety
  const tsContent = `// Auto-generated - DO NOT EDIT
// Synced from: packages/contracts/out/VyreJack.sol/VyreJack.json
// Last updated: ${new Date().toISOString()}

export const VYREJACK_ABI = ${JSON.stringify(compiled.abi, null, 2)} as const;

export type VyreJackABI = typeof VYREJACK_ABI;
`;

  writeFileSync(join(destDir, 'VyreJack.ts'), tsContent);
  console.log('✅ TypeScript ABI generated!');
} catch (error) {
  console.error('❌ Failed to sync ABI:', error.message);
  process.exit(1);
}
