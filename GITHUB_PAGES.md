# GitHub Pages 部署指南（秋招助手）

部署完成后，网站地址为：

```text
https://<你的GitHub用户名>.github.io/<仓库名>/
```

例如用户名为 `zhangsan`、仓库名为 `resume`：

```text
https://zhangsan.github.io/resume/
```

---

## 第一步：把代码上传到 GitHub

你的电脑当前**未检测到 Git 命令行**，推荐用 **GitHub Desktop**（图形界面，最简单）。

### 1. 安装 GitHub Desktop

下载：https://desktop.github.com/

安装后用 GitHub 账号登录。

### 2. 发布本项目

1. 打开 GitHub Desktop  
2. **File → Add local repository**  
3. 选择文件夹：`D:\visualStudio_project\resume`  
4. 若提示「不是 Git 仓库」，点 **create a repository**，仓库名建议：`resume`  
5. 左下角 Summary 填：`秋招助手初始版本` → 点 **Commit to main**  
6. 点 **Publish repository**  
   - 可勾选 **Keep this code private**（私有仓库也能用 Pages，需在 Settings 里单独开启）  
   - 或取消勾选，公开仓库  

记住你填的**仓库名**，后面网址要用。

---

## 第二步：开启 GitHub Pages

1. 浏览器打开刚发布的仓库（GitHub Desktop 里 **View on GitHub**）  
2. 进入 **Settings** → 左侧 **Pages**  
3. **Build and deployment** → **Source** 选择 **GitHub Actions**（不要选 Deploy from a branch）  
4. 保存即可  

---

## 第三步：触发自动部署

项目已包含自动部署文件：`.github/workflows/deploy.yml`

### 若刚才 Publish 时已包含该文件

1. 打开仓库的 **Actions** 标签  
2. 应看到 **Deploy to GitHub Pages** 正在运行或已完成  
3. 绿色 ✓ 表示成功  

### 若 Actions 没自动跑

1. **Actions** → 左侧 **Deploy to GitHub Pages**  
2. 点 **Run workflow** → **Run workflow**  

或在本机改任意文件后，用 GitHub Desktop 再 **Commit** + **Push** 一次。

---

## 第四步：打开你的网站

1. 仓库 **Settings → Pages**  
2. 顶部会显示：**Your site is live at …**  
3. 点开链接，应能看到「秋招助手」看板  

首次部署约 **1～3 分钟**。

---

## 第五步：改 Boss 插件地址

1. 浏览器打开 `chrome://extensions`  
2. 找到「秋招助手」插件 → **刷新**  
3. 插件 **选项/设置** → **秋招助手地址** 改为（不要末尾 `/`）：

```text
https://你的用户名.github.io/仓库名
```

4. 保存  

---

## 以后更新网站

1. 在本机改代码  
2. GitHub Desktop：**Commit** → **Push origin**  
3. Actions 会自动重新部署，等 1～2 分钟刷新网页即可  

---

## 常见问题

| 问题 | 处理 |
|------|------|
| 打开是空白页 | 确认 Settings → Pages 选的是 **GitHub Actions**；Actions 是否成功 |
| 404 / 刷新子页面失败 | 重新 Push，确保 `.github/workflows/deploy.yml` 在仓库里 |
| Actions 失败 `npm ci` | 确保 `package-lock.json` 已提交到仓库 |
| 插件连不上网站 | 地址不要带末尾 `/`；插件和 manifest 需刷新 |
| Gemini 线上不可用 | 正常，GitHub Pages 无后端代理；本地 `npm run dev` 或用 Ollama |
| 别人看不到我的投递数据 | 正常，数据在各自浏览器本地，不会上云 |

---

## 数据说明

- **网站**：公网任何人可访问  
- **投递记录**：存在访问者自己浏览器的 IndexedDB  
- **备份**：设置页 → 导出 JSON  

---

## 可选：用命令行（已安装 Git 后）

```bash
cd D:\visualStudio_project\resume
git init
git add .
git commit -m "deploy to GitHub Pages"
git branch -M main
git remote add origin https://github.com/你的用户名/resume.git
git push -u origin main
```

然后在 GitHub 网页完成 **Settings → Pages → GitHub Actions** 即可。
