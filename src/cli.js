#!/usr/bin/env node
/**
 * cli.js —— 麦麦儿童营养管家 命令行入口
 *
 * 三大功能（全部基于麦当劳真实在售餐品，数据来自官方 MCP）：
 *   1) recommend 智能推荐：从真实菜单为孩子自动组合最优儿童套餐
 *   2) evaluate  套餐评估：评估家长选定的套餐并给出健康替换
 *   3) list      列出真实在售餐品营养
 *
 * 数据来源：
 *   本工具所有数据均来自麦当劳官方 MCP 实时查询（需环境变量 MCD_MCP_TOKEN）。
 *   不使用任何离线快照或模拟数据；无 Token 时给出配置提示并退出。
 *
 * ⚠️ 本程序从不打印或存储真实 Token。
 */

import 'dotenv/config';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import { getNutritionData } from './data-source.js';
import { evaluateMeal, screenAllergens, buildSuggestions } from './nutrition-engine.js';
import { recommendKidCombos, suggestHealthierSwaps } from './recommend-engine.js';
import { getAgeGroup } from './data/children-nutrition-reference.js';
import {
  renderReport,
  renderRecommendations,
  renderSwaps,
  renderSourceBanner,
} from './report.js';

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];

function parseArgs(argv) {
  const args = {
    command: 'recommend',
    age: 6,
    meal: 'lunch',
    items: null,
    count: 3,
    listTools: false,
  };
  const positional = [];
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--list-tools') args.listTools = true;
    else if (a === '--age') args.age = Number(argv[++i]);
    else if (a === '--meal') args.meal = argv[++i];
    else if (a === '--items') args.items = argv[++i];
    else if (a === '--count') args.count = Number(argv[++i]);
    else if (a === '-h' || a === '--help') args.help = true;
    else if (!a.startsWith('-')) positional.push(a);
  }
  if (positional.length) args.command = positional[0];
  return args;
}

function printHelp() {
  console.log(`
🍔 麦麦儿童营养管家 (happy-meal-nutrition-guardian)
   基于麦当劳官方 MCP 真实在售餐品，为孩子科学规划套餐。

用法:
  node src/cli.js recommend [--age 6] [--meal lunch] [--count 3]
      从真实菜单为孩子智能推荐最优儿童套餐

  node src/cli.js evaluate --items "麦乐鸡5块,小薯条,可乐小杯" [--age 6]
      评估指定套餐，并给出一键健康替换建议
      （不加 --items 时进入交互选餐）

  node src/cli.js list [--age 6]
      列出真实在售餐品营养（按儿童友好度参考）

  node src/cli.js --list-tools
      连接 MCP 列出可用工具（自检）

通用参数:
  --age <n>      孩子年龄（岁），支持 3-14，默认 6
  --meal <type>  餐段 breakfast|lunch|dinner|snack，默认 lunch
  -h, --help     显示帮助

数据来源:
  本工具所有数据均来自麦当劳官方 MCP (https://mcp.mcd.cn) 实时查询，
  不使用任何离线/模拟数据。需在 .env 配置 MCD_MCP_TOKEN。
  Token 申请：https://open.mcd.cn/mcp
`);
}

/** 匹配用户输入的餐品名到真实餐品（支持部分匹配） */
function matchFoods(names, allFoods) {
  const result = [];
  const notFound = [];
  for (const raw of names) {
    const q = raw.trim();
    if (!q) continue;
    let f = allFoods.find((x) => x.name === q);
    if (!f) f = allFoods.find((x) => x.name.includes(q) || q.includes(x.name));
    if (f) result.push(f);
    else notFound.push(q);
  }
  return { result, notFound };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) return printHelp();

  console.log('🍔 麦麦儿童营养管家 启动\n');

  if (!MEALS.includes(args.meal)) {
    console.error(`无效餐段 "${args.meal}"，请用 ${MEALS.join('|')}。`);
    process.exit(1);
  }

  // --list-tools 单独处理
  if (args.listTools) {
    const { McdMcpClient } = await import('./mcp-client.js');
    const client = new McdMcpClient({
      token: process.env.MCD_MCP_TOKEN,
      url: process.env.MCD_MCP_URL,
    });
    await client.connect();
    const tools = await client.listTools();
    console.log(`可用工具（${tools.length}）：`);
    for (const t of tools) console.log(`  • ${t.name} — ${t.description ?? ''}`);
    await client.close();
    return;
  }

  const ageGroup = getAgeGroup(args.age);
  if (!ageGroup) {
    console.error(`暂不支持 ${args.age} 岁，请输入 3-14 岁之间的年龄。`);
    process.exit(1);
  }

  // 获取真实营养数据（仅 MCP 实时查询）
  const meta = await getNutritionData({
    token: process.env.MCD_MCP_TOKEN,
    url: process.env.MCD_MCP_URL,
  });
  console.log(renderSourceBanner(meta));
  console.log('');

  const allFoods = meta.foods;
  const childProfile = { age: args.age, ageGroup };

  switch (args.command) {
    case 'recommend': {
      const combos = recommendKidCombos(allFoods, ageGroup, args.meal, { count: args.count });
      console.log(renderRecommendations({ childProfile, mealType: args.meal, combos }));
      break;
    }

    case 'evaluate': {
      let names;
      if (args.items) {
        names = args.items.split(/[,，]/);
      } else {
        // 交互选餐
        const rl = readline.createInterface({ input, output });
        allFoods.slice(0, 50).forEach((f, i) => {
          const kcal = typeof f.energyKcal === 'number' ? `${f.energyKcal}kcal` : '—';
          console.log(`  [${i + 1}] ${f.name} (${kcal})`);
        });
        const picked = await rl.question('\n请输入要组成套餐的餐品序号（逗号分隔，如 10,7,33）：');
        rl.close();
        const idxs = picked.split(/[,，\s]+/).map((x) => parseInt(x, 10) - 1).filter((n) => n >= 0 && n < allFoods.length);
        names = idxs.map((i) => allFoods[i].name);
        console.log('');
      }

      const { result: foods, notFound } = matchFoods(names, allFoods);
      if (notFound.length) {
        console.log(`⚠️ 以下餐品未在真实菜单中找到，已忽略：${notFound.join('、')}\n`);
      }
      if (foods.length === 0) {
        console.error('未匹配到有效餐品，已退出。可先用 `list` 查看真实在售餐品名。');
        process.exit(1);
      }

      const evalResult = evaluateMeal(ageGroup, foods, args.meal);
      const allergens = screenAllergens(foods);
      const suggestions = buildSuggestions(evalResult);
      console.log(renderReport({ childProfile, foods, evalResult, allergens, suggestions }));
      console.log('');
      const swaps = suggestHealthierSwaps(foods, allFoods);
      console.log(renderSwaps(swaps));
      break;
    }

    case 'list': {
      console.log(`真实在售餐品营养（共 ${allFoods.length} 项，节选前 60）：\n`);
      allFoods.slice(0, 60).forEach((f) => {
        console.log(
          `  ${f.name.padEnd(20)} ${String(f.energyKcal ?? '—').padStart(4)}kcal` +
            ` · 蛋白${f.proteinG ?? '—'}g · 钠${f.sodiumMg ?? '—'}mg · 钙${f.calciumMg ?? '—'}mg`
        );
      });
      break;
    }

    default:
      console.error(`未知命令 "${args.command}"。使用 -h 查看帮助。`);
      process.exit(1);
  }
}

main().catch((err) => {
  if (err && err.isTokenRequired) {
    console.error('\n⚠️  ' + err.message);
    process.exit(1);
  }
  console.error('\n❌ 运行出错：', err.message);
  if (/MCD_MCP_TOKEN|Token|401/.test(err.message)) {
    console.error('   提示：请检查 .env 中的 MCD_MCP_TOKEN 是否为有效的真实 Token。');
  }
  process.exit(1);
});
