# 把秋招助手发布到公网（别人也能打开）

本网站是**纯前端**，部署后任何人用浏览器打开链接就能用，**仍然 0 元**。

> **重要**：数据存在**每个人自己的浏览器**里（IndexedDB），不是云端数据库。  
> 你电脑上的投递记录**不会**自动出现在别人那里；每人各自录入，或用「设置 → 导出 JSON」备份/迁移。

---

## 方式一：Vercel（推荐，最简单）

适合：想快速得到一个 `https://xxx.vercel.app` 链接发给朋友。

### A. 网页部署（不用装 Git）

1. 在本机项目目录执行：
   ```bash
   npm install
   npm run build
   ```
2. 打开 [https://vercel.com](https://vercel.com) 注册/登录（可用 GitHub 账号）
3. 点击 **Add New → Project**
4. 若已关联 GitHub 仓库：选仓库 → Deploy（会自动读 `vercel.json`）
5. **若没有 Git 仓库**：安装 Vercel CLI 后部署：
   ```bash
   npx vercel --prod
   ```
   按提示登录，选当前项目目录，完成后会给公网地址。

### B. 连接 GitHub 自动部署

1. 把代码推到 GitHub（见文末「首次上传 GitHub」）
2. Vercel → Import 该仓库 → Deploy  
3. 以后每次 `git push`，网站自动更新

**插件地址**：在插件设置里填 `https://你的项目.vercel.app`（不要末尾 `/`）

---

## 方式二：GitHub Pages（免费，地址带仓库名）

适合：代码已在 GitHub，想要 `https://用户名.github.io/仓库名`

### 1. 上传代码到 GitHub

```bash
git init
git add .
git commit -m "deploy"
git branch -M main
git remote add origin https://github.com/你的用户名/resume.git
git push -u origin main
```

### 2. 开启 Pages

1. 打开 GitHub 仓库 → **Settings** → **Pages**
2. **Build and deployment** → Source 选 **GitHub Actions**
3. 推送 `main` 分支后，Actions 会自动构建（见 `.github/workflows/deploy.yml`）
4. 几分钟后 Pages 显示绿色地址，例如：  
   `https://你的用户名.github.io/resume/`

### 3. 插件地址

插件设置填：`https://你的用户名.github.io/resume`（不要末尾 `/`）

---

## 方式三：Netlify

1. [https://app.netlify.com](https://app.netlify.com) 注册
2. **Add new site → Import from Git** 或拖拽 `dist` 文件夹（需先 `npm run build`）
3. 已包含 `netlify.toml`，构建命令会自动带上 `VITE_BASE_PATH=/`

---

## 部署后注意

| 功能 | 本地 `npm run dev` | 公网部署 |
|------|-------------------|----------|
| 看板、录入、进度、面经 | ✅ | ✅ |
| Boss 插件导入 | ✅ | ✅（需改插件里的网站地址） |
| 截图 OCR | ✅ | ✅ |
| Gemini AI | ✅（有代理） | ⚠️ 可能受 CORS 限制，建议本地或用 Ollama |
| 数据 | 仅本浏览器 | 仅访问者自己的浏览器 |

### 分享给朋友

直接把公网链接发出去即可，例如：

- `https://job-tracker.vercel.app`
- `https://zhangsan.github.io/resume/`

每人打开后自行注册/使用 Boss 插件，数据互不干扰。

---

## 首次上传 GitHub（Windows 没装 Git 时）

1. 安装 [Git for Windows](https://git-scm.com/download/win)
2. 安装 [GitHub Desktop](https://desktop.github.com/)（可选，更直观）
3. 用 GitHub Desktop：**File → Add local repository** → 选本项目 → **Publish repository**

---

## 本地预览「上线版」

```bash
npm run build
npm run preview
```

浏览器打开终端里显示的地址，确认页面正常后再部署。
