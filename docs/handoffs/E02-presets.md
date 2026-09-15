# E02：输出规格模块（可直接转发）

你负责独立纯 JavaScript 模块。基线 rembg-ui 88646de，原生 ES modules + Node 内置测试，不使用 React/TypeScript。你不是唯一开发者，不得回滚或覆盖其他修改。

唯一可修改文件：`web/presets.mjs`、`web/test/presets.test.mjs`。不接入 app.mjs、不改 build.mjs/package.json、不加依赖、不发布。Codex 负责后续接入。

固定接口：
- `PRESETS`：冻结的数组，三个对象 `{id,label,width,height,background,marginPercent,format}`：white-1200（1200 方图白底）、white-1600（1600 方图白底）、transparent-1200（1200 方图透明）；留白均10，format均png。冻结每个对象。不得声称满足任何平台官方规则。
- `validatePreset(value)`：返回新对象且只含上述七个字段；非法值抛 TypeError 或 RangeError。id 非空字符串最多64字符；label非空字符串最多80字符；width/height整数800至2000；marginPercent整数0至30；background仅white/transparent；format仅png。拒绝 NaN、Infinity、数字字符串、null、数组、缺失字段；多余字段忽略，不修改输入。

第一步先返回理解的 schema 与3个边界用例，再实现。测试应覆盖合法三预设、类型错误、范围边界、不修改输入、忽略多余字段和冻结对象。用 `node --test web/test/presets.test.mjs` 验证，不能只检查自己实现里重复写的常量。

交付文件和完整测试结果。不要创建模型逻辑、Canvas、持久化、Worker 或 UI；不得更改这里的接口。若接口不够用，另写建议返回，不擅自扩展。
