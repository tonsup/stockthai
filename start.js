#!/usr/bin/env node
/**
 * StockThai – Quick Start
 * Run: node start.js  (then open http://localhost:3000)
 */
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const dir = __dirname;

// Install deps if missing
if (!fs.existsSync(path.join(dir, 'node_modules', 'express'))) {
  console.log('📦 Installing dependencies...');
  execSync('npm install --cache /tmp/npm-cache --no-fund', { cwd: dir, stdio: 'inherit' });
}

// Start server
const child = spawn(process.execPath, [path.join(dir, 'server.js')], {
  cwd: dir,
  stdio: 'inherit',
  env: { ...process.env, PORT: process.env.PORT || '3000' },
});

child.on('error', err => { console.error('Failed to start:', err.message); process.exit(1); });

process.on('SIGINT', () => { child.kill(); process.exit(0); });
