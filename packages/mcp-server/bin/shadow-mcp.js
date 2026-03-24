#!/usr/bin/env node
'use strict';

const { loadConfig, startMcpServer } = require('../dist/index');

async function main() {
  try {
    const config = loadConfig();
    await startMcpServer(config);
  } catch (err) {
    console.error('Shadow MCP Server failed to start:', err.message);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
