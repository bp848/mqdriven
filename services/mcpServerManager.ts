/**
 * MCP Server Manager - MCPサーバーの起動・管理・状態監視
 * 
 * このサービスはMCPサーバーの起動、状態監視、再起動を管理します。
 * ブラウザ環境でのMCPサーバーとの通信を確実にするための機能を提供します。
 */

import mcpService, { MCPToolResult } from './mcpService';

export interface MCPServerStatus {
  serverId: string;
  name: string;
  isRunning: boolean;
  lastCheck: Date;
  endpoint: string;
  error?: string;
  responseTime?: number;
}

export interface MCPServerConfig {
  serverId: string;
  name: string;
  endpoint: string;
  transportType: 'sse' | 'http';
  startupCommand?: string;
  port?: number;
  healthCheckPath?: string;
}

class MCPServerManager {
  private servers: Map<string, MCPServerStatus> = new Map();
  private configs: Map<string, MCPServerConfig> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30秒

  constructor() {
    this.initializeServerConfigs();
    this.startHealthChecks();
  }

  /**
   * MCPサーバー設定を初期化
   */
  private initializeServerConfigs(): void {
    const defaultConfigs: MCPServerConfig[] = [
      {
        serverId: 'supabase',
        name: 'Supabase MCP Server',
        endpoint: 'http://localhost:3004/mcp',
        transportType: 'http',
        port: 3004,
        healthCheckPath: '/health'
      },
      {
        serverId: 'calendar',
        name: 'Google Calendar MCP Server',
        endpoint: 'http://localhost:3001/mcp',
        transportType: 'sse',
        port: 3001,
        healthCheckPath: '/health'
      },
      {
        serverId: 'email',
        name: 'Email MCP Server',
        endpoint: 'http://localhost:3002/mcp',
        transportType: 'sse',
        port: 3002,
        healthCheckPath: '/health'
      },
      {
        serverId: 'gdrive',
        name: 'Google Drive MCP Server',
        endpoint: 'http://localhost:3003/mcp',
        transportType: 'http',
        port: 3003,
        healthCheckPath: '/health'
      }
    ];

    defaultConfigs.forEach(config => {
      this.configs.set(config.serverId, config);
      this.servers.set(config.serverId, {
        serverId: config.serverId,
        name: config.name,
        isRunning: false,
        lastCheck: new Date(),
        endpoint: config.endpoint
      });
    });
  }

  /**
   * 定期的なヘルスチェックを開始
   */
  private startHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // MCPサーバーが未実装の場合はチェックをスキップ
    console.log('MCP Server Manager: Health checks disabled (servers not implemented)');
    return;

    this.healthCheckInterval = setInterval(async () => {
      await this.checkAllServers();
    }, this.HEALTH_CHECK_INTERVAL);

    // 初回チェック
    this.checkAllServers();
  }

  /**
   * 全サーバーの状態をチェック
   */
  private async checkAllServers(): Promise<void> {
    const promises = Array.from(this.configs.keys()).map(serverId => 
      this.checkServerHealth(serverId)
    );

    await Promise.allSettled(promises);
  }

  /**
   * 個別サーバーのヘルスチェック
   */
  private async checkServerHealth(serverId: string): Promise<void> {
    const config = this.configs.get(serverId);
    if (!config) return;

    const startTime = Date.now();
    let isRunning = false;
    let error: string | undefined;

    try {
      // MCPツール一覧取得でヘルスチェック
      const tools = await mcpService.listTools(serverId);
      isRunning = tools[serverId] && tools[serverId].length > 0;
      
      if (!isRunning) {
        error = 'No tools available';
      }
    } catch (err) {
      isRunning = false;
      error = err instanceof Error ? err.message : String(err);
    }

    const responseTime = Date.now() - startTime;

    this.servers.set(serverId, {
      ...this.servers.get(serverId)!,
      isRunning,
      lastCheck: new Date(),
      error,
      responseTime
    });

    // サーバーがダウンしている場合は再起動を試みる
    if (!isRunning && config.startupCommand) {
      console.warn(`MCP Server ${serverId} is down, attempting restart...`);
      await this.attemptServerRestart(serverId);
    }
  }

  /**
   * サーバーの再起動を試行
   */
  private async attemptServerRestart(serverId: string): Promise<void> {
    const config = this.configs.get(serverId);
    if (!config?.startupCommand) return;

    try {
      console.log(`Restarting MCP server: ${serverId}`);
      // Note: ブラウザ環境では直接コマンド実行はできない
      // 代わりにユーザーに通知するか、別の手段を検討
      this.notifyServerRestartNeeded(serverId);
    } catch (error) {
      console.error(`Failed to restart server ${serverId}:`, error);
    }
  }

  /**
   * サーバー再起動が必要なことを通知
   */
  private notifyServerRestartNeeded(serverId: string): void {
    const config = this.configs.get(serverId);
    if (!config) return;

    console.warn(`🚨 MCP Server "${config.name}" needs manual restart!`);
    console.warn(`📍 Endpoint: ${config.endpoint}`);
    console.warn(`🔧 Startup: ${config.startupCommand || 'Manual restart required'}`);
    
    // ブラウザ環境では通知UIを表示
    if (typeof window !== 'undefined') {
      // イベントを発行してUIに通知
      window.dispatchEvent(new CustomEvent('mcp-server-down', {
        detail: { serverId, serverName: config.name, endpoint: config.endpoint }
      }));
    }
  }

  /**
   * 全サーバーの状態を取得
   */
  public getAllServerStatus(): MCPServerStatus[] {
    return Array.from(this.servers.values());
  }

  /**
   * 特定サーバーの状態を取得
   */
  public getServerStatus(serverId: string): MCPServerStatus | undefined {
    return this.servers.get(serverId);
  }

  /**
   * サーバーが利用可能かチェック
   */
  public async isServerAvailable(serverId: string): Promise<boolean> {
    await this.checkServerHealth(serverId);
    const status = this.servers.get(serverId);
    return status?.isRunning || false;
  }

  /**
   * 利用可能なサーバー一覧を取得
   */
  public getAvailableServers(): string[] {
    return Array.from(this.servers.values())
      .filter(status => status.isRunning)
      .map(status => status.serverId);
  }

  /**
   * 手動ヘルスチェックを実行
   */
  public async manualHealthCheck(serverId?: string): Promise<void> {
    if (serverId) {
      await this.checkServerHealth(serverId);
    } else {
      await this.checkAllServers();
    }
  }

  /**
   * サーバー設定を更新
   */
  public updateServerConfig(serverId: string, config: Partial<MCPServerConfig>): void {
    const existing = this.configs.get(serverId);
    if (existing) {
      this.configs.set(serverId, { ...existing, ...config });
      this.servers.set(serverId, {
        ...this.servers.get(serverId)!,
        endpoint: config.endpoint || existing.endpoint
      });
    }
  }

  /**
   * クリーンアップ
   */
  public cleanup(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}

// シングルトンインスタンス
const mcpServerManager = new MCPServerManager();

export default mcpServerManager;
