# AGENTS.md — endfield-menu-pro 代码规范

> 本文件是 endfield-menu-pro 项目的统一代码规范，人类开发者与 AI 代理（Agent）共同遵守。
> 任何与本文件冲突的写法都视为违规；本文件未覆盖的场景遵循"与周围代码保持一致"原则。

## 1. 项目概览

- 定位：《明日方舟：终末地》主菜单的像素级/逐毫秒生产复刻，纯静态展示站点。
- 技术栈：React 19 + Vite 8 + TypeScript 6（strict）+ 原生 CSS；包管理 pnpm；Node >= 20.19。
- 一切坐标、时序、样式、文案均逐字迁移自原版 demo（"demo"即下文各节的比对基准）。

## 2. 硬性纪律（最高优先级）

- **测量数字零改动**：所有坐标、毫秒时序、关键帧百分比、cubic-bezier、颜色值都是从 demo
  逐字迁移的测量资产；重构、格式化、"顺手优化"一律不许碰这些数字。组件注释里的测量说明同样是资产，禁止删除。
- **验证命令**：改动前 `npx tsc -b`（确认基线干净），改动后 `pnpm build` + `pnpm check:libs`。全绿才算完成。
- Git 操作边界见 §10。

## 3. 目录结构与职责（禁止越界存放）

| 目录              | 职责                                                                 | 禁止                                   |
| ----------------- | -------------------------------------------------------------------- | -------------------------------------- |
| `src/` 根         | 入口装配：`main.tsx`（挂载，无 StrictMode）、`App.tsx`（相位编排根）、`menu-actions.tsx`（动作路由 context）、`index.css`（全局变量与布局） | 放新组件、新 hooks、新样式文件         |
| `src/components/` | 界面组件（与 demo 组件一一对应）+ `info-dialog`                      | 放几何/物理纯函数                      |
| `src/scene/`      | 3D 场景：相机弹簧、图层、attach 补偿、几何常量                       | 组件渲染逻辑                           |
| `src/styles/`     | 逐字迁移的 CSS（每 demo 组件一个文件）+ fonts.css                    | 手写字体表（由脚本生成）               |
| `src/lib/`        | 纯函数（arcD / shapePathD / mulberry32 / labelText）                 | 副作用、DOM 依赖                       |
| `src/hooks/`      | 菜单相位、舞台缩放等编排 hooks                                       | 高频每帧状态（走指令式岛屿）           |
| `src/config/`     | `menu-content.ts` 全部可编辑内容                                     | 坐标/时序数字（那是测量资产）          |
| `src/test/`       | 手搓测试（镜像源码目录：`lib/`）                                     | 引入测试框架、放业务代码               |
| `src/assets/`     | 提取的美术数据 + 生成字体（脚本产物，不手改）                        | 手工编辑                               |
| `scripts/`        | 资产生成脚本（extract-assets / build-fonts）                         | 引入浏览器 API、放测试                 |
| `docs/`         | 项目文档                                                             | 代码                                   |

## 4. 架构边界（不可协商）

- CSS 逐字迁移；`body.ef-in/ef-out/ef-closed` 三个类必须继续挂在 `<body>`（全部关键帧依赖它们）。
- 指令式岛屿（相机弹簧、右列滚动物理、舞台缩放）每帧直接写 CSS 变量，**不走 React state**；
  React 只负责结构、配置注入与相位/弹窗状态。
- scene 图层内子元素顺序 = demo `app.js mountAll` 的挂载顺序，不可调整。
- `attach()` 对 SVG 元素的 NaN 补偿是 demo 原生行为，禁止"修复"。
- `main.tsx` 故意不用 StrictMode（double-invoke 会重放入场编排）。
- `menu-content.ts` 中的 `text` 布局（逐字 x/y）按具体文案测量，换文案必须重新测量。

## 5. 命名规范

- 文件/目录一律 `kebab-case`；hooks 文件 `use-xxx.ts`。
- 组件、类型、接口：`PascalCase`；变量/函数：`camelCase`；模块级常量：`UPPER_SNAKE_CASE`。
- 事件处理器命名 `handleXxx`；回调 props 命名 `onXxx`；布尔值用 `is/has/should` 前缀。
- 组件与 hook 一律 named export（入口装配按名字导入）。
- CSS 文件与组件同名（`disc.tsx` ↔ `disc.css`）；测试脚本与生成脚本用 `.mjs`。

## 6. TypeScript 规范

- `strict` 全开，含 `noUnusedLocals` / `noUnusedParameters` / `noFallthroughCasesInSwitch`。
- 开启 `verbatimModuleSyntax`：仅类型的导入必须写 `import type`。
- 开启 `erasableSyntaxOnly`：**禁止 enum / namespace / 参数属性**，用 `as const` 对象与联合类型。
- 禁止 `any`（用 `unknown` + 收窄）；禁止 `!` 非空断言（收窄优先）。
  现存唯一例外：`main.tsx` 的 `getElementById("root")!`（Vite 入口根节点，模板保证存在）。

## 7. 组件与 Hook 规范

- 函数组件；props 用内联 type 或同文件 `type XxxProps`。
- 界面组件与 demo 组件一一对应，一个组件一个文件，配套 CSS 同名放 `src/styles/`；
  新增独立界面（如 `info-dialog`）同样一文件一 CSS。
- 编排 hooks 一个职责一个文件；**高频每帧状态禁止进 React state**，
  走指令式岛屿直接写 CSS 变量（见 §4）。
- 禁止在渲染期产生副作用；副作用统一 `useEffect` 或事件处理器。

## 8. 样式规范

- 只写原生 CSS，按组件分文件放 `src/styles/`（每 demo 组件一个文件）；
  **禁止 Tailwind / CSS Modules / CSS-in-JS**。
- 迁移自 demo 的规则逐字保留：不重排、不重命名、不合并选择器、不改数值。
- 新增规则沿用 demo 手法：`@property` 注册非继承变量、按类名命名选择器、
  `setIfChanged` 式跳写（每帧只在值变化时写 CSS 变量）。
- `styles/fonts.css` 与 `src/assets/fonts/` 的 woff2 均为 `scripts/build-fonts.mjs` 的产物，
  **禁止手改**；字体调整必须改脚本后重新生成。

## 9. 测试规范（手搓，禁框架；测试统一放 `src/test/`，镜像源码目录）

- **禁止引入 Playwright / Vitest / Jest / pngjs 等任何测试框架或断言/截图/解码库**。
  本项目的测试全部手搓：纯 Node 脚本 + `node:assert` + 内置 `node:http` / `node:zlib` / 全局 `WebSocket`。
- 单测：`src/test/lib/check-libs.mjs` —— 从 demo 源码现场抽取几何函数，与 `src/lib/` 的实现逐字节比对。
- 新增测试 = 在 `src/test/` 对应镜像目录下新增/扩展脚本；不允许"顺手装个测试库"。

## 10. Git 与提交规范

- **AI 代理严禁私自操作 git**：完成修改后只允许停留在"工作区改动"状态，
  **禁止执行 `git add`（进暂存区）、`git commit`、`git push`**；
  暂存与提交的时机、拆分方式与提交信息一律由用户决定并手动执行；
  仅当用户当轮明确要求"提交"时才可代为执行。
- 分支：`main`（稳定）/ `feat/*`、`fix/*`、`chore/*`。
- 提交信息：Conventional Commits——`feat(components): …`、`fix(scene): …`、`chore(scripts): …`；
  scope 用模块名（components / scene / styles / lib / hooks / config / test / scripts / docs）。
- 提交前必须通过：`pnpm lint`、`pnpm build`、`pnpm check:libs`。

## 11. 依赖规范

- 不新增运行时依赖；开发依赖新增需说明理由，优先零依赖实现；禁止引入与现有能力重叠的库。
- **禁止引入任何测试框架或断言/截图/PNG 解码库**（见 §9）。
- `@fontsource/*` 仅由 `scripts/build-fonts.mjs` 读取作为 woff2 来源，应用代码禁止 import。

## 12. 已知坑

- Windows + Git Bash；仓库文件 CRLF；Vite dev 只监听 `localhost`（IPv6），`127.0.0.1` 连不上是正常。
- **dev server 长跑后模块转换缓存可能陈旧**（本仓文件常被脚本批量改动、依赖被重装时）：
  表现为源码 import 明明正确、浏览器却报 `xxx is not defined` 并白/黑屏。修法：
  杀掉占用 5173 的 node 进程（`netstat -ano | findstr :5173` 找 PID → `Stop-Process -Id <pid> -Force`），
  再 `npx vite --port 5173 --force` 重启。注意 `TaskStop` 后台任务不会连带杀掉 node 子进程，端口会残留占用。

## 13. AI 代理附加守则

- 动手前先读本文，并先跑 `npx tsc -b` 确认基线干净；先模仿同目录既有文件的结构与风格。
- 测量资产文件视为只读：`src/styles/` 中迁移的 CSS、`src/scene/` 的几何常量、
  `src/config/menu-content.ts` 的坐标/时序与逐字 `text` 布局、组件注释里的测量说明；
  只有任务本身要求改内容时才可动，且换文案必须重新测量（见 §4）。
- 原版 demo 及其所在目录任何情况下只读（包括为了让测试通过），本仓库外的一切文件不得改动。
- 完成定义：`npx tsc -b`、`pnpm lint`、`pnpm build`、`pnpm check:libs` 全绿；改动停留在工作区，不提交（见 §10）。
