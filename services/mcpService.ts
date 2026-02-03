/**
 * MCP Service - Browser-Compatible Model Context Protocol Client Implementation
 * 
 * This service handles communication with MCP servers via HTTP/SSE connections
 * for browser environments. Node.js stdio transport is not supported in browser.
 * 
 * Key features:
 * - listTools(): Retrieve available tools from MCP servers
 * - callTool(): Execute tools on MCP servers  
 * - Response formatting for UI integration
 */

// MCP Server Configuration for browser environment
interface MCPServerConfig {
  name: string;
  transportType: 'sse' | 'http'; // Only browser-compatible transports
  endpoint: string; // HTTP endpoint required for browser
  apiKey?: string;
}

// Tool execution result
interface MCPToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
  uiTags?: string[]; // e.g., [':::email', ':::draft']
}

// Formatted result for UI consumption
interface FormattedMCPResult {
  type: 'email' | 'calendar' | 'document' | 'search' | 'raw';
  content: string;
  metadata?: Record<string, any>;
  uiTags?: string[]; // e.g., [':::email', ':::draft']
}

class MCPService {
  private serverConfigs: Map<string, MCPServerConfig> = new Map();
  private isInitialized = false;

  constructor() {
    this.initializeDefaultServers();
  }

  /**
   * Initialize default MCP server configurations for browser environment
   */
  private initializeDefaultServers(): void {
    // Calendar MCP Server (for liveCalendar functionality)
    this.serverConfigs.set('calendar', {
      name: 'Google Calendar',
      transportType: 'sse',
      endpoint: process.env.MCP_CALENDAR_ENDPOINT || 'http://localhost:3001/mcp',
      apiKey: process.env.GOOGLE_API_KEY
    });

    // Email MCP Server (for email functionality)
    this.serverConfigs.set('email', {
      name: 'Email Service',
      transportType: 'sse',
      endpoint: process.env.MCP_EMAIL_ENDPOINT || 'http://localhost:3002/mcp',
      apiKey: process.env.EMAIL_API_KEY
    });

    // Google Drive MCP Server (HTTP API for browser)
    this.serverConfigs.set('gdrive', {
      name: 'Google Drive',
      transportType: 'http',
      endpoint: process.env.MCP_GDRIVE_ENDPOINT || 'http://localhost:3003/mcp',
      apiKey: process.env.GOOGLE_API_KEY
    });
  }

  /**
   * Make HTTP request to MCP server endpoint
   */
  private async makeRequest(
    serverId: string,
    method: string,
    params?: any
  ): Promise<any> {
    const config = this.serverConfigs.get(serverId);
    if (!config) {
      throw new Error(`MCP server configuration not found: ${serverId}`);
    }

    const url = `${config.endpoint}/${method}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(params || {})
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`MCP request failed for ${serverId}:`, error);
      throw error;
    }
  }

  /**
   * List available tools from all configured MCP servers
   */
  async listTools(serverId?: string): Promise<Record<string, any[]>> {
    const results: Record<string, any[]> = {};

    const serverIds = serverId ? [serverId] : Array.from(this.serverConfigs.keys());

    for (const id of serverIds) {
      try {
        const response = await this.makeRequest(id, 'tools/list');
        results[id] = response.tools || [];
        console.log(`Retrieved ${response.tools?.length || 0} tools from ${id}`);

      } catch (error) {
        console.error(`Failed to list tools from ${id}:`, error);
        results[id] = [];
      }
    }

    return results;
  }

  /**
   * Call a specific tool on an MCP server
   */
  async callTool(
    serverId: string,
    toolName: string,
    arguments_: Record<string, any> = {}
  ): Promise<MCPToolResult> {
    try {
      const response = await this.makeRequest(serverId, 'tools/call', {
        name: toolName,
        arguments: arguments_
      });

      // Handle different response formats
      if (response.content && Array.isArray(response.content)) {
        const textContent = response.content
          .filter((item: any) => item.type === 'text')
          .map((item: any) => item.text)
          .join('\n');

        return {
          success: true,
          data: textContent,
          metadata: {
            serverId,
            toolName,
            arguments: arguments_,
            rawResponse: response
          }
        };
      }

      return {
        success: true,
        data: response,
        metadata: {
          serverId,
          toolName,
          arguments: arguments_
        }
      };

    } catch (error) {
      console.error(`Failed to call tool ${toolName} on ${serverId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          serverId,
          toolName,
          arguments: arguments_
        }
      };
    }
  }

  /**
   * Format MCP tool results for UI consumption with tags
   */
  formatResultForUI(result: MCPToolResult, toolName: string): FormattedMCPResult {
    if (!result.success) {
      return {
        type: 'raw',
        content: `Error: ${result.error}`,
        uiTags: []
      };
    }

    const data = result.data;

    // Format based on tool name and content patterns
    switch (toolName) {
      case 'search_files':
      case 'read_file':
        if (this.isEmailContent(data)) {
          return {
            type: 'email',
            content: this.extractEmailContent(data),
            uiTags: [':::email']
          };
        }
        break;

      case 'list_events':
      case 'get_calendar':
        return {
          type: 'calendar',
          content: this.formatCalendarContent(data),
          uiTags: [':::calendar']
        };

      case 'create_draft':
      case 'compose_email':
        return {
          type: 'document',
          content: data,
          uiTags: [':::draft']
        };

      default:
        return {
          type: 'raw',
          content: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
          uiTags: []
        };
    }

    return {
      type: 'raw',
      content: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
      uiTags: []
    };
  }

  /**
   * Check if content appears to be an email
   */
  private isEmailContent(content: any): boolean {
    if (typeof content !== 'string') return false;

    const emailPatterns = [
      /From:\s*.+/i,
      /To:\s*.+/i,
      /Subject:\s*.+/i,
      /Date:\s*.+/i
    ];

    return emailPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Extract and clean email content
   */
  private extractEmailContent(rawEmail: string): string {
    // Remove headers and clean up email content
    const lines = rawEmail.split('\n');
    const bodyStart = lines.findIndex(line =>
      line.trim() === '' ||
      line.match(/^(From|To|Subject|Date|CC|BCC):/i) === null
    );

    if (bodyStart > 0) {
      return lines.slice(bodyStart).join('\n').trim();
    }

    return rawEmail;
  }

  /**
   * Format calendar content for display
   */
  private formatCalendarContent(calendarData: any): string {
    if (typeof calendarData === 'string') {
      return calendarData;
    }

    if (Array.isArray(calendarData)) {
      return calendarData
        .map(event => `📅 ${event.summary || 'No title'}\n🕐 ${event.start || 'No time'}\n📍 ${event.location || 'No location'}`)
        .join('\n\n');
    }

    return JSON.stringify(calendarData, null, 2);
  }

  /**
   * Close all connections (no-op for browser HTTP-based implementation)
   */
  async close(): Promise<void> {
    // No persistent connections to close in browser HTTP implementation
    console.log('MCP service: No persistent connections to close');
  }

  /**
   * Get connection status for all servers
   */
  getConnectionStatus(): Record<string, boolean> {
    const status: Record<string, boolean> = {};

    for (const serverId of this.serverConfigs.keys()) {
      // In browser implementation, we assume servers are available if configured
      status[serverId] = true;
    }

    return status;
  }
}

// Singleton instance
const mcpService = new MCPService();

export default mcpService;
export type { MCPToolResult, FormattedMCPResult, MCPServerConfig };
