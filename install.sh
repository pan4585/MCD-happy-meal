#!/usr/bin/env bash
#
# install.sh —— 将「麦麦儿童营养管家」安装为通用 Agent Skill
#
# 本 Skill 遵循 Anthropic Agent Skills 开放规范（SKILL.md），可用于多种 Agent 工具。
# 本脚本负责把 Skill 目录安装到目标工具的 skills 目录并安装依赖；
# MCP 连接配置请参考 INSTALL.md 与 mcp-config/ 下对应平台样例。
#
# 用法：
#   bash install.sh [target]
#     target 可选： kiro（默认） | claude-code | <自定义目标目录绝对路径>
#
#   示例：
#     bash install.sh kiro
#     bash install.sh claude-code
#     bash install.sh ~/.config/some-agent/skills
#
#   可选：传入 MCD_MCP_TOKEN 环境变量，脚本会在 Kiro 场景顺带写入 mcp.json 与 .env：
#     MCD_MCP_TOKEN=你的Token bash install.sh kiro
#
set -euo pipefail

SKILL_NAME="happy-meal-nutrition-guardian"
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${1:-kiro}"

# 解析目标 skills 目录
case "${TARGET}" in
  kiro)        SKILLS_DIR="${HOME}/.kiro/skills" ;;
  claude-code) SKILLS_DIR="${HOME}/.claude/skills" ;;
  *)           SKILLS_DIR="${TARGET}" ;;   # 视为自定义目录
esac
TARGET_DIR="${SKILLS_DIR}/${SKILL_NAME}"

echo "🍔 安装 ${SKILL_NAME} 到 [${TARGET}]"
echo "   源目录: ${SRC_DIR}"
echo "   目标目录: ${TARGET_DIR}"

# 1. 复制（排除 node_modules / .env / .git）
mkdir -p "${SKILLS_DIR}"
if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete \
    --exclude 'node_modules' --exclude '.env' --exclude '.git' \
    "${SRC_DIR}/" "${TARGET_DIR}/"
else
  mkdir -p "${TARGET_DIR}"
  cp -R "${SRC_DIR}/." "${TARGET_DIR}/"
  rm -rf "${TARGET_DIR}/node_modules" "${TARGET_DIR}/.env" "${TARGET_DIR}/.git"
fi
echo "✅ 已复制到 skills 目录"

# 2. 安装依赖
echo "📦 安装依赖 ..."
( cd "${TARGET_DIR}" && npm install >/dev/null 2>&1 )
echo "✅ 依赖安装完成"

# 3. Kiro 场景：顺带安全追加 mcd-mcp 到 mcp.json（不覆盖已有项）
if [ "${TARGET}" = "kiro" ]; then
  MCP_CONFIG="${HOME}/.kiro/settings/mcp.json"
  TOKEN_VALUE="${MCD_MCP_TOKEN:-YOUR_MCP_TOKEN}"
  echo "🔌 配置 Kiro MCP (mcd-mcp) ..."
  mkdir -p "$(dirname "${MCP_CONFIG}")"
  node - "${MCP_CONFIG}" "${TOKEN_VALUE}" <<'NODE'
const fs = require('fs');
const [, , cfgPath, token] = process.argv;
let cfg = { mcpServers: {} };
if (fs.existsSync(cfgPath)) {
  try { cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8')); }
  catch (e) { console.error('⚠️ 现有 mcp.json 解析失败，已跳过：' + e.message); process.exit(0); }
}
cfg.mcpServers = cfg.mcpServers || {};
if (cfg.mcpServers['mcd-mcp']) {
  console.log('ℹ️  已存在 mcd-mcp，未覆盖。');
} else {
  cfg.mcpServers['mcd-mcp'] = {
    type: 'streamable-http',
    url: 'https://mcp.mcd.cn',
    headers: { Authorization: 'Bearer ' + token },
  };
  fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
  console.log(token === 'YOUR_MCP_TOKEN'
    ? '✅ 已写入 mcd-mcp（占位符，请手动替换 Token）'
    : '✅ 已写入 mcd-mcp（含你提供的 Token）');
}
NODE
  if [ "${TOKEN_VALUE}" != "YOUR_MCP_TOKEN" ]; then
    printf 'MCD_MCP_TOKEN=%s\nMCD_MCP_URL=https://mcp.mcd.cn\n' "${TOKEN_VALUE}" > "${TARGET_DIR}/.env"
    echo "✅ 已在 skill 目录生成 .env"
  fi
else
  echo "ℹ️  非 Kiro 平台：请参考 INSTALL.md 与 mcp-config/ 配置 mcd-mcp 连接。"
fi

echo ""
echo "🎉 安装完成！"
echo "   自检： cd ${TARGET_DIR} && node src/cli.js --list-tools"
echo "   使用： node src/cli.js recommend --age 6 --meal lunch"
echo "   其他平台 MCP 配置见： INSTALL.md"
