/**
 * Supabase MCP Service - Integration with Supabase MCP Server
 * 
 * This service provides a typed interface for calling Supabase MCP tools.
 * It uses the underlying mcpService for communication.
 */

import mcpService, { MCPToolResult } from './mcpService';
import mcpServerManager from './mcpServerManager';

export interface SupabaseMCPTools {
    // Search documentation
    searchDocs(query: string): Promise<string>;

    // List resources
    listResources(limit?: number): Promise<any[]>;

    // Manage database (Caution: these are powerful commands)
    executeSql(query: string): Promise<any>;

    // Manage Edge Functions
    listEdgeFunctions(): Promise<any[]>;
    getEdgeFunctionLogs(functionName: string): Promise<string>;

    // Project Info
    getProjectInfo(): Promise<any>;
}

class SupabaseMCPService implements SupabaseMCPTools {
    private serverId = 'supabase';

    /**
     * Check if Supabase MCP server is available
     */
    async checkAvailability(): Promise<boolean> {
        try {
            // MCPサーバーマネージャー経由で状態をチェック
            const isAvailable = await mcpServerManager.isServerAvailable(this.serverId);
            if (isAvailable) {
                return true;
            }

            // フォールバック: 直接ツールリストを取得
            const tools = await mcpService.listTools(this.serverId);
            return tools[this.serverId] && tools[this.serverId].length > 0;
        } catch (error) {
            console.warn('Supabase MCP server check failed:', error);
            return false;
        }
    }

    /**
     * Search Supabase documentation via MCP
     */
    async searchDocs(query: string): Promise<string> {
        const result = await mcpService.callTool(this.serverId, 'search_docs', { query });
        return this.handleResult(result, 'search_docs');
    }

    /**
     * List resources from Supabase project
     */
    async listResources(limit: number = 10): Promise<any[]> {
        const result = await mcpService.callTool(this.serverId, 'list_tables', { schemas: ['public'] });

        if (result.success && result.data) {
            if (typeof result.data === 'string') {
                try {
                    return JSON.parse(result.data);
                } catch {
                    return []; // parsing failed
                }
            }
            return Array.isArray(result.data) ? result.data : [result.data];
        }
        return [];
    }

    /**
     * Execute SQL Query via MCP
     * WARN: This is a powerful command. Ensure proper validation before calling.
     */
    async executeSql(query: string): Promise<any> {
        // In a real app, you might want to wrap this in a confirmation check or restrict to read-only queries
        const result = await mcpService.callTool(this.serverId, 'execute_sql', { query });
        return this.handleResult(result, 'execute_sql');
    }

    /**
     * List Edge Functions
     */
    async listEdgeFunctions(): Promise<any[]> {
        const result = await mcpService.callTool(this.serverId, 'list_edge_functions', {});

        if (result.success && result.data) {
            if (typeof result.data === 'string') {
                try {
                    return JSON.parse(result.data);
                } catch {
                    return [];
                }
            }
            return Array.isArray(result.data) ? result.data : [result.data];
        }
        return [];
    }

    /**
     * Get logs for a specific Edge Function
     */
    async getEdgeFunctionLogs(functionName: string): Promise<string> {
        const result = await mcpService.callTool(this.serverId, 'get_logs', {
            service: 'edge-function',
            project_id: 'default' // This might need to be dynamic based on your setup
        });
        return this.handleResult(result, 'get_logs');
    }

    /**
     * Get basic project info
     */
    async getProjectInfo(): Promise<any> {
        const result = await mcpService.callTool(this.serverId, 'get_project', { id: 'default' });

        if (result.success && result.data) {
            if (typeof result.data === 'string') {
                try {
                    return JSON.parse(result.data);
                } catch {
                    return {};
                }
            }
            return result.data;
        }
        return {};
    }

    /**
     * Helper to process tool results
     */
    private handleResult(result: MCPToolResult, toolName: string): any {
        if (!result.success) {
            console.error(`Supabase MCP Tool ${toolName} failed:`, result.error);
            throw new Error(result.error || `Failed to execute ${toolName}`);
        }
        return result.data;
    }
}

const supabaseMCPService = new SupabaseMCPService();
export default supabaseMCPService;
