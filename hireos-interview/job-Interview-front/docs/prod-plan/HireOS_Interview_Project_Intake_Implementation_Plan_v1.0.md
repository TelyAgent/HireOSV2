# 新建面试项目与 AI 材料解析实现计划

日期：2026-09-10  
状态：待评审的实施方案；本文不表示功能已经实现。  
范围：第一步 Intake，从新建项目到材料解析、人工核对，并为后续要求与评分标准提供输入。

## 1. 需求依据与结论

依据以下文档及当前前端代码：

- [PRD v1.5](HireOS_Command_Interview_PRD_v1.5.md)：需求基线，重点为 3.4、4、5、8.7；与旧接口规范冲突时优先。
- [Interface Spec v1.0](HireOS_Command_Interview_Interface_Spec_v1.0.md)：参考版本快照、来源引用、幂等与对象边界，不沿用独立模式必须有 Application/Candidate 的旧门槛。
- [Prototype Design Brief](HireOS_Command_Interview_Prototype_Design_Brief_v1.0.md)：JD-only 路径、三种来源、人工确认。
- [公司邮箱与面试流程](HiOS_Command_Company_Email_and_Interview_Flow_v1.0.md)：本地案件、材料存储、授权邮箱及去重；其中邮件请求建议字段不增加手动创建门槛。

**JD 是唯一必填业务材料。简历、筛选报告、测评报告均可后补。AI 用于理解和结构化材料，不负责决定能否录用，也不是保存项目草稿的前置条件。**

实现采用两层处理：先将 PDF/DOCX/TXT 转为可定位的文字，再由 AI 提取结构化岗位信息或候选人自述。岗位要求提取、Rubric 生成仍由现有页面入口触发，不能在点击“创建项目”时自动视为已确认。

## 2. 当前实现与缺口

| 位置 | 当前行为 | 本阶段改造 |
|---|---|---|
| `src/components/Modals.tsx` / CreateProjectModal | 校验 jdText，批量设置全局模拟状态并跳转 | 上传、保存真实项目、处理提交状态 |
| JD 文件选择 | TXT 本地读取；PDF/DOCX 仅保存文件名 | 后端实际提取文字、显示失败与重试 |
| 候选材料 | 仅保存 name/key | 保存材料 ID、类型、上传和解析状态 |
| `src/pages/ProjectA.tsx` | 从 JD 首行取岗位名；要求提取写入布尔值 | 使用项目快照与真实解析结果 |
| `src/pages/Home.tsx` | 示例项目与模拟草稿 | 接入真实项目列表，保证刷新后可恢复 |
| 路由与 Store | 项目页面没有 projectId，共享项目状态 | 引入项目 ID；项目数据按 ID 获取 |
| `backend/src` | NestJS 配置、校验和健康检查 | 增加材料、项目、解析任务与 AI 模块 |

沿用当前弹窗尺寸、排版、配色、三种入口和中英文体系。仅在现有材料区域补齐必要状态和核对交互，不重新设计页面。

## 3. 分期边界

### 本阶段交付

1. 粘贴 JD，或上传一个 JD 文件；支持 PDF、DOCX、TXT，单文件最大 10 MB，与现有提示一致。
2. 可选上传简历、筛选报告和测评材料；材料类型允许人工指定或纠正。
3. 创建并持久化独立项目，返回稳定 projectId。
4. JD 和简历的异步结构化解析、来源追溯、核对与保存。
5. 项目列表、总览、材料状态恢复，以及已有要求提取入口的真实数据衔接。
6. 上传、解析失败可重试；AI 不可用时可保存草稿并人工补录。

### 后续阶段

- 邮箱 OAuth、邮件持续监控、文件夹连接及自动扫描。保留现有入口，未接通时明确展示未连接，不能伪装导入成功。
- 筛选/测评报告的深度证据归一化、候选人与岗位匹配评分。
- Rubric 行为锚点与权重生成、面试计划、排期、实时面试及后续评估。第一阶段只准备可追溯岗位要求输入；不默认生成正式评分标准。
- 完整账号管理和跨模块平台化。真实多用户运行前必须具备有效身份与 Workspace 授权。

扫描 PDF 第一版识别为“需要 OCR”，提示提供可复制文字或文本版文件；OCR 接入单独验收，不能把空文本当作成功。

## 4. 用户流程与输入规则

### 4.1 手动创建

1. 打开现有弹窗。示例 JD 只作为 placeholder，不作为用户已提交的数据。
2. 粘贴文字或选择 JD 文件。文件选择后上传，服务端提取文字；可查看提取结果。
3. 可选添加候选材料，逐项显示上传状态，支持移除与重试。
4. 点击创建，服务端事务保存项目、JD 来源快照、材料关联和后台任务记录。
5. 返回 projectId 后关闭弹窗，进入 `/projects/:projectId/overview`。
6. 后台完成 JD 基础信息与简历解析，总览显示待核对信息；刷新页面仍能看到任务状态。
7. 用户核对并保存。后续从现有“从 JD 中提取要求”入口生成要求草稿，另行编辑确认。

### 4.2 明确的输入策略

- JD 文本与 JD 文件至少提供一种；不能仅凭一个文件名创建有效 JD。
- 文件仍在上传时不能提交其引用。文件已保存但文字提取未完成时允许保存草稿，总览显示处理中。
- 同时存在文本与文件时，默认以用户当前编辑的文本作为有效 JD；显示这一来源选择，原文件作为附件保留，不静默拼接。文件提取结果不得覆盖已编辑文本。
- 无可读文字的文件可保留在草稿中，但必须标记 JD 待修复，不进入要求提取；用户可粘贴文字修复。
- 简历失败不阻塞 JD-only 流程；创建时须明确移除失败附件或保留其失败状态，不能丢失用户所选材料而宣称全部成功。
- 多份简历不自动合并为同一人。歧义进入待核对；仅在人工确认后关联候选人。
- 创建项目与候选人联系信息确认分开；不发送任何邀请或邮件。

## 5. AI 处理契约

### 5.1 文件层与语义层分开

| 环节 | 职责 | 结果 |
|---|---|---|
| 文件校验 | 类型、内容签名、大小、可读性、Workspace 权限 | 合法材料或明确错误 |
| 文字提取 | PDF 文本层、DOCX 段落、TXT 编码处理 | 原文分段及页码/段落位置 |
| JD 解析 | 岗位名称、团队、地点、职责、明确要求、缺失项 | RoleSnapshot 草稿 |
| 简历解析 | 姓名、联系方式、工作经历、教育、技能、自述成果 | CandidateSnapshot 草稿及 claims |
| 人工核对 | 修正字段、确认材料归属、保留修改记录 | 新人工版本 |

PDF/DOCX 解析器在实施时用真实样本验证后锁定依赖版本。TXT 不需要 AI 才能读取；扫描件需要 OCR 才能进入相同的语义管线。

### 5.2 结构化输出

公共字段：`schemaVersion`、`sourceVersion`、`language`、`warnings`、`missingFields`。

JD 草稿：`title`、`department`、`location`、`employmentType`、`seniority`、`responsibilities[]`、`requirements[]`。每条要求保存 `text`、`category`、`explicitness`、`sourceRefs[]`。原文没有说明的 must-have、年限、权重不得自行补全；建议项必须另列为 AI 建议。

简历草稿：`name`、`emails[]`、`phones[]`、`experiences[]`、`education[]`、`skills[]`、`claims[]`。缺失标量为 null，缺失集合为空数组；日期允许仅有年份或年月，不补造具体日期。

来源引用：`artifactId` 或 `textRevisionId`、`segmentId`、`quote`，有页码时附 `page`。后端检查 segment 存在且引用文字与原文匹配，无法验证的内容标记待核对，不进入已确认事实。

简历描述默认是 `self_reported`；抽取成功不等于能力已验证。不得推断性别、种族、健康、人格等敏感特征，也不产生录用/淘汰决定。

### 5.3 模型接入与失败处理

- 后端定义 `AiProvider` 接口，提供 JD 和简历结构化解析能力；具体供应商、模型和凭证尚未确定，不在本计划中虚构配置。
- 用固定 JSON Schema 校验输出，拒绝无效字段和类型。即使供应商支持结构化输出，服务端仍校验。
- 文档内容作为不可信数据，文档中的“忽略指令”等文字不能变成系统指令。解析任务不开启工具调用或任意 URL 访问。
- 按段切分长文档，保留段落 ID；超过限制须明确提示，不能静默截断简历末尾。
- 暂定单次模型请求 60 秒超时，可重试错误最多自动重试 2 次；限流采用退避，拒答及输入错误不盲目重试。值在联调后调整。
- 记录模型标识、prompt/schema 版本、输入摘要、耗时、用量、尝试次数；日志不记录完整简历和密钥。
- AI 原始结果和人工修改版本独立保存；新解析结果不覆盖已人工确认版本。
- 不把模型自报 confidence 当作可靠概率；以来源可验证、缺失和冲突状态表达质量。

## 6. 后端架构与存储

采用 NestJS 模块化单体，后台任务与 API 可使用同一代码库、不同进程运行。

| 模块 | 责任 |
|---|---|
| ProjectsModule | 创建、查询、项目权限、材料关联、快照版本 |
| MaterialsModule | 上传、文件元数据、访问、来源及文字提取 |
| ParsingModule | 持久化任务、重试、状态、任务结果应用 |
| AiModule | 供应商适配、提示词、Schema 校验、用量记录 |
| PersistenceModule | 数据访问、事务和迁移 |

建议使用关系型数据库保存项目、来源与版本；以 PostgreSQL 为实施默认提案，ORM 在后端实际落地前结合参考项目确认。文件内容通过 Storage 接口保存：开发可用私有本地目录，部署使用私有对象存储。数据库仅保存存储键和元数据。

上传使用当前 NestJS Express 适配器的 multipart 接口；官方方案基于 Multer，支持文件拦截与校验，见 [NestJS File upload](https://docs.nestjs.com/techniques/file-upload)。文件大小必须在接收阶段限制，不能完全读入后才判断。

后台任务第一版采用数据库持久化任务与租约领取，包含超时回收、重试时间和唯一任务键，避免仅用进程内 Promise。若参考后端已有成熟队列则直接复用；不同时维护两套调度实现。写项目与写任务同一事务提交，防止项目创建成功却没有解析任务。

### 最小实体

| 实体 | 关键字段 |
|---|---|
| InterviewProject | id、workspaceId、createdBy、status=draft、candidateId 可空、activeJdRevisionId、version |
| Material | id、workspaceId、storageKey、name、mime、size、sha256、sourceType、readStatus |
| ProjectMaterial | projectId、materialId、kind、consumptionStatus |
| TextRevision | id、projectId/materialId、text、segments、hash、version |
| ParseJob | id、workspaceId、targetRef、inputVersion、type、status、attempt、leaseUntil、nextRunAt、errorCode |
| ParseResult | jobId、schemaVersion、model、promptVersion、payload、sourceRefs |
| RoleSnapshot / CandidateSnapshot | projectId、version、origin=ai/human、payload、reviewStatus、sourceResultId |
| AuditEvent | actorId、workspaceId、subjectId、action、version、timestamp |

InterviewProject 对应邮件文档中的本地 InterviewCase，本阶段统一一个实体，避免重复建模。Application 和上游 Candidate ID 均为可空映射。

同 Workspace 文件内容可按摘要去重，但项目材料关联独立；不得跨租户泄露文件是否存在。临时未关联上传采用可配置过期清理，创建期间的材料不能被清理任务删除。

## 7. 建议 API 与状态

以下为新增接口提案，不是现有 Interface Spec 已定义的 API。

| 方法与路径 | 作用 |
|---|---|
| POST `/api/materials` | multipart 上传，返回 materialId 与读取状态 |
| GET `/api/materials/:id` | 查询材料元数据及授权后的提取结果 |
| POST `/api/projects` | 保存 JD 文本/材料引用、可选附件；返回 projectId、version、taskIds |
| GET `/api/projects` | 查询当前 Workspace 可见项目列表 |
| GET `/api/projects/:id` | 总览、快照、材料与任务摘要 |
| POST `/api/projects/:id/materials` | 后补材料，按类型建立解析任务 |
| GET `/api/parsing-jobs/:id` | 查询异步任务状态 |
| POST `/api/parsing-jobs/:id/retry` | 对失败任务创建新尝试 |
| PATCH `/api/projects/:id/intake` | 带 version 保存人工核对字段或修复 JD |
| POST `/api/projects/:id/requirements-extractions` | 现有按钮的后续衔接接口，生成要求草稿 |

创建参数包括 `jd: {text?, materialId?, effectiveSource}`、`materials: [{materialId, kind}]`，来源互斥规则在服务端校验。Workspace 和操作者从认证上下文获取，不信任请求体自报。

创建使用 `Idempotency-Key`：相同用户/Workspace/键和相同请求返回原项目，不同请求内容返回 409。提交超时后前端用原键重试；输入改变后生成新键。

解析状态：`queued → extracting_text → parsing → succeeded | needs_review | failed`；纯文本可跳过 extracting_text。项目生命周期与解析状态分开，AI 失败不删除项目。材料读取状态与业务消费状态独立，满足 PRD 8.7。

更新 JD 后旧任务结果仍留档，仅当任务输入版本匹配当前版本时才能成为当前结果。人工保存使用乐观锁，冲突返回 409，避免覆盖。

统一错误返回 `code`、`retryable`、`fieldErrors`、`requestId`；前端按 code 翻译。至少覆盖 JD_REQUIRED、FILE_TOO_LARGE、UNSUPPORTED_FILE_TYPE、NO_EXTRACTABLE_TEXT、OCR_REQUIRED、AI_TIMEOUT、AI_OUTPUT_INVALID、VERSION_CONFLICT。

## 8. 前端接入计划

- 将 CreateProjectModal 中表单逻辑拆到 `features/project-intake`，保留现有展示样式；提取 JDInput、MaterialUploadList 和 useCreateProject。
- 增加类型化 API 层。表单状态局部管理，文件通过 materialId 引用；现有 Store 保留语言、外观等 UI 偏好。
- 引入 `/projects/:projectId/*` 路由并更新首页链接。旧演示页面与真实项目数据明确分开，未知 ID 显示未找到，不能回退到示例候选人。
- 总览读取真实标题、候选人关联和材料；其他未接通页面不得为新项目显示示例完成轮次、分数和结论。
- 初期轮询任务状态，建议 2 秒间隔、页面隐藏时暂停，终态停止；刷新后重新读取服务端状态。
- 核对信息放在现有总览/材料区域，包含来源、待确认字段和保存入口；候选人联系方式经人工确认后才可用于未来邀请。
- 新增状态、错误、无候选人、失败重试等文案统一纳入中英文词典。切换语言不重新提交或解析资料，也不改写原文。
- 上传中、提交中禁重复操作；提交失败保留输入；取消弹窗不宣称撤销已经创建的项目。

## 9. 实施顺序与验收

| 阶段 | 工作 | 完成条件 |
|---|---|---|
| A：数据基础 | 持久化、最小权限上下文、项目 API、projectId 路由 | JD 文本创建后刷新可恢复，项目互不串数据 |
| B：真实文件 | 上传、校验、文本提取、来源、失败状态 | PDF/DOCX/TXT 可处理，坏文件/OCR 有明确反馈 |
| C：AI 解析 | Provider、Schema、任务、版本、JD/简历结果 | 真实输入产生可追溯草稿，可重试且不覆盖人工结果 |
| D：前端闭环 | 弹窗、列表、总览、人工核对、全局语言 | JD-only 和 JD+简历均可完成创建与核对 |
| E：回归与交接 | 端到端验证、配置说明、接口文档 | 满足下列验收，才进入 Rubric 与面试计划阶段 |

关键验收场景：

1. 只有 JD 可创建，候选人为未关联，未生成虚假简历/测评结果。
2. JD 文本、PDF、DOCX、TXT 分别成功；空文件、伪造扩展名、超限和扫描件有明确结果。
3. 简历提取保留工作经历和来源，缺失字段为 null，自述不变成已验证证据。
4. 连续点击、请求超时重试只创建一个项目；相同幂等键不同内容返回冲突。
5. AI 超时、拒答、无效 JSON 后项目仍存在，可人工继续或重试。
6. 进程重启后任务恢复；旧 JD 的慢任务不能覆盖新版 JD；人工版本不能被异步结果覆盖。
7. 跨 Workspace 查询项目、文件、任务均被拒绝；开发模拟身份不能用于生产授权。
8. 长文档尾部内容不静默丢失；简历内嵌指令不改变解析规则。
9. 创建两个不同岗位项目，列表、总览、刷新和深链接保持数据隔离。
10. 中英文切换覆盖所有新增状态，保持现有弹窗外观与布局；用浏览器截图核对。

测试分层：文件/Schema/状态迁移单元测试；创建事务、幂等、权限和任务恢复集成测试；JD-only 与 JD+简历浏览器流程测试。AI 离线回归使用虚构中英文样本与固定预期字段，真实供应商冒烟测试单独运行，不上传真实简历作为默认测试数据。

## 10. 实施前配置项

本计划可用于开始 A、B 阶段；以下配置在相关阶段接入前落实：

- 数据库连接及参考后端的数据访问、任务约定。
- AI 供应商、模型、凭证、允许的数据处理区域与用量上限。
- 文件存储位置、临时材料过期时间和正式材料保留配置。
- 身份来源及 Workspace 获取方式；本地可使用明确的开发用户，生产必须校验真实身份。
- OCR 与邮件/文件夹供应商待后续阶段确定，不阻塞手动 JD-only 创建。

本次交付仅为实施计划，未修改业务代码或接通任何外部服务。
