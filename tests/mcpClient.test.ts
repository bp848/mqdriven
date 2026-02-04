import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);

const loadMcpClient = () => {
  const modulePath = path.resolve(process.cwd(), 'server', 'mcp', 'mcpClient.js');
  delete require.cache[modulePath];
  return require(modulePath) as typeof import('../server/mcp/mcpClient.js');
};

describe('mcp client config', () => {
  it('parses MCP_SERVERS arrays', () => {
    const { parseMcpServers, McpClientManager } = loadMcpClient();
    const raw = JSON.stringify([
      {
        name: 'google',
        command: 'npx',
        args: ['@modelcontextprotocol/server-google'],
        env: { GOOGLE_CLIENT_ID: 'id' },
      },
    ]);
    const servers = parseMcpServers(raw);
    expect(servers).toHaveLength(1);
    const manager = new McpClientManager(servers);
    expect(manager.hasServer('google')).toBe(true);
  });

  it('handles invalid MCP_SERVERS input', () => {
    const { parseMcpServers } = loadMcpClient();
    expect(parseMcpServers('not-json')).toEqual([]);
  });
});
