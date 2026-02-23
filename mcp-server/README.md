# MQDriven MCP Server

This is the dedicated MCP (Model Context Protocol) server for the MQDriven ERP system. 
It acts as a secure gateway for AI agents to interact with the Supabase backend.

## Setup

1.  **Install Dependencies:**
    ```bash
    cd mcp-server
    npm install
    ```

2.  **Environment Variables:**
    Copy `.env.example` to `.env` and fill in your Supabase credentials.
    *   `SUPABASE_URL`: Your Supabase Project URL
    *   `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase Service Role Key (Found in Project Settings > API). **DO NOT share this key.**

3.  **Build:**
    ```bash
    npm run build
    ```

## Usage with Claude Desktop / Cursor

Add the following to your MCP config:

```json
{
  "mcpServers": {
    "mqdriven": {
      "command": "node",
      "args": ["/absolute/path/to/mqdriven/mcp-server/build/index.js"],
      "env": {
        "SUPABASE_URL": "...",
        "SUPABASE_SERVICE_ROLE_KEY": "..."
      }
    }
  }
}
```

## Available Tools

-   `get_customer_budget_summary`: Retrieves budget analysis for a user.
