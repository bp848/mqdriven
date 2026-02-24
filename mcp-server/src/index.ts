#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { z } from "zod";

// Load environment variables for the MCP server
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env");
    process.exit(1);
}

// Initialize Supabase Client with Service Role Key (Admin Privileges)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Create server instance
const server = new Server(
    {
        name: "mqdriven-mcp-gateway",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// Define Tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "get_customer_budget_summary",
                description: "Retrieve budget summary for a specific customer. Useful for checking profit margins and project counts.",
                inputSchema: {
                    type: "object",
                    properties: {
                        customerId: {
                            type: "string",
                            description: "The UUID of the customer",
                        },
                        customerCode: {
                            type: "string",
                            description: "The legacy code of the customer (optional if UUID provided)",
                        },
                    },
                },
            },
            {
                name: "execute_sql_query",
                description: "Execute a read-only SQL query against the database. Use with caution. RESTRICTED TO READ-ONLY.",
                inputSchema: {
                    type: "object",
                    properties: {
                        query: {
                            type: "string",
                            description: "The SQL query to execute",
                        },
                    },
                    required: ["query"],
                },
            },
        ],
    };
});

// Handle Tool Execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
        if (name === "get_customer_budget_summary") {
            const { customerId, customerCode } = args as { customerId?: string; customerCode?: string };

            let query = supabase.from("customer_budget_summary_view").select("*");

            if (customerId) {
                query = query.eq("customer_id", customerId);
            } else if (customerCode) {
                query = query.eq("customer_code", customerCode);
            } else {
                return {
                    content: [{ type: "text", text: "Error: Either customerId or customerCode must be provided." }],
                    isError: true,
                };
            }

            const { data, error } = await query;

            if (error) throw error;

            return {
                content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
            };
        }

        if (name === "execute_sql_query") {
            // Validation: Simple check to prevent Write operations (Not a generic solution, just a safeguard)
            const { query } = args as { query: string };
            const upperQuery = query.toUpperCase();
            if (upperQuery.includes("INSERT ") || upperQuery.includes("UPDATE ") || upperQuery.includes("DELETE ") || upperQuery.includes("DROP ") || upperQuery.includes("ALTER ")) {
                return {
                    content: [{ type: "text", text: "Error: Only SELECT queries are allowed via this tool." }],
                    isError: true,
                };
            }

            // Note: Supabase JS client doesn't support raw SQL easily without RPC. 
            // We will assume an RPC function 'exec_sql' exists or use postgrest directly if possible.
            // Since we don't have a generic SQL RPC, we will fail gracefully or recommend using specific tools.
            // For now, let's return a placeholder or implement specific logic.

            return {
                content: [{ type: "text", text: "Error: Custom SQL execution is not yet configured. Please use specific tools." }],
                isError: true
            }
        }

        return {
            content: [{ type: "text", text: `Unknown tool: ${name}` }],
            isError: true,
        };
    } catch (error: any) {
        return {
            content: [
                {
                    type: "text",
                    text: `Error executing tool ${name}: ${error.message}`,
                },
            ],
            isError: true,
        };
    }
});

// Start server
async function runServer() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("MQDriven MCP Server running on stdio");
}

runServer().catch((error) => {
    console.error("Fatal error running server:", error);
    process.exit(1);
});
