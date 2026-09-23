# HireOS 本地开发端口分配表

本文档是各子系统前后端端口的唯一权威来源。新增子系统或新增服务前，先在这里登记端口，再写代码，避免冲突和临时占用。

所有前端 Vite 项目的 `server.port` 都已设置 `strictPort: true`：如果端口被占用，Vite 会直接报错退出，**不会**自动切换到下一个空闲端口。因此如果启动失败提示端口被占用，说明有旧进程没关掉，去杀掉旧进程，而不是任由它跳到别的端口——那正是之前端口漂移、代理配置对不上的根源。

后端（NestJS `app.listen`）本身遇到端口占用会直接抛错退出，不会漂移，无需额外配置。

## 端口分配

| 子系统 | 后端端口 | 后端 API 前缀 | 前端端口 | 状态 |
| --- | --- | --- | --- | --- |
| hireos-interview（面试） | 3001 | `/api` | 5173 | 使用中 |
| hireos-screening（简历筛选） | 3002 | `/api` | 5174 | 使用中 |
| （预留，未分配） | 3003 | — | — | 空闲 |
| hireos-core-record（核心档案，无独立前端） | 3004 | `/api/v1` | — | 使用中 |
| hireos-jd（职位描述） | 3005 | `/api` | 5175 | 使用中 |
| hireos-assessment（测评，代码未创建） | 3006 | `/api` | 5176 | 预留 |
| hireos-offer（Offer，代码未创建） | 3007 | `/api` | 5177 | 预留 |
| hireos-written（笔试） | 3008 | `/api` | 5178 | 使用中（后端仅骨架，未接数据库） |

约定：后端从 `3001` 起顺序分配，前端从 `5173` 起顺序分配，一一对应、留有空位方便插入。所有服务默认监听 `127.0.0.1`（仅本机可访问）。

## 各子系统配置文件位置

| 子系统 | 后端端口配置 | 前端端口配置 |
| --- | --- | --- |
| hireos-interview | `hireos-interview/job-Interview-backend/.env` → `PORT` | `hireos-interview/job-Interview-front/vite.config.ts` → `server.port` |
| hireos-screening | `hireos-screening/hireos-screening-backend/.env` → `PORT` | `hireos-screening/hireos-screening-front/vite.config.ts` → `server.port` |
| hireos-core-record | `hireos-core-record/.env` → `PORT` | — |
| hireos-jd | `hireos-jd/hireos-jd-backend/.env` → `PORT` | `hireos-jd/hireos-jd-front/vite.config.ts` → `server.port` |
| hireos-written | `hireos-written/hireos-written-backend/.env` → `PORT` | `hireos-written/hireos-written-front/vite.config.ts` → `server.port` |

## 前端 → 后端代理关系

每个前端的 Vite dev server 把 `/<子系统>/api` 请求代理到对应后端，并在转发前去掉 `/<子系统>` 前缀（`rewrite`），代理目标写在各自 `vite.config.ts` 的 `server.proxy`（可用环境变量 `VITE_API_PROXY_TARGET` 覆盖，`job-Interview-front` 用的是 `API_PROXY_TARGET`）：

- hireos-interview-front：`/interview/api` → `http://127.0.0.1:3001/api`
- hireos-screening-front：`/screening/api` → `http://127.0.0.1:3002/api`
- hireos-jd-front：`/jd/api` → `http://127.0.0.1:3005/api`，另有 `/jd/ws/voice-stream` → `http://127.0.0.1:3005/ws/voice-stream`（语音流 WebSocket）
- hireos-written-front：`/written/api` → `http://127.0.0.1:3008/api`（后端目前只有空骨架 + `/api/health`，还没有业务接口）

前端代码里发请求一律用 `` `${import.meta.env.BASE_URL}api/...` ``（每个前端的 `src/utils/apiBase.ts` 或 `src/lib/apiBase.ts` 导出的 `API_BASE_URL`），不要写死 `/api/...`——`BASE_URL` 由下面的 `base` 配置决定，两者必须对应。

## 跨系统服务地址引用

以下 `.env` 中的跨系统地址要和上表保持一致，改端口时记得同步改这些：

- `hireos-screening-backend/.env`
  - `CORE_RECORD_BASE_URL=http://127.0.0.1:3004/api/v1`
  - `JD_BASE_URL=http://127.0.0.1:3005/api`

## 新增子系统时怎么做

1. 先在上面的表里登记一个未被占用的端口（后端 3xxx / 前端 51xx），改这份文档。
2. 后端 `.env` 写 `PORT=<登记的端口>`。
3. 前端 `vite.config.ts` 的 `server.port` 填对应端口，并确保带上 `strictPort: true`。
4. 如果有其他子系统需要调用它，在调用方的 `.env` 里加对应的 `xxx_BASE_URL`，同时更新本文档"跨系统服务地址引用"一节。
5. 按下面"本地统一网关"一节的模式，给前端加 `base`/`basename`/`API_BASE_URL`，并在 `gateway/frontend-gateway.mjs`、`gateway/backend-gateway.mjs`、`scripts/dev.sh` 的服务表里各加一行。

## 本地统一网关

所有前端合并到一个端口、所有后端合并到另一个端口，按子系统路径前缀分流——纯反向代理，各子系统进程本身完全不变，仍然各自独立跑在上面表格的端口上。

| 子系统 | 前端网关（`:8080`） | 后端网关（`:8090`） |
| --- | --- | --- |
| Interview | `/interview/*` → `127.0.0.1:5173/interview/*` | `/interview/*` → `127.0.0.1:3001/api/*` |
| Screening | `/screening/*` → `127.0.0.1:5174/screening/*` | `/screening/*` → `127.0.0.1:3002/api/*` |
| JD | `/jd/*` → `127.0.0.1:5175/jd/*` | `/jd/*` → `127.0.0.1:3005/api/*` |
| Written | `/written/*` → `127.0.0.1:5178/written/*` | `/written/*` → `127.0.0.1:3008/api/*` |
| Core Record | — （无独立前端） | `/core-record/*` → `127.0.0.1:3004/api/v1/*` |

实现在 `/Users/qmk/work/HireOS/gateway/`（`frontend-gateway.mjs` / `backend-gateway.mjs`，纯 `http-proxy` 转发，不做鉴权）。

**关键约定**：每个前端自己的 Vite `base` 也设成了对应前缀（如 `/screening/`），前端网关因此是纯直通转发，不做路径改写。**副作用**：单独访问某个前端也必须带上前缀，例如 `http://localhost:5174/screening/`，裸的 `http://localhost:5174/` 不再能用。浏览器端请求 API 走的是"同源相对路径 → 自己 dev server 的 `/<前缀>/api` 代理 → 真正的后端"这条链路，从不直接跨源打后端网关；后端网关（`:8090`）是给 curl/Postman/外部调用方用的独立入口，浏览器 JS 不会用到它，所以**后端本身、CORS 配置一律不用改**。

**启动脚本**：`scripts/dev.sh`，覆盖所有子系统 + 两个网关。

```
scripts/dev.sh start all              # 全部起来（5 个后端 + 4 个前端 + 2 个网关）
scripts/dev.sh start backends         # 只起后端
scripts/dev.sh start screening-backend  # 只起某一个
scripts/dev.sh start gateway          # 只起两个网关（假设各子系统已在跑）
scripts/dev.sh stop all
scripts/dev.sh status
```

日志在 `.local/logs/<name>.log`，pid（进程组）记录在 `.local/pids/<name>.pid`；`stop` 会把整个进程组一起杀掉（用的是 bash 的 `set -m` job-control 分组，不是 `setsid`），不会再出现"杀了父进程、`nest --watch` 的 `dist/main` 子进程还活着"这种残留。

## Docker 部署

根目录 `docker-compose.yml` 把整套系统打包成容器，路径分流方案跟本地网关完全一致，只是把"前端网关 + 后端网关两个端口"合并成了一个：生产环境前端是编译后的静态文件（每个前端自己一个 `nginx:alpine` 容器，内部按 `base` 前缀，比如 `/screening/`，服务静态文件），不再需要 Vite dev server，所以没必要维持两个端口分开处理 HMR/proxy 那套局面。

- `gateway`（`gateway/Dockerfile` + `gateway/nginx.conf`）：唯一对外暴露端口的容器，监听 `:80`，按子系统前缀反代到各前端/后端容器，路由表跟 `本地统一网关` 一节的表格一一对应。约定不变：只剥掉子系统前缀转发，调用方仍要自己带上后端的 `/api`（或 Core Record 的 `/api/v1`）。落地页 `/` 的 `root`/`index` 指令要写在 `server` 块顶层，不能只塞进 `location = /` 块里单独设——实测过后者会莫名其妙退回到 nginx 编译期默认的 `/etc/nginx/html`，原因没深究，照 `server` 顶层这个标准写法走就没问题。
- 5 个后端、4 个前端各自一份 `Dockerfile`（多阶段构建）+ `.dockerignore`（避免把本地 `.env`/`node_modules` 烤进镜像）；4 个 Prisma 后端另有 `docker-entrypoint.sh`（启动前跑 `prisma migrate deploy`）。
- **所有服务都钉死在 `platform: linux/amd64`**：`job-Interview-backend` 依赖的 `@zoom/rtms`（Zoom RTMS 原生模块）完全没有 `linux/arm64` 的预编译包（只有 `linux-x64` 和 `darwin-arm64`），本地在 Apple Silicon 上不显式指定平台会构建出 arm64 镜像，容器一起来就 `MODULE_NOT_FOUND` 疯狂重启。而真实部署目标是 x86_64 服务器，所以直接把整个 compose 栈钉在 `linux/amd64` 上——本地在 Apple Silicon 上构建会走 Rosetta 模拟、明显更慢，但这样本地验证的架构跟真实部署一致，不用等到远程部署时才踩这个坑。
- `job-Interview-backend/Dockerfile` 因为这个原生模块，除了平台还需要两处特殊处理：① 基础镜像不能用 `node:24-alpine`（没有对应的 musl 预编译），也不能用 `node:24-slim`（Debian 12 "bookworm"，包括 `bookworm-backports`，都还停留在 `libstdc++6 12.2.0`，缺 `.node` 二进制要求的 `GLIBCXX_3.4.31`——这是 GCC 13 才引入的符号版本），改用了 `node:24-trixie-slim`（Debian 13，自带 GCC 14）才解决；② runtime 阶段额外装了 `openssl`（Prisma 在没有它的 Debian 镜像上会跑不起来查询引擎）。其余 4 个后端都是普通 `node:24-alpine`，没有这些问题。
- `postgres`：单个 `postgres:17-alpine` 容器，`scripts/docker/postgres-init.sh` 在容器首次启动时建好 4 个库（`hireos_interview`/`hireos_screening`/`hireos_core_record`/`hireos_jd`；`hireos-written` 还没接数据库）。不对外映射端口，只在容器网络内可达。
- 每个后端的生产环境变量来自 `<dir>/.env.production`（不进 git，`.env.production.example` 是进 git 的脱敏模板）。跟本地开发 `.env` 的关键差异：`HOST=0.0.0.0`（容器内必须监听所有接口）、跨系统地址改成 Compose 服务名（如 `http://core-record:3004/api/v1`）、`DATABASE_URL` 指向 `postgres` 服务。真实密钥（AI/Zoom/Doubao）原样保留，只在运行时通过 `env_file` 注入，不进镜像层、不进 git。
- 这一轮保留了 `DEV_AUTH_ENABLED=true`（还没有真实鉴权系统）——如果这台服务器会对外网开放或有你之外的人访问，这个假设需要重新评估。
- `hireos-jd-backend` 目前没有 `/api/health` 路由（`app.module.ts` 里没接 health 模块），不是 bug，只是这个子系统还没补——验证连通性用 `/jd/api/jobs` 之类真实存在的路由。

**已知遗留问题（Docker 化过程中发现，跟容器化本身无关）**：`job-Interview-front` 的 `npm run build`（`tsc -b && vite build`）目前跑不过——`vite.config.ts` 缺 `@types/node`、`StoreContext.tsx` 里中英文 i18n 字典的字面量类型对不上、`Files.tsx` 几处数组类型不匹配、`status.tsx`/`roles.ts` 的类型导入不对齐，这些都是本次会话之前就存在的类型错误，本地开发一直用 `vite` 起 dev server（不走 `tsc`），从没被真正挡住过。这些错误确认都只是类型层面的（`import type`，erased at build time），不影响运行时，所以它的 `Dockerfile` 暂时改成了直接 `npx vite build`（跳过 `tsc -b` 这道门），保证镜像能出，但这不是修复——类型错误还在源码里，应该单独安排时间修。`hireos-screening-front` 也有类似问题（3 处 `message.info` 类型字面量比 `ToastItem.type` 定义窄），这个顺手真修了（加宽了 `ToastItem.type`，补了 `.toast.info` 的样式）。

**本地已验证通过**（`docker compose build && up -d`，全部 11 个容器稳定运行，无重启循环）：落地页 `/` 200；4 个前端 `/interview/`、`/screening/`、`/jd/`、`/written/` 均 200 text/html；`interview-backend`/`screening-backend`/`written-backend`/`core-record` 的 `/api/health`（Core Record 是 `/api/v1/health`）均 200；`jd-backend` 用 `/jd/api/jobs` 验证 200；`interview-backend`/`screening-backend`/`core-record`/`jd-backend` 的 `prisma migrate deploy` 日志确认全部迁移干净跑完，无报错。验证完 `docker compose down -v` 清理干净。

本地验证步骤：

```
cp scripts/docker/postgres.env.production.example scripts/docker/postgres.env.production   # 填 POSTGRES_PASSWORD
# 每个后端目录下：cp .env.production.example .env.production，填真实密钥
docker compose build
docker compose up -d
curl http://localhost/interview/api/health   # 其余子系统同理
docker compose logs -f <service>
docker compose down -v   # 清理，连数据卷一起删
```

### 远程部署（经跳板机）—— 已实际部署成功

`scripts/deploy/deploy.sh`，跳板机连接格式经实测确认（见 `JumpServer生产服务器连接说明.md`）：**SSH 的 host 参数是跳板机自己的 IP，登录名是 `-l '跳板机用户@资产SSH用户@资产IP'` 这个复合字符串**——早期草稿把这个搞反过（把四段拼成一个位置参数丢给 ssh，会被当成"直连资产 IP"，不经过跳板机），已改正，不要再退回那种写法。

当前实际部署到的服务器：
- 跳板机 `34.92.110.140:2222`，资产 `34.94.189.76`（hostname `sdm-front`），资产账号 `ubuntu`（本身有完整 sudo，不需要单独登 `ops`）。
- 部署目录 `/opt/hireos`（不是最初设想的 `/home/ops/jenkins_job/...`——那个目录的属主 `ops` 权限是 `750`，`ubuntu` 根本穿不进去；`/opt` 是 `755` 全局可穿透，照着已有的 `/opt/telyclaw-backend` 先例走）。
- 这台机器 80/443 已经被自己的 nginx 占用（服务着 25+ 个其他域名的项目），`8830` 是确认空闲后分配给 HireOS 网关容器的内部端口，但 GCP 防火墙没放行这个端口，外部连不上（容器本身完全正常，`curl localhost:8830` 在机器上是 200）。最终方案是复用现有 nginx 的 `default`（`server_name _`，兜底 server block）加一个 `location /hireos/` 转发到 `127.0.0.1:8830`，不改防火墙、不碰其他站点配置。**对外访问入口是 `http://34.94.189.76/hireos/`**（`/interview/`、`/screening/`、`/jd/`、`/written/`、`/core-record/api/v1/...` 都在这个前缀下面）。

`deploy.sh` 命令：`check`（只读诊断）、`bootstrap`（一次性：装 `docker-compose-plugin`、建目录）、`push-env`（上传 `.env.production` 系列密钥到 `shared/env/`，不走 git/tar）、`deploy`（上传源码 + 远程 build + up -d）、`status`、`logs <service>`。必需的环境变量：`REMOTE_JUMP_USER`/`REMOTE_ASSET_USER`/`REMOTE_ASSET_HOST`/`REMOTE_JUMP_HOST`/`REMOTE_APP_DIR`，没有默认值，必须显式指定。

部署过程中排掉的几个坑（都已经在 `deploy.sh`/compose 文件里修好，不会再犯）：
1. **内嵌 git 仓库导致打包爆炸到 2.86GB**：`hireos-interview`/`hireos-screening`/`hireos-jd`/`hireos-core-record` 下面的子目录各自带着独立的 `.git`（非正式 submodule），根仓库 `git ls-files` 碰到这种目录只会吐出目录本身一行，`tar` 拿到这一行会不管三七二十一把整个目录（含 `node_modules`）打包进去。`scripts/deploy/deploy.sh` 的 `collect_upload_list()` 现在会动态找出这些内嵌仓库，各自单独跑 `git ls-files`，结果合并。
2. **`git ls-files` 输出的中文文件名默认转义**：`git ls-files -zco` + `tar --null` 才是安全组合；BSD sed 没有 `-z`，需要 NUL 安全拼接前缀时用 `perl -0`。
3. **`docker compose` v2 插件"装了没装上"**：老版本 `deploy.sh bootstrap` 的判断逻辑是"`docker-compose`（v1 独立二进制）存在就跳过"，但这台机器只有 v1、没有 v2 插件，导致 `docker compose ...`（v2 语法）全线报错 `unknown shorthand flag: 'f'`。改成只认 v2（`sudo docker compose version`），不认 v1 存在就短路跳过。
4. **`docker-compose.prod.yml` 覆盖端口没生效**：Compose 对 `ports:` 这类列表字段是**多文件拼接**，不是替换——base 文件写 `80:80`、override 写 `8830:80`，两条会同时生效，`80` 那条因为宿主机已被占用直接把 `up` 拖挂了。改成 base 文件完全不写 `gateway.ports`，本地开发用新增的 `docker-compose.override.yml`（`docker compose` 不带 `-f` 时会自动加载）配 `80:80`，远程用 `docker-compose.prod.yml`（显式 `-f`，不会跟 override.yml 混在一起）配 `8830:80`。
5. **GCP 防火墙没放行新端口 + 外层 nginx 转发方案引出的一串连环坑**：`8830` 在服务器内部完全正常，但外部连不上（GCP VPC 防火墙没开这个端口），改成复用这台机器已有的 nginx（`/etc/nginx/sites-available/default` 的 `server_name _` 兜底 server block）加一个 `location /hireos/` 转发到内部网关。这一改动牵出三个真问题：
   - **Vite `base` 是编译时烤进 HTML/JS 的绝对路径**，不是运行时相对路径——多包一层 `/hireos/` 前缀后，原来 `base: '/interview/'` 编译出的资源引用 `/interview/assets/...` 会被浏览器当成"相对域名根目录"解析，完全绕开 `/hireos/` 前缀，404。不能只在 nginx 层加转发规则解决，得让 4 个前端在构建时把 `base` 也烤成带前缀的版本（`vite.config.ts` 改成读 `process.env.VITE_BASE_PATH`，默认值不变，`docker-compose.prod.yml` 给远程构建传 `/hireos/<子系统>/`）。
   - 三个前端项目（screening/jd/written）第一次因此从没用过 `process.env` 导致 `tsc` 报 `Cannot find name 'process'`——补装 `@types/node` 解决（不是绕过 `tsc`，因为这次是真的类型缺失，不是预存量债务）。
   - 顺带把 4 个前端的 Dockerfile/nginx.conf 简化成了"服务端扁平目录、前缀无关"（`base` 只影响资源*引用*方式，不影响 `dist/` 自身的物理目录结构），但忘了同步改我们自己 `gateway/nginx.conf` 的转发逻辑——网关还在把 `/interview/` 前缀原样转发给已经变成扁平结构的前端容器，404 被前端自己的 SPA fallback 悄悄兜底成 `200 text/html`（状态码骗人，内容是错的，必须查 `Content-Type` 才能发现）。修复：网关的每个 `location` 都要显式 `rewrite ^/prefix(/.*)$ $1 break;` 剥掉子系统前缀再转发。
   - 顺带还加了 `resolver 127.0.0.11 valid=10s;` + `proxy_pass` 用变量形式（`set $upstream ...; proxy_pass http://$upstream;`），修复了另一个独立问题：只重建部分服务的增量部署时，网关默认会在启动时把上游容器名解析成 IP 缓存住，重建的容器换了新 IP 但网关不知道，转发会打到（被 Docker 重新分配了那个旧 IP 的）别的容器上去。
   - **一个不直观的 nginx 坑**：`rewrite ... break;` 之后写的 `set` 指令不会执行（`break` 会中止 rewrite 模块后续所有指令，`set` 也算在内）——`set` 必须写在 `rewrite` **之前**。

**最终对外访问地址**：`http://34.94.189.76/hireos/`（`/interview/`、`/screening/`、`/jd/`、`/written/`、`/core-record/api/v1/...` 都在这个前缀下面）。

## 已知遗留问题

启动 `hireos-interview-front` 前先确认 `5173` 端口没有被别的进程占着——排查时发现过一个从旧目录 `hireos-screening/resume-screening-front`（该目录已不存在，大概率是改名/重建成了现在的 `hireos-screening-front`）启动、始终没退出的残留 Vite 进程占用着 `5173`。这类残留进程不会自动消失，用 `lsof -iTCP:5173 -sTCP:LISTEN` 揪出 PID 后手动杀掉。

**4 个前端的 Vite dev server 曾经全部 IPv6-only 绑定过一次**：某次本机环境变化后（原因不明，大概率是 `localhost` 的 DNS 解析优先级变了），4 个 `npm run dev` 进程都只监听了 `::1`（IPv6），不监听 `127.0.0.1`（IPv4）——`dev.sh status` 用 `lsof -iTCP:端口` 检查不区分协议族，照样显示"UP"，但本地网关（`gateway/frontend-gateway.mjs`）转发目标写的是字面量 `127.0.0.1`，导致连不上、报 `Bad gateway: upstream not reachable (ECONNREFUSED)`。已经在 4 个前端的 `vite.config.ts` 里把 `server.host` 显式写死成 `'127.0.0.1'`（不再依赖 `'localhost'` 字符串的 DNS 解析结果），重启后解决。如果以后又碰到网关报 `ECONNREFUSED` 但 `dev.sh status` 显示对应服务是 UP，先用 `lsof -iTCP:<端口> -sTCP:LISTEN` 看清楚实际监听的是 IPv4 还是 IPv6。
