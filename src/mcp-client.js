/**
 * mcp-client.js
 *
 * 麦当劳 MCP Server 客户端封装。
 * 使用官方 @modelcontextprotocol/sdk，通过 Streamable HTTP 协议接入，
 * 在请求头中携带 Authorization: Bearer <MCD_MCP_TOKEN>。
 *
 * 接入地址与协议参考麦当劳官方文档：
 *   https://github.com/M-China/mcd-mcp-server
 *
 * ⚠️ 安全：Token 只从环境变量读取，绝不硬编码。
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { parseNutritionResult } from './nutrition-parser.js';

export class McdMcpClient {
  /**
   * @param {object} opts
   * @param {string} opts.token  麦当劳 MCP Token
   * @param {string} [opts.url]  接入地址，默认 https://mcp.mcd.cn
   */
  constructor({ token, url = 'https://mcp.mcd.cn' } = {}) {
    if (!token || token === 'YOUR_MCP_TOKEN') {
      throw new Error(
        '缺少有效的 MCD_MCP_TOKEN。请在 .env 中配置真实 Token，或参考 .env.example。'
      );
    }
    this.token = token;
    this.url = url;
    this.client = null;
    this.transport = null;
  }

  /** 建立连接 */
  async connect() {
    this.transport = new StreamableHTTPClientTransport(new URL(this.url), {
      requestInit: {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      },
    });

    this.client = new Client(
      { name: 'happy-meal-nutrition-guardian', version: '1.0.0' },
      { capabilities: {} }
    );

    await this.client.connect(this.transport);
    return this;
  }

  /** 列出服务端支持的工具（用于自检/调试） */
  async listTools() {
    const res = await this.client.listTools();
    return res.tools ?? [];
  }

  /**
   * 调用一个 MCP 工具并解析返回的文本内容为 JSON（失败则返回原始文本）。
   * @param {string} name  工具名
   * @param {object} args  工具参数
   */
  async callTool(name, args = {}) {
    const res = await this.client.callTool({ name, arguments: args });
    return normalizeToolResult(res);
  }

  // ---------- 业务语义封装（本 Skill 实际用到的工具） ----------

  /**
   * 获取餐品营养信息列表（真实解析）。
   * @returns {Promise<{datetime:string, traceId:string, foods:Array}>}
   */
  async listNutritionFoods(args = {}) {
    const res = await this.client.callTool({
      name: 'list-nutrition-foods',
      arguments: args,
    });
    return parseNutritionResult(res);
  }

  /** 查询当前门店可售卖餐品菜单 */
  async queryMeals(args = {}) {
    return this.callTool('query-meals', args);
  }

  /** 查询餐品详情（套餐组成/可替换项） */
  async queryMealDetail(args = {}) {
    return this.callTool('query-meal-detail', args);
  }

  /** 获取当前时间信息（用于判断餐段） */
  async nowTimeInfo(args = {}) {
    return this.callTool('now-time-info', args);
  }

  /** 关闭连接 */
  async close() {
    if (this.transport) {
      await this.transport.close();
    }
  }
}

/**
 * 把 MCP CallTool 返回结构（content: [{type:'text', text}]）统一解析。
 * 若文本是 JSON 则解析为对象/数组，否则返回原文；多段文本会合并。
 */
export function normalizeToolResult(res) {
  if (!res || !Array.isArray(res.content)) return res;

  const texts = res.content
    .filter((c) => c.type === 'text' && typeof c.text === 'string')
    .map((c) => c.text);

  if (texts.length === 0) return res;

  const joined = texts.join('\n');
  try {
    return JSON.parse(joined);
  } catch {
    // 单段尝试逐段解析
    if (texts.length === 1) return texts[0];
    const parsed = texts.map((t) => {
      try {
        return JSON.parse(t);
      } catch {
        return t;
      }
    });
    return parsed;
  }
}
