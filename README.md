# PixelBeads — 拼豆图纸制作小助手 (Node.js + MySQL 版)

版本备注
v9是仅前端的最近版本
从v10开始就是加入了后端和数据库了
v17还有选色，重复校验，删除等问题没有解决
v是加入AI之前的最新版本
从v开始加入了AI


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

## Sealos / Docker 部署

本项目现在需要作为 Node.js 服务运行，并连接 MySQL 数据库。

### 1. 构建镜像
```bash
docker build -t pixelbeads:v10 .
```

### 2. 部署配置 (Sealos)

在 Sealos 上部署应用时，必须添加以下 **环境变量 (Environment Variables)**，否则服务无法连接数据库：

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `DB_HOST` | 数据库地址 (Host) | `mysql-service.namespace.svc` |
| `DB_PORT` | 端口 | `3306` |
| `DB_USER` | 用户名 | `root` |
| `DB_PASSWORD` | 密码 | `你的数据库密码` |
| `DB_NAME` | 数据库名 | `pixelbeads` |

*注意：请确保先在 Sealos 的数据库应用中创建好 MySQL 实例。*

## 文件结构

- `server.js`: Node.js 后端入口，提供 API 和静态文件服务
- `db.js`: MySQL 数据库连接池配置
- `schema.sql`: 数据库初始化脚本
- `docs/`: 前端静态资源 (HTML, JS, CSS)
  - `js/storage.js`: **[更新]** 与后端 API 通信的数据服务
- `Dockerfile`: **[更新]** Node.js 运行环境配置
