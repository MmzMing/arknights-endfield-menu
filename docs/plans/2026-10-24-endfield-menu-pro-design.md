# Endfield Menu 生产版设计文档

日期：2026-10-24 ｜ 状态：已批准

## 目标

将 `D:\my-blog\endfield_menu`（无框架 demo，约 3000 行）复刻为 **React 19 + Vite 8 + TypeScript** 生产版本：
**100% 逐毫秒像素级还原**（所有坐标、时序、关键帧、缓动曲线原样搬运），作为独立展示站点部署。

## 已对齐的决策

| 决策点 | 结论 |
|---|---|
| 用途 | 独立展示站点（纯静态产物，任意静态托管） |
| 还原标准 | 100% 逐毫秒：测量数字零改动；验收用 Playwright 逐帧截图比对 |
| 数据层 | 类型化配置模块 `config/menu-content.ts`；坐标/时序数字是测量资产，硬编码在组件内不进配置 |
| 按钮动作 | 统一 Endfield 风格信息弹窗（InfoDialog），内容来自配置 |
| 弹窗时菜单 | 暂停（相机/轮播 stop，同关闭语义）；ESC 先关弹窗再关菜单 |
| 样式方案 | 原生 CSS 分文件，demo 的 keyframes/@property/选择器逐字保留，body.ef-in/ef-out/ef-closed 类继续挂在 `<body>` |
| 位置/包管理 | `D:\my-blog\HOME`，pnpm |
| 字体 | @fontsource 自托管（Rajdhani/Noto Sans SC/Inter/JetBrains Mono），字形度量与 demo 一致 |

## 架构（方案 A：CSS 原样搬运 + React 壳 + 指令式岛屿）

- CSS（keyframes、@property、类名门控选择器）逐字迁移为每组件一个 .css 文件。
- 每个 demo 组件 → 渲染**相同 DOM 结构与类名**的 React 组件；静态结构声明式渲染。
- 高频路径不走 React 状态：相机弹簧、磁贴滚动物理、布局写入封装为 custom hooks，
  在 ref 元素上直接写 CSS 变量（与 demo 的性能哲学一致：@property 非继承变量 + setIfChanged）。
- React 状态仅用于：菜单相位、弹窗开关、轮播索引。
- 纯函数（arcD/shapePathD/mulberry32/labelSVG）进 `lib/`，模块加载期生成路径数据并 memo。

## 目录结构

```
src/
  main.tsx / App.tsx / index.css        # demo index.html 全局样式逐字迁移
  scene/    useCamera, geometry(DISC/R_EDGE), SceneProvider(7 图层 refs), attach 补偿
  styles/   每组件一个 .css（backdrop.css, disc.css, …, info-dialog.css）
  assets/   sprite(图标+描摹美术 SVG defs), card-contours 数据, backdrop-field 数据
  components/ backdrop, disc, transition-skeleton, dial-rings, level-pill, energy-pill,
              disc-buttons, top-bar, news-panel, player-badge, left-cards,
              right-tiles, hud, info-dialog
  hooks/    useMenuPhase, useStageScale, useTileScroll, useNewsCarousel, useReducedMotion
  config/   menu-content.ts
  lib/      arc-d, label-svg, shape-path-d, mulberry32
  types.ts
e2e/       Playwright 逐帧比对 + 冒烟
```

## 关键实现要点

1. **挂载顺序** 与 app.js 完全一致（deck←links+belt；cards←cards+badge+sysbtns+power；
   tiles←tiles+close；core←win+skeleton+rings+flags+levelPill；btns←energy+discbtns+disclabels；top←topbar；stage←netinfo）。
2. **useMenuPhase**：body 三类编排；`animationend`(efBackdropOut) + 750ms 兜底；入场在 fonts.ready+80ms；
   ef-in 900ms 后移除；重开取消退场。
3. **useCamera**：弹簧参数/springK 8e-3/damp 0.8、量化 100 级阴影、settle 检测、reduced-motion 静止。
4. **useTileScroll**：0.18 缓动 / 0.8 回弹 / 0.92 惯性 / 滚轮 0.062 / rubberBand 指数公式 /
   MAX_OVERSCROLL=354/PX_PER_DEG；slot=round(i−scroll/15.5)∈[0,5]，入场时 toTop()；相位变化时锁 slot。
5. **InfoDialog**：深色半透+金边+黄斜切角；入场 62.5° 翻起（同 news 曲线）；reduced-motion 直显；
   打开时 scene.pause()+news.pause()；ESC 优先级 弹窗>菜单。
6. **验收**：demo 与生产版同视口；`getAnimations()` pause + 设 currentTime 采样入场 24 帧/退场 11 帧/静止/相机偏移帧；
   像素 diff 容差：每通道 ≤2、差异像素占比 ≤0.5%。

## 不做的事（YAGNI）

- 不接后端、不做路由占位页、不做 i18n、不做移动端触控手势适配（demo 亦无）、CI 不跑逐帧比对（本地/手动）。

## 版权

描摹美术（button-art、card-contours、backdrop-field）源自 Hypergryph 游戏画面，文件头保留原注释；
站点角落加 fan-recreation 免责声明。
