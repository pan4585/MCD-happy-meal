/**
 * real-foods-sample.js
 *
 * 测试固件：下列餐品及营养数值为从麦当劳官方 MCP `list-nutrition-foods`
 * 实测抓取的真实数据（节选），仅用于驱动纯函数单元测试，不参与运行时逻辑。
 * 运行时程序始终从 MCP 实时获取完整数据，不使用本文件。
 *
 * 字段单位：energyKcal 千卡 / proteinG,fatG,carbG 克 / sodiumMg,calciumMg 毫克
 */
export const REAL_FOODS_SAMPLE = [
  { name: '猪柳麦满分', energyKj: 1288, energyKcal: 308, proteinG: 16, fatG: 16, carbG: 24, sodiumMg: 781, calciumMg: 213 },
  { name: '烟肉蛋麦满分', energyKj: 1089, energyKcal: 260, proteinG: 16, fatG: 10, carbG: 24, sodiumMg: 483, calciumMg: 238 },
  { name: '中薯条', energyKj: 1210, energyKcal: 289, proteinG: 4, fatG: 12, carbG: 38, sodiumMg: 165, calciumMg: 18 },
  { name: '大薯条', energyKj: 1587, energyKcal: 379, proteinG: 6, fatG: 16, carbG: 50, sodiumMg: 216, calciumMg: 23 },
  { name: '小薯条', energyKj: 877, energyKcal: 210, proteinG: 3, fatG: 9, carbG: 28, sodiumMg: 120, calciumMg: 13 },
  { name: '麦乐鸡5块', energyKj: 890, energyKcal: 213, proteinG: 12, fatG: 12, carbG: 13, sodiumMg: 422, calciumMg: 9 },
  { name: '麦乐鸡4块', energyKj: 712, energyKcal: 170, proteinG: 10, fatG: 10, carbG: 11, sodiumMg: 337, calciumMg: 7 },
  { name: '大杯玉米杯', energyKj: 365, energyKcal: 87, proteinG: 4, fatG: 1, carbG: 12, sodiumMg: 2, calciumMg: 10 },
  { name: '小杯玉米杯', energyKj: 223, energyKcal: 53, proteinG: 2, fatG: 1, carbG: 7, sodiumMg: 1, calciumMg: 6 },
  { name: '吉士汉堡包', energyKj: 1231, energyKcal: 294, proteinG: 16, fatG: 12, carbG: 30, sodiumMg: 673, calciumMg: 144 },
  { name: '麦辣鸡腿汉堡', energyKj: 2029, energyKcal: 485, proteinG: 24, fatG: 24, carbG: 42, sodiumMg: 1208, calciumMg: 154 },
  { name: '板烧鸡腿堡', energyKj: 1638, energyKcal: 391, proteinG: 23, fatG: 17, carbG: 35, sodiumMg: 1041, calciumMg: 93 },
  { name: '巨无霸', energyKj: 2146, energyKcal: 513, proteinG: 27, fatG: 26, carbG: 42, sodiumMg: 961, calciumMg: 171 },
  { name: '可乐大杯', energyKj: 936, energyKcal: 224, proteinG: 0, fatG: 0, carbG: 55, sodiumMg: 0, calciumMg: 15 },
  { name: '可乐中杯', energyKj: 616, energyKcal: 147, proteinG: 0, fatG: 0, carbG: 36, sodiumMg: 0, calciumMg: 10 },
  { name: '纯牛奶（盒装）', energyKj: 541, energyKcal: 129, proteinG: 7, fatG: 7, carbG: 10, sodiumMg: 73, calciumMg: 231 },
  { name: '热牛奶中杯', energyKj: 736, energyKcal: 176, proteinG: 10, fatG: 7, carbG: 18, sodiumMg: 101, calciumMg: 319 },
  { name: '苹果片', energyKj: 133, energyKcal: 32, proteinG: 0, fatG: 0, carbG: 7, sodiumMg: 0, calciumMg: 18 },
  { name: '儿童鱼排堡', energyKj: 1126, energyKcal: 269, proteinG: 15, fatG: 6, carbG: 36, sodiumMg: 442, calciumMg: 58 },
  { name: '浓缩咖啡', energyKj: 54, energyKcal: 13, proteinG: 1, fatG: 0, carbG: 2, sodiumMg: 0, calciumMg: 7 },
  { name: '麦麦脆汁鸡-带骨里脊', energyKj: 1389, energyKcal: 332, proteinG: 22, fatG: 18, carbG: 16, sodiumMg: 812, calciumMg: 25 },
  { name: '优品豆浆小杯', energyKj: 633, energyKcal: 151, proteinG: 6, fatG: 3, carbG: 25, sodiumMg: 32, calciumMg: 15 },
];
