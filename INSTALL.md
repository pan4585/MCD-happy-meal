# 安装与配置指南（跨平台通用）

本 Skill 遵循 [Anthropic Agent Skills 开放规范](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)（`SKILL.md`），
可被任何支持该规范的 Agent 工具加载；底层能力通过麦当劳官方 MCP（`mcd-mcp`）获取实时数据。

安装分两步：**① 装 Skill 本体** + **② 配置 mcd-mcp 连接**。

---

## 前置准备（所有平台通用）

1. 环境：Node.js >= 18。
2. 申请麦当劳 MCP Token：访问 https://open.mcd.cn/mcp → 手机号登录 → 控制台 → 激活 → 复制 Token。
3. 克隆并安装依赖：
   ```bash
   git clone <你的仓库地址>
   cd happy-meal-nutrition-guardian
   npm install
   cp .env.example .env     # 编辑 .env，填入真实 MCD_MCP_TOKEN
   ```
4. 自检（确认能连上 MCP）：
   ```bash
   node src/cli.js --list-tools
   ```

---

## ① 安装 Skill 本体

Agent Skill 的本质是「一个含 `SKILL.md` 的目录」。把本项目目录放到对应工具的 skills 目录即可。

| 工具 | Skills 目录 | 说明 |
|---|---|---|
| **Claude Code** | `~/.claude/skills/happy-meal-nutrition-guardian/` | 个人级；项目级可用 `.claude/skills/` |
| **Claude Desktop** | 通过 Settings → Capabilities → Skills 导入目录 | 需开启 Skills 功能 |
| **Kiro** | `~/.kiro/skills/happy-meal-nutrition-guardian/` | 可用随附 `install.sh` 一键安装 |
| **Cursor / VSCode** | 作为 MCP 工具使用（见下）+ 可将 `SKILL.md` 作为 rules/context 引入 | 以 MCP 能力为主 |
| **Cherry Studio / Trae / WorkBuddy** | 以 MCP 连接器形式使用（见下），`SKILL.md` 作为提示词参考 | 以 MCP 能力为主 |

> 通用做法（任何平台）：
> ```bash
> cp -R happy-meal-nutrition-guardian <目标工具的 skills 目录>/
> ```
> Kiro 用户可直接运行： `MCD_MCP_TOKEN=你的Token bash install.sh`

---

## ② 配置 mcd-mcp 连接

不同工具的 MCP 配置字段略有差异，本项目在 `mcp-config/` 下提供了对应样例，**均为脱敏占位符**，
使用时把 `${MCD_MCP_TOKEN}` 替换为真实 Token（或由工具从环境变量注入）。

### Cursor / Kiro / VSCode
配置文件参考 [`mcp-config/cursor-kiro-vscode.json`](./mcp-config/cursor-kiro-vscode.json)（`type: streamable-http`）：
- **Cursor**：设置 → Tools & MCP → Add Custom MCP，粘贴配置
- **Kiro**：写入 `~/.kiro/settings/mcp.json` 的 `mcpServers`
- **VSCode**：在 MCP 配置处添加

### Cherry Studio / Trae / WorkBuddy
参考 [`mcp-config/cherry-studio-workbuddy.json`](./mcp-config/cherry-studio-workbuddy.json)（`type: streamablehttp`）：
- **Cherry Studio**：设置 → MCP → 从 JSON 导入 → 开启启用开关
- **WorkBuddy**：左侧【专家·技能·连接器】→【连接器】→【自定义连接器】→【配置MCP】→ 粘贴 → 保存 → 启用
- **Trae**：设置 → MCP → 手动添加 → 粘贴

### Claude Desktop
Claude Desktop 对远程 HTTP MCP 需用 `mcp-remote` 做 stdio 桥接。
参考 [`mcp-config/claude-desktop.json`](./mcp-config/claude-desktop.json)，写入
`claude_desktop_config.json`（macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`）。

### Claude Code
```bash
claude mcp add --transport http mcd-mcp https://mcp.mcd.cn \
  --header "Authorization: Bearer <你的Token>"
```

---

## 验证可用

配置完成后，重启/重载你的 Agent 工具，然后用自然语言触发：

- "给我 6 岁的孩子推荐一份麦当劳午餐套餐"
- "帮我评估下 麦辣鸡腿汉堡+大薯+可乐 适不适合 5 岁孩子"

或直接命令行验证：

```bash
node src/cli.js recommend --age 6 --meal lunch
node src/cli.js evaluate --age 6 --items "麦辣鸡腿汉堡,大薯条,可乐大杯"
```

---

## 常见问题

- **报"未检测到有效 Token"**：检查 `.env` 的 `MCD_MCP_TOKEN` 或 MCP 配置中的 Authorization 是否为真实 Token。
- **Claude Desktop 连不上**：确认用的是 `mcp-remote` 桥接配置（本仓库 `mcp-config/claude-desktop.json`），而非直接 `url`。
- **429 限流**：MCP 每 Token 每分钟上限 600 次请求，正常使用不会触发。
