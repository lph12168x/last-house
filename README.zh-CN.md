# Last House · 户型室内方案

**一套可复用的户型设计流程，当前以 143㎡ 四室户型为例。**

[中文](README.zh-CN.md) | [English](README.md)

这是一次完整的室内方案演练：包含平面布置图、24 张效果图、风格切换器，以及由同一空间模型生成的三套网页 3D 场景。当前以 143㎡ 四室户型为实例，后续可继续加入其他户型和风格。

![奶油暖木客厅](public/renders/warm/living.png)

## 在线浏览

- 方案页：**https://lph12168x.github.io/last-house/design.html**
- 3D · 奶油暖木：**https://lph12168x.github.io/last-house/?scene=your-house-warm**
- 3D · 现代灰调：**https://lph12168x.github.io/last-house/?scene=your-house-grey**
- 3D · 深色雅奢：**https://lph12168x.github.io/last-house/?scene=your-house-dark**

在方案页切换风格时，8 张效果图、材质清单和 3D 入口会整套同步；当前风格会写入 URL（`?style=warm|grey|dark`）。

## 三套风格

| 方案 | 气质 | 主要材质 |
| --- | --- | --- |
| 奶油暖木 | 松弛、耐看，适合长期居住 | 暖白乳胶漆、浅橡木、亚麻、陶土与鼠尾草绿、黄铜 |
| 现代灰调 | 克制、利落，强调秩序 | 浅灰墙面、烟熏橡木、黑色金属、锈橙与橄榄绿 |
| 深色雅奢 | 温暖包裹，偏夜晚氛围 | 暖灰艺术漆、深胡桃、墨绿丝绒、米色石材、黄铜 |

每套包含 8 张 1500 × 950 效果图：鸟瞰、客厅、电视墙、餐厅、厨房、主卧、北次卧、3D 俯视。

## 仓库内容

- `public/design.html` — 三套风格方案页
- `public/renders/<scheme>/` — 每套 8 张最终效果图
- `public/renders/plan.png` / `plan.svg` — 带尺寸的平面布置图
- `public/scenes/your-house-<scheme>.json` — 三套 3D 场景
- `public/items/<scheme>/` — 按风格生成的家具与柜体 GLB
- `src/` — Vite + React 3D 查看器
- `scripts/blender/render.py` — Blender 程序化场景与渲染
- `scripts/blender/make-style-assets.py` — 生成三套风格 GLB
- `scripts/make-style-scenes.mjs` — 生成三套 3D 场景 JSON

## 本地运行

```bash
npm ci
npm run dev
```

方案页：`http://localhost:5173/design.html`；3D：`http://localhost:5173/?scene=your-house-warm`。

生产构建：

```bash
npm run build
npm run preview
```

## GitHub Pages

站点由 GitHub Actions 从 `main` 自动部署，Vite base 为 `/last-house/`。推送到 `main` 或在 Actions 中手动运行 **Deploy GitHub Pages** 即可重新部署。

如果仓库名不同，把 workflow 构建步骤里的 `GITHUB_PAGES_BASE` 改成 `/<repo-name>/`。

## 说明

- 平面和尺寸为方案阶段成果，施工前需现场复尺。
- 3D 用于核对空间与家具关系；材质细节以效果图为准。
- 仓库中的 `LICENSE` 为 GNU Affero General Public License v3.0。
