#!/usr/bin/env node

// 导入并启动 MCP Server
const mainModule = await import('../src/index.js');
if (mainModule.main) {
  mainModule.main().catch(console.error);
}
