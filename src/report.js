/**
 * report.js
 *
 * 把分析结果渲染为适合终端展示的中文报告（纯字符串，无副作用）。
 */

import { MEAL_LABEL } from './data/children-nutrition-reference.js';

const LEVEL_ICON = { good: '✅', note: 'ℹ️ ', warn: '⚠️ ' };
const BAR = '═'.repeat(54);
const THIN = '─'.repeat(54);

/** 数据来源横幅（仅实时） */
export function renderSourceBanner(meta) {
  return (
    `🟢 数据来源：麦当劳官方 MCP 实时查询（${meta.datetime}）\n` +
    `   traceId: ${meta.traceId} ·  在售餐品 ${meta.foods.length} 项`
  );
}

/** 单份套餐的营养评估报告 */
export function renderReport({ childProfile, foods, evalResult, allergens, suggestions }) {
  const lines = [];
  lines.push(BAR);
  lines.push('🍔  麦麦儿童营养管家 · 套餐营养评估报告');
  lines.push(BAR);
  lines.push('');
  lines.push(`👶 孩子画像：${childProfile.age} 岁 · ${childProfile.ageGroup.label}`);
  lines.push(`🍽️  餐段：${MEAL_LABEL[evalResult.mealType] ?? evalResult.mealType}`);
  lines.push('');

  lines.push('【套餐组成】');
  for (const f of foods) {
    lines.push(`  • ${foodLine(f)}`);
  }
  lines.push('');

  const t = evalResult.total;
  lines.push('【营养合计 vs 该年龄段单餐目标】');
  lines.push(`  能量：${t.energyKcal} kcal  / 目标约 ${evalResult.target.energyKcal} kcal`);
  lines.push(`  蛋白质：${t.proteinG} g  / 目标约 ${evalResult.target.proteinG} g`);
  lines.push(`  脂肪：${t.fatG} g   碳水：${t.carbG} g`);
  lines.push(`  钠：${t.sodiumMg} mg  / 单餐上限约 ${evalResult.target.sodiumMaxMg} mg`);
  if (t.calciumMg) lines.push(`  钙：${t.calciumMg} mg`);
  lines.push('');

  lines.push(THIN);
  lines.push(`📊 综合评分：${evalResult.score} / 100   等级：${evalResult.grade.label}`);
  lines.push(THIN);
  lines.push('');

  lines.push('【逐项分析】');
  for (const flag of evalResult.flags) {
    lines.push(`  ${LEVEL_ICON[flag.level] ?? ''}${flag.text}`);
  }
  lines.push('');

  lines.push('【过敏原提示（启发式，仅供参考）】');
  const keys = Object.keys(allergens);
  if (keys.length === 0) {
    lines.push('  未从餐品名称识别到常见过敏原关键词。');
  } else {
    for (const k of keys) {
      lines.push(`  ⚠️ 可能含${allergens[k].label}：${allergens[k].foods.join('、')}`);
    }
    lines.push('  （真实过敏原信息以麦当劳官方标注为准，过敏体质请谨慎选择。）');
  }
  lines.push('');

  lines.push('【更均衡的搭配建议】');
  suggestions.forEach((s, i) => lines.push(`  ${i + 1}. ${s}`));
  lines.push('');

  lines.push(disclaimer());
  return lines.join('\n');
}

/** 智能推荐套餐列表 */
export function renderRecommendations({ childProfile, mealType, combos }) {
  const lines = [];
  lines.push(BAR);
  lines.push('🎯  麦麦儿童营养管家 · 智能套餐推荐');
  lines.push(BAR);
  lines.push('');
  lines.push(`👶 ${childProfile.age} 岁 · ${childProfile.ageGroup.label}   🍽️ ${MEAL_LABEL[mealType] ?? mealType}`);
  lines.push('（以下套餐由程序从麦当劳真实在售餐品中智能组合，按儿童营养契合度排序）');
  lines.push('');

  combos.forEach((c, i) => {
    const medal = ['🥇', '🥈', '🥉'][i] ?? `#${i + 1}`;
    lines.push(`${medal} 推荐套餐（契合度 ${Math.round(c.fitScore)}）`);
    for (const f of c.items) lines.push(`     • ${foodLine(f)}`);
    const n = c.nutrition;
    lines.push(
      `     合计：${n.energyKcal}kcal · 蛋白${n.proteinG}g · 钠${n.sodiumMg}mg · 钙${n.calciumMg}mg`
    );
    lines.push('');
  });

  lines.push(disclaimer());
  return lines.join('\n');
}

/** 健康替换建议 */
export function renderSwaps(swaps) {
  const lines = [];
  lines.push('【🔄 一键健康替换建议】');
  if (swaps.length === 0) {
    lines.push('  当前套餐已较为合理，暂无更优替换建议。');
  } else {
    for (const s of swaps) {
      lines.push(`  • 把「${s.from}」换成「${s.to}」`);
      lines.push(`     ↳ ${s.reason}`);
    }
    lines.push('  （替换项均为麦当劳真实在售餐品，数据来自官方 MCP。）');
  }
  return lines.join('\n');
}

// ---------- 工具 ----------
function foodLine(f) {
  const parts = [];
  if (typeof f.energyKcal === 'number') parts.push(`${f.energyKcal}kcal`);
  if (typeof f.proteinG === 'number') parts.push(`蛋白${f.proteinG}g`);
  if (typeof f.sodiumMg === 'number') parts.push(`钠${f.sodiumMg}mg`);
  if (typeof f.calciumMg === 'number' && f.calciumMg > 0) parts.push(`钙${f.calciumMg}mg`);
  const detail = parts.length ? `（${parts.join(' · ')}）` : '（无营养数据）';
  return `${f.name} ${detail}`;
}

function disclaimer() {
  return (
    THIN +
    '\n※ 本报告仅供参考，不构成医疗/营养专业建议；\n' +
    '  餐品信息、价格及供应状态以麦当劳官方渠道实时结果为准。\n' +
    BAR
  );
}
