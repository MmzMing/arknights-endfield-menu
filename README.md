# Endfield Menu

一个《明日方舟：终末地》风格的交互式主菜单界面 —— **React 19 + Vite 8 + TypeScript（strict）+ 原生 CSS**
全新开发的生产级实现。

> Fan recreation for technical demonstration only. Arknights: Endfield © Hypergryph —
> 界面美术为按图描摹的同人资产（版权归原厂商），本项目不以之营利，页面内亦标注了同人复刻声明。

## 特性

- **1920×1080 固定舞台**自适应缩放；CSS 3D 场景（透视相机 + 7 个高度分层），鼠标驱动的弹簧阻尼相机，
  阴影随视角倾斜。
- **完整交互动效**：逐毫秒编排的开场/关闭时间轴、中央圆盘的位姿动画、左侧卡片列、
  右侧 18 项功能磁贴的**角度滚动列**（滚轮缓动 / 拖拽跟手 / 惯性 / 橡皮筋回弹）、
  新闻轮播（Web Animations API 驱动）、双货币/理智读数、玩家徽章、系统 HUD。
- **Endfield 风格信息弹窗**：点击任意入口弹出（菜单随之暂停），ESC 优先关闭弹窗。
- **性能手法**：`@property` 注册非继承自定义属性、类名门控选择器、量化阴影写入、
  `setIfChanged` 跳写、确定性随机（种子固定）——滚动与相机每帧直写 CSS 变量，零 React 重渲。
- **完整无障碍降级**：`prefers-reduced-motion` 全链路支持。
- 内容（文案 / 数字 / 弹窗文案）集中于 `src/config/menu-content.ts`，类型化可编辑。

## 快速开始

```bash
pnpm install
pnpm dev          # 开发服务器（只监听 localhost/IPv6）
pnpm build        # tsc + vite build，产物 dist/（base './'，任意静态路径可部署）
pnpm lint         # oxlint
```

## 测试（手搓，无测试框架）

项目规范：**不使用 Playwright / Vitest 等测试框架**。测试代码统一在 `src/test/`（镜像源码目录），
全部为纯 Node 脚本（`node:assert`，零额外依赖）。

```bash
pnpm check:libs    # src/test/lib/check-libs.mjs —— 几何/随机纯函数的黄金值校验
                   #   （arcD 圆弧 / mulberry32 种子流 / shapePathD 卡片轮廓）
```

## 目录结构

```
src/
  components/   界面组件（与界面各区域一一对应）+ info-dialog 信息弹窗
  scene/        3D 场景：常量、相机弹簧、图层与高度补偿、SceneLayer 门户
  styles/       原生 CSS（每组件一个文件）+ fonts.css（自托管字体表）
  lib/          纯函数（圆弧 / 卡片轮廓路径 / 确定性随机 / 文字排版）
  hooks/        菜单相位编排、舞台缩放
  config/       menu-content.ts —— 全部可编辑内容
  assets/       描摹美术数据与字体文件（脚本生成，勿手改）
  test/         手搓测试（镜像源码目录：lib/ 纯函数校验）
scripts/        资产生成（extract-assets / build-fonts）
docs/           项目文档
```

## 已知说明

- `main.tsx` 有意不使用 StrictMode（double-invoke 会重放开场编排，破坏时序）。
- Vite dev 在部分机器只监听 `localhost`（IPv6），`127.0.0.1` 连不上属正常。

## 规范

见 [AGENTS.md](AGENTS.md)：禁止私自 git 操作、界面坐标与时序数字零改动、
测试手搓禁框架、目录职责边界。
