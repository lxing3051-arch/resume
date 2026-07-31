# 秋招助手

零成本的 Boss 直聘秋招/春招投递管理工具。

## 特点

- 投递看板、进度跟踪、面经笔记、日历、数据统计
- Boss 直聘 **浏览器插件** 一键抓取 JD
- **Gemini / Ollama** AI 解析（可选）
- 截图 OCR、简历 PDF 本地存储、深色模式、PWA
- CSV / JSON 导出

## 本地运行

```bash
npm install
npm run dev
```

浏览器打开 `http://localhost:5173`

## 发布到公网（别人也能打开）

**GitHub Pages 详细步骤 → [GITHUB_PAGES.md](./GITHUB_PAGES.md)**

简要流程：

1. 用 **GitHub Desktop** 把本项目 Publish 到 GitHub（仓库名如 `resume`）
2. 仓库 **Settings → Pages → Source** 选 **GitHub Actions**
3. 等 Actions 跑完，访问 `https://<用户名>.github.io/<仓库名>/`
4. 插件设置里把地址改成上述链接

每人数据仍在各自浏览器；详见部署文档。

## 浏览器插件

```text
chrome://extensions → 开发者模式 → 加载 extension 文件夹
```

部署到公网后，在插件 **设置** 里把「秋招助手地址」改成你的线上地址（不要用 localhost）。

详见 [extension/README.md](extension/README.md)

## 成本

**0 元** — 无服务器、无付费 API（Gemini 免费额度另计）。
