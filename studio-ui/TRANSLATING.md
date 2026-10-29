# Rembg Studio 翻译贡献指南 / Translation contributions

界面词条已与 TypeScript 逻辑分离。无需安装或理解 React，也不用修改源码即可贡献翻译。

## 文件位置（距离 studio-ui 根目录 ≤ 2 层）

- `locales/zh-CN.json`：简体中文原文（基准词典）。
- `locales/en.json`：英文。
- `src/i18n/messages.ts`：读取 JSON 和翻译函数；不要把文本写回这里。
- `scripts/i18n.mjs`：JSON 格式、键名和占位符校验器。
- `tests/i18n.test.mjs`：国际化单元测试。

## 第三方翻译的流程

1. 克隆项目，找到 `studio-ui/locales/`。
2. 修改对应 JSON 中的**值**，保留键名。请保持 UTF-8 编码。
3. 原文中的 `{name}` 等变量必须原样保留，不能翻译变量名。
4. 运行 `cd studio-ui && npm run i18n:check && npm test`。无需修改任何 TS 文件。
5. 提交包含 JSON 修改的 PR。建议在 PR 中标注目标语言和测试结果。

可以运行 `npm run i18n:export` 输出 `translations-export/` 的纯 JSON 翻译包，用于分享给不熟悉 Git 的翻译志愿者。该目录是本地生成物，不会被提交。修改后将对应 JSON 放回 `locales/` 即可。

## 增加一种新语言

复制 `locales/en.json` 并按 BCP 47 命名，如 `ja.json`。词典校验会自动检查新 JSON。但要让新语言出现在 App 的语言菜单，还需在 `src/i18n/messages.ts` 注册导入，并修改语言选择和检测逻辑；后续可进一步自动发现语言包。

## 约束与审查

- 修改翻译不能修改模型名称、许可证原文或法律条款的实际含义。
- 当前只覆盖独立的新版 React 模型中心；旧版 `frontend/index.html` 未全部国际化。
- 文件层级约束：以 `studio-ui/` 为根，人工维护的代码和翻译文件最多 **4 层**；不要再引入深层嵌套的 feature/page/components 树。
- 涉及法律许可的信息需技术/法律审核，翻译者不应自行删减。
