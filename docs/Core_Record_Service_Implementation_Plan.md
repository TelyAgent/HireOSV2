# HireOS Core Record Service 实施计划

## 1. 文档目的

本文定义 HireOS Core Record Service 的实施范围、数据所有权、数据库边界、API 契约、迁移策略和验收标准。

Core Record Service 是 HireOS 的核心业务基建，不是普通业务子系统。它负责维护跨 JD、Screening、Assessment、Interview、Offer 五个系统共享的主档：

- Candidate；
- Job；
- Application；
- File / Material 的主档引用；
- Workspace 和用户身份的外部引用。

本文的目标是：

1. 让五个业务子系统引用同一份 Candidate、Job 和 Application；
2. 消除各子系统重复创建主档的问题；
3. 保证主档只有一个写入方；
4. 支持业务子系统独立部署、独立迁移和独立发布；
5. 为后续 Outbox、事件总线和跨系统组合提供稳定基础；
6. 在不一次性重写 Screening 的前提下，渐进完成迁移。

## 2. 核心决策

### 2.1 Core Record 是主档唯一写入方

Core Record Service 独占以下事实的写入权：

```text
Candidate
Job
Application
File / Material 主档引用
```

JD、Screening、Assessment、Interview、Offer 不得直接写入这些主档表。

### 2.2 早期共用 PostgreSQL，逻辑隔离优先

第一阶段不需要立即部署独立 PostgreSQL 集群。建议使用：

```text
一个 PostgreSQL 实例
│
├── core_record schema
└── screening schema
```

如果当前开发阶段仍然需要兼容旧表，可以暂时保留 `public` Schema，但必须先冻结数据所有权，并通过 Core Record API 进行新写入。

### 2.3 Core Record 不拥有业务结果

Core Record 只维护主档事实和基础生命周期，不负责：

- Screening 评分；
- Assessment 答题和测评结果；
- Interview 反馈；
- Offer 条款；
- AI 判断；
- 招聘决策理由；
- 业务系统的私有工作流。

这些数据由对应业务子系统拥有，通过稳定 ID 和事件关联。

### 2.4 兼容迁移优先于一次性搬迁

当前 Screening 已经拥有 Candidate、Job、Application、Material 等表。迁移不采用一次性删除和重建，而采用：

```text
冻结所有权
    ↓
建立 Core Record API
    ↓
增加兼容适配层
    ↓
双读 / 单写
    ↓
校验数据一致性
    ↓
切换读取来源
    ↓
迁移私有 Schema
    ↓
移除旧写入路径
```

## 3. 当前项目基线

当前 Screening backend 位于：

```text
hireos-screening/job-Resume-Screening-backend/
```

目前已经存在：

- `Candidate`
- `Job`
- `Application`
- `Material`
- `ResumeVersion`
- `CandidateProfile`
- `CandidateJobRecommendation`
- `ScreeningEvaluation`
- `ScreeningDecision`
- `HandoffPackage`
- `AuditRecord`

当前这些模型暂时位于同一个 PostgreSQL 数据库和默认 Schema 中。

其中应当迁移到 Core Record 的主档：

```text
Candidate
Job
Application
Material 的主档部分
```

仍由 Screening 拥有的内容：

```text
CandidateJobRecommendation
PreLinkMatchEvaluation
ScreeningSession
ScreeningEvaluation
ScreeningConcern
VerificationItem
ComparisonSet
ScreeningDecision
HandoffPackage
DeliveryAttempt
Receipt
```

`ResumeVersion`、`CandidateProfile` 和材料解析过程需要在 Core Record 与 Screening 之间进一步确认所有权：

- ResumeVersion 的来源版本和 Material 引用属于 Core Record；
- Profile 解析结果可以属于 Screening 或独立 Profile 服务；
- Screening 不应直接修改原始材料；
- 所有解析结果必须引用 `candidate_id`、`resume_version_id` 和 `material_id`。

## 4. 目标架构

```text
统一工作台 / Shell
        │
        ├── JD Service
        ├── Screening Service
        ├── Assessment Service
        ├── Interview Service
        └── Offer Service
                │
                ├── Core Record API
                │       └── core_record schema
                │
                ├── Event Bus
                ├── Queue
                ├── Object Storage
                └── Audit / Timeline
```

业务子系统访问主档的方式：

```text
业务子系统 ──同步 API──> Core Record Service ──> core_record schema
业务子系统 ──事件订阅──> Event Bus
业务子系统 ──私有数据库──> 自己的 schema
```

不允许：

```text
Screening ──直接 SQL──> core_record schema
Interview ──直接 SQL──> screening schema
Offer ──直接 SQL──> interview schema
```

## 5. 数据所有权设计

### 5.1 Candidate

Core Record 负责：

- 唯一 Candidate ID；
- 基础身份字段；
- 联系方式；
- 候选人状态；
- workspace 所属关系；
- 去重后的主档合并关系；
- 数据保留策略；
- 主档版本和审计。

Screening 可以维护候选人的筛选投影和评估引用，但不能直接改变 Candidate 主档。

### 5.2 Job

Core Record 负责：

- Job ID；
- 岗位基础信息；
- team、location、employment type、seniority；
- 岗位开放/关闭状态；
- workspace 所属关系；
- openings 和基础统计的事实来源。

JD Service 负责：

- JD 正文；
- JD 解析；
- Criteria；
- 岗位标准版本；
- 岗位编辑体验。

JD Service 通过 Core Record API 创建和更新 Job 基础主档。

### 5.3 Application

Core Record 负责：

- Application ID；
- Candidate 与 Job 的关系；
- cycle；
- application 基础状态；
- origin；
- linkedAt、linkedBy；
- 去重与幂等；
- 基础生命周期状态。

Screening 负责：

- Screening 状态；
- Evaluation；
- Decision；
- Handoff；
- 交付状态。

如果 Application 的基础状态需要被其他系统改变，应通过 Core Record 的状态变更 API，或由 Core Record 消费经过授权的标准事件。

### 5.4 File / Material

Core Record 负责：

- Material ID；
- 原始文件元数据；
- workspace 所属关系；
- hash；
- storage key 的主档引用；
- 版本关系；
- 可用、失败、隔离、删除等基础状态。

对象存储中的原始内容不应通过 Core Record API 直接返回给所有调用者。下载必须经过授权和用途校验。

解析、OCR、Profile 和 Screening 消费记录属于对应处理模块。

## 6. 数据库设计

### 6.1 Schema

目标 Schema：

```sql
CREATE SCHEMA core_record;
```

Core Record 初始表：

```text
core_record.workspace
core_record.candidate
core_record.candidate_identity
core_record.job
core_record.application
core_record.material
core_record.material_version
core_record.application_status_history
core_record.record_merge
core_record.outbox_event
core_record.audit_record
```

### 6.2 Candidate 表

建议字段：

```text
id
workspace_id
display_name
email
phone
identity_status
owner_id
retention_policy
status
version
created_at
updated_at
```

约束：

- `id` 使用 UUID；
- `workspace_id` 必须参与所有唯一约束；
- email 和 phone 不直接做全局唯一；
- 去重结果由显式合并或人工确认决定；
- 更新使用 `expected_version` 或 `If-Match`。

### 6.3 Job 表

建议字段：

```text
id
workspace_id
title
team
location
employment_type
seniority
status
openings
created_by
version
created_at
updated_at
```

JD 正文、Criteria 和 JD 版本不应与基础 Job 字段混成无版本 JSON。它们可以在 JD Service 的私有 Schema 中保存，并通过 `job_id` 关联。

### 6.4 Application 表

建议字段：

```text
id
workspace_id
candidate_id
job_id
cycle_id
status
origin
linked_at
linked_by
version
created_at
updated_at
```

核心唯一约束：

```text
UNIQUE(workspace_id, candidate_id, job_id, cycle_id)
```

Application 创建必须支持幂等：

```text
workspace_id + candidate_id + job_id + cycle_id
```

重复请求返回已有 Application，不重复创建投递关系。

### 6.5 Material 表

建议字段：

```text
id
workspace_id
name
mime
size
hash
storage_key
read_status
security_status
retention_policy
version
created_at
updated_at
```

原始文件内容继续放对象存储或当前本地私有目录，数据库只保存元数据和受控引用。

### 6.6 版本与审计

所有主档更新至少记录：

- actor；
- workspace；
- before version；
- after version；
- reason；
- correlation ID；
- request ID；
- source service；
- occurredAt。

任何覆盖式更新都不能删除历史事实。

## 7. API 设计

API 建议使用 `/api/v1` 版本前缀。

### 7.1 Candidate API

```text
POST   /api/v1/candidates
GET    /api/v1/candidates/:id
PATCH  /api/v1/candidates/:id
POST   /api/v1/candidates/:id/merge
GET    /api/v1/candidates/:id/history
```

创建示例：

```json
{
  "displayName": "Alex Morgan",
  "email": "alex@example.com",
  "phone": "+1-555-0100",
  "source": "resume_import"
}
```

### 7.2 Job API

```text
POST   /api/v1/jobs
GET    /api/v1/jobs/:id
PATCH  /api/v1/jobs/:id
POST   /api/v1/jobs/:id/close
POST   /api/v1/jobs/:id/reopen
GET    /api/v1/jobs/:id/history
```

### 7.3 Application API

```text
POST   /api/v1/applications
GET    /api/v1/applications/:id
PATCH  /api/v1/applications/:id
POST   /api/v1/applications/:id/status
GET    /api/v1/applications/:id/history
```

创建 Application 必须要求：

```json
{
  "candidateId": "candidate-id",
  "jobId": "job-id",
  "cycleId": "cycle-1",
  "origin": "sourced",
  "linkReason": "Human-confirmed recommendation"
}
```

### 7.4 Material API

```text
POST   /api/v1/materials
GET    /api/v1/materials/:id
GET    /api/v1/materials/:id/download
POST   /api/v1/materials/:id/consume
GET    /api/v1/materials/:id/history
```

下载接口必须：

- 校验 workspace；
- 校验用途和角色；
- 使用短期授权；
- 不暴露真实 storage key；
- 写入下载审计；
- 支持撤回或隔离状态。

### 7.5 通用查询 API

```text
GET /api/v1/records/candidates/:id
GET /api/v1/records/jobs/:id
GET /api/v1/records/applications/:id
```

这些接口只返回主档信息，不返回业务子系统私有结果。

## 8. API 契约要求

所有 mutation 必须包含：

```text
workspace context
actor
idempotency key
request ID
correlation ID
expected version（适用时）
```

统一错误结构：

```json
{
  "code": "VERSION_CONFLICT",
  "message": "The record has changed since it was read.",
  "retryable": false,
  "fieldPaths": [],
  "correlationId": "corr-123",
  "responsibleModule": "core-record",
  "suggestedAction": "Refresh the record and retry with a new version."
}
```

必须支持的错误：

```text
INVALID_SCHEMA
TENANT_MISMATCH
ACCESS_DENIED
NOT_FOUND
IDEMPOTENCY_CONFLICT
VERSION_CONFLICT
INVALID_STATE_TRANSITION
RECORD_ALREADY_EXISTS
RECORD_MERGE_REQUIRED
MATERIAL_UNAVAILABLE
```

## 9. 状态和并发控制

### 9.1 Candidate

建议状态：

```text
provisional
active
merged
archived
deleted
```

### 9.2 Job

建议状态：

```text
draft
open
paused
closed
archived
```

### 9.3 Application

建议状态：

```text
active
on_hold
withdrawn
closed
archived
```

Screening 的 `screeningStatus`、Assessment 的 `assessmentStatus`、Interview 的 `interviewStatus` 不应全部塞进 Core Record 的单一 status 字段。

### 9.4 乐观锁

所有可编辑主档带有整数 `version`：

```text
读取 version = 4
更新时携带 expectedVersion = 4
数据库当前 version != 4
返回 409 VERSION_CONFLICT
```

禁止用最后写入覆盖其他系统的更新。

## 10. 幂等设计

### 10.1 主档创建

候选人导入：

```text
workspace_id + source + source_record_id
```

Application 创建：

```text
workspace_id + candidate_id + job_id + cycle_id
```

### 10.2 API 幂等

统一使用：

```text
Idempotency-Key
```

服务端保存：

- workspace；
- operation；
- key；
- request hash；
- response；
- createdAt；
- expiration policy。

相同 key、相同请求返回原结果；相同 key、不同请求返回：

```text
409 IDEMPOTENCY_CONFLICT
```

## 11. 事件设计

Core Record 第一阶段可以先实现 Outbox 表和本地发布接口，不必立即引入 Kafka。

事件示例：

```text
candidate.created
candidate.updated
candidate.merged
job.created
job.updated
job.opened
job.closed
application.created
application.status_changed
material.received
material.available
material.invalidated
```

标准 envelope：

```json
{
  "eventId": "event-id",
  "eventType": "application.created",
  "schemaVersion": "1.0",
  "aggregateType": "Application",
  "aggregateId": "application-id",
  "aggregateVersion": 1,
  "workspaceId": "workspace-id",
  "occurredAt": "2026-09-20T00:00:00.000Z",
  "producer": "core-record",
  "correlationId": "correlation-id",
  "payload": {
    "candidateId": "candidate-id",
    "jobId": "job-id",
    "cycleId": "cycle-1"
  }
}
```

事件只发布已经成功提交的事实。业务写入和 Outbox 写入必须在同一个数据库事务中完成。

## 12. 与 Screening 的迁移计划

### Phase 0：契约和所有权冻结

交付：

- Core Record 服务仓库；
- NestJS + PostgreSQL + Prisma 基础结构；
- `core_record` Schema；
- 主档实体和 ID 设计；
- API contract；
- 所有权矩阵；
- 兼容层接口。

验收：

- 不再新增跨模块直接写 Candidate、Job、Application 的代码；
- API contract 可供 Screening 使用；
- 数据库角色和权限方案已确定。

### Phase 1：Core Record 最小服务

交付：

- Candidate CRUD；
- Job CRUD；
- Application create/get/update；
- Material metadata；
- workspace guard；
- health check；
- optimistic locking；
- idempotency；
- AuditRecord。

验收：

- 可以独立启动；
- 可以独立执行 migration；
- 真实 PostgreSQL 集成测试通过；
- Application 幂等创建通过；
- VERSION_CONFLICT 测试通过。

### Phase 2：Screening 兼容适配层

交付：

- Screening `CoreRecordClient`；
- Candidate、Job、Application 的 API client；
- 本地 mock adapter；
- 统一错误映射；
- correlation ID 透传；
- feature flag：

```text
CORE_RECORD_MODE=mock|remote
```

验收：

- mock 模式保持现有 Screening 测试通过；
- remote 模式能够创建和查询主档；
- 失败时不会重复创建 Application；
- Core Record 不可用时错误状态可观察、可重试。

### Phase 3：Screening 单写切换

交付：

- Import 创建 Candidate 改为 Core Record API；
- Jobs 创建/编辑改为 Core Record API；
- Confirm Link 创建 Application 改为 Core Record API；
- Screening 本地表改为保存外部主档 ID；
- 旧写路径改为只读或兼容 fallback。

验收：

- 新数据只写入 Core Record；
- Screening 与 Core Record 的 Candidate、Job、Application 数量和引用一致；
- 重复导入不产生重复 Candidate；
- 并发 Confirm Link 不产生重复 Application。

### Phase 4：数据校验和读取切换

交付：

- 旧表与 Core Record 对账任务；
- 双读结果比对；
- 差异报告；
- 读取来源切换开关；
- 清理无法匹配的历史数据。

验收：

- 所有差异都有明确处理结果；
- Screening 读取主档默认来自 Core Record；
- 历史 Screening Evaluation 的外部引用仍可解析；
- 旧数据不被无提示覆盖。

### Phase 5：Schema 隔离

交付：

- Core Record 表迁移到 `core_record` Schema；
- Screening 私有表迁移到 `screening` Schema；
- 独立数据库角色；
- 只授予所属 Schema 写权限；
- Prisma datasource 和 migration 调整。

验收：

- Screening 数据库角色无法写 Core Record 表；
- Core Record 数据库角色无法写 Screening 私有表；
- 所有业务流程通过 API 或事件完成；
- 迁移可以单独执行和回滚。

### Phase 6：Outbox / Inbox / 事件总线

交付：

- Core Record Outbox；
- Screening Inbox；
- 事件 envelope；
- 重试、死信和消费位点；
- 事件 schema registry；
- 事件重放工具。

验收：

- 数据提交成功但事件发布失败时可以恢复；
- 重复事件不会重复创建业务结果；
- 事件乱序可检测；
- 事件可按 aggregate 重放；
- 消费者不依赖生产者数据库。

## 13. 测试计划

### 13.1 单元测试

覆盖：

- Candidate contract；
- Job contract；
- Application contract；
- 状态转换；
- workspace 隔离；
- idempotency；
- optimistic locking；
- merge 规则；
- Material 状态；
- 错误映射。

### 13.2 集成测试

覆盖：

1. Candidate 创建和查询；
2. Job 创建、关闭和重新打开；
3. Application 幂等创建；
4. 并发 Application 创建；
5. VERSION_CONFLICT；
6. IDEMPOTENCY_CONFLICT；
7. workspace 隔离；
8. Material hash 去重；
9. Material 下载权限；
10. Audit 写入；
11. Outbox 同事务写入；
12. 事件重试和重复消费。

### 13.3 Screening 联调测试

覆盖：

1. Upload 创建 Material；
2. Import 创建 Candidate；
3. Job criteria 继续保存在 JD/Screening 私有域；
4. Confirm Link 通过 Core Record 创建 Application；
5. Screening Evaluation 只引用 Application；
6. Decision 只写 Screening 私有表；
7. Delivery Package 使用稳定主档 ID；
8. 删除或归档主档时，业务结果保留引用但停止新用途。

## 14. 安全和权限

Core Record 是高敏感主档服务，必须默认 fail closed。

要求：

- 生产环境禁止开发身份；
- 所有请求带 workspace context；
- 每个调用方使用 service identity；
- 每个 service identity 只获得所需权限；
- 主档查询执行字段级最小返回；
- 联系方式和文件下载单独授权；
- 日志不记录原始简历正文和完整个人联系方式；
- 合并、删除、归档必须写审计；
- 连接和外部系统凭据不存入通用主档表；
- 任何跨 workspace ID 访问返回统一的 `NOT_FOUND` 或 `ACCESS_DENIED`。

## 15. 可观测性

所有请求至少记录：

```text
request_id
correlation_id
workspace_id
actor_id / service_id
operation
aggregate_type
aggregate_id
duration
status
error_code
```

核心指标：

- API latency；
- 409 version conflict 数量；
- idempotency replay 数量；
- Application duplicate rate；
- Core Record API error rate；
- Outbox backlog；
- 事件发布失败数量；
- 事件消费延迟；
- 主档对账差异数量。

## 16. 项目结构建议

建议新建：

```text
hireos-core-record/
├── docs/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── auth/
│   ├── candidates/
│   ├── jobs/
│   ├── applications/
│   ├── materials/
│   ├── idempotency/
│   ├── outbox/
│   ├── audit/
│   ├── persistence/
│   ├── health/
│   └── main.ts
├── test/
├── .env.example
└── README.md
```

建议沿用当前 Interview 和 Screening backend 的技术栈：

```text
NestJS
PostgreSQL
Prisma
Zod / ValidationPipe
Node test runner
Redis Queue / Streams
```

## 17. 环境配置建议

```env
NODE_ENV=development
HOST=127.0.0.1
PORT=3004
CORS_ORIGIN=http://localhost:5174
DEV_AUTH_ENABLED=true

DATABASE_URL=postgresql://hireos@127.0.0.1:55432/hireos_core_record
DATABASE_SCHEMA=core_record

CORE_RECORD_SERVICE_NAME=core-record
OUTBOX_ENABLED=false
EVENT_BUS_MODE=local
REDIS_URL=redis://127.0.0.1:6379
STORAGE_DIR=.local/materials
```

如果早期与 Screening 共用数据库实例，应使用不同数据库角色或不同 Schema，而不是让两个服务共用 Prisma 用户。

## 18. 完成定义

Core Record Service 达到以下条件，才认为可以作为正式基础设施被其他子系统依赖：

- Candidate、Job、Application 只有一个事实来源；
- Core Record API 可独立部署和迁移；
- workspace 隔离可验证；
- 所有写入有审计；
- Application 创建幂等；
- 并发更新有版本冲突保护；
- Screening 已通过适配层访问主档；
- Core Record 与 Screening 的历史数据已对账；
- 私有 Schema 权限已隔离；
- Outbox 事件不因业务事务失败而丢失；
- API 错误契约和事件契约有版本；
- 真实 PostgreSQL 集成测试和 Screening 联调测试通过；
- 可以在不修改 Screening 私有业务代码的情况下新增 Assessment。

## 19. 当前实现状态

已开始执行 Phase 0，当前已完成：

- 新建独立 `hireos-core-record` NestJS 服务；
- 创建 `hireos_core_record` PostgreSQL 数据库和 `core_record` Schema；
- 完成 Candidate、Job、Application、Material metadata 最小 API；
- 完成 workspace guard、版本号、幂等键、AuditRecord 和 OutboxEvent；
- 完成 422 输入错误、409 幂等冲突和版本冲突响应；
- Screening 增加 `CoreRecordClient` 兼容适配层；
- Screening 的 Candidate、Job 创建已支持 `mock` / `remote` 两种模式；
- 远程模式下 Screening 本地影子记录复用 Core Record 主档 ID；
- Candidate、Job 重复请求可以复用远程主档，不重复插入本地影子记录；
- Screening 与 Core Record 已完成本地 HTTP 联调，验证 workspace、ID 对齐和 Job 状态同步；
- 新增 `RoleDefinitionVersion` 和 `JobRequirementSnapshot`，支持岗位标准版本及 Screening 用途快照；
- 新增岗位标准 API：创建版本、确认版本、生成用途快照；
- 默认仍使用 `CORE_RECORD_MODE=mock`，便于现有功能继续运行。

当前仍未完成：

- Core Record 与 Screening 的双读/单写迁移；
- 外部认证和 service identity；
- Outbox publisher、Inbox 和 Redis Streams；
- Core Record 独立数据库角色权限；
- Candidate merge 和真实对象存储下载。
- JD Backend 的完整草稿协作、审批和发布流程。

## 20. 第一阶段建议

建议下一步执行 Phase 1：

1. 将简历导入创建 Candidate 的远程模式纳入正式联调；
2. 将 Confirm Link 创建 Application 的远程链路纳入正式联调；
3. 为 Screening 增加 Core Record 读状态和依赖可用性检查；
4. 建立 Core Record 与 Screening 旧表的对账脚本；
5. 不立即删除 Screening 当前表，继续维持本地影子投影；
6. 增加真实 PostgreSQL 集成测试，覆盖 Candidate、Job、Application 的幂等和 ID 对齐；
7. 再评估哪些 `Material` / `ResumeVersion` 字段迁移到 Core Record。

第一阶段的核心目标不是“把所有代码搬走”，而是：

> **先建立唯一主档和唯一写入边界，再逐步迁移业务系统。**
