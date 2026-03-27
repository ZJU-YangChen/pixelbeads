# PixelBeads — 拼豆图纸制作小助手 (Node.js + MySQL 版)

版本备注
v9是仅前端的最近版本
从v10开始就是加入了后端和数据库了
v17还有选色，重复校验，删除等问题没有解决（已在v22修复）
v22是加入AI之前的最新版本
从v23开始加入了AI


这是一个基于 [Pixel It](https://github.com/giventofly/pixelit) 改造的拼豆图纸制作工具。
**V10 版本更新：** 已从纯静态网页升级为 Node.js 全栈应用，支持用户注册、登录，并将库存和历史记录保存到 MySQL 数据库。

## 功能特性

- **云端存储**：用户注册登录后，数据（库存、历史记录）永久保存到数据库。
- **图片上传与像素化**：支持拖拽上传，自定义像素块大小。
- **色板管理**：内置色板，支持自定义“我的豆子仓库”并保存。
- **图纸导出**：支持 PNG 图纸、CSV 网格数据导出。
- **用量统计**：自动统计每种颜色的珠子数量。

## 如何使用 (本地开发)

1. **环境准备**:
   - 安装 Node.js (v18+)
   - 安装 MySQL 数据库

2. **配置数据库**:
   - 创建一个名为 `pixelbeads` 的数据库。
   - 修改 `db.js` 或设置环境变量配置数据库连接。

3. **运行**:
   ```bash
   npm install
   # 设置环境变量 (示例)
   # set DB_HOST=localhost
   # set DB_USER=root
   # set DB_PASSWORD=your_password
   # set DB_NAME=pixelbeads
   npm start
   ```
4. 访问 `http://localhost:3000`

## Sealos / Docker 部署指南 (2026 更新)

本项目已针对 Sealos 容器云平台进行适配。以下是一步一步的部署流程：

### 1. 准备工作
- 确保拥有 [Docker Hub](https://hub.docker.com/) 账号（本指南使用用户名：`lajones`）。
- 确保已注册并登录 [Sealos Cloud](https://cloud.sealos.io/)。

### 2. 构建与发布镜像 (在本地终端执行)
如果代码有更新，请执行以下命令重新打包镜像并推送到仓库：

```bash
# 1. 登录 Docker Hub (如果未登录)
docker login

# 2. 构建镜像 (注意最后的点 ".")
# 将 lajones 替换为你的 Docker Hub 用户名
docker build -t lajones/pixelbeads:latest .

# 3. 推送到仓库
docker push lajones/pixelbeads:latest
```

### 3. 在 Sealos 上部署应用

1.  **创建数据库**：
    *   在 Sealos 桌面打开 **"数据库 (Database)"** 应用。
    *   新建 MySQL 数据库，记录下连接信息（Host, Username, Password）。Host 通常是内网地址，如 `mysql-xxx.ns-xxx.svc`。

2.  **创建应用**：
    *   在 Sealos 桌面打开 **"应用管理 (App Launch)"**。
    *   新建应用，关键配置如下：
        *   **镜像名 (Image Name)**: `lajones/pixelbeads:latest` (必填！不能用 nginx 默认镜像)
        *   **容器端口 (Container Port)**: `3000`
        *   **CPU/内存**: 推荐 0.5 Core / 512 MB 起步。

3.  **配置环境变量 (Environment Variables)**：
    点击主要配置下的“环境变量”或高级设置，添加以下键值对（使用第1步中的数据库信息）：

    | 变量名 | 值 (示例) | 说明 |
    |--------|-----------|------|
    | `DB_HOST` | `mysql-pixel.ns-xxx.svc` | 必须使用数据库应用的**内网地址**，不能填 localhost |
    | `DB_PORT` | `3306` | 数据库端口 |
    | `DB_USER` | `root` | 数据库用户名 |
    | `DB_PASSWORD` | `your_password` | 数据库密码 |
    | `DB_NAME` | `pixelbeads` | 数据库名称 |

4.  **开启外网访问**，点击部署。

### 4. 常见问题排查 checklist

*   **Q: 打开网页显示 "Welcome to nginx!"**
    *   **原因**：镜像名填错了，或者没填，Sealos 默认使用了 nginx 镜像。
    *   **解决**：编辑应用，将镜像改为 `lajones/pixelbeads:latest`，端口改为 `3000`。

*   **Q: 登录时提示 `Unexpected token 'u', "upstream c"...`**
    *   **原因**：后端服务崩溃或未启动，通常是连不上数据库。
    *   **解决**：
        1.  查看应用日志 (`Logs`)。
        2.  如果报错 `connect ECONNREFUSED` 或 `Unknown database`，检查 **环境变量** 是否填错。
        3.  确认 `DB_HOST` 是 Sealos 内部的长域名，而不是 IP 或 localhost。

*   **Q: 数据库连接失败**
    *   **解决**：确保数据库应用状态为 "Running"。 

## 文件结构

- `server.js`: Node.js 后端入口，提供 API 和静态文件服务
- `db.js`: MySQL 数据库连接池配置
- `schema.sql`: 数据库初始化脚本
- `docs/`: 前端静态资源 (HTML, JS, CSS)
  - `js/storage.js`: **[更新]** 与后端 API 通信的数据服务
- `Dockerfile`: **[更新]** Node.js 运行环境配置
