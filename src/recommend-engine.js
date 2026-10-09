/**
 * recommend-engine.js
 *
 * 创意核心：基于麦当劳真实在售餐品，为儿童智能组合最优套餐，
 * 并提供「一键健康替换」。所有候选餐品均来自 MCP 真实数据。
 *
 * 套餐结构（符合儿童膳食均衡理念）：
 *   主食/蛋白主菜 ×1  +  果蔬/配餐 ×1  +  健康饮品 ×1
 *
 * 评分目标：在接近「单餐能量目标」的前提下，
 *   最大化蛋白质与钙，最小化钠与添加糖（用碳水近似），控制脂肪供能占比。
 */

import { getMealTarget } from './data/children-nutrition-reference.js';

/**
 * 餐品分类规则（基于真实餐品名的关键词）。
 * 用于把 160 个真实餐品分配到套餐的三个槽位。
 */
const CATEGORY_RULES = {
  // 主食/蛋白主菜：汉堡、鸡块、鸡翅、麦满分、营养卷、鱼排等
  main: [
    '鱼排堡', '麦乐鸡', '汉堡', '吉士', '麦香', '鸡腿', '板烧', '麦满分',
    '营养卷', '鸡排', '脆汁鸡', '鸡翅', '鸡翅', 'V翅', '牛堡', '鳕鱼堡', '炒双蛋堡',
  ],
  // 果蔬/健康配餐：玉米杯、苹果片等（薯条归为“非优选配餐”单独处理）
  side: ['玉米杯', '苹果片'],
  // 健康饮品：牛奶、豆浆、纯悦水、苹果汁、锡兰红茶（无糖优先）
  drink: ['纯牛奶', '牛奶', '优品豆浆', '纯悦', '苹果汁', '锡兰红茶', '无糖'],
};

/** 不建议作为儿童套餐优选的关键词（高糖/高咖啡因/高脂等），仅做提示不参与自动推荐 */
const NOT_PREFERRED_FOR_KIDS = [
  '咖啡', '浓缩', '可乐', '雪碧', '柠檬红茶', '麦旋风', '新地', '雪冰', '冰淇淋',
  '派', '油条', '薯饼', '安格斯厚牛堡', '那么大', '美汁源', '黄金橙',
];

export function classify(food) {
  const name = food.name;
  if (CATEGORY_RULES.drink.some((k) => name.includes(k))) return 'drink';
  if (CATEGORY_RULES.side.some((k) => name.includes(k))) return 'side';
  if (CATEGORY_RULES.main.some((k) => name.includes(k))) return 'main';
  return 'other';
}

export function isKidFriendly(food) {
  return !NOT_PREFERRED_FOR_KIDS.some((k) => food.name.includes(k));
}

/**
 * 对单个餐品按“儿童友好度”打分（越高越适合放进儿童套餐）。
 * 维度：蛋白质(+)、钙(+)、钠(-)、脂肪(-)、能量过高(-)
 */
export function foodKidScore(food) {
  const kcal = food.energyKcal ?? 0;
  const protein = food.proteinG ?? 0;
  const calcium = food.calciumMg ?? 0;
  const sodium = food.sodiumMg ?? 0;
  const fat = food.fatG ?? 0;

  let score = 0;
  score += protein * 2; // 蛋白质正向
  score += calcium * 0.03; // 钙正向
  score -= sodium * 0.02; // 钠负向
  score -= fat * 1.2; // 脂肪负向
  if (kcal > 400) score -= (kcal - 400) * 0.1; // 能量过高惩罚
  return score;
}

/**
 * 智能组合儿童套餐。
 * @param {Array} foods     真实餐品列表（来自 MCP）
 * @param {object} ageGroup 年龄段
 * @param {string} mealType 餐段
 * @param {object} opts     { count: 返回候选套餐数, allowSide, allowDrink }
 * @returns {Array} 推荐套餐列表（每个含 items / nutrition / reasonable 说明）
 */
export function recommendKidCombos(foods, ageGroup, mealType = 'lunch', opts = {}) {
  const { count = 3 } = opts;
  const target = getMealTarget(ageGroup, mealType);

  // 分槽位并筛掉非儿童友好项
  const mains = foods.filter((f) => classify(f) === 'main' && isKidFriendly(f) && f.energyKcal);
  const sides = foods.filter((f) => classify(f) === 'side' && f.energyKcal);
  const drinks = foods.filter((f) => classify(f) === 'drink' && isKidFriendly(f) && f.energyKcal !== undefined);

  // 各槽位按儿童友好度排序，取前若干作为候选，降低组合爆炸
  const topMains = sortByKidScore(mains).slice(0, 8);
  const topSides = sortByKidScore(sides).slice(0, 4);
  const topDrinks = sortByKidScore(drinks).slice(0, 6);

  const combos = [];
  for (const m of topMains) {
    for (const s of topSides.length ? topSides : [null]) {
      for (const d of topDrinks.length ? topDrinks : [null]) {
        const items = [m, s, d].filter(Boolean);
        const nutrition = sumFoods(items);
        const fit = comboFitScore(nutrition, target, ageGroup);
        combos.push({ items, nutrition, fitScore: fit.score, energyPct: fit.energyPct });
      }
    }
  }

  // 过滤能量明显超标/过低的组合，再按契合度排序
  const filtered = combos
    .filter((c) => c.energyPct >= 0.55 && c.energyPct <= 1.25)
    .sort((a, b) => b.fitScore - a.fitScore);

  const pool = filtered.length ? filtered : combos.sort((a, b) => b.fitScore - a.fitScore);

  // 去重（避免主菜相同的套餐挤占前列），尽量主菜多样
  const picked = [];
  const usedMains = new Set();
  for (const c of pool) {
    const mainName = c.items[0]?.name;
    if (usedMains.has(mainName) && picked.length < pool.length) continue;
    usedMains.add(mainName);
    picked.push(c);
    if (picked.length >= count) break;
  }
  return picked;
}

/**
 * 一键健康替换：对用户给定的一份套餐，逐项在真实餐品中寻找「同类更健康」替代。
 * 评判：同类别中，钠更低或脂肪更低且蛋白不降太多者为优。
 * @returns {Array} 替换建议 [{from, to, reason, deltas}]
 */
export function suggestHealthierSwaps(selectedFoods, allFoods) {
  const swaps = [];
  for (const food of selectedFoods) {
    const cat = classify(food);
    if (cat === 'other') continue;

    const candidates = allFoods.filter(
      (f) => classify(f) === cat && f.name !== food.name && isKidFriendly(f) && f.energyKcal
    );
    let best = null;
    let bestGain = 0;
    for (const c of candidates) {
      const sodiumDrop = (food.sodiumMg ?? 0) - (c.sodiumMg ?? 0);
      const fatDrop = (food.fatG ?? 0) - (c.fatG ?? 0);
      const proteinDrop = (food.proteinG ?? 0) - (c.proteinG ?? 0);
      const kcalDrop = (food.energyKcal ?? 0) - (c.energyKcal ?? 0);
      // 收益：钠降 + 脂肪降 + 热量降，但蛋白不能掉太多
      const gain = sodiumDrop * 0.02 + fatDrop * 1.5 + kcalDrop * 0.1 - Math.max(0, proteinDrop) * 2;
      if (gain > bestGain) {
        bestGain = gain;
        best = { c, sodiumDrop, fatDrop, kcalDrop, proteinDrop };
      }
    }
    if (best && bestGain > 3) {
      swaps.push({
        from: food.name,
        to: best.c.name,
        deltas: {
          energyKcal: -best.kcalDrop,
          sodiumMg: -best.sodiumDrop,
          fatG: -best.fatDrop,
        },
        reason: buildSwapReason(best),
      });
    }
  }
  return swaps;
}

// ---------- 工具函数 ----------

function sortByKidScore(list) {
  return [...list].sort((a, b) => foodKidScore(b) - foodKidScore(a));
}

export function sumFoods(items) {
  const t = { energyKcal: 0, proteinG: 0, fatG: 0, carbG: 0, sodiumMg: 0, calciumMg: 0 };
  for (const f of items) {
    for (const k of Object.keys(t)) t[k] += f[k] ?? 0;
  }
  for (const k of Object.keys(t)) t[k] = Math.round(t[k] * 10) / 10;
  return t;
}

function comboFitScore(nutrition, target, ageGroup) {
  const energyPct = target.energyKcal ? nutrition.energyKcal / target.energyKcal : 0;
  // 能量越接近 1（目标）越好
  const energyScore = 100 - Math.abs(1 - energyPct) * 120;
  // 蛋白达标正向
  const proteinScore = Math.min(1, nutrition.proteinG / (target.proteinG || 1)) * 30;
  // 钠越低越好
  const sodiumScore = -(nutrition.sodiumMg / (target.sodiumMaxMg || 1)) * 25;
  // 钙正向
  const calciumScore = Math.min(1, nutrition.calciumMg / (ageGroup.calciumMg / 3 || 1)) * 20;
  // 脂肪供能占比惩罚
  const fatPct = nutrition.energyKcal ? (nutrition.fatG * 9) / nutrition.energyKcal : 0;
  const fatScore = fatPct > ageGroup.fatMaxPct / 100 ? -(fatPct - ageGroup.fatMaxPct / 100) * 80 : 0;

  const score = energyScore + proteinScore + sodiumScore + calciumScore + fatScore;
  return { score, energyPct };
}

function buildSwapReason(best) {
  const parts = [];
  if (best.sodiumDrop > 30) parts.push(`钠降低约 ${Math.round(best.sodiumDrop)}mg`);
  if (best.fatDrop > 2) parts.push(`脂肪减少约 ${Math.round(best.fatDrop)}g`);
  if (best.kcalDrop > 20) parts.push(`热量减少约 ${Math.round(best.kcalDrop)}kcal`);
  if (best.proteinDrop < 0) parts.push(`蛋白质还增加约 ${Math.round(-best.proteinDrop)}g`);
  return parts.length ? parts.join('，') + '。' : '营养结构更适合儿童。';
}
