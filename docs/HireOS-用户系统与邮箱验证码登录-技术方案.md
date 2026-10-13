# HireOS 用户系统与邮箱验证码登录 · 技术方案

- 状态：P1、P2 已实现（2026-10-13，分支 `feat/identity-login`），线上尚未启用，启用步骤见第 14 节
- 日期：2026-10-13
- 范围：新增统一身份服务 `hireos-identity`；interview / screening / jd / written / core-record 五个后端与四个前端接入
- 已确认（2026-10-13）：仅邀请制；通过 Gmail SMTP 发信；使用现有 HTTPS 域名 `https://hireos.aipollo.me/hireos/`；会话 7 天；角色为管理员 / HR / 面试官；初始管理员 `sujunjie427@gmail.com`
- 相关：[`HireOS_演进式组合架构.md`](HireOS_演进式组合架构.md)（L1 Identity「账号 · 组织 · 权限」、L3 Shell「登录」）、[`HireOS-域名与HTTPS配置需求.md`](HireOS-域名与HTTPS配置需求.md)、[`PORTS.md`](../PORTS.md)

## 1. 背景与现状

HireOS 目前没有真正的用户和登录。五个后端各自有一个 `WorkspaceGuard`，逻辑完全相同：`DEV_AUTH_ENABLED=true` 且非 `production` 时，给每个请求塞一个写死的身份，否则一律 401。

| 服务 | Guard 位置 | 注入的 workspaceId | 注入的 actorId |
| --- | --- | --- | --- |
| core-record | `hireos-core-record/src/auth/workspace.guard.ts` | `DEV_WORKSPACE_ID`（`local-screening-workspace`） | `local-core-record-user` |
| screening | `hireos-screening-backend/src/auth/workspace.guard.ts` | 同上 | `local-screening-user` |
| jd | `hireos-jd-backend/src/auth/workspace.guard.ts` | 同上 | `local-jd-user` |
| written | `hireos-written-backend/src/auth/workspace.guard.ts` | 同上 | `local-written-user` |
| interview | `job-Interview-backend/src/intake/workspace.guard.ts` | **写死 `local-workspace`** | `local-user` |

由此带来的问题：

- 谁都能访问，操作记录（审计、`confirmedBy`、`linkedBy` 等）里没有真实的人。
- 前端的「当前用户」是 fixture 里的演示人物（Emma Wilson、Daniel 等），右上角有「演示角色」切换，跟后端身份没有关系。
- interview 的 workspaceId 和其他服务不一致，接入真实身份时必须统一。
- 服务之间的调用（screening → core-record、screening → jd）只带 `x-workspace-id` 等头，被调方并不校验，也没有服务身份。

## 2. 目标与非目标

**目标**

1. 一套账号，所有子系统共用：登录一次，在 interview / screening / jd / written 之间切换不需要再登录。
2. 邮箱验证码登录（按设计稿）：输入工作邮箱 → 收到 6 位验证码 → 输入后登录。不设密码。
3. 每个请求都带真实身份（用户、工作区、角色），所有后端用同一种方式拿到它。
4. 可以主动登出、管理员可以停用账号，并且立即生效。
5. 本地开发体验不变差：本地无需真发邮件，也保留一键登录演示账号的能力（只在开发环境）。

**非目标（本期不做）**

- 细粒度权限（按职位、按字段的授权）。本期只做「登录 + 身份透传 + 粗粒度角色」，各子系统现有的业务逻辑不按角色拦截。
- 第三方登录（Google / 企业微信 / 飞书 SSO）。数据模型预留，不实现。
- 多租户自助注册。工作区由管理员创建。
- 候选人侧登录（笔试作答链接等仍走现有的一次性链接机制）。

## 3. 总体方案

```text
浏览器（同一域名下的 /interview/ /screening/ /jd/ /written/ /account/）
   │  Cookie: hireos_sid=<随机会话 ID>（HttpOnly，同源自动携带）
   ▼
网关 nginx（只转发，不做鉴权）
   ├─ /account/        → identity-front（登录页、个人与成员管理）
   ├─ /account/api/    → identity-backend（发码、验码、登出、me、成员管理）
   ├─ /screening/api/  → screening-backend ─┐
   ├─ /jd/api/         → jd-backend        ├─ AuthGuard：读 hireos_sid →
   ├─ /interview/api/  → interview-backend │   调 identity 内部接口校验（每次请求实时校验）
   ├─ /written/api/    → written-backend   │   → request.identity = { userId, workspaceId, roles, ... }
   └─ /core-record/    → core-record      ─┘
```

关键决策：

| 决策 | 选择 | 理由 |
| --- | --- | --- |
| 身份服务 | 新建独立服务 `hireos-identity`（后端 + 小前端），独立库 `hireos_identity` | 对应架构文档里的 L1 Identity；不塞进 core-record，core-record 只管候选人/职位/申请主档 |
| 会话形态 | **不透明会话 ID + 服务端会话表**，后端每次请求都通过 identity 内部接口实时校验（#16） | 登出、停用、移除立即生效；前端无需实现 token 刷新逻辑（interview 前端有大量散落的 `fetch`，加刷新重试代价大）；没有密钥轮换问题 |
| Cookie 共享 | 所有子系统同一域名、不同路径，**一个 host-only Cookie** 即可全局共享 | 网关已经把所有前端放在同一 origin 下（本地 `localhost:8080`，线上 `/hireos/` 前缀），无需跨域 SSO |
| 鉴权位置 | 各后端的 Guard，而不是网关 `auth_request` | 本地开发时前端 Vite 代理是直连后端的（绕过网关），只有放在后端才能所有路径都生效 |
| 登录方式 | 邮箱 + 6 位验证码，无密码 | 设计稿要求；省掉密码存储、找回密码等整套流程 |

备选方案见第 13 节。

## 4. 数据模型（`hireos_identity` 库）

```prisma
model User {
  id           String    @id @default(uuid())
  email        String    @unique          // 小写、去空格后存储
  displayName  String
  avatarColor  String?
  locale       String    @default("zh")
  status       UserStatus @default(active) // active | disabled
  lastLoginAt  DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  memberships  Membership[]
  sessions     Session[]
}

model Workspace {
  id                  String   @id          // 沿用现有 workspaceId 字符串，见第 10 节
  name                String
  createdAt           DateTime @default(now())
  memberships         Membership[]
}

model Membership {
  userId      String
  workspaceId String
  roles       String[]                    // admin | hr | interviewer
  status      MembershipStatus @default(active) // invited | active | removed
  invitedBy   String?
  createdAt   DateTime @default(now())
  user        User      @relation(fields: [userId], references: [id])
  workspace   Workspace @relation(fields: [workspaceId], references: [id])
  @@id([userId, workspaceId])
}

model LoginCode {
  id          String    @id @default(uuid())
  email       String
  codeHash    String                      // HMAC-SHA256(code, LOGIN_CODE_SECRET)
  expiresAt   DateTime                    // 发出后 10 分钟
  attempts    Int       @default(0)       // 输错次数，满 5 次作废
  consumedAt  DateTime?
  requestIp   String?
  createdAt   DateTime  @default(now())
  @@index([email, createdAt])
}

model Session {
  id          String    @id @default(uuid())
  tokenHash   String    @unique           // SHA-256(会话 ID)，库里不存明文
  userId      String
  workspaceId String
  userAgent   String?
  ip          String?
  createdAt   DateTime  @default(now())
  lastUsedAt  DateTime  @default(now())
  expiresAt   DateTime                    // 最后活跃时间 + 7 天，活跃时顺延
  revokedAt   DateTime?
  user        User      @relation(fields: [userId], references: [id])
  @@index([userId])
}

model AuthEvent {                        // 登录审计
  id        String   @id @default(uuid())
  type      String   // code_requested | code_failed | login_succeeded | logout | session_revoked | user_disabled ...
  email     String?
  userId    String?
  ip        String?
  userAgent String?
  detail    Json?
  createdAt DateTime @default(now())
  @@index([email, createdAt])
}
```

说明：

- 预留第三方登录时加 `UserIdentity(provider, subject, userId)`，不影响现有表。
- 一个用户可以属于多个工作区；本期界面上只有一个工作区，会话里记录当前工作区。

## 5. 登录流程

### 5.1 时序

```text
用户            identity-front           identity-backend                 邮件服务
 │ 输入邮箱 ──▶ │ POST /account/api/auth/code {email} ──▶ │
 │              │                          │ 校验频率 → 判断邮箱是否允许登录
 │              │                          │ 生成验证码 → 存 HMAC → 作废旧码 ──▶ 发信
 │              │ ◀── 200（无论邮箱是否存在，响应一致）
 │ 输入 6 位码 ▶│ POST /account/api/auth/verify {email, code} ──▶ │
 │              │                          │ 取最新未用码 → 次数/过期校验 → 常量时间比较
 │              │                          │ 成功：标记已用，建 Session
 │              │ ◀── 200 + Set-Cookie: hireos_sid=...
 │ 跳回 return_to（例如 /screening/jobs）
```

### 5.2 发码 `POST /account/api/auth/code`

请求 `{ "email": "name@company.com" }`。

1. 邮箱规范化（trim + 小写），格式校验。
2. 频率限制（存库或 Redis，本期用库即可）：
   - 同一邮箱 60 秒内只能发 1 次，1 小时内最多 5 次，24 小时内最多 20 次；
   - 同一 IP 1 小时内最多 20 次。
   - 超限返回 429 `CODE_RATE_LIMITED`，并带 `retryAfterSeconds`，前端据此显示倒计时。
3. 判断是否允许登录（见 5.4）。**不允许时不发信，但响应和允许时完全一样**，防止通过接口探测哪些邮箱是员工。
4. `crypto.randomInt(0, 1_000_000)` 生成 6 位码（左补零），同邮箱之前未使用的码全部作废，存 `HMAC-SHA256(code, LOGIN_CODE_SECRET)`。
5. 发送邮件（模板见 5.6），记录 `AuthEvent(code_requested)`。

响应：`200 { "sent": true, "resendAfterSeconds": 60, "expiresInSeconds": 600 }`。

### 5.3 验码 `POST /account/api/auth/verify`

请求 `{ "email": "...", "code": "123456", "returnTo": "/screening/jobs" }`。

1. 取该邮箱最新一条未使用、未过期的码；没有则返回 400 `CODE_INVALID`（不区分「过期」和「不存在」）。
2. `attempts >= 5` 视为作废，返回 `CODE_INVALID`。
3. 常量时间比较 HMAC。失败：`attempts + 1`，记 `code_failed`，返回 `CODE_INVALID` 和剩余次数。
4. 成功（在一个事务内完成）：
   - 标记 `consumedAt`；
   - 邮箱没有有效的 `Membership`（没被邀请或已被移出）→ 返回 `CODE_INVALID`。正常情况下 5.2 已经不会给这种邮箱发码；
   - 邀请状态（`invited`）的成员第一次登录成功后，改为 `active`；
   - 用户被停用 → 返回 403 `USER_DISABLED`；
   - 生成会话 ID：32 字节随机数，base64url 编码；
   - 存 `Session(tokenHash = SHA-256(ID))`，更新 `lastLoginAt`，记 `login_succeeded`。
5. 设置 Cookie（见第 7 节），返回 `{ user, workspace, returnTo }`。
6. `returnTo` 只接受以 `/` 开头、并且是已知子系统前缀（`/interview/`、`/screening/`、`/jd/`、`/written/`、`/account/`，线上带 `/hireos`）的相对路径。其他值一律回到默认首页，防开放重定向。

### 5.4 谁可以登录

**仅邀请制**（已确认）：

- 只有管理员邀请过、成员状态为 `invited` 或 `active` 的邮箱能登录。不支持按域名自动开通，也没有自助注册。
- 管理员在成员管理页邀请：填邮箱、姓名、角色。邀请时可以选择顺便发一封通知邮件（「你已被邀请加入 HireOS，前往 … 登录」），不带验证码。
- 初始管理员通过环境变量 `BOOTSTRAP_ADMIN_EMAILS=sujunjie427@gmail.com` 在 identity 启动时幂等写入：用户不存在就创建，并保证是 `admin`。

### 5.5 会话、登出

- **有效期 7 天**（已确认）：
  - 登录后 7 天内没有任何访问就自动退出；
  - 期间有访问会顺延到「最后访问 + 7 天」，但从登录起满 30 天必须重新登录，顺延不会超过这个上限（#16 AC-6）；
  - `lastUsedAt` 和 `expiresAt` 最多每 5 分钟更新一次，避免每个请求都写库。
- **登出**：`POST /account/api/auth/logout`，作废当前会话，清除 Cookie。
- **退出所有设备**：`POST /account/api/auth/logout-all`。
- **停用 / 移除用户**：作废该用户所有会话，各后端下一个请求即拒绝。

### 5.6 邮件

**发信服务：Gmail SMTP**（已确认）。没有 `aipollo.me` 的 DNS 管理权限，没法验证 Resend 这类服务的发信域名，所以先用 Gmail 账号通过 SMTP 发信。代码里抽象成 `MailSender` 接口，用 `MAIL_TRANSPORT` 切换，以后换 Resend 只改环境变量：

| `MAIL_TRANSPORT` | 用途 | 配置 |
| --- | --- | --- |
| `console` | 本地默认。不发信，验证码打印在 identity-backend 日志里 | — |
| `smtp` | 线上（Gmail） | `SMTP_HOST=smtp.gmail.com`、`SMTP_PORT=465`、`SMTP_SECURE=true`、`SMTP_USER=<Gmail 地址>`、`SMTP_PASS=<应用专用密码>`、`MAIL_FROM="HireOS <同一个 Gmail 地址>"` |
| `resend` | 预留。拿到 DNS 权限、验证 `hireos.aipollo.me` 后切换 | `RESEND_API_KEY`、`MAIL_FROM="HireOS <no-reply@hireos.aipollo.me>"` |

用 nodemailer 发信，screening 后端已经在用这个库。

**Gmail 的限制与注意事项**：

- 需要给发信的 Gmail 账号开启两步验证，再生成一个「应用专用密码」（Google 账号 → 安全性 → 应用专用密码）作为 `SMTP_PASS`。不能用账号的登录密码。
- 普通 Gmail 账号每天大约能发 500 封，内部登录量够用。发码频率限制（5.2）也能防止额度被刷完。
- 发件地址必须是这个 Gmail 本身，显示名可以写成「HireOS」。
- 这个账号改密码、关掉两步验证，或者被 Google 风控，都会导致所有人收不到验证码。建议用一个专门的发信账号，不用个人主邮箱，并记录在运维文档里。
- 发信失败时，接口返回 503 `MAIL_UNAVAILABLE`，记录告警日志，前端提示「验证码发送失败，请稍后重试」。

**邮件模板**（参考 Poseidon OS 的样式）：

- **主题**：验证码放在最前面，这样手机通知和收件箱列表里不打开邮件就能看到。
  - 英文：`817296 is your HireOS verification code`
  - 中文：`817296 是你的 HireOS 登录验证码`
- **正文结构**：
  - 顶部色块写品牌名 HireOS，用品牌色；
  - 「Hi,」和「Use the code below to sign in to HireOS:」；
  - 浅色底的大号等宽验证码，字间距加大，方便看清和复制；
  - 两行小字：「The code is valid for 10 minutes and can only be used once. Please do not forward it to anyone.」和「If you did not request this sign-in, you can ignore this email.」
- **兼容性**：
  - HTML 用 `<table>` 布局、全部内联样式，最大宽度 520px。很多邮件客户端（Outlook、Gmail）不支持 `<style>` 和 flex 布局。
  - 同时附一份纯文本版本，提高送达率。
- **语言**：按用户 `locale` 选择中文或英文。
- **安全**：验证码只出现在邮件里，不写进任何日志。console 模式例外，它只在开发环境可用。

## 6. 接口清单（identity-backend，前缀 `/api`，网关路径 `/account/api`）

| 方法 | 路径 | 说明 | 鉴权 |
| --- | --- | --- | --- |
| POST | `/auth/code` | 发验证码 | 公开 + 限流 |
| POST | `/auth/verify` | 验证码登录，Set-Cookie | 公开 + 限流 |
| POST | `/auth/logout` | 登出当前会话 | 会话 |
| POST | `/auth/logout-all` | 登出所有设备 | 会话 |
| GET | `/auth/me` | 当前用户、工作区、角色 | 会话 |
| POST | `/auth/dev-login` | 演示账号一键登录 | **仅 `NODE_ENV !== production` 且 `DEV_LOGIN_ENABLED=true`** |
| GET | `/users` | 成员列表 | admin |
| POST | `/users/invite` | 邀请成员（邮箱、姓名、角色） | admin |
| PATCH | `/users/:id` | 修改姓名、角色，停用或恢复 | admin |
| GET | `/users/lookup?ids=` | 批量按 ID 查姓名、头像（各子系统展示操作人用） | 会话 |
| POST | `/internal/sessions/introspect` | 校验会话，返回身份 | **内部**：`x-internal-token`，网关不对外暴露 |

`/internal/*` 在 nginx 和本地网关里都不转发，只能在 Docker 内网或本机访问。

`/auth/me` 响应示例：

```json
{
  "user": { "id": "uuid", "email": "maya@company.com", "displayName": "Maya Chen", "avatarColor": "#2563eb", "locale": "zh" },
  "workspace": { "id": "local-screening-workspace", "name": "Sending Labs" },
  "roles": ["admin", "hr"]
}
```

## 7. Cookie 与安全

**Cookie `hireos_sid`**

| 属性 | 值 |
| --- | --- |
| HttpOnly | 是，前端 JS 读不到 |
| Secure | 线上是；本地 `http://localhost` 否（`COOKIE_SECURE`） |
| SameSite | `Lax` |
| Path | 线上 `/hireos/`，本地 `/`（`COOKIE_PATH`）。线上那个 IP 上还有其他站点，不能用 `/` |
| Domain | 不设（host-only） |
| Max-Age | 7 天，会话顺延时一并刷新 |

**CSRF**

- `SameSite=Lax` 已经挡住跨站 POST 携带 Cookie 的情况。
- 各后端 Guard 对 POST、PUT、PATCH、DELETE 额外校验 `Origin`（或 `Referer`）是否属于允许的来源（`ALLOWED_ORIGINS`，线上为 `https://hireos.aipollo.me`）。
- 现有前端全部是同源请求，不受影响。

**其他**

- 会话 ID 和验证码在库里都只存哈希值。
- 验证码比较用 `crypto.timingSafeEqual`。
- 登录相关接口统一返回模糊错误，不暴露邮箱是否存在。
- **HTTPS**：线上已经有 `https://hireos.aipollo.me/hireos/`（2026-10-13 验证可访问），Cookie 可以带 `Secure`。
  - 旧的 `http://34.94.189.76/hireos/` 入口仍然可以访问。但在 HTTP 下，浏览器不会保存带 `Secure` 的 Cookie，从这个入口永远登录不上。
  - 启用登录前，需要运维把这个 IP 入口 301 跳转到域名（改服务器 nginx 的 `default` 里的 `location /hireos/`）。

## 8. 后端接入：统一 AuthGuard

五个后端的 `WorkspaceGuard` 换成同一份 `AuthGuard`。仓库没有根 workspace，所以采用「同一份文件复制到各服务」的方式，文件头注明来源；以后如果引入共享包再收拢。

```ts
export type Identity = {
  workspaceId: string;
  actorId: string;      // = userId；保留这个字段名，现有代码不用改
  roles: string[];
  email?: string;
  displayName?: string;
  kind: 'user' | 'service' | 'dev';
};
```

处理顺序：

1. **@Public() 路由**直接放行：health、Zoom OAuth 回调和 webhook、笔试候选人作答链接等。
   - 需要逐个服务梳理。interview 有 9 个 controller，目前只有 7 个挂了 Guard，剩下 2 个要确认是否本来就该公开。
2. **服务间调用**：请求头带 `x-hireos-service-token`，与 `SERVICE_TOKEN` 匹配时（所有后端配置同一个值）：
   - 读取 `x-workspace-id`、`x-actor-id` 作为身份，`kind = 'service'`；
   - 这两个值必须由调用方从它自己拿到的用户身份里透传，不能编造。
3. **用户请求**：从 `Cookie` 头解析 `hireos_sid`，调 identity 的 `/internal/sessions/introspect`。
   - 不缓存：每个请求都实时校验，退出或移除立即生效（#16 AC-7 / AC-8）；
   - 无效或缺失：返回 401 `AUTH_REQUIRED`。
4. **开发模式**：`AUTH_MODE=dev`（同时要求 `NODE_ENV !== production`）时，没有 Cookie 就回退到现有的固定开发身份。
   - 方便本地用 curl 直接调接口；
   - 有 Cookie 时仍然优先用真实会话，保证本地也能测登录。

切换开关：`AUTH_MODE = dev | session`，默认 `dev`，与现在的行为一致。线上切到 `session` 才真正启用登录；需要回滚时改回 `dev` 即可。

**服务间调用改造点**（调用方都要带上服务 token 和透传的用户身份）：

- screening → core-record（`core-record.client.ts`，现在已经带 `x-workspace-id`）
- screening → jd（`job-criteria.facade.ts`）
- jd → core-record
- interview / written → core-record（如果有）

**WebSocket**：`/jd/ws/voice-stream` 升级握手时同样会带 Cookie，需要在 upgrade 处理里做同样的校验。

## 9. 前端接入

### 9.1 登录页（identity-front，`/account/login`）

按设计稿实现：

- 邮箱输入 → 「发送验证码」→ 6 位验证码输入框（支持粘贴、自动提交）→ 登录。
- 「重新发送」按钮显示 60 秒倒计时；可以返回修改邮箱。
- 错误提示：验证码错误（剩余 N 次）、请求太频繁、账号已停用。
- 「PROTOTYPE ONLY — DEMO ACCOUNTS」区块只在 `/auth/dev-login` 可用时显示（开发环境），点一下直接以该演示账号登录。
- 中英文切换，沿用现有 `EN / 中` 的做法。
- `/account/` 下还有两个页面：个人信息页、成员管理页（仅 admin，可以邀请、改角色、停用）。

### 9.2 各子系统前端

四个前端（screening、jd、written、interview）做同样的四件事：

1. **启动时调 `GET /account/api/auth/me`**：
   - 401：跳转到 `/account/login?return_to=<当前完整路径>`；
   - 成功：把用户写入全局 store，替代现在 fixture 里的 `currentUser`。
2. **统一处理 401**：各前端的请求封装（screening `data/api/shared.ts` 的 `apiFetch`、jd 和 written 的同类封装、interview 的 `API_BASE_URL` 系列 `fetch`）收到 401 时跳转登录页。
   - interview 的 `fetch` 散落在多个文件，需要先收拢成一个封装。
3. **右上角用户菜单**：显示真实姓名和头像，提供「退出登录」。「演示角色」切换只在 `AUTH_MODE=dev` 下保留。
4. **操作人展示**：`confirmedBy`、`linkedBy` 等字段改为存 userId，展示时调 `/users/lookup` 批量换成姓名。

## 10. 现有数据与迁移

- **workspaceId 统一**：
  - 新建的 `Workspace` 记录直接用现有值 `local-screening-workspace` 作为 id，四个服务的存量数据不用迁移。
  - interview 写死的 `local-workspace` 已通过迁移 `20261013090000_unify_workspace_id` 统一改为 `local-screening-workspace`，部署 interview-backend 时自动执行（容器启动时跑 `prisma migrate deploy`）。
  - 上线前要核实线上各服务实际的 `DEV_WORKSPACE_ID`。
- **历史操作人**：存量记录里的 `actorId` 是 `local-screening-user` 这类固定字符串，不迁移。展示时 `lookup` 查不到就显示为「系统（历史数据）」。
- **前端演示人物**：
  - screening 等前端用 `PersonId`（`emma`、`daniel`、`morgan` 等）作为负责人、操作人。例如 `confirmJobCriteria(id, state.currentUser)`，以及候选人的 assignee。
  - 这部分改成真实 userId 是一项单独的改造，放在 P4。
- **Prisma**：只有新增的 `hireos_identity` 库。各子系统的 schema 不改，`actorId` 本来就是字符串。

## 11. 部署与分阶段上线

新增服务和端口（按 `PORTS.md` 约定，先登记再写代码）：

| 服务 | 端口 | 网关路径 |
| --- | --- | --- |
| hireos-identity 后端 | 3003（当前空闲的预留位） | `/account/api/` → `:3003/api/`（`/api/internal/*` 不转发） |
| hireos-identity 前端 | 5179 | `/account/` |

需要同步修改的文件：`PORTS.md`、`gateway/nginx.conf`、`gateway/frontend-gateway.mjs`、`gateway/backend-gateway.mjs`、`scripts/dev.sh`、`docker-compose.yml`、`docker-compose.prod.yml`、`scripts/docker/postgres-init.sh`（新建 `hireos_identity` 库）、`.github/ci/projects.json`。

| 阶段 | 内容 | 线上行为 |
| --- | --- | --- |
| P1 | identity 服务（数据模型、发码、验码、会话、me、登出、内部校验接口、成员邀请）、登录页、成员管理页、console 和 SMTP 发信、dev-login、单元测试 | 不变（各后端仍是 `dev`） |
| P2 | 五个后端换成 `AuthGuard`（支持 `dev` 和 `session` 两种模式）、服务间 token、四个前端接入 me、401 跳转、用户菜单；interview workspaceId 迁移 | 不变（仍是 `dev`），本地可以用 `session` 联调 |
| P3 | 线上前置条件：发信 Gmail 账号和应用专用密码、IP 入口跳转到域名、`BOOTSTRAP_ADMIN_EMAILS=sujunjie427@gmail.com`。部署后各服务切到 `AUTH_MODE=session` | **启用登录**；回滚只需改回 `dev` |
| P4 | 操作人和负责人改为真实用户（替换演示人物）；按角色做粗粒度权限 | 逐步生效 |

按 `AGENTS.md`：新增 Prisma schema 和跨子系统接口变更都要走 Issue → PR 流程，建议按 P1–P4 拆成 4 个 Issue；同时补一份 ADR（`docs/adr/0002-...`）记录「不透明会话 + 内部校验」这个决策。

## 12. 决策记录与待办

**已确认（2026-10-13）**

| 问题 | 结论 |
| --- | --- |
| 谁能登录 | 仅管理员邀请的邮箱 |
| 发信 | Gmail SMTP（应用专用密码）；以后拿到 DNS 权限可切换到 Resend |
| HTTPS | 使用现有 `https://hireos.aipollo.me/hireos/` |
| 会话时长 | 闲置 7 天过期，活跃顺延；登录满 30 天强制重新登录（#16） |
| 角色 | `admin`（管理员）、`hr`、`interviewer`（面试官） |
| 初始管理员 | `sujunjie427@gmail.com` |

**还需要准备的**

1. 发信用的 Gmail 账号：开启两步验证，生成应用专用密码，放线上 `shared/env`（`SMTP_USER`、`SMTP_PASS`），不进仓库。
2. 已注册的 Resend 账号暂时不用。聊天里出现过的那个 API Key 应该删除。

3. 运维把 `http://34.94.189.76/hireos/` 跳转到 `https://hireos.aipollo.me/hireos/`。
4. 角色和各子系统的对应关系：interview 前端的 `cycleRole` 演示角色、各后端现有的 `recruiter / hiring_manager` 等角色名，在 P4 映射到 `admin / hr / interviewer`。

## 13. 备选方案（未采用）

| 方案 | 不采用的原因 |
| --- | --- |
| JWT access token（15 分钟）+ refresh token，各后端用 JWKS 本地验签 | 每次请求都不用调 identity，性能更好；但前端要实现过期刷新和重试，interview 前端改动大；登出和停用要等 token 过期才生效；还要管理密钥轮换。以后有性能需要时可以平滑切换：Guard 接口不变 |
| 网关 nginx `auth_request` 统一鉴权，向后端注入身份头 | 后端代码最少；但本地开发时前端 Vite 代理直连后端、绕过网关，本地和线上行为会不一致；而且后端要无条件信任请求头 |
| 身份数据放进 core-record | core-record 的职责是业务主档。账号放进去会让它变成所有请求的认证依赖，和架构文档里 L1 Identity 独立的规划不一致 |
| 密码登录或第三方 SSO | 设计稿明确要求邮箱验证码；SSO 留作后续扩展（`UserIdentity` 表） |

## 14. 实现说明与上线清单（2026-10-13）

### 14.1 代码位置

| 内容 | 位置 |
| --- | --- |
| 身份服务后端（端口 3003） | `hireos-identity/hireos-identity-backend`（库 `hireos_identity`） |
| 登录页、账号页、成员管理（端口 5179，路径 `/account/`） | `hireos-identity/hireos-identity-front` |
| 后端统一 Guard（五份相同文件） | 各后端 `src/auth/workspace.guard.ts`（interview 为 `src/intake/workspace.guard.ts`） |
| 前端会话模块（四份相同文件） | 各前端 `src/lib/session.tsx`：`SessionGate`、`authFetch`、`UserMenu` |
| 网关与部署 | `gateway/nginx.conf`、`gateway/*-gateway.mjs`、`docker-compose*.yml`、`scripts/dev.sh`、`scripts/deploy/deploy.sh`、`PORTS.md` |

和前文设计相比的落地细节：

- **前端是否强制登录**由 identity 的 `LOGIN_REQUIRED` 决定（`GET /account/api/auth/config`）。为 `false` 时，未登录的前端照旧使用演示人物；已登录时右上角显示真实用户和「退出登录」。
- **服务间调用**统一用一个共享的 `SERVICE_TOKEN`，调用方带 `x-hireos-service-token`、`x-workspace-id`、`x-actor-id`。
  - 已改的调用：screening → core-record、jd；jd → core-record；interview → core-record、jd；screening → interview / written 的交接；written → interview 的交接。
- **限流取客户端 IP**：线上前面有两层代理（服务器 nginx、网关 nginx），配置 `TRUSTED_PROXY_HOPS=2`。
  - 这要求服务器 nginx 的 `location /hireos/` 传 `X-Forwarded-For`（`proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`），上线前需要确认；没传时所有人会共用一个 IP 限额（每小时 20 次发码）。
- 后端 Guard 每次请求都实时校验 Cookie，不做缓存；登出、停用、移除后各子系统立即拒绝旧会话。
- written 的候选人作答页 `/written/apply/:token` 和对应的公开接口不需要登录。

### 14.2 线上启用步骤（P3，由人执行）

1. **准备密钥**（都放各服务的 `.env.production`，不进仓库）：
   - `hireos-identity-backend/.env.production`：按 `.env.production.example` 填写。`LOGIN_CODE_SECRET`、`INTERNAL_TOKEN` 用 `openssl rand -hex 32` 生成；`SMTP_USER` 和 `SMTP_PASS` 填发信 Gmail 账号和它的应用专用密码；先保持 `LOGIN_REQUIRED=false`。
   - 五个后端的 `.env.production` 追加 `AUTH_MODE=dev`、`IDENTITY_INTERNAL_URL=http://identity-backend:3003/api`、`IDENTITY_INTERNAL_TOKEN`（等于上面的 `INTERNAL_TOKEN`）、`SERVICE_TOKEN`（五个后端同一个值）、`ALLOWED_ORIGINS=https://hireos.aipollo.me`。
2. **建库**：线上 Postgres 数据卷早已初始化，`postgres-init.sh` 不会再执行，需要手动 `CREATE DATABASE hireos_identity;`。
3. **推送 env 并部署**：`deploy.sh push-env`，然后部署 identity、五个后端、四个前端和 gateway。
   - 注意：部署脚本会检查 `docker-compose.yml` 里引用的每个 env 文件是否在服务器上存在。合并这次改动之后，即使只部署别的服务，也要先推送 identity 的 env。
4. **试运行**（仍是 `dev` 模式，行为不变）：打开 `https://hireos.aipollo.me/hireos/account/login`，用 `sujunjie427@gmail.com` 收验证码登录，确认邮件能收到、登录后各子系统右上角显示真实用户；在成员管理页邀请其他成员。
5. **正式启用**：五个后端改 `AUTH_MODE=session`，identity 改 `LOGIN_REQUIRED=true`，重新推送 env 并重启这些服务。
6. **回滚**：把第 5 步改回 `AUTH_MODE=dev`、`LOGIN_REQUIRED=false` 再重启即可，数据不受影响。

### 14.3 本地开发

- `scripts/dev.sh start` 已包含 `identity-backend` 和 `identity-frontend`。
- 默认 `AUTH_MODE=dev`、`LOGIN_REQUIRED=false`，和以前一样不用登录。
- 想在本地体验登录：identity 的 `.env` 设 `LOGIN_REQUIRED=true`，五个后端的 `.env` 设 `AUTH_MODE=session`，重启后访问 `http://localhost:8080/screening/` 会跳到登录页。
  - 验证码打印在 `.local/logs/identity-backend.log`；登录页下方的演示账号可以一键登录。

