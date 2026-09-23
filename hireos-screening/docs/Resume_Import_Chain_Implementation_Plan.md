# Resume Import Chain Implementation Plan

## 1. 文档目的

本文是 `hireos-screening` 简历导入链路的专项实现计划。

目标是把当前已经存在的“文件上传、材料保存、候选人创建、简历解析”基础能力，补充为一条可追踪、可重试、可审计、支持人工确认的完整业务链路：

```text
接收来源
  -> 上传与来源校验
  -> 安全检查
  -> 保存原始材料
  -> 内容提取
  -> 精确去重
  -> 相似简历识别
  -> 身份确认
  -> 创建或复用 Candidate
  -> 创建 ResumeVersion
  -> 解析 CandidateProfile
  -> 资料审核
  -> 匹配已确认的开放岗位
  -> 生成岗位推荐
  -> 人工确认岗位关系
  -> 创建 Application
  -> 进入正式 Screening
```

本计划依据：

- `hireos-screening/docs/Resume_Screening_PRD_v1.3.md`
- `hireos-screening/docs/Resume_Screening_Interface_Spec_v1.1.md`
- `hireos-screening/docs/Resume_Screening_Prototype_Design_Brief_v1.0.md`
- `hireos-screening/docs/Resume_Screening_Backend_Implementation_Plan.md`
- 当前 `hireos-screening-backend` 和 `hireos-screening-front` 的实际实现

## 2. 实施原则

### 2.1 材料、候选人和岗位关系必须分离

三个对象具有不同的生命周期：

| 对象 | 含义 | 是否可以独立存在 |
|---|---|---|
| Material | 上传的原始文件或来源材料 | 可以 |
| Candidate | 被识别出的自然人 | 可以 |
| Application | 候选人与岗位之间已经被人工确认的正式关系 | 不应自动创建 |

上传简历不能直接创建 Application。

### 2.2 读取成功不等于业务导入成功

系统必须区分以下状态：

```text
材料是否已经保存
材料是否可以读取
材料是否已经完成解析
是否已经识别候选人
是否已经生成候选人资料
是否已经完成岗位推荐
是否已经人工确认岗位关系
```

例如：

```text
文件保存成功
  -> 文本提取失败
  -> Material = Available
  -> Profile = Failed
  -> Import business consumption = Failed
```

此时不能把整个导入项标记为“已处理”，也不能重复上传原始材料来重试解析。

### 2.3 AI 只能产生提案，人工确认才能产生业务关系

以下结果都不能自动等价为最终业务决定：

- AI 认为是同一个人；
- AI 认为候选人适合某个岗位；
- AI 认为候选人不适合某个岗位；
- AI 建议创建 Application；
- AI 建议合并两个 Candidate。

这些结果必须进入人工审核或人工确认任务。

## 3. 当前实现基线

### 3.1 已有能力

当前后端已经具备以下基础：

- `POST /api/imports` 多文件上传；
- PDF、DOCX、TXT 基础格式校验；
- 文件大小和文件头校验；
- 服务端私有目录保存原始文件；
- 文件内容 Hash；
- 文本提取和段落切分；
- `Material`、`Candidate`、`LibraryEntry`、`ResumeVersion` 创建；
- `ProcessingJob` 简历解析队列；
- `DuplicateCheck` 查询和处理接口；
- 候选人详情聚合；
- 前端导入页和统一接收箱基础界面。

主要实现位置：

- [intake.controller.ts](/Users/qmk/work/HireOS/hireos-screening/hireos-screening-backend/src/intake/intake.controller.ts)
- [imports.service.ts](/Users/qmk/work/HireOS/hireos-screening/hireos-screening-backend/src/intake/imports.service.ts)
- [materials.service.ts](/Users/qmk/work/HireOS/hireos-screening/hireos-screening-backend/src/intake/materials.service.ts)
- [duplicates.service.ts](/Users/qmk/work/HireOS/hireos-screening/hireos-screening-backend/src/duplicates/duplicates.service.ts)
- [profiles.service.ts](/Users/qmk/work/HireOS/hireos-screening/hireos-screening-backend/src/profiles/profiles.service.ts)

### 3.2 当前主要缺口

当前实现还存在以下业务缺口：

1. 安全校验状态仍然是占位状态，不能真正区分通过、隔离和失败。
2. `ImportBatch` 和 `ImportItem` 状态粒度不足，无法表达每一个阶段。
3. 上传批次主要同步处理，缺少稳定的操作记录、重试和取消能力。
4. 精确 Hash 去重存在，但规范化文本去重和身份判断仍然较弱。
5. DuplicateCheck 创建后没有自动生成对应的人工任务。
6. 导入失败后的重试接口不完整，前端重试仍有本地模拟逻辑。
7. 邮箱、文件夹、API 导入入口尚未统一接入真实材料接收管线。
8. 简历解析成功后，没有稳定触发岗位发现和推荐。
9. Candidate owner、审核任务 assignee、岗位推荐确认人没有清晰分层。
10. 预览、下载、重试、取消和来源读取缺少统一 Activity 记录。

## 4. 目标状态模型

### 4.1 导入项状态

每个文件或来源项目应独立拥有以下状态：

```text
received
  -> validating
  -> rejected
  -> quarantined
  -> stored
  -> extracting
  -> extracted
  -> duplicate
  -> needs_identity_review
  -> candidate_created
  -> profile_processing
  -> profile_ready
  -> matching
  -> recommendations_ready
  -> completed
```

任何阶段都可能进入：

```text
failed
cancelled
```

重试时只能从可重试的失败阶段继续，不能重复创建已经成功的实体。

### 4.2 状态轴分离

系统至少需要分别记录以下状态轴：

| 状态轴 | 关注点 |
|---|---|
| Connection | 邮箱或文件夹连接是否授权、是否可用 |
| Read / Scan | 是否已经从来源读取或扫描 |
| Material | 原始材料是否保存、是否可预览 |
| Extraction | 内容是否成功提取 |
| Identity | 是否已经识别或确认 Candidate |
| Profile | CandidateProfile 是否生成 |
| Business Import | 是否已经完成 Screening 业务消费 |
| Matching | 是否已经完成岗位发现 |
| Human Task | 是否还有人工确认任务 |
| Audit | 所有操作和状态变更是否可追踪 |

不能用一个 `status` 字段代替所有状态轴。

## 5. 目标模块边界

### 5.1 Intake / Materials

职责：

- 接收手动上传、粘贴、邮箱、文件夹和 API 输入；
- 校验来源和文件；
- 保存原始材料；
- 生成内容 Hash；
- 提取文本和段落；
- 记录读取状态；
- 生成统一 `MaterialEnvelope`；
- 发布后续处理任务。

不负责：

- 自动决定候选人是否属于某个岗位；
- 自动创建 Application；
- 自动合并 Candidate。

### 5.2 Identity / Duplicates

职责：

- 精确文件去重；
- 规范化文本去重；
- 联系方式和身份信号分析；
- 创建 DuplicateCheck；
- 创建身份确认任务；
- 执行人工确认后的复用、合并或新建。

### 5.3 Profile Processing

职责：

- 生成 ResumeVersion；
- 解析 CandidateProfile；
- 保存字段级证据；
- 记录解析器和版本；
- 处理失败、重试和人工修正；
- 在资料达到可匹配状态后触发岗位发现。

### 5.4 Assignment / Tasks

“分配”拆为三种业务：

1. Candidate 负责人分配：维护候选人资料的 owner。
2. 人工任务分配：重复审核、身份确认、资料审核、推荐确认等任务的 assignee。
3. 岗位关系确认：通过 Recommendation 和 LinkDecision 建立岗位关系，最终创建 Application。

这三者不能共用一个 `assigneeId` 或一个状态字段。

### 5.5 Discovery / Recommendation

职责：

- 仅读取已确认、已开放、当前工作区可访问的岗位；
- 使用候选人 Profile 和岗位标准进行预匹配；
- 生成 PreLinkMatchEvaluation；
- 生成 CandidateJobRecommendation；
- 生成推荐确认任务；
- 在候选人或岗位版本变化时使旧推荐失效。

## 6. 数据模型实施计划

### 6.1 Material 扩展

在现有 `Material` 基础上补充：

```text
sourceType
sourceRef
sourceVersion
parentMaterialId
securityStatus
securityErrorCode
previewStatus
downloadStatus
storedAt
extractedAt
```

建议增加数据库约束：

```text
unique(workspaceId, hash)
```

防止并发上传相同文件时重复创建材料。

### 6.2 ImportBatch / ImportItem 扩展

建议补充：

```text
operationId
sourceType
sourceRef
stage
status
errorCode
errorMessage
retryable
attemptCount
lastAttemptAt
completedAt
duplicateOfMaterialId
businessConsumeStatus
```

`ImportBatch` 负责批次聚合状态，`ImportItem` 负责每个文件或来源项目的独立状态。

批次状态建议为：

```text
received
processing
completed
partial
failed
cancelled
```

### 6.3 操作与尝试记录

建议新增或统一以下模型：

```text
IngestionOperation
IngestionAttempt
ActivityEvent
```

至少记录：

```text
operationId
batchId
itemId
workspaceId
actorId
sourceType
stage
status
attempt
idempotencyKey
errorCode
startedAt
finishedAt
```

### 6.4 Candidate 和任务

保留：

```text
LibraryEntry.ownerId
```

作为候选人资料负责人。

使用 `HumanTask` 表示需要人工完成的动作，并补充任务关联字段：

```text
candidateId
materialId
resumeVersionId
duplicateReviewId
recommendationId
assigneeId
taskType
priority
dueAt
```

不建议在 Candidate 上直接添加 `jobId`，候选人与岗位的关系应继续通过：

```text
CandidateJobRecommendation
  -> LinkDecision
  -> Application
```

## 7. API 实施计划

### 7.1 上传与批次

保留并增强：

```http
POST /api/imports
GET  /api/imports/:id
GET  /api/intake
```

建议新增：

```http
POST /api/imports/:id/retry
POST /api/import-items/:id/retry
POST /api/imports/:id/cancel
GET  /api/imports/:id/activity
```

上传接口需要支持：

- `Idempotency-Key`；
- 批次级返回；
- 单文件独立结果；
- 错误码；
- 是否可重试；
- 后续任务 ID；
- 材料 ID 和导入项 ID。

### 7.2 材料访问

现有材料详情接口不应默认返回全部原始文本或内部存储信息。

建议拆分：

```http
GET /api/materials/:id
GET /api/materials/:id/preview
GET /api/materials/:id/download
GET /api/materials/:id/activity
```

要求：

- 所有访问都校验 workspace；
- 不返回 `storageKey`；
- 预览和下载写入 Activity；
- 下载状态独立于材料读取状态；
- 不允许前端通过内部文件路径访问原文件。

### 7.3 去重与身份确认

保留并增强：

```http
GET  /api/duplicates/:id
POST /api/duplicates/:id/resolve
```

建议新增：

```http
GET /api/duplicates
POST /api/duplicates/:id/assign
```

处理结果至少包括：

```text
same_person_new_version
different_person
reuse_file
needs_more_information
defer
```

处理动作必须具备幂等性，并记录 actor、理由和证据。

### 7.4 任务和分配

建议补充：

```http
GET  /api/tasks
POST /api/tasks/:id/claim
POST /api/tasks/:id/assign
POST /api/tasks/:id/complete
POST /api/tasks/:id/defer
```

重复审核、资料审核和推荐确认都应通过任务接口完成，不在前端直接修改候选人或岗位关系。

## 8. 分阶段实施

## Phase 0：契约和数据库准备

目标：先固定状态和数据边界，避免后续重复返工。

工作项：

- 确认 ImportBatch、ImportItem、Material、ResumeVersion、HumanTask 状态；
- 增加错误码字典；
- 增加 `Material` Hash 唯一约束；
- 确定 `MaterialEnvelope`；
- 确定幂等键规则；
- 确定 ActivityEvent 字段；
- 确认本地存储目录和生产对象存储迁移边界。

验收：

- 状态值有单一来源；
- 每个导入项可以表达“已保存但业务消费失败”；
- 所有新增状态可以映射到前端展示。

## Phase 1：上传链路基础加固

目标：让手动上传链路真实可靠。

工作项：

- 增加 MIME、扩展名、文件头、大小和内容校验；
- 增加安全扫描适配层；
- 增加隔离状态；
- 完成批次异步处理；
- 增加导入项重试；
- 增加批次取消；
- 增加失败阶段恢复；
- 增加操作和尝试记录；
- 增加真实进度查询；
- 将前端 retry 从本地模拟切换到真实 API。

验收：

- 一个批次内可以同时出现成功、失败、重复和待审核；
- 重试失败项不会重新创建已成功的 Candidate；
- 读取失败不会进入 AI 解析；
- 相同文件重复上传不会创建重复材料；
- 批次页面刷新后进度仍然存在。

## Phase 2：去重和身份确认

目标：把重复简历处理从“提示”升级为可执行人工工作流。

工作项：

- 增加规范化文本 Hash；
- 增加邮箱、电话、姓名和经历信号；
- 为相似结果生成置信度和证据；
- 自动创建 Duplicate Review 任务；
- 实现任务领取、分配、延后和完成；
- 完善 same person / different person / reuse file 事务；
- 为合并和拆分写入审计；
- 处理并发身份决策。

验收：

- 同文件、同内容异格式、同人新版本分别得到不同结果；
- 仅凭姓名不能自动合并；
- 重复审核完成后只产生一个正确的 Candidate 关系；
- 所有处理动作可以在 Activity 中还原。

## Phase 3：Profile 解析和资料审核

目标：建立稳定的 CandidateProfile 生成和人工修正闭环。

工作项：

- 补充解析任务重试；
- 保存解析器版本；
- 保存字段级证据；
- 增加解析结果完整度；
- 增加人工资料审核任务；
- 支持缺失字段和待确认字段；
- 保存人工修正历史；
- 修复手动粘贴入口字段丢失问题；
- 解析成功后发布 ProfileReady 事件或调用匹配调度。

验收：

- ResumeVersion 和 CandidateProfile 版本可追溯；
- 解析失败只重试解析，不重新上传文件；
- 资料不足显示 `insufficient_data`，不显示为候选人不合格；
- 人工修改不覆盖原始材料和原始解析结果。

## Phase 4：岗位发现、推荐和人工确认

目标：把上传简历连接到岗位推荐，但不越过人工确认边界。

工作项：

- 解析成功后自动触发 JobDiscoveryRun；
- 只使用已确认的 RoleDefinitionVersion；
- 只匹配开放且当前工作区可访问的岗位；
- 生成 PreLinkMatchEvaluation；
- 生成 CandidateJobRecommendation；
- 生成推荐确认任务；
- 处理 `no_match`、`no_open_jobs`、`insufficient_data`、`failed`；
- 新 CandidateProfile 或岗位版本产生后使旧推荐失效；
- 人工确认后再创建 Application。

验收：

- 简历上传不会直接创建 Application；
- 草稿岗位不会产生正式推荐；
- 推荐结果有版本和来源；
- 推荐确认、岗位关联和下一步决定是不同动作；
- 新简历版本不会覆盖历史推荐。

## Phase 5：邮箱、文件夹和 API 来源

目标：让多个来源复用同一条材料接收管线。

工作项：

- 实现邮箱读取适配器；
- 区分邮件正文和附件；
- 保存原始 Message ID；
- 实现文件夹初始扫描和增量扫描；
- 保存扫描 checkpoint；
- 文件更新时创建新 Material 版本；
- 实现 API 导入幂等；
- 处理授权过期、断线和重连；
- 所有来源统一输出 `MaterialEnvelope`。

验收：

- 不同来源不会各自创建一套 Candidate 逻辑；
- 同一个来源项目重复读取不会重复创建材料；
- 来源读取失败可以重试读取；
- 业务消费失败只重试业务消费；
- 原始来源不会被系统修改或删除。

## Phase 6：前端真实业务闭环

目标：让导入页面完整反映服务端状态。

工作项：

- 上传进度和 Activity 历史分离；
- 显示每个文件的校验、保存、解析、去重和业务消费状态；
- 显示可重试原因；
- 支持单文件重试和批次重试；
- 增加 Duplicate Review 任务入口；
- 增加 Candidate owner 和任务 assignee；
- 增加 Profile 审核入口；
- 增加岗位推荐确认入口；
- 邮箱、文件夹、API Tab 切换到真实接口；
- 统一接收箱支持按来源、状态和批次过滤。

## 9. 测试计划

### 9.1 单元测试

- 文件类型、大小和文件头校验；
- PDF、DOCX、TXT 提取；
- 文件 Hash 和规范化文本 Hash；
- 去重信号计算；
- 导入状态转换；
- 重试和取消规则；
- 幂等键；
- 推荐状态失效；
- Application 创建前的人工确认校验。

### 9.2 集成测试

- 多文件批次部分成功；
- 相同文件并发上传；
- 读取成功但业务消费失败；
- 解析失败后单独重试；
- DuplicateCheck 处理事务；
- CandidateProfile 解析完成后触发岗位发现；
- 新简历版本使旧推荐失效；
- workspace 隔离；
- 材料预览和下载权限。

### 9.3 端到端验收场景

至少覆盖：

1. 上传一个有效 PDF，完成候选人创建和资料解析。
2. 同一文件重复上传，不创建重复 Candidate。
3. 同一个人上传新版本，进入身份确认。
4. 两个不同人使用相同姓名，不自动合并。
5. 批量上传时部分文件格式错误。
6. 文件保存成功但解析失败，只重试解析。
7. 解析完成后只对已确认开放岗位生成推荐。
8. 推荐未确认前不创建 Application。
9. 邮件正文和多个附件都能追踪到同一来源消息。
10. 文件夹中的更新文件生成新的材料版本。
11. 页面刷新后批次进度和历史记录不丢失。
12. 所有上传、预览、下载、重试和人工决定可在 Activity 中追溯。

## 10. 非目标

本计划暂不包含：

- 自动替代招聘人员做最终录用决定；
- 仅凭 AI 结果自动合并候选人；
- 未经人工确认自动创建 Application；
- 将所有简历永久保存到数据库字段；
- 前端直接访问服务器文件路径；
- 在没有授权的情况下读取邮箱或本地文件夹；
- 让草稿岗位参与正式候选人匹配；
- 立即接入真实 OCR、病毒扫描或邮件供应商。

供应商能力应通过适配器接入，不应改变核心 Intake 和 Material 契约。

## 11. 推荐执行顺序

建议实际开发顺序如下：

```text
Phase 0
  -> Phase 1
  -> Phase 2
  -> Phase 3
  -> Phase 4
  -> Phase 5
  -> Phase 6
```

其中 Phase 1、Phase 2 和 Phase 3 是后续岗位匹配的基础。没有稳定的材料状态、身份判断和 Profile 版本，直接开发岗位推荐会造成重复候选人、错误推荐和无法重试的问题。

第一批建议直接实现：

1. `ImportItem` 状态机和错误码；
2. Material Hash 唯一约束；
3. 上传批次操作记录；
4. 单项重试和批次取消；
5. 安全校验适配层；
6. Duplicate Review 自动任务；
7. 前端真实重试和刷新恢复；
8. Material 预览、下载和 Activity 权限边界。

完成这批后，再进入身份确认和岗位推荐，不会因为上游状态不可靠而反复修改下游业务。
