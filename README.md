# 🍔 麦麦儿童营养管家（Happy Meal Nutrition Guardian）

> 基于麦当劳**官方 MCP 实时数据**，为家长科学规划孩子的套餐。
> 从 160+ 款**真实在售餐品**中，为孩子智能推荐最优儿童套餐、评估营养、一键给出更健康的替换。

一个为「麦当劳程序员创意开发大赛」开发的开源 Skill —— 让「带孩子吃麦当劳」这件事，吃得开心也吃得明白。

**所有餐品与营养数据均来自麦当劳官方 MCP 的 `list-nutrition-foods` 工具，程序只做实时查询，不使用任何离线快照或编造数据。**

---

## ✨ 三大核心功能

### 1. 🎯 智能套餐推荐（`recommend`）
输入孩子的年龄和餐段，程序从**真实在售菜单**里，按「主食/蛋白 + 果蔬配餐 + 健康饮品」的均衡结构，自动组合并排序出最适合孩子的套餐。不是让你自己选，而是像营养管家一样**替你搭好**。

### 2. 🍔 套餐评估 + 🔄 一键健康替换（`evaluate`）
把你想点的套餐报给它，得到按年龄段的五维营养评估（能量/蛋白/钠/脂肪/钙）与 A/B/C/D 评分；并从真实菜单里找出**更健康的替代餐品**，带具体数据对比（如「钠降低 458mg、热量减少 359kcal」）。

### 3. 📋 真实餐品营养查询（`list`）
列出当前在售餐品的真实营养数据，一目了然。

---

## 🧠 它的「智能」体现在哪

- **按年龄段科学建模**：依据《中国居民膳食指南》3–14 岁不同年龄段的营养参考摄入量，计算单餐目标。
- **真实数据组合优化**：在真实餐品中做组合搜索，以「接近单餐能量目标、最大化蛋白与钙、最小化钠与脂肪」为目标函数择优。
- **儿童友好过滤**：自动排除咖啡、碳酸饮料、高糖冰品等不适合儿童的餐品，优先牛奶、玉米杯、苹果片等。
- **过敏原提示**：对麸质、乳制品、蛋、鱼等常见过敏原做提示。

---

## 👨‍👩‍👧 目标用户

- **有 3–14 岁孩子的家长**：在意孩子吃麦当劳时的热量、钠和营养均衡。
- **过敏体质儿童的照护者**：需要快速看到套餐里可能含的常见过敏原。
- **MCP / AI 应用开发者**：参考「如何把麦当劳 MCP 真实数据做成一个有用的 Skill」。

---

## 📦 安装

> 💡 本项目是一个遵循 [Anthropic Agent Skills 开放规范](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)（`SKILL.md`）的**通用 Skill**，
> 可被 Claude Code/Desktop、Cursor、Kiro、Cherry Studio、WorkBuddy、Trae、VSCode 等多种 Agent 工具加载。
> **各平台的 Skill 安装 + MCP 配置详细步骤见 [INSTALL.md](./INSTALL.md)**，MCP 配置样例见 [`mcp-config/`](./mcp-config)。

前置要求：Node.js >= 18。

```bash
git clone <your-repo-url>
cd happy-meal-nutrition-guardian
npm install

# 配置 MCP Token（实时模式必需）
cp .env.example .env
# 编辑 .env，把 MCD_MCP_TOKEN 换成你在 https://open.mcd.cn/mcp 申请的真实 Token

# 可选：一键安装到指定 Agent 工具
bash install.sh kiro          # Kiro
bash install.sh claude-code   # Claude Code
```

> ⚠️ **安全**：`.env` 已被 `.gitignore` 忽略，请勿把真实 Token 提交到任何公开仓库。

---

## 🚀 使用示例

### 智能推荐（实时数据）

```bash
# 为 6 岁孩子推荐午餐套餐（连接 MCP 实时查询）
node src/cli.js recommend --age 6 --meal lunch

# 为 5 岁孩子推荐 2 套
node src/cli.js recommend --age 5 --count 2
```

**真实输出示例（实时模式）：**

```text
🟢 数据来源：麦当劳官方 MCP 实时查询（2026-10-09 15:29:56）
   traceId: 84a67aa26b91da0ad7e1336aab1482fb ·  在售餐品 160 项

══════════════════════════════════════════════════════
🎯  麦麦儿童营养管家 · 智能套餐推荐
══════════════════════════════════════════════════════

👶 5 岁 · 3-5 岁（学龄前）   🍽️ 午餐
（以下套餐由程序从麦当劳真实在售餐品中智能组合，按儿童营养契合度排序）

🥇 推荐套餐（契合度 112）
     • 儿童鱼排堡 （269kcal · 蛋白15g · 钠442mg · 钙58mg）
     • 苹果片 （32kcal · 蛋白0g · 钠0mg · 钙18mg）
     • 热牛奶中杯 （176kcal · 蛋白10g · 钠101mg · 钙319mg）
     合计：477kcal · 蛋白25g · 钠543mg · 钙395mg
...
```

### 套餐评估 + 健康替换

```bash
# 评估一份套餐并给出健康替换建议
node src/cli.js evaluate --age 6 --items "麦辣鸡腿汉堡,大薯条,可乐大杯"

# 不加 --items 则进入交互选餐
node src/cli.js evaluate --age 6
```

**真实输出示例（节选）：**

```text
📊 综合评分：55 / 100   等级：需要调整 🟠

【逐项分析】
  ⚠️ 这一餐热量约为该年龄段单餐目标的 194%，偏高，建议减量或分享。
  ⚠️ 钠含量约为单餐上限的 291%，偏咸，儿童应控制钠摄入。
  ✅钙摄入约达单餐目标的 72%，有助于孩子骨骼发育。

【🔄 一键健康替换建议】
  • 把「麦辣鸡腿汉堡」换成「蒜了吧黄油风味薄皮脆汁鸡-带骨里脊」
     ↳ 钠降低约 458mg，脂肪减少约 22g，热量减少约 359kcal。
  （替换项均为麦当劳真实在售餐品，数据来自官方 MCP。）
```

### 查看真实在售餐品营养

```bash
node src/cli.js list --age 6
```

### 未配置 Token 时

本工具**只使用麦当劳官方 MCP 的实时数据，不内置任何离线/模拟数据**。
若未配置 `MCD_MCP_TOKEN`，运行时会给出清晰的配置引导并退出：

```text
⚠️  未检测到有效的麦当劳 MCP Token，无法获取实时餐品营养数据。

本工具的所有数据均来自麦当劳官方 MCP 实时查询，不使用任何离线/模拟数据。
请按以下步骤配置后重试：
  1. 访问 https://open.mcd.cn/mcp ，用手机号登录并在控制台申请 MCP Token
  2. 在项目根目录执行： cp .env.example .env
  3. 编辑 .env，将 MCD_MCP_TOKEN 的值替换为你申请到的真实 Token
  4. 重新运行命令
```

### 命令行参数

| 命令 / 参数 | 说明 |
|---|---|
| `recommend` | 智能推荐儿童套餐（默认命令） |
| `evaluate` | 评估套餐 + 健康替换 |
| `list` | 列出真实在售餐品营养 |
| `--age <n>` | 孩子年龄（3–14），默认 6 |
| `--meal <type>` | 餐段 `breakfast`/`lunch`/`dinner`/`snack`，默认 lunch |
| `--items "a,b,c"` | evaluate 时指定套餐餐品（真实餐品名） |
| `--count <n>` | recommend 返回套餐数，默认 3 |
| `--list-tools` | 连接 MCP 列出可用工具（自检） |
| `-h, --help` | 帮助 |

---

## 🏗️ 项目结构

```
happy-meal-nutrition-guardian/
├── src/
│   ├── cli.js                              # 命令行入口（recommend / evaluate / list）
│   ├── data-source.js                      # 数据源：仅 MCP 实时查询，无 Token 则提示
│   ├── mcp-client.js                       # 麦当劳 MCP 客户端封装
│   ├── nutrition-parser.js                 # 解析 list-nutrition-foods 真实返回
│   ├── nutrition-engine.js                 # 营养评估引擎（评分/过敏原/建议）
│   ├── recommend-engine.js                 # 智能推荐 + 健康替换引擎
│   ├── report.js                           # 中文报告渲染
│   └── data/
│       └── children-nutrition-reference.js # 分年龄段营养参考摄入量
├── test/
│   ├── nutrition-engine.test.js            # 单元测试（node:test）
│   └── real-foods-sample.js                # 测试固件（实测真实餐品节选）
├── mcp-config.example.json                 # 脱敏 MCP 配置示例（仅占位符）
├── .env.example                            # 环境变量模板
├── README.md
├── MCP_INTEGRATION.md                      # MCP 集成说明
└── CONTEST_DECLARATION.md                  # 参赛声明
```

---

## 🔌 MCP 集成

本项目真实使用麦当劳官方 MCP Server（`https://mcp.mcd.cn`），核心工具为 **`list-nutrition-foods`（餐品营养信息列表）**，并封装了 `now-time-info`、`query-meals` 等工具。
完整的 Server / Tool / 调用流程 / 业务价值说明见 [MCP_INTEGRATION.md](./MCP_INTEGRATION.md)。

### 关于数据真实性

- **纯实时**：每次运行都连接 MCP 实时拉取，报告头部会显示本次查询的 `datetime` 和 `traceId`（每次运行都不同，可据此核验为实时结果）。
- **不含任何离线/模拟数据**：项目中不存在内置餐品数据文件；无 Token 时程序直接提示配置并退出，绝不以任何本地数据充当结果。
- 测试固件 `test/real-foods-sample.js` 中的数值为实测真实数据节选，**仅用于单元测试驱动纯函数逻辑，不参与运行时**。

---

## 🧪 测试

```bash
npm test
```

11 项单元测试，覆盖真实返回解析、营养汇总、年龄段换算、套餐评分区分度、餐品分类、儿童友好过滤、智能推荐合理性、健康替换有效性，**全部基于实测真实餐品数据驱动**。

---

## ⚖️ 免责声明

本项目为麦当劳程序员节创意开发大赛参赛作品，由参赛者独立开发，**非麦当劳官方产品**。
项目输出仅供参考，**不构成医疗、营养或其他专业建议**；孩子的具体营养需求请咨询专业医师或注册营养师。
餐品信息、价格及供应状态以麦当劳官方渠道的实时结果为准。

参赛声明详见 [CONTEST_DECLARATION.md](./CONTEST_DECLARATION.md)。

## 📄 许可证

[MIT](./LICENSE)
