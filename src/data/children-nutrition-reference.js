/**
 * children-nutrition-reference.js
 *
 * 儿童每日营养参考摄入量（Reference Intake）。
 *
 * 数据来源与口径说明：
 *   数值参考公开的《中国居民膳食营养素参考摄入量》(DRIs) 与
 *   《中国居民膳食指南》中不同年龄段儿童的推荐范围，并做了区间化、
 *   近似化处理，仅用于“单餐占比”这类相对评估，不作为精确医学依据。
 *
 * ⚠️ 合规声明：
 *   本模块输出仅供参考，不构成任何医疗、营养或专业建议。
 *   孩子的具体营养需求请咨询专业医师或注册营养师。
 */

/**
 * 年龄段分组。每段给出“每日”参考值，单位：
 *   energyKcal   能量（千卡/天）
 *   proteinG     蛋白质（克/天）
 *   fatMaxPct    脂肪供能占比上限（%，用于判断脂肪是否偏高）
 *   sodiumMaxMg  钠每日上限（毫克/天）
 *   calciumMg    钙推荐（毫克/天）
 *
 * 能量/蛋白质给的是“推荐中位数”，用于估算单餐占比。
 */
export const AGE_GROUPS = [
  {
    key: '3-5',
    label: '3-5 岁（学龄前）',
    minAge: 3,
    maxAge: 5,
    energyKcal: 1300,
    proteinG: 30,
    fatMaxPct: 35,
    sodiumMaxMg: 1200,
    calciumMg: 600,
  },
  {
    key: '6-8',
    label: '6-8 岁（学龄早期）',
    minAge: 6,
    maxAge: 8,
    energyKcal: 1600,
    proteinG: 40,
    fatMaxPct: 30,
    sodiumMaxMg: 1400,
    calciumMg: 800,
  },
  {
    key: '9-11',
    label: '9-11 岁（学龄中期）',
    minAge: 9,
    maxAge: 11,
    energyKcal: 1900,
    proteinG: 50,
    fatMaxPct: 30,
    sodiumMaxMg: 1600,
    calciumMg: 1000,
  },
  {
    key: '12-14',
    label: '12-14 岁（青春期早期）',
    minAge: 12,
    maxAge: 14,
    energyKcal: 2200,
    proteinG: 60,
    fatMaxPct: 30,
    sodiumMaxMg: 1900,
    calciumMg: 1000,
  },
];

/**
 * 一餐占每日的典型比例。
 * 早餐 25%、午餐 35%、晚餐 30%、加餐 10%（指南常见口径）。
 */
export const MEAL_RATIO = {
  breakfast: 0.25,
  lunch: 0.35,
  dinner: 0.3,
  snack: 0.1,
};

export const MEAL_LABEL = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '加餐',
};

/**
 * 根据年龄返回对应的年龄段参考对象。
 * @param {number} age 年龄（岁）
 * @returns {object|null}
 */
export function getAgeGroup(age) {
  if (typeof age !== 'number' || Number.isNaN(age)) return null;
  const group = AGE_GROUPS.find((g) => age >= g.minAge && age <= g.maxAge);
  return group ?? null;
}

/**
 * 计算某一餐的目标营养区间（基于年龄段每日值 × 餐段比例）。
 * @param {object} ageGroup getAgeGroup 的返回值
 * @param {string} mealType breakfast|lunch|dinner|snack
 * @returns {{energyKcal:number, proteinG:number, sodiumMaxMg:number}}
 */
export function getMealTarget(ageGroup, mealType = 'lunch') {
  const ratio = MEAL_RATIO[mealType] ?? MEAL_RATIO.lunch;
  return {
    mealType,
    ratio,
    energyKcal: Math.round(ageGroup.energyKcal * ratio),
    proteinG: Math.round(ageGroup.proteinG * ratio),
    sodiumMaxMg: Math.round(ageGroup.sodiumMaxMg * ratio),
    fatMaxPct: ageGroup.fatMaxPct / 100,
  };
}

/**
 * 常见过敏原关键词 → 中文名。用于对餐品名做朴素的过敏原筛查提示。
 * 注意：这是基于“餐品名称/常识”的启发式提示，不是官方成分表，
 * 真实过敏原信息请以麦当劳官方标注为准。
 */
export const ALLERGEN_KEYWORDS = {
  gluten: { label: '麸质/小麦（面包、吉事果、派皮等）', keywords: ['汉堡', '包', '堡', '吉事果', '派', '松饼', '麦满分', '卷', '鸡块', '薯饼'] },
  egg: { label: '蛋类', keywords: ['蛋', '满分'] },
  milk: { label: '乳制品', keywords: ['奶', '芝士', '吉士', '圣代', '麦旋风', '奶昔', '拿铁', '咖啡'] },
  fish: { label: '鱼类', keywords: ['鱼', '鳕鱼'] },
  soy: { label: '大豆', keywords: ['豆浆', '豆'] },
  peanut: { label: '花生/坚果', keywords: ['花生', '坚果', '杏仁'] },
};
