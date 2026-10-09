/**
 * nutrition-parser.js
 *
 * 解析麦当劳官方 MCP `list-nutrition-foods` 工具的真实返回。
 *
 * 真实返回结构（经实测确认）：
 *   content[0].text 是一段带说明的文本，其中 "## Original Response" 之后
 *   是一个 JSON：{ success, code, message, datetime, traceId, data }
 *   其中 data 是一段自定义文本表格，形如：
 *
 *     [160]{productName,nutritionDescription,energyKj,energyKcal,protein,fat,carbohydrate,sodium,calcium}:
 *       猪柳麦满分,null,1288,308,16,16,24,781,213
 *       中薯条,null,1210,289,4,12,38,165,18
 *       ...
 *
 * 单位（依据麦当劳营养标注惯例，每份）：
 *   energyKj   能量（千焦）
 *   energyKcal 能量（千卡）
 *   protein    蛋白质（克）
 *   fat        脂肪（克）
 *   carbohydrate 碳水化合物（克）
 *   sodium     钠（毫克）
 *   calcium    钙（毫克）
 */

const FIELD_ORDER = [
  'productName',
  'nutritionDescription',
  'energyKj',
  'energyKcal',
  'protein',
  'fat',
  'carbohydrate',
  'sodium',
  'calcium',
];

/**
 * 从 MCP callTool 的完整返回对象中提取真实营养数据。
 * @param {object} toolResult  client.callTool 的原始返回（含 content[]）
 * @returns {{ datetime:string, traceId:string, foods:Array }}
 */
export function parseNutritionResult(toolResult) {
  const text = extractText(toolResult);
  if (!text) {
    throw new Error('MCP 返回为空或结构异常，无法解析营养数据。');
  }

  const payload = extractOriginalResponse(text);
  if (!payload || payload.success !== true || !payload.data) {
    throw new Error(
      `MCP 返回未成功或缺少 data 字段：${payload ? payload.message || payload.code : '无法解析'}`
    );
  }

  const foods = parseDataTable(payload.data);
  return {
    datetime: payload.datetime,
    traceId: payload.traceId,
    code: payload.code,
    foods,
  };
}

/** 提取 content 中的文本（合并多段） */
function extractText(toolResult) {
  if (!toolResult) return '';
  if (typeof toolResult === 'string') return toolResult;
  if (Array.isArray(toolResult.content)) {
    return toolResult.content
      .filter((c) => c && c.type === 'text' && typeof c.text === 'string')
      .map((c) => c.text)
      .join('\n');
  }
  return '';
}

/** 从带说明的文本中切出 "## Original Response" 后的 JSON 并解析 */
export function extractOriginalResponse(text) {
  // 优先定位 Original Response 段
  let jsonStr = null;
  const marker = text.indexOf('Original Response');
  const searchFrom = marker >= 0 ? marker : 0;
  const start = text.indexOf('{"success"', searchFrom);
  if (start >= 0) {
    jsonStr = text.slice(start);
  } else {
    // 兜底：整体就是 JSON
    const s = text.indexOf('{');
    if (s >= 0) jsonStr = text.slice(s);
  }
  if (!jsonStr) return null;

  // data 字段里包含真实换行，直接 JSON.parse 可能因控制字符失败，
  // 因此做一次健壮解析：先尝试直接 parse，失败则转义裸换行后再 parse。
  try {
    return JSON.parse(jsonStr);
  } catch {
    const escaped = escapeRawControlChars(jsonStr);
    return JSON.parse(escaped);
  }
}

/** 把 JSON 字符串字面量内部的裸控制字符（真实换行/制表）转义，避免 parse 失败 */
function escapeRawControlChars(s) {
  let out = '';
  let inStr = false;
  let prev = '';
  for (const ch of s) {
    if (ch === '"' && prev !== '\\') inStr = !inStr;
    if (inStr && ch === '\n') out += '\\n';
    else if (inStr && ch === '\r') out += '\\r';
    else if (inStr && ch === '\t') out += '\\t';
    else out += ch;
    prev = ch === '\\' && prev === '\\' ? '' : ch; // 处理连续反斜杠
  }
  return out;
}

/**
 * 解析 data 文本表格为餐品数组。
 * @param {string} dataStr
 * @returns {Array<object>}
 */
export function parseDataTable(dataStr) {
  if (typeof dataStr !== 'string') return [];

  // 解析头部：[N]{f1,f2,...}:
  const headerMatch = dataStr.match(/^\s*\[(\d+)\]\{([^}]+)\}\s*:/);
  let fields = FIELD_ORDER;
  let bodyStart = 0;
  if (headerMatch) {
    fields = headerMatch[2].split(',').map((f) => f.trim());
    bodyStart = dataStr.indexOf(':', headerMatch.index) + 1;
  }

  const body = dataStr.slice(bodyStart);
  const rows = body
    .split('\n')
    .map((r) => r.trim())
    .filter((r) => r.length > 0);

  const foods = [];
  for (const row of rows) {
    const cols = splitRow(row);
    if (cols.length < 2) continue;
    const obj = {};
    fields.forEach((f, i) => {
      obj[f] = cols[i] !== undefined ? cols[i] : null;
    });
    foods.push(toFood(obj));
  }
  return foods;
}

/**
 * 按逗号切分一行。餐品名里可能含中文括号/引号但不含英文逗号，
 * 实测字段用英文逗号分隔，直接 split 即可；做个长度对齐保护。
 */
function splitRow(row) {
  return row.split(',').map((c) => c.trim());
}

/** 把一行原始对象转为标准 food 结构（数值字段转 number，null/空转 undefined） */
function toFood(obj) {
  const num = (v) => {
    if (v === null || v === undefined || v === '' || v === 'null') return undefined;
    const n = Number(v);
    return Number.isNaN(n) ? undefined : n;
  };
  const str = (v) => (v === null || v === 'null' || v === '' ? undefined : v);

  return {
    name: str(obj.productName) ?? '未知餐品',
    nutritionDescription: str(obj.nutritionDescription),
    energyKj: num(obj.energyKj),
    energyKcal: num(obj.energyKcal),
    proteinG: num(obj.protein),
    fatG: num(obj.fat),
    carbG: num(obj.carbohydrate),
    sodiumMg: num(obj.sodium),
    calciumMg: num(obj.calcium),
  };
}
