#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { MemoryServer } from './memory-server.js';

const server = new Server(
  {
    name: 'memory-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const memoryServer = new MemoryServer(process.env.MEMORY_FILE_PATH);

// Tool definitions
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'create_entities',
        description: 'Create multiple new entities in the knowledge graph',
        inputSchema: {
          type: 'object',
          properties: {
            entities: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Entity identifier' },
                  entityType: { type: 'string', description: 'Type classification' },
                  observations: { 
                    type: 'array', 
                    items: { type: 'string' },
                    description: 'Associated observations'
                  }
                },
                required: ['name', 'entityType']
              }
            }
          },
          required: ['entities']
        }
      },
      {
        name: 'create_relations',
        description: 'Create multiple new relations between entities',
        inputSchema: {
          type: 'object',
          properties: {
            relations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  from: { type: 'string', description: 'Source entity name' },
                  to: { type: 'string', description: 'Target entity name' },
                  relationType: { type: 'string', description: 'Relationship type in active voice' }
                },
                required: ['from', 'to', 'relationType']
              }
            }
          },
          required: ['relations']
        }
      },
      {
        name: 'add_observations',
        description: 'Add new observations to existing entities',
        inputSchema: {
          type: 'object',
          properties: {
            observations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  entityName: { type: 'string', description: 'Target entity' },
                  contents: { 
                    type: 'array', 
                    items: { type: 'string' },
                    description: 'New observations to add'
                  }
                },
                required: ['entityName', 'contents']
              }
            }
          },
          required: ['observations']
        }
      },
      {
        name: 'delete_entities',
        description: 'Remove entities and their relations',
        inputSchema: {
          type: 'object',
          properties: {
            entityNames: {
              type: 'array',
              items: { type: 'string' },
              description: 'Entity names to delete'
            }
          },
          required: ['entityNames']
        }
      },
      {
        name: 'delete_observations',
        description: 'Remove specific observations from entities',
        inputSchema: {
          type: 'object',
          properties: {
            deletions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  entityName: { type: 'string', description: 'Target entity' },
                  observations: { 
                    type: 'array', 
                    items: { type: 'string' },
                    description: 'Observations to remove'
                  }
                },
                required: ['entityName', 'observations']
              }
            }
          },
          required: ['deletions']
        }
      },
      {
        name: 'delete_relations',
        description: 'Remove specific relations from the graph',
        inputSchema: {
          type: 'object',
          properties: {
            relations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  from: { type: 'string', description: 'Source entity name' },
                  to: { type: 'string', description: 'Target entity name' },
                  relationType: { type: 'string', description: 'Relationship type' }
                },
                required: ['from', 'to', 'relationType']
              }
            }
          },
          required: ['relations']
        }
      },
      {
        name: 'read_graph',
        description: 'Read the entire knowledge graph',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'search_nodes',
        description: 'Search for nodes based on query',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' }
          },
          required: ['query']
        }
      },
      {
        name: 'open_nodes',
        description: 'Retrieve specific nodes by name',
        inputSchema: {
          type: 'object',
          properties: {
            names: {
              type: 'array',
              items: { type: 'string' },
              description: 'Entity names to retrieve'
            }
          },
          required: ['names']
        }
      }
    ]
  };
});

// Tool handlers
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'create_entities':
        await memoryServer.create_entities(args.entities);
        return { content: [{ type: 'text', text: 'Entities created successfully' }] };

      case 'create_relations':
        await memoryServer.create_relations(args.relations);
        return { content: [{ type: 'text', text: 'Relations created successfully' }] };

      case 'add_observations':
        const result = await memoryServer.add_observations(args.observations);
        return { 
          content: [{ 
            type: 'text', 
            text: `Observations added: ${JSON.stringify(result, null, 2)}` 
          }] 
        };

      case 'delete_entities':
        await memoryServer.delete_entities(args.entityNames);
        return { content: [{ type: 'text', text: 'Entities deleted successfully' }] };

      case 'delete_observations':
        await memoryServer.delete_observations(args.deletions);
        return { content: [{ type: 'text', text: 'Observations deleted successfully' }] };

      case 'delete_relations':
        await memoryServer.delete_relations(args.relations);
        return { content: [{ type: 'text', text: 'Relations deleted successfully' }] };

      case 'read_graph':
        const graph = await memoryServer.read_graph();
        return { 
          content: [{ 
            type: 'text', 
            text: JSON.stringify(graph, null, 2) 
          }] 
        };

      case 'search_nodes':
        const searchResults = await memoryServer.search_nodes(args.query);
        return { 
          content: [{ 
            type: 'text', 
            text: JSON.stringify(searchResults, null, 2) 
          }] 
        };

      case 'open_nodes':
        const nodes = await memoryServer.open_nodes(args.names);
        return { 
          content: [{ 
            type: 'text', 
            text: JSON.stringify(nodes, null, 2) 
          }] 
        };

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (error) {
    throw new McpError(
      ErrorCode.InternalError,
      `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
});

async function main() {
  await memoryServer.initialize();
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('Memory MCP Server running on stdio');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Server error:', error);
    process.exit(1);
  });
}
