---
name: happy-meal-nutrition-guardian
description: 麦麦儿童营养管家。基于麦当劳官方 MCP 的真实在售餐品数据，为 3-14 岁孩子智能推荐最优儿童套餐、评估套餐营养（能量/蛋白/钠/脂肪/钙五维评分）、筛查过敏原、并给出一键健康替换建议。当用户说"给孩子推荐麦当劳套餐/儿童套餐怎么点才健康/这份麦当劳套餐适合几岁孩子吗/帮孩子评估一下这顿麦当劳/孩子吃麦当劳有没有更健康的搭配/麦当劳儿童餐营养"时使用。
license: MIT
metadata:
  version: "1.0"
  runtime: node>=18
  mcp: mcd-mcp (https://mcp.mcd.cn)
---

# 麦麦儿童营养管家（Happy Meal Nutrition Guardian）

> 通用 Agent Skill，遵循 Anthropic Agent Skills 开放规范（SKILL.md）。
> 可被任何读取 SKILL.md 的 Agent 工具加载：Claude Code / Claude Desktop、
> Cursor、Cherry Studio、Trae、VSCode、Kiro、WorkBuddy 等。

一个基于麦当劳官方 MCP **真实在售餐品数据**的儿童营养助手。所有餐品与营养数值均来自
MCP `list-nutrition-foods` 工具的**实时查询**，不使用任何离线/编造数据。

## 何时使用本 Skill

当用户的意图涉及"**给孩子吃麦当劳 + 营养/健康/推荐/评估**"时触发，典型说法：

- "给我 6 岁的孩子推荐一份麦当劳套餐"
- "孩子吃麦当劳怎么点才健康？"
- "这份套餐（麦辣鸡腿汉堡+大薯+可乐）适合我 5 岁孩子吗？"
- "帮孩子评估一下这顿麦当劳营养"
- "有没有更健康的麦当劳儿童搭配？"
- "麦当劳儿童餐热量/钠/钙够不够？"

## 何时不使用

- 用户点餐与孩子无关、也不关心营养（普通点餐用麦当劳点餐类工具）。
- 用户询问价格、门店、优惠券（用对应的 MCP 工具，不走本 Skill）。
- 非麦当劳餐品的营养咨询。

## 前置条件：MCP 连接

本 Skill 依赖麦当劳官方 MCP Server。使用前必须已配置：

- MCP Server：`mcd-mcp`，地址 `https://mcp.mcd.cn`，Streamable HTTP 协议
- 鉴权：请求头 `Authorization: Bearer <MCD_MCP_TOKEN>`
- Token 申请：https://open.mcd.cn/mcp （手机号登录 → 控制台 → 激活 → 复制 Token）

配置方式见本目录 `mcp-config.example.json`。环境变量 `MCD_MCP_TOKEN` 必填。

## 三大能力与调用方式

本 Skill 的实现是一个 Node.js 程序（`src/cli.js`），提供三个子命令。
Agent 应根据用户意图选择对应命令，通过 shell 执行并把结果整理给用户。

### 1. 智能推荐（recommend）—— 用户只给年龄/餐段，替他搭好套餐

```bash
node src/cli.js recommend --age <3-14> --meal <breakfast|lunch|dinner|snack> [--count <n>]
```

从真实在售餐品中，按"主食/蛋白 + 果蔬配餐 + 健康饮品"结构，以"接近单餐能量目标、
最大化蛋白与钙、最小化钠与脂肪"为目标自动组合并排序。

例：`node src/cli.js recommend --age 6 --meal lunch`

### 2. 套餐评估 + 健康替换（evaluate）—— 用户给出想点的套餐

```bash
node src/cli.js evaluate --age <3-14> --items "餐品1,餐品2,餐品3" [--meal <...>]
```

输出五维营养评估、A/B/C/D 评分、过敏原提示，以及从真实菜单找到的更健康替换建议
（含"钠降低多少 mg、热量减少多少 kcal"等具体数据）。餐品名支持部分匹配。

例：`node src/cli.js evaluate --age 6 --items "麦辣鸡腿汉堡,大薯条,可乐大杯"`

### 3. 真实餐品营养查询（list）

```bash
node src/cli.js list
```

列出当前实时在售餐品的真实营养数据。

## Agent 使用建议

1. 从用户话里提取 **年龄**（必需，3-14）和 **餐段**（默认 lunch）。年龄缺失时先询问。
2. 用户是"想要推荐" → 用 `recommend`；用户"已有套餐想评估/优化" → 用 `evaluate`。
3. 执行命令后，程序会先打印数据来源横幅（含实时查询时间与 traceId），据此向用户
   说明"数据为麦当劳官方 MCP 实时结果"。
4. 若命令报"未检测到有效 Token"，引导用户按 `mcp-config.example.json` 配置
   `MCD_MCP_TOKEN` 后重试，不要编造营养数据。
5. 转述结果时**必须保留免责声明**：仅供参考，不构成医疗/营养专业建议，餐品信息以
   麦当劳官方实时结果为准。

## 年龄段营养模型（内置依据）

依据《中国居民膳食指南》将 3-14 岁分为 4 段（3-5/6-8/9-11/12-14），每段有不同的
每日能量、蛋白、钠上限、脂肪供能上限、钙目标；再按餐段比例（早25%/午35%/晚30%/
加餐10%）折算为单餐目标。因此同一套餐对不同年龄孩子的评分不同。

## 安装与自检

本 Skill 为通用形态，可安装到任意支持 SKILL.md 的 Agent 工具（Claude Code/Desktop、
Cursor、Kiro、Cherry Studio、WorkBuddy、Trae、VSCode 等）。各平台安装与 MCP 配置的
详细步骤见 `INSTALL.md`，MCP 配置样例见 `mcp-config/` 目录。

```bash
npm install                 # 安装依赖（@modelcontextprotocol/sdk, dotenv）
cp .env.example .env        # 配置环境变量，填入真实 MCD_MCP_TOKEN
node src/cli.js --list-tools   # 自检：连接 MCP 并列出可用工具
npm test                    # 运行单元测试

# 一键安装到指定平台（可选）
bash install.sh kiro          # 安装到 Kiro
bash install.sh claude-code   # 安装到 Claude Code
```

## 合规

- 数据实时来自麦当劳官方 MCP，不使用离线/模拟数据。
- Token 仅通过环境变量注入，代码与配置示例只含占位符。
- 所有输出附免责声明；本 Skill 为参赛作品，非麦当劳官方产品。
