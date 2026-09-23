# Hotspot Agent Jenkins 上线部署手册

本文档记录 Hotspot Agent Backend 当前使用的 Jenkins Freestyle 上线流程，适用于开发期和测试环境已经验证、需要部署到线上服务器的场景。

当前部署链路如下：

```text
开发者提交代码
  ↓
Jenkins 选择 Git 分支或 Tag
  ↓
Jenkins 拉取代码并执行构建脚本
  ↓
构建 hotspot-agent-backend Docker 镜像
  ↓
推送镜像到内网镜像仓库 10.168.0.2:5000
  ↓
Jenkins 通过 Ansible/SSH 通知线上服务器
  ↓
线上服务器执行 service.sh restart <IMAGE_TAG>
  ↓
拉取指定镜像
  ↓
启动 PostgreSQL 并等待就绪
  ↓
执行 Prisma 数据库迁移
  ↓
启动或更新 Backend 容器
  ↓
健康检查和上线验证
```

## 1. 部署范围

当前仓库中已经配置完整的 Jenkins 部署资产主要位于：

```text
hotspot-agent-backend/
├── Dockerfile
├── docker-compose.yml
├── docker_deploy.sh
├── service.sh
├── .env.production.example
└── JENKINS_FREESTYLE_DEPLOYMENT.md
```

这套流程直接部署的是后端服务：

```text
hotspot-agent-backend
```

后端容器内部监听 `3001`，线上 Docker Compose 默认将宿主机端口 `3002` 映射到容器端口 `3001`：

```text
宿主机 3002 → 容器 3001
```

前端 `hotspot-master` 当前仓库内没有独立的 Jenkinsfile、Dockerfile 或生产 Docker Compose 配置。前端生产部署需要由现有 Web 服务器、静态资源发布流程或另一个 Jenkins Job 负责。前端本地开发时，`/api` 会代理到 `http://localhost:3001`。

## 2. 前置条件

### 2.1 Jenkins 节点

Jenkins 执行节点需要安装并具备以下能力：

```text
git
docker
docker login / Docker Registry 访问权限
ansible
ssh
```

Jenkins 用户需要能够执行 Docker 命令，例如已加入 `docker` 用户组，或者由管理员配置了相应的 sudo 权限。

### 2.2 内网镜像仓库

当前默认镜像仓库为：

```text
10.168.0.2:5000
```

最终镜像名称为：

```text
10.168.0.2:5000/hotspot-agent-backend:<IMAGE_TAG>
10.168.0.2:5000/hotspot-agent-backend:latest
```

Jenkins 节点需要能够访问该仓库，线上服务器也需要能够拉取该仓库。

### 2.3 线上服务器

线上服务器需要准备：

```text
Docker
docker-compose
PostgreSQL 数据卷写入权限
到内网镜像仓库的网络访问
```

当前文档约定的线上部署目录为：

```text
/home/ops/jenkins_job/hotspot-agent-backend_prod_job
```

如果实际目录不同，需要同步修改 Jenkins Execute shell 中的 `service.sh` 路径。

## 3. Jenkins Job 配置

### 3.1 创建 Job

Jenkins 中选择：

```text
New Item
→ Freestyle project
```

推荐 Job 名称：

```text
hotspot-agent-backend_prod_job
```

### 3.2 General

建议填写 Job 描述：

```html
<h1>Hotspot Agent Backend Production Deployment</h1>
<p>热点监测、KOL 雷达、事件层、运营决策和 Agent API 后端服务</p>
```

建议勾选：

```text
This project is parameterized
```

添加 Git Parameter：

```text
Name: Revision
Parameter Type: Branch
Default Value: origin/main
```

如果只允许部署正式 Tag，可以改用 Tag 参数，或者在构建脚本中增加分支保护。

### 3.3 Source Code Management

选择：

```text
Git
```

仓库地址使用项目实际 Git 地址。历史配置示例：

```text
git@github.com:TelyAgent/hotspot-backend.git
```

Credentials 选择 Jenkins 中已配置的 Git SSH 凭据，例如：

```text
Sending.Me Jenkins Github Account on Ubuntu
```

Branches to build：

```text
$Revision
```

Jenkins 检出的目录根部应包含：

```text
Dockerfile
docker-compose.yml
docker_deploy.sh
package.json
prisma/
src/
```

### 3.4 Build Triggers

初期建议使用手动构建：

```text
不勾选任何自动触发项
```

确认流程稳定后，可以根据仓库权限和发布策略启用：

```text
GitHub hook trigger for GITScm polling
```

不建议直接对所有分支自动生产部署，至少应限制为 `main`、release 分支或正式 Tag。

### 3.5 Build Environment

默认可以不勾选额外选项。

如果 Jenkins 节点通过代理访问镜像仓库，在这里配置对应的环境变量或凭据注入。不要把镜像仓库密码、OpenAI Key、Twitter API Key 等敏感信息直接写进 Job shell。

## 4. Jenkins 构建脚本

在 Jenkins Job 的：

```text
Build Steps
→ Execute shell
```

填入：

```bash
#!/usr/bin/env bash
set -euo pipefail

IMAGE_TAG="$(git describe --tags --always)"
echo "Deploy revision: ${IMAGE_TAG}"

./docker_deploy.sh -r 10.168.0.2:5000 -t "${IMAGE_TAG}"

ansible sendingme -u ops -m shell -a \
  "/bin/bash /home/ops/jenkins_job/hotspot-agent-backend_prod_job/service.sh restart ${IMAGE_TAG}"
```

### 4.1 构建脚本的作用

`git describe --tags --always`：

- 优先使用当前提交可解析到的 Git Tag。
- 没有 Tag 时使用 Git commit 简写。
- 作为镜像版本号，便于线上定位代码版本。

`docker_deploy.sh`：

```text
构建本地镜像
→ 添加带版本号的远程镜像 Tag
→ 添加 latest Tag
→ 推送两个 Tag 到镜像仓库
```

脚本实际执行的核心命令等价于：

```bash
docker build -t hotspot-agent-backend:${IMAGE_TAG} -f Dockerfile .
docker tag hotspot-agent-backend:${IMAGE_TAG} 10.168.0.2:5000/hotspot-agent-backend:${IMAGE_TAG}
docker tag hotspot-agent-backend:${IMAGE_TAG} 10.168.0.2:5000/hotspot-agent-backend:latest
docker push 10.168.0.2:5000/hotspot-agent-backend:${IMAGE_TAG}
docker push 10.168.0.2:5000/hotspot-agent-backend:latest
```

Ansible 通知命令会让目标主机执行线上目录中的 `service.sh`，并传入本次构建对应的镜像 Tag。线上发布优先使用具体版本号，不依赖 `latest`。

## 5. Docker 镜像构建过程

后端 Dockerfile 使用多阶段构建：

```text
base
  ├── Node.js 22
  ├── OpenSSL
  ├── Python 3
  └── yt-dlp

build
  ├── npm ci
  ├── prisma generate
  ├── nest build
  └── npm prune --omit=dev

runner
  ├── 复制生产依赖
  ├── 复制 dist
  ├── 复制 prisma
  ├── 创建 logs/private 目录
  ├── 使用 node 用户运行
  └── 执行 node dist/main.js
```

本地建议先执行同等检查：

```bash
npm ci
npm run prisma:generate
npm run typecheck
npm run build
```

## 6. 线上目录和文件

首次部署前，在服务器准备：

```bash
mkdir -p /home/ops/jenkins_job/hotspot-agent-backend_prod_job/private
cd /home/ops/jenkins_job/hotspot-agent-backend_prod_job
```

目录至少需要包含：

```text
docker-compose.yml
service.sh
.env
private/
```

复制文件后授予脚本执行权限：

```bash
chmod +x service.sh
```

`docker-compose.yml` 和 `service.sh` 应与代码仓库中的版本保持一致。`.env` 不建议放入 Git，应该由运维在服务器上单独维护。

## 7. 线上环境变量

可以参考：

```text
.env.production.example
```

线上实际使用：

```text
.env
```

基础配置示例：

```dotenv
NODE_ENV=production
HOST=0.0.0.0
PORT=3001

POSTGRES_DB=hotspot_agent
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<生产数据库密码>
POSTGRES_HOST_PORT=5435
DATABASE_URL=postgresql://postgres:<密码>@postgres:5432/hotspot_agent?schema=public

OPENAI_API_KEY=<生产模型密钥>
OPENAI_MODEL=<模型名称>
OPENAI_BASE_URL=<可选，兼容网关地址>

TWITTERAPI_IO_KEY=<Twitter API 密钥>
TWITTERAPI_BASE_URL=https://api.twitterapi.io
YOUTUBE_API_KEY=<YouTube API 密钥>
HOTSPOT_MCP_API_KEY=<MCP 调用密钥>
```

采集和调度配置根据业务需要设置，例如：

```dotenv
DATA_SOURCE_SCHEDULER_ENABLED=true
X_TRENDS_REGIONS=global,United States,United Kingdom,Japan,Korea
X_TRENDS_LIMIT=30
X_TRENDS_COLLECTION_INTERVAL_MS=10800000

OPPORTUNITY_MINING_SCHEDULER_ENABLED=true
FUTURE_EVENT_SOURCE_SCHEDULER_ENABLED=true
FUTURE_EVENT_SOURCE_COLLECTION_INTERVAL_MS=86400000
FUTURE_EVENT_MONITORING_SCHEDULER_ENABLED=true
FUTURE_EVENT_MONITORING_INTERVAL_MS=3600000

YOUTUBE_COLLECTION_INTERVAL_MS=86400000
YOUTUBE_ANALYSIS_CONCURRENCY=1
```

### 7.1 安全要求

以下内容不能写入 Git、Jenkins shell、镜像层或公开文档：

```text
OPENAI_API_KEY
TWITTERAPI_IO_KEY
YOUTUBE_API_KEY
HOTSPOT_MCP_API_KEY
POSTGRES_PASSWORD
```

如果密钥曾经提交到仓库、日志或聊天记录，应立即在对应平台轮换，并更新线上 `.env`。

## 8. 线上服务启动逻辑

线上通过以下命令控制服务：

```bash
cd /home/ops/jenkins_job/hotspot-agent-backend_prod_job
bash service.sh <command> [IMAGE_TAG]
```

### 8.1 `start`

```bash
bash service.sh start <IMAGE_TAG>
```

执行顺序：

```text
1. 检查 docker-compose.yml 和 .env
2. 拉取指定 Backend 镜像
3. 启动 PostgreSQL
4. 最多等待 PostgreSQL 约 60 秒
5. 执行 prisma migrate deploy
6. 启动 PostgreSQL 和 Backend
7. 输出服务地址和镜像版本
```

### 8.2 `restart`

```bash
bash service.sh restart <IMAGE_TAG>
```

执行顺序：

```text
1. docker-compose down
2. 等待 2 秒
3. 执行 start <IMAGE_TAG>
```

Jenkins 默认调用该命令，因此每次线上发布会重新拉取镜像、执行迁移并启动服务。

### 8.3 常用运维命令

```bash
bash service.sh status
bash service.sh logs
bash service.sh pull <IMAGE_TAG>
bash service.sh migrate <IMAGE_TAG>
bash service.sh stop
```

## 9. 首次部署步骤

### 9.1 准备线上目录

```bash
mkdir -p /home/ops/jenkins_job/hotspot-agent-backend_prod_job/private
cd /home/ops/jenkins_job/hotspot-agent-backend_prod_job
```

复制并检查：

```text
docker-compose.yml
service.sh
.env
```

### 9.2 检查 Compose 配置

```bash
docker-compose config
```

如果这里报错，先处理 `.env` 缺失、变量没有替换、YAML 缩进错误或 Docker Compose 版本不兼容。

### 9.3 手动启动一次

```bash
bash service.sh start latest
bash service.sh status
curl -fsS http://127.0.0.1:3002/healthz
curl -fsS http://127.0.0.1:3002/health
```

## 10. 日常发布步骤

### 10.1 发布前

确认：

```text
1. 代码已合并到待发布分支
2. 后端本地构建通过
3. Prisma schema 与迁移文件已提交
4. 没有把 .env 或密钥提交到 Git
5. 涉及破坏性数据库变更时已有备份和回滚方案
```

### 10.2 Jenkins 构建

```text
1. 打开 hotspot-agent-backend_prod_job
2. 点击 Build with Parameters
3. 选择 Revision
4. 确认是正确的分支或 Tag
5. 点击 Build
```

Jenkins 成功日志应包含：

```text
Building hotspot-agent-backend:<IMAGE_TAG>
Push docker images done
service.sh restart <IMAGE_TAG>
```

### 10.3 线上验证

```bash
cd /home/ops/jenkins_job/hotspot-agent-backend_prod_job
bash service.sh status
curl -fsS http://127.0.0.1:3002/healthz
curl -fsS http://127.0.0.1:3002/health
docker-compose logs --tail=200 backend
```

重点确认：

```text
1. Backend 容器处于 Up 状态
2. PostgreSQL 处于 healthy 状态
3. healthz 返回 HTTP 200
4. 没有 Prisma migration error
5. 没有模型、Twitter 或 YouTube API 配置错误
6. 定时任务没有持续报错
7. 前端请求的 API 地址指向当前线上服务
```

## 11. 数据库迁移

生产启动时由以下命令执行迁移：

```bash
npm run prisma:migrate:deploy
```

线上脚本实际通过临时 Backend 容器执行：

```bash
docker-compose run --rm backend npm run prisma:migrate:deploy
```

迁移规则：

```text
1. 只使用 prisma migrate deploy，不要在线上执行 prisma migrate dev
2. 迁移文件必须和代码一起提交
3. 迁移前确认数据库备份策略
4. 删除表、改字段、改枚举等破坏性迁移必须单独评审
5. 迁移失败时不要继续启动新版本应用
```

检查迁移状态：

```bash
docker-compose run --rm backend npx prisma migrate status
```

## 12. 回滚流程

### 12.1 回滚应用版本

从 Jenkins 重新选择上一个可用的 Git Revision，重新构建并发布。

如果历史镜像仍然存在，也可以在服务器上直接指定历史 Tag：

```bash
cd /home/ops/jenkins_job/hotspot-agent-backend_prod_job
bash service.sh restart <上一版本 IMAGE_TAG>
```

### 12.2 数据库回滚

当前 `service.sh` 没有自动 down migration。涉及数据库结构的回滚必须先评估补偿迁移或数据库备份恢复，不要直接删除 Prisma migration 记录或手动修改生产数据库结构。

## 13. 常见问题排查

### 13.1 Jenkins 构建失败

本地复现：

```bash
npm ci
npm run prisma:generate
npm run typecheck
npm run build
```

常见原因：

```text
Prisma schema 已删除 Model，但代码仍在调用
package-lock.json 未同步
构建分支不是预期分支
Node.js 版本不一致
Jenkins 节点无法访问 npm registry
Docker 磁盘空间不足
```

### 13.2 镜像推送或拉取失败

Jenkins 节点检查：

```bash
curl http://10.168.0.2:5000/v2/
```

线上服务器检查：

```bash
docker pull 10.168.0.2:5000/hotspot-agent-backend:<IMAGE_TAG>
```

重点检查网络、镜像 Tag、仓库登录状态和 `DOCKER_REGISTRY` 配置。

### 13.3 PostgreSQL 未就绪

```bash
docker-compose ps
docker-compose logs postgres
docker-compose exec postgres pg_isready -U postgres -d hotspot_agent
```

常见原因：

```text
数据库卷损坏
端口冲突
POSTGRES_PASSWORD 配置变化但旧数据卷仍在使用
磁盘空间不足
```

### 13.4 Prisma 迁移失败

```bash
docker-compose run --rm backend npx prisma migrate status
docker-compose logs backend
```

如果是迁移文件缺失或迁移顺序不一致，不要直接跳过迁移。先确认数据库 `_prisma_migrations` 状态和目标代码版本。

### 13.5 健康检查失败

```bash
docker-compose ps
docker-compose logs --tail=200 backend
curl -v http://127.0.0.1:3002/healthz
```

确认：

```text
容器内 PORT 为 3001
宿主机 HOST_PORT 为 3002
DATABASE_URL 使用容器服务名 postgres
.env 被正确挂载
应用没有因为配置缺失退出
```

容器内数据库地址应使用：

```text
postgresql://postgres:<密码>@postgres:5432/hotspot_agent?schema=public
```

不要在 Backend 容器中把数据库主机写成 `localhost`。

### 13.6 Jenkins 成功但线上仍是旧版本

```bash
docker images | grep hotspot-agent-backend
docker-compose ps
docker-compose images
docker-compose logs --tail=100 backend
```

逐项核对：

```text
1. Jenkins 推送的 IMAGE_TAG
2. Ansible 传入的 IMAGE_TAG
3. service.sh 实际拉取的 IMAGE_TAG
4. docker-compose 实际使用的 IMAGE_TAG
5. 当前容器创建时间和镜像 ID
```

## 14. 发布记录模板

每次生产发布建议记录：

```text
发布时间：
发布人：
Jenkins Job：
Git Revision：
IMAGE_TAG：
数据库是否有迁移：
是否修改环境变量：
发布结果：
验证结果：
异常和回滚情况：
```

示例：

```text
发布时间：2026-09-18 15:30
发布人：xxx
Jenkins Job：hotspot-agent-backend_prod_job
Git Revision：abc1234
IMAGE_TAG：abc1234
数据库是否有迁移：是/否
是否修改环境变量：是/否
发布结果：成功
验证结果：/healthz 200，前端页面正常
异常和回滚情况：无
```

## 15. 当前流程的关键约束

```text
1. Jenkins 负责构建和推送镜像，不直接在生产机编译代码
2. 线上服务器只拉取镜像并执行服务编排
3. 生产启动前自动执行 Prisma migrate deploy
4. 版本号使用 Git Tag 或 commit 标识，不只依赖 latest
5. latest 只作为镜像仓库的辅助 Tag，发布验证应关注具体 IMAGE_TAG
6. .env 只保存在服务器，不进入 Git
7. 线上 Backend 容器端口为 3001，宿主机默认暴露 3002
8. 前端生产部署不属于当前这份后端 Jenkins Job，需要单独配置静态资源发布流程
```
