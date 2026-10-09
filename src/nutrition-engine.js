/**
 * nutrition-engine.js
 *
 * 核心营养分析引擎（纯函数，不依赖网络，便于单元测试）。
 * 输入的餐品已由 nutrition-parser.js 标准化为统一结构：
 *   { name, energyKcal, proteinG, fatG, carbG, sodiumMg, calciumMg, ... }
 *
 * 职责：
 *   1. 汇总一组餐品的营养总量
 *   2. 对照年龄段单餐目标做评分与分级
 *   3. 过敏原启发式筛查
 *   4. 生成更均衡的搭配建议
 *
 * ⚠️ 合规：所有营养评估仅供参考，不构成医疗/营养专业建议；
 *          餐品营养数据以麦当劳官方 MCP 实时结果为准。
 */

import { getMealTarget, ALLERGEN_KEYWORDS } from './data/children-nutrition-reference.js';

/** 汇总一组餐品营养（缺失字段按 0 累加，但记录缺失计数） */
export function sumNutrition(foods) {
  const total = { energyKcal: 0, proteinG: 0, fatG: 0, carbG: 0, sodiumMg: 0, calciumMg: 0 };
  const missing = { energyKcal: 0, proteinG: 0, fatG: 0, carbG: 0, sodiumMg: 0, calciumMg: 0 };

  for (const f of foods) {
    for (const key of Object.keys(total)) {
      if (typeof f[key] === 'number') total[key] += f[key];
      else missing[key] += 1;
    }
  }
  for (const key of Object.keys(total)) total[key] = Math.round(total[key] * 10) / 10;
  return { total, missing };
}

/**
 * 评估一份套餐相对某年龄段单餐目标的营养表现。
 */
export function evaluateMeal(ageGroup, foods, mealType = 'lunch') {
  const target = getMealTarget(ageGroup, mealType);
  const { total, missing } = sumNutrition(foods);

  const energyPct = target.energyKcal ? total.energyKcal / target.energyKcal : 0;
  const proteinPct = target.proteinG ? total.proteinG / target.proteinG : 0;
  const sodiumPct = target.sodiumMaxMg ? total.sodiumMg / target.sodiumMaxMg : 0;
  const fatEnergyPct = total.energyKcal > 0 ? (total.fatG * 9) / total.energyKcal : 0;

  const flags = [];
  let score = 100;

  // 能量：理想在目标的 80%~120%
  if (energyPct > 1.3) {
    flags.push({ level: 'warn', text: `这一餐热量约为该年龄段单餐目标的 ${pct(energyPct)}，偏高，建议减量或分享。` });
    score -= 25;
  } else if (energyPct > 1.1) {
    flags.push({ level: 'note', text: `热量略高（约目标的 ${pct(energyPct)}），可搭配运动或减少加餐。` });
    score -= 10;
  } else if (energyPct < 0.6) {
    flags.push({ level: 'note', text: `热量偏低（约目标的 ${pct(energyPct)}），作为正餐可能不够，适合当加餐。` });
    score -= 8;
  } else {
    flags.push({ level: 'good', text: `热量约为单餐目标的 ${pct(energyPct)}，处于合理区间。` });
  }

  // 蛋白质
  if (proteinPct >= 0.8) {
    flags.push({ level: 'good', text: `蛋白质约达单餐目标的 ${pct(proteinPct)}，有利于孩子生长发育。` });
  } else if (proteinPct >= 0.5) {
    flags.push({ level: 'note', text: `蛋白质约为目标的 ${pct(proteinPct)}，可加一份牛奶/鸡蛋类补足。` });
    score -= 8;
  } else {
    flags.push({ level: 'warn', text: `蛋白质偏低（约目标的 ${pct(proteinPct)}），建议补充优质蛋白。` });
    score -= 15;
  }

  // 钠
  if (sodiumPct > 1.0) {
    flags.push({ level: 'warn', text: `钠含量约为单餐上限的 ${pct(sodiumPct)}，偏咸，儿童应控制钠摄入。` });
    score -= 20;
  } else if (sodiumPct > 0.7) {
    flags.push({ level: 'note', text: `钠含量约为单餐上限的 ${pct(sodiumPct)}，略高，当天其余餐次宜清淡。` });
    score -= 8;
  } else if (total.sodiumMg > 0) {
    flags.push({ level: 'good', text: `钠含量约为单餐上限的 ${pct(sodiumPct)}，处于可接受范围。` });
  }

  // 脂肪供能占比
  if (fatEnergyPct > ageGroup.fatMaxPct / 100 + 0.1) {
    flags.push({ level: 'warn', text: `脂肪供能约占 ${pct(fatEnergyPct)}，高于该年龄段建议上限（${ageGroup.fatMaxPct}%）。` });
    score -= 15;
  } else if (fatEnergyPct > ageGroup.fatMaxPct / 100) {
    flags.push({ level: 'note', text: `脂肪供能约占 ${pct(fatEnergyPct)}，接近建议上限（${ageGroup.fatMaxPct}%）。` });
    score -= 6;
  }

  // 钙：达到单餐目标（每日 1/3）正向加分
  const calciumTarget = ageGroup.calciumMg / 3;
  const calciumPct = calciumTarget ? total.calciumMg / calciumTarget : 0;
  if (calciumPct >= 0.5) {
    flags.push({ level: 'good', text: `钙摄入约达单餐目标的 ${pct(calciumPct)}，有助于孩子骨骼发育。` });
    score += 6;
  } else if (total.calciumMg > 0) {
    flags.push({ level: 'note', text: `钙摄入约为单餐目标的 ${pct(calciumPct)}，可用牛奶类补足。` });
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    mealType,
    target,
    total,
    missing,
    metrics: { energyPct, proteinPct, sodiumPct, fatEnergyPct, calciumPct },
    flags,
    score,
    grade: grade(score),
  };
}

/** 过敏原启发式筛查：基于餐品名称关键词 */
export function screenAllergens(foods) {
  const hits = {};
  for (const f of foods) {
    const name = String(f.name ?? '');
    for (const [key, def] of Object.entries(ALLERGEN_KEYWORDS)) {
      if (def.keywords.some((kw) => name.includes(kw))) {
        hits[key] = hits[key] ?? { label: def.label, foods: [] };
        if (!hits[key].foods.includes(name)) hits[key].foods.push(name);
      }
    }
  }
  return hits;
}

/** 结合评估结果给出搭配建议（面向家长的可执行自然语言） */
export function buildSuggestions(evalResult) {
  const s = [];
  const { metrics, total } = evalResult;

  if (metrics.energyPct > 1.1) {
    s.push('把薯条换成小份，或与家人分享，可明显降低这一餐的热量。');
  }
  if (metrics.proteinPct < 0.8) {
    s.push('加一盒纯牛奶或一份麦乐鸡，补充孩子生长所需的优质蛋白。');
  }
  if (metrics.sodiumPct > 0.7) {
    s.push('钠偏高，建议搭配纯悦饮用水或纯牛奶而非含糖饮料，当天其他餐次口味清淡一些。');
  }
  if (metrics.fatEnergyPct > evalResult.target.fatMaxPct) {
    s.push('脂肪供能偏高，可优先选择烤制/蒸煮类（如板烧鸡腿），减少油炸与酱料。');
  }
  if (!total.calciumMg || metrics.calciumPct < 0.5) {
    s.push('这一餐钙摄入有限，可用纯牛奶替代含糖饮料补钙。');
  }
  s.push('鼓励孩子搭配一份玉米杯或苹果片，增加膳食纤维与维生素。');
  s.push('用纯悦饮用水或纯牛奶替代碳酸饮料，是最简单有效的减糖方式。');

  // 去重
  return [...new Set(s)];
}

// ---------- 工具函数 ----------
function pct(x) {
  return `${Math.round(x * 100)}%`;
}

function grade(score) {
  if (score >= 85) return { key: 'A', label: '均衡优秀 🟢' };
  if (score >= 70) return { key: 'B', label: '基本均衡 🟡' };
  if (score >= 55) return { key: 'C', label: '需要调整 🟠' };
  return { key: 'D', label: '明显失衡 🔴' };
}
