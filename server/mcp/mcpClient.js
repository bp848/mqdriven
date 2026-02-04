const { Client } = require('@modelcontextprotocol/sdk/client');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

const CLIENT_INFO = { name: 'mqdriven', version: '1.0.0' };

const parseMcpServers = (raw) => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object') return [parsed];
  } catch {
    return [];
  }
  return [];
};

const normalizeServer = (entry) => {
  if (!entry || typeof entry !== 'object') return null;
  const name = typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : 'default';
  const command = typeof entry.command === 'string' && entry.command.trim() ? entry.command.trim() : null;
  const args = Array.isArray(entry.args) ? entry.args : [];
  const env = entry.env && typeof entry.env === 'object' ? entry.env : undefined;
  const cwd = typeof entry.cwd === 'string' ? entry.cwd : undefined;
  const kind = entry.kind || (command ? 'stdio' : 'unknown');
  return { name, kind, command, args, env, cwd };
};

const buildServerMap = (servers) => {
  const map = new Map();
  (servers || [])
    .map(normalizeServer)
    .filter(Boolean)
    .forEach((server) => map.set(server.name, server));
  return map;
};

class McpClientManager {
  constructor(servers) {
    this.serverMap = buildServerMap(servers);
    this.clients = new Map();
    this.connecting = new Map();
  }

  hasServer(name) {
    const server = this.serverMap.get(name);
    return Boolean(server && server.kind === 'stdio' && server.command);
  }

  async connect(name) {
    if (!this.hasServer(name)) {
      throw new Error(`MCP server not configured: ${name}`);
    }
    if (this.clients.has(name)) return this.clients.get(name);
    if (this.connecting.has(name)) return this.connecting.get(name);

    const server = this.serverMap.get(name);
    const connectPromise = (async () => {
      const transport = new StdioClientTransport({
        command: server.command,
        args: server.args,
        env: server.env,
        cwd: server.cwd,
        stderr: 'pipe',
      });
      const client = new Client(CLIENT_INFO);
      try {
        await client.connect(transport);
        try {
          const tools = await client.listTools();
          if (typeof client.cacheToolMetadata === 'function') {
            client.cacheToolMetadata(tools.tools);
          }
        } catch {}
        const entry = { client, transport };
        this.clients.set(name, entry);
        return entry;
      } catch (error) {
        await transport.close();
        throw error;
      } finally {
        this.connecting.delete(name);
      }
    })();

    this.connecting.set(name, connectPromise);
    return connectPromise;
  }

  async callTool(serverName, toolName, args) {
    const entry = await this.connect(serverName);
    const params = { name: toolName };
    if (args && Object.keys(args).length) {
      params.arguments = args;
    }
    return entry.client.callTool(params);
  }
}

module.exports = {
  McpClientManager,
  parseMcpServers,
};
