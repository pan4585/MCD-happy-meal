/**
 * data-source.js
 *
 * 营养数据来源：**仅麦当劳官方 MCP 实时查询**，保证数据实时、完全正确。
 * 不使用任何本地快照或编造数据。
 *
 * 无有效 MCD_MCP_TOKEN 时，直接抛出清晰的配置提示，不做任何数据兜底。
 */

import { McdMcpClient } from './mcp-client.js';

/**
 * 实时获取餐品营养数据。
 * @param {object} opts
 * @param {string} opts.token  MCP Token（必需）
 * @param {string} [opts.url]  MCP 接入地址
 * @returns {Promise<{source:'live', realtime:true, datetime:string, traceId:string, foods:Array}>}
 */
export async function getNutritionData(opts = {}) {
  const { token, url } = opts;

  if (!token || token === 'YOUR_MCP_TOKEN') {
    throw new TokenRequiredError();
  }

  const client = new McdMcpClient({ token, url });
  await client.connect();
  try {
    const { datetime, traceId, foods } = await client.listNutritionFoods({});
    if (!foods || foods.length === 0) {
      throw new Error('MCP 返回的餐品列表为空，请稍后重试。');
    }
    return { source: 'live', realtime: true, datetime, traceId, foods };
  } finally {
    await client.close();
  }
}

/** 未配置 Token 的专用错误，带引导提示 */
export class TokenRequiredError extends Error {
  constructor() {
    super(
      '未检测到有效的麦当劳 MCP Token，无法获取实时餐品营养数据。\n\n' +
        '本工具的所有数据均来自麦当劳官方 MCP 实时查询，不使用任何离线/模拟数据。\n' +
        '请按以下步骤配置后重试：\n' +
        '  1. 访问 https://open.mcd.cn/mcp ，用手机号登录并在控制台申请 MCP Token\n' +
        '  2. 在项目根目录执行： cp .env.example .env\n' +
        '  3. 编辑 .env，将 MCD_MCP_TOKEN 的值替换为你申请到的真实 Token\n' +
        '  4. 重新运行命令'
    );
    this.name = 'TokenRequiredError';
    this.isTokenRequired = true;
  }
}
