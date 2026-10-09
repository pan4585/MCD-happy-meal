/**
 * 测试：真实数据解析器 + 营养引擎 + 推荐引擎
 * 使用从真实 MCP 抓取的快照数据驱动，确保逻辑对真实数据成立。
 * 运行： npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseNutritionResult,
  parseDataTable,
} from '../src/nutrition-parser.js';
import { evaluateMeal, screenAllergens, buildSuggestions, sumNutrition } from '../src/nutrition-engine.js';
import {
  recommendKidCombos,
  suggestHealthierSwaps,
  classify,
  isKidFriendly,
} from '../src/recommend-engine.js';
import { getAgeGroup, getMealTarget } from '../src/data/children-nutrition-reference.js';
import { REAL_FOODS_SAMPLE } from './real-foods-sample.js';

const FOODS = REAL_FOODS_SAMPLE;

// ---------- 解析器 ----------

test('解析器能从真实 MCP 文本返回中提取 data', () => {
  // 构造一个贴近真实返回结构的样例（字段顺序与真实一致）
  const fakeToolResult = {
    content: [
      {
        type: 'text',
        text:
          '## Original Response\n\n' +
          JSON.stringify({
            success: true,
            code: 200,
            message: '请求成功',
            datetime: '2026-10-09 15:00:00',
            traceId: 'test-trace',
            data:
              '[2]{productName,nutritionDescription,energyKj,energyKcal,protein,fat,carbohydrate,sodium,calcium}:\n' +
              '  麦乐鸡5块,null,890,213,12,12,13,422,9\n' +
              '  纯牛奶（盒装）,null,541,129,7,7,10,73,231',
          }),
      },
    ],
  };
  const { foods, datetime, traceId } = parseNutritionResult(fakeToolResult);
  assert.equal(foods.length, 2);
  assert.equal(datetime, '2026-10-09 15:00:00');
  assert.equal(traceId, 'test-trace');
  assert.equal(foods[0].name, '麦乐鸡5块');
  assert.equal(foods[0].energyKcal, 213);
  assert.equal(foods[0].proteinG, 12);
  assert.equal(foods[0].sodiumMg, 422);
  assert.equal(foods[1].name, '纯牛奶（盒装）');
  assert.equal(foods[1].calciumMg, 231);
});

test('parseDataTable 正确处理表头与 null 字段', () => {
  const data =
    '[1]{productName,nutritionDescription,energyKj,energyKcal,protein,fat,carbohydrate,sodium,calcium}:\n' +
    '  纯悦,能量约清水1杯,0,0,0,0,0,0,0';
  const foods = parseDataTable(data);
  assert.equal(foods.length, 1);
  assert.equal(foods[0].name, '纯悦');
  assert.equal(foods[0].nutritionDescription, '能量约清水1杯');
  assert.equal(foods[0].energyKcal, 0);
});

test('真实样例数据营养字段完整', () => {
  assert.ok(FOODS.length >= 20, `样例应包含充足餐品，实际 ${FOODS.length}`);
  const missingKcal = FOODS.filter((f) => typeof f.energyKcal !== 'number');
  assert.equal(missingKcal.length, 0, '所有餐品应有能量数据');
  const chicken = FOODS.find((f) => f.name === '麦乐鸡5块');
  assert.ok(chicken, '应包含真实餐品 麦乐鸡5块');
  assert.equal(chicken.energyKcal, 213);
});

// ---------- 营养引擎 ----------

test('sumNutrition 对真实餐品正确汇总', () => {
  const picked = [
    FOODS.find((f) => f.name === '麦乐鸡5块'),
    FOODS.find((f) => f.name === '纯牛奶（盒装）'),
  ].filter(Boolean);
  const { total } = sumNutrition(picked);
  assert.ok(total.energyKcal > 0);
  assert.ok(total.proteinG >= 19, `蛋白应为两者之和，实际 ${total.proteinG}`);
});

test('evaluateMeal 对高热量汉堡套餐评分低于均衡套餐', () => {
  const g = getAgeGroup(6);
  const balanced = [
    FOODS.find((f) => f.name === '麦乐鸡5块'),
    FOODS.find((f) => f.name === '大杯玉米杯'),
    FOODS.find((f) => f.name === '纯牛奶（盒装）'),
  ].filter(Boolean);
  const heavy = [
    FOODS.find((f) => f.name === '巨无霸'),
    FOODS.find((f) => f.name === '大薯条'),
    FOODS.find((f) => f.name === '可乐大杯'),
  ].filter(Boolean);

  const be = evaluateMeal(g, balanced, 'lunch');
  const he = evaluateMeal(g, heavy, 'lunch');
  assert.ok(be.score > he.score, `均衡(${be.score}) 应高于 高热量(${he.score})`);
  assert.ok(['A', 'B', 'C', 'D'].includes(be.grade.key));
});

test('screenAllergens 对真实餐品识别过敏原', () => {
  const foods = [
    FOODS.find((f) => f.name === '吉士汉堡包'),
    FOODS.find((f) => f.name === '纯牛奶（盒装）'),
  ].filter(Boolean);
  const hits = screenAllergens(foods);
  assert.ok(hits.gluten, '汉堡应命中麸质');
  assert.ok(hits.milk, '牛奶应命中乳制品');
});

test('buildSuggestions 始终返回非空去重建议', () => {
  const g = getAgeGroup(6);
  const foods = [FOODS.find((f) => f.name === '巨无霸')].filter(Boolean);
  const ev = evaluateMeal(g, foods, 'lunch');
  const s = buildSuggestions(ev);
  assert.ok(s.length > 0);
  assert.equal(s.length, new Set(s).size, '建议应已去重');
});

// ---------- 推荐引擎 ----------

test('classify 能把真实餐品分到正确槽位', () => {
  assert.equal(classify(FOODS.find((f) => f.name === '儿童鱼排堡')), 'main');
  assert.equal(classify(FOODS.find((f) => f.name === '大杯玉米杯')), 'side');
  assert.equal(classify(FOODS.find((f) => f.name === '纯牛奶（盒装）')), 'drink');
});

test('isKidFriendly 过滤掉咖啡/可乐等不适合儿童的餐品', () => {
  const coke = FOODS.find((f) => f.name === '可乐大杯');
  const coffee = FOODS.find((f) => f.name.includes('浓缩咖啡'));
  if (coke) assert.equal(isKidFriendly(coke), false);
  if (coffee) assert.equal(isKidFriendly(coffee), false);
  assert.equal(isKidFriendly(FOODS.find((f) => f.name === '纯牛奶（盒装）')), true);
});

test('recommendKidCombos 从真实菜单产出合理的儿童套餐', () => {
  const g = getAgeGroup(6);
  const combos = recommendKidCombos(FOODS, g, 'lunch', { count: 3 });
  assert.ok(combos.length >= 1 && combos.length <= 3);
  for (const c of combos) {
    assert.ok(c.items.length >= 2, '套餐至少含 2 项');
    // 推荐套餐不应含明显不适合儿童的餐品
    assert.ok(c.items.every(isKidFriendly), '推荐套餐不应含非儿童友好餐品');
    // 能量在合理区间
    const target = getMealTarget(g, 'lunch');
    assert.ok(
      c.nutrition.energyKcal >= target.energyKcal * 0.5 &&
        c.nutrition.energyKcal <= target.energyKcal * 1.3,
      `能量应在合理区间，实际 ${c.nutrition.energyKcal} / 目标 ${target.energyKcal}`
    );
  }
});

test('suggestHealthierSwaps 为高钠主食找到更健康替代', () => {
  // 麦辣鸡腿汉堡 钠很高(1208)，应能找到更低钠的主食替代
  const spicy = FOODS.find((f) => f.name === '麦辣鸡腿汉堡');
  assert.ok(spicy);
  const swaps = suggestHealthierSwaps([spicy], FOODS);
  assert.ok(swaps.length >= 1, '应给出至少一个替换建议');
  // 替换目标必须是真实存在的餐品
  for (const s of swaps) {
    assert.ok(FOODS.some((f) => f.name === s.to), `替换目标 ${s.to} 必须是真实餐品`);
  }
});
