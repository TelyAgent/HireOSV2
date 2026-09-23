# 简历/材料主档统一到 Core Record —— 现状盘点与迁移计划

> 背景：Interview 子系统是在 Core Record 建立之前独立开发的，因此自己维护了一整套简历/材料（Material）存储，跟 Screening 各建一套、互不相通。这份文档记录当前现状、为什么要收敛到 Core Record、以及分阶段的迁移计划。

## 一、结论先行

按 `docs/HireOS-Database-Architecture-Decision.md` §4.1 / §4.3 的既定分工：

> **4.1 Core Record Service**：Core Record 是跨系统主档的唯一写入方，负责 Candidate / Job / Application / **File 或 Material 主档**……其他子系统不得自行创建另一份主档作为事实来源。
>
> **4.3 Screening 子系统**：Screening 子系统负责**候选人导入和材料消费记录**……

**主档（文件本身、全平台唯一一份）归 Core Record；各业务子系统只保留"消费记录"（引用 + 自己的解析/处理结果），不再各自维护一份主档。** 这跟 JD/Job 已经落地的模式完全一致——JD 不再自己维护 Job 主档，而是调 Core Record 创建/更新 Job。Material 应该对称地照做。

Interview 现在这套独立的 Material 是历史遗留（建的时候 Core Record 还不存在），需要往 Core Record 收敛，而不是反过来让 Core Record/其他子系统对齐 Interview 或 Screening 现有的某一套。

## 二、现状盘点

### 2.1 Screening（`hireos-screening-backend`）—— 模型体量大，但耦合面比想象中窄；已迁移（见四、阶段三）

Screening 自己维护了一整套材料/简历导入流水线，核心模型（`prisma/schema.prisma`）：

- `Material`：真正的文件主档字段都在这——`storageKey`、`hash`（含 `@@unique([workspaceId, hash])` 去重）、`normalizedTextHash`（内容级去重，PDF/DOCX 同一份简历也能识别）、`text`/`segments`（解析出的正文）、`readStatus`/`securityStatus`/`extractionStatus`。
- `ResumeVersion`：材料与候选人的版本化关联（一个候选人可以有多版简历）。
- `CandidateSource`、`LibraryEntry`、`ImportBatch`/`ImportItem`、`IngestionOperation`/`IngestionAttempt`：围绕批量导入（文件夹/邮箱等渠道）的整条流水线，全部挂在 `materialId` 上。
- `CandidateProfile`：从简历解析出的结构化画像，挂在 `ResumeVersion` 上。
- `DuplicateCheck`：重名/重复候选人检测，同样挂 `materialId`。

**实际去读代码后，发现耦合面比模型数量看起来的要窄很多。** 全仓库只有 8 个文件碰 `materialId`/`Material`：

| 文件 | 用到什么 |
|---|---|
| `intake/materials.service.ts` | **唯一的写入入口**——`saveUpload()`：接文件、扫描、PDF/DOCX 解析、`hash`/`normalizedTextHash` 去重、写本地磁盘（`.local/materials`）、建 `Material` 行 |
| `intake/imports.service.ts` | 批量导入流水线，调用 `saveUpload()`，用返回的本地 `material.id` 建 `ImportItem`/`CandidateSource`/`ResumeVersion` |
| `duplicates/duplicates.service.ts` | 只读 `material.text`/`segments`/`name`/`readStatus`/`createdAt`（本地已解析的字段） |
| `library/candidates.service.ts`、`discovery/discovery.service.ts` | 只读 `material.text`/`material.name`，用于展示/分析 |
| `profiles/profile-parser.service.ts`、`profiles/profiles.service.ts` | 简历解析 worker，只读本地 `material.text`/`segments` |
| `screening/screening.service.ts` | 只读 `material.text`/`segments`/`name`/`readStatus`，写评分证据里的 `materialId`（指向本地 id） |

**关键发现：除了 `materials.service.ts` 的 `saveUpload()`，其余 7 个文件全部只读本地已解析字段（`text`/`segments`/`name`/`readStatus`）——这些全是消费记录，没有一个碰主档字段（`hash`/`storageKey`）。** 也就是说，本地 `Material` 表**不需要删掉**，迁移后它继续存在、继续存 `text`/`segments`/`extractionStatus`/`normalizedTextHash` 这些 Screening 自己的解析产物——这部分本来就该留在本地（是业务处理结果，不是"文件本身"）。真正要动的字段只有 `hash`/`storageKey` 这两个"这是不是同一份原始文件"相关的，而这两个字段目前只在 `saveUpload()` 一处被写、被读（本地去重那一行）。

所以实际工作量是：**加一列 `coreMaterialId`，重写一个函数（`saveUpload`），其余 7 个文件不用碰。** 比最初凭模型数量估的"体量最大、耦合最深"要轻得多。

### 2.2 Interview（`hireos-interview/job-Interview-backend`）—— 原本独立的一套，已迁移（见四、阶段二）

当时的状态：

- `Material`：本地主档字段（简化版，没有 Screening 那套去重/导入体系），且本地磁盘写入的文件从来没被读取过（没有下载/预览接口）。
- `Resume`：材料与候选人的关联。
- `JobMaterial`/`TaskMaterial`：材料与 Job/InterviewTask 的关联。
- 上传入口：`POST /materials`（"关联岗位 + 上传简历"轻量入口也是走这个）。

这套已经在阶段二收敛完毕：主档身份挪去 Core Record，本地不再存字节，只留解析产物。

### 2.3 Core Record（`hireos-core-record`）—— 原本只是元数据登记，现已补成真正的文件存储（见四、阶段一）

`src/materials/` 当时的状态：

- `POST /materials`：**只接收 JSON 元数据**（`name`/`mime`/`size`/`hash`/`storageKey`），没有 `FileInterceptor`，不接收真实文件字节。已经有 `hash` 去重（`workspaceId_hash` 唯一索引）、幂等、outbox 事件（`material.received`）。
- `GET /materials/:id`：返回元数据。
- `GET /materials/:id/download`：返回的 `downloadUrl` 指向 `/api/v1/materials/:id/content`，**但这个 `/content` 路由当时没有实现**——只是个占位。

这个缺口已经在阶段一补上了（真实 multipart 上传 + `/content` 下载都已实现并实测），下面"现状"是历史记录，当前状态见第四节阶段一。

### 2.4 Screening → Interview 的移交事件缺材料引用

`ScreeningOutboxEvent`（`candidate.advanced_to_interview`）的 payload 目前只有候选人姓名/邮箱/电话 + `matchScore`/`matchRecommendation`，**没有简历文件的引用**。所以候选人从 Screening 移交到 Interview 后，面试官那边看不到原始简历，只能靠人工在 Interview 里重新上传一份——这是这次讨论的起因，也是迁移完成后要顺带修的。

## 三、目标架构

```
                    ┌─────────────────────────┐
                    │      Core Record        │
                    │  Material 主档：         │
                    │  - id / hash / storageKey│
                    │  - name / mime / size    │
                    │  - readStatus/securityStatus │
                    │  - 真实文件字节存储       │  ← 待建
                    └──────────┬───────────────┘
                     调 API 创建/读取（不直连 DB）
              ┌────────────────┼────────────────┐
              │                                  │
      ┌───────▼────────┐               ┌─────────▼────────┐
      │   Screening     │               │     Interview     │
      │ 消费记录：       │               │  消费记录：         │
      │ - ResumeVersion │               │ - Resume           │
      │ - text/segments │               │ - JobMaterial/      │
      │   (自己解析)     │               │   TaskMaterial      │
      │ - 导入流水线     │               │ - 自己的解析结果      │
      └────────┬────────┘               └─────────▲──────────┘
               │                                    │
               └──── outbox 事件带 coreMaterialId ───┘
                  （移交时直接引用，无需重新上传）
```

- **Core Record** 存主档身份（唯一 id、hash 去重、基础状态）+ 真实文件字节。
- **各子系统**只存"消费记录"：自己的解析结果（`text`/`segments`/`CandidateProfile` 这类业务特定的加工产物，仍然合理地留在各子系统本地，不需要也不应该塞进 Core Record），以及跟自己业务对象（Application / InterviewTask）的关联。
- **跨系统引用**：谁都不再重新上传同一份文件——上传一次进 Core Record，其他子系统通过 `coreMaterialId` 引用；Screening→Interview 的移交事件带上这个 id，Interview 直接用，不用等人工重传。

## 四、分阶段迁移计划

### 阶段一：补全 Core Record 的文件存储能力 ✅ 已完成

- `POST /materials` 已改为真正的 multipart 上传（`FileInterceptor`），服务端自己算 `hash`（不再信任调用方传来的 hash/storageKey），按 `(workspaceId, hash)` 去重，写入本地磁盘 `.local/materials`（跟 Screening/Interview 现有做法一致），幂等键、审计记录、outbox 事件（`material.received`）沿用原有模式。
- `GET /materials/:id/content` 已实现，真正把文件字节流回去（`StreamableFile`），`GET /materials/:id/download` 保留作纯元数据/授权检查用途，不传输文件本身。
- 非 ASCII 文件名的 latin1→utf8 修复（Screening 那边已有的坑）在这里也一起加上了。
- 已实测验证：上传 → 同文件不同 idempotency-key 复用同一 `id`（跨请求去重）→ 同 idempotency-key 重放返回同一响应 → `/content` 下载字节与原文件一致 → 空文件/404 都按预期报错。加了 `@types/multer` 依赖，`tsconfig.json` 补了 `"types": ["node", "multer"]`（之前漏配，导致 `Express.Multer.File` 类型解析不到）。

### 阶段二：Interview 先迁 ✅ 已完成

- Prisma：`Material` 加 `coreMaterialId String? @unique`，**同时删掉了 `storageKey` 字段**——查代码发现 Interview 从来没有任何地方读取过本地存的文件（没有下载/预览接口，前端也没有"查看原文件"功能），本地磁盘写入纯属之前的历史遗留、写了从没读过，索性一起去掉，不再本地存字节。
- `core-record.client.ts` 新增 `uploadMaterial()`：把文件转发给 Core Record（`FormData`/`Blob` 上传），拿到 `coreMaterialId` + Core Record 算好的 `hash`。
- `materials.service.ts` 的 `upload()` 改为：先调 Core Record 拿 `coreMaterialId` → 用 `coreMaterialId` 查本地是否已有对应记录（有就直接返回，跳过重新解析，避免同一份文件重复跑一遍 PDF/DOCX 解析）→ 没有才在本地做文本抽取、建 `Material` 行（`hash` 直接用 Core Record 返回的值，不再本地重算）。
- `Resume`/`JobMaterial`/`TaskMaterial`/`ParseJob` **保持挂本地 `Material.id` 不变**——它们要的是本地已解析的 `text`/`segments`，不是 Core Record 的主档 id，跟 Screening 那边的结论一致：本地 `Material` 表不消失，只是加一列引用。
- 已实测验证：上传 → 本地行同时有 `id`（本地）和 `coreMaterialId`（Core Record）→ 直接从 Core Record 下载内容，字节与原文件一致 → 同文件重复上传两次，本地/Core Record 的 id 都完全复用（不产生重复行，也不重新解析）→ 用这份材料走完整的"关联岗位 + 建面试任务"流程（`POST /jobs/:id/tasks`），`Resume`/`Candidate`/`InterviewTask`/默认轮次全部正常生成，`candidates.service.ts`/`tasks.service.ts` 一行没改，因为它们本来就只认本地 `material.id`。

### 阶段三：Screening 迁移 ✅ 已完成

- Prisma：`Material` 加 `coreMaterialId String? @unique`，**同时删掉了 `storageKey`**——跟 Interview 一样，查代码发现本地磁盘写入从来没被读取过（没有下载/预览接口），一并清掉。`normalizedTextHash`/`text`/`segments`/`extractionStatus` 等 Screening 自己的解析产物保留在本地不动。
- `core-record.client.ts` 新增 `uploadMaterial()`，跟这个文件里 `createCandidate`/`createJob`/`createApplication` 保持同一套 `mock`/`remote` 双模式约定：`CORE_RECORD_MODE=mock` 时返回 `null`（当前 `.env` 里配的是 `remote`，已经在用真实调用）。
- `intake/materials.service.ts` 的 `saveUpload()` 改为：先调 Core Record 上传（`mock` 模式下返回 `null`）→ 去重判断分两条路：拿到 `coreMaterialId` 就按它查本地，没拿到（`mock` 模式）就退回原来的 `{workspaceId, hash}` 本地去重，保证 `mock` 模式下行为跟迁移前完全一致 → 找到已有记录直接返回（跳过安全扫描和解析）→ 没有才走扫描/解析/建行，`hash` 直接复用本地算好的值（不依赖 Core Record 返回，因为 mock 模式下没有）。
- `saveUpload()` 的签名从 `(workspaceId: string, ...)` 改成 `(identity: Identity, ...)`（Core Record 调用需要完整 identity），两个调用点（`intake.controller.ts`、`imports.service.ts`）同步更新，其余 7 个只读本地字段的文件**一行没动**。
- 已实测验证，而且验证到了这次迁移最有价值的一点——**真正的跨子系统去重**：同一份简历先传到 Screening，再传到 Interview，两边各自的本地 `id`不同，但 `coreMaterialId` 完全一样，都指向 Core Record 的同一份主档；从 Core Record 直接下载内容，字节与原文件一致；同一子系统内重复上传会命中 `exact_file`，跳过重新扫描/解析。测试数据已清理。

### 阶段四：打通移交事件 ✅ 已完成

- Screening 侧（`decisions.service.ts`）：查候选人最新一版 `ResumeVersion`（沿用 `screening.service.ts` 里已有的 `where: { isLatest: true }, take: 1, include: { material: true }` 写法），把 `resumeVersions[0]?.material.coreMaterialId` 塞进 `candidate.advanced_to_interview` 事件的 payload。`coreMaterialId` 本身是个稳定引用，不是文件内容，符合事件信封"只带 ID 和摘要"的约定；`CORE_RECORD_MODE=mock` 时这个字段自然是 `undefined`，跟迁移前行为一致。
- Interview 侧：`screeningHandoffSchema` 加 `coreMaterialId`（可选）；`MaterialsService` 新增 `fromCoreMaterial()`——按 `coreMaterialId` 查本地是否已有记录（幂等）→ 没有就调 Core Record 新增的 `getMaterial()`/`downloadMaterialContent()` 拉取元数据和字节 → 跑同一套抽取逻辑（重构出了 `extractText()` 私有方法，`upload()` 和 `fromCoreMaterial()` 共用，不再各写一份）→ 建本地 `Material` 行。`screening-handoff.service.ts` 拿到 `Material` 后 upsert 一个 `Resume`，把 `resumeId` 挂到 `InterviewTask` 上。
- 派发器（`interview-handoff-dispatcher.service.ts`）原样转发 payload，不需要改。
- 已做完整端到端实测：真实创建一条 Screening 申请（关联一份带 `coreMaterialId` 的简历）→ 提交"进入面试"决策 → outbox 事件 payload 里正确带上 `coreMaterialId` → 派发器 2 秒内自动送达 → Interview 端自动下载、解析出来的文本跟原文件逐字一致、`InterviewTask.resumeId` 正确挂上简历，**全程不需要人工重新上传**——这正是最初触发这轮讨论的那个缺口，现在补上了。另外单独验证了幂等性：把同一个 handoff payload重放一次，`taskId`/`Resume`/`Material` 全部复用，不产生重复行。测试数据已清理。

## 五、待确认事项

- ~~阶段三（Screening 迁移）的具体工作量评估~~ —— 已完成，见 2.1（结论：耦合面窄，改动集中在 `saveUpload()` 一处，中等工作量）。
- ~~阶段一（Core Record 补文件存储能力）~~ —— 已完成并实测，见四、阶段一。
- ~~阶段二（Interview 先迁）~~ —— 已完成并实测，见四、阶段二。附带发现并清理了 Interview 本地磁盘写入这个从未被读取过的死代码。
- ~~阶段三（Screening 迁移）~~ —— 已完成并实测，见四、阶段三。实测验证了跨子系统去重真的生效（同一份简历从 Screening 和 Interview 分别上传，落到 Core Record 同一个主档）。同样发现并清理了 Screening 本地磁盘写入这个从未被读取过的死代码。
- ~~阶段四（打通移交事件）~~ —— 已完成并端到端实测，见四、阶段四。这是最初触发这轮讨论的那个缺口，现在四个阶段全部完成，整个迁移计划结束。
- 真实文件存储先落本地磁盘还是直接上云存储：目前落的是本地磁盘，跟现有部署方式匹配；以后要上云存储时只需要改 Core Record `MaterialsService` 内部的读写路径，接口形状不用变。
