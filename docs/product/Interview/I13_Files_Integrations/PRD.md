# I13 产品文档：Files & Integrations

| 项 | 内容 |
|---|---|
| 模块 | I13 / 公共能力 SHARED-04、05、06、07（当前在 Interview 就地定义，后续统一抽取） |
| 版本 / 日期 | v1.0 / 2026-10-14（草稿，待评审） |
| 主角色 | HR / Recruiter；有管理权限的人员查看 Workspace 范围历史 |
| 原型页面 | 左侧栏 `Files and integrations` → Files / Connections / Activity 三个标签；上传进度面板；文件详情面板（[原型](../../../design/Interview/index.html)） |
| 实现现状 | ❌ 后端只有 `POST materials` 单文件上传（PDF / DOCX / TXT，存入 Core Record）和 `GET materials/:id`；邮件读取、文件夹监控、下载、批次、操作历史、重试均未实现。前端没有 Files 页面。材料主档迁移计划见 `hireos-interview/docs/材料主档统一到CoreRecord-迁移计划.md`。未逐项验证 AC |
| 依据 | [PRD v1.5 §3.8、§8.7、§9、§6 INT-23–26、§12.2](../HireOS_Command_Interview_PRD_v1.5.md) |

## 1. 背景与目标

面试材料来自手工上传、邮箱和共享文件夹。如果每个业务模块各写一套上传、读取和下载，状态口径会不一致；如果把「文件读取成功」等同于「业务导入成功」，失败会被掩盖。

**目标**：一个小型、独立、可复用的材料接入模块，负责上传、下载、邮件读取、文件夹监控和统一操作历史；不依赖任何面试项目或上下游模块存在；材料可用、业务消费、产物生成和下载四类状态分开记录。

## 2. 范围

| 包含 | 不包含 |
|---|---|
| Files：Drive 式文件列表、拖放 / 多文件上传、逐项进度、预览、单选 / 多选下载、详情面板、搜索与筛选 | 在线文档编辑、网盘同步、公开分享、复杂文件权限 |
| Connections：邮件连接（范围、规则、Read now、自动读取、暂停 / 恢复、重新授权）；文件夹连接（根目录、子目录、类型、初次扫描范围、持续监控、Scan now） | 发送邮件、写回 / 移动 / 删除源文件 |
| Activity：上传、下载、读取、预览的统一历史；批次、子项、尝试时间线；筛选与搜索；重试 | Interview 对材料的业务解释（I01、I02） |
| 重复与新版本识别；Unassigned 与 Triage | 账号与凭据管理（Account & System Configuration） |
| 业务产物（评估包）注册与下载 | |

## 3. 功能需求

| ID | 需求 |
|---|---|
| FR-1 | Files 列表列：Name、Source、Updated、Read status、Business status；支持文件名搜索和类型、来源、状态筛选 |
| FR-2 | 上传：明显的 Upload 按钮和拖放区，说明支持的类型和限制；不选业务项目也能上传，材料为 Unassigned |
| FR-3 | 上传进度面板逐项显示进度、成功、失败、取消和重试；关闭面板不取消任务、不删除记录；一批中个别失败不回滚其他文件 |
| FR-4 | 详情面板显示来源、版本、读取状态（如「Available · virus scan passed · text extraction completed」）、业务关联和操作时间线；预览关闭后回到原列表位置和选择状态 |
| FR-5 | 重复材料显示 `Duplicate · needs resolution`，Resolve 后保留新版本、旧版本标 superseded；无法归类的附件显示 `Unassigned · needs triage`，Triage 后匹配 |
| FR-6 | 邮件连接：连接名、授权账号、邮箱 / 标签范围、发件人 / 主题 / 时间条件、正文 / 附件选择、读取方式；规则有版本；提供匹配预览 |
| FR-7 | Read now：每封邮件的正文和每个附件各有子记录；无匹配的邮件记录为 Skipped 及原因，不算失败；默认只读启用后的新邮件，补读历史需选择时间区间 |
| FR-8 | 文件夹连接：根目录、是否含子目录、允许类型、首次读取范围（扫描现有 / 只处理之后的变化）、自动监控；状态 Watching / Paused / Disconnected / Authorization required / Error |
| FR-9 | 文件更新形成新的 MaterialVersion，并通知已关联业务模块复核，不覆盖旧评估依据；源文件删除只标记源不可用 |
| FR-10 | 授权过期时显示 `Authorization required`，依赖的读取暂停；重新授权后从检查点继续，不重扫全部历史 |
| FR-11 | 暂停监控不影响已接收的材料；断开连接不删除既有历史 |
| FR-12 | 下载：权限检查后提供文件或打包；状态 Requested / Preparing / Ready / Transfer started / Transfer served / Failed / Cancelled / Expired；无法确认本地保存时不显示「已保存到设备」 |
| FR-13 | Activity 列：Time、Operation、Source、Status；按时间、操作类型、来源连接、状态、发起人、目标项目筛选；批次可展开子项，子项可打开尝试时间线 |
| FR-14 | Retry failed items 只重试失败项；读取成功但业务消费失败时只重试交付，不重新下载源文件；每次重试是新的 attempt，原失败保留 |
| FR-15 | 原型中外部连接全部模拟，并在页面标明「Connections are simulated for this prototype」 |

## 4. 业务规则

| ID | 规则 |
|---|---|
| BR-1 | 文件传输成功 ≠ 业务导入成功；材料 Available 与业务 Accepted / Failed 分开显示 |
| BR-2 | 所有上传、下载、读取、扫描、预览都留历史，包括失败、取消、跳过、空扫描和重试；时间线追加，不覆盖 |
| BR-3 | 操作历史不采用首页全局可见规则：普通用户只看获授权来源 / 材料 / 项目的历史；无权材料不通过文件名、邮件主题或路径泄露 |
| BR-4 | 相同来源对象的重复发现记为跳过；不同来源出现同内容保留各自历史，不自动认定属于同一候选人或岗位 |
| BR-5 | 权限、格式类错误不无限重试 |
| BR-6 | 文件内容是待处理数据，不能改变权限、连接规则，不能触发自动发送或删除 |
| BR-7 | 不修改源邮箱已读状态，不移动或删除原邮件和源文件 |
| BR-8 | 普通浏览器页面不能被当作拥有后台监控本地目录的能力；生产需授权的云文件连接器或本地辅助服务 |

## 5. 数据

| 方向 | 对象 | 关键字段 |
|---|---|---|
| 输出 | SourceConnection、RuleVersion | 类型（email / folder）、范围、规则版本、状态、检查点；凭据引用（不在日志中暴露） |
| 输出 | Material / MaterialVersion | material_id、version、source_type、source_ref、content_type、checksum、read_status、extraction_status |
| 输出 | ReadRun | 触发方式、发现 / 匹配 / 成功 / 跳过 / 失败计数、状态 |
| 输出 | Operation / Attempt / Timeline | operation_id、batch_id、actor、trigger、阶段、错误码、idempotency_key、retry_of |
| 输出 | 消费回执 | consumer_module、consumer_status、business_object_ref、reason |
| 输出 | ExportArtifactRef、DownloadAttempt | 产物版本、生成状态、下载尝试、可观测传输结果、到期 |

## 6. 权限

- HR / Recruiter：上传、管理连接、下载、查看所属范围历史。
- Interviewer：不能进入 Files & Integrations（原型「Assignees cannot access file and integration management」）。
- 管理员：查看 Workspace 范围历史。
- 候选人不能访问任何文件。

## 7. 非功能要求

- 可恢复任务和检查点；下游不可用时保留已接收的材料。
- 上传、下载支持现有主题和字号；第三方存储界面不在范围内。

## 8. 验收标准

| ID | 验收 | 对应 |
|---|---|---|
| AC-1 | 无项目时上传材料，存为 Unassigned；之后关联项目不需要重新上传 | FILE-AC01 |
| AC-2 | 批量上传含成功、格式错误、取消：各项结果和批次部分成功清楚，成功项不回滚 | FILE-AC02 |
| AC-3 | 邮件含正文和多个附件，来源邮件和子材料可追溯；无匹配也记录批次和零结果 | FILE-AC03 |
| AC-4 | 文件夹首次扫描、新增、更新：遵循所选范围，新版本不覆盖旧依据 | FILE-AC04 |
| AC-5 | 重复通知、重连补扫、批次重试：已成功材料不重复创建，失败项独立重试 | FILE-AC05 |
| AC-6 | 读取成功但 Interview 消费失败：两种状态分开，只重试交付 | FILE-AC06 |
| AC-7 | 暂停 / 授权失效 / 恢复：状态真实，恢复后从检查点补齐并去重 | FILE-AC07 |
| AC-8 | 下载开始、链接过期、无法确认本地保存：不虚构「已保存」，重新下载是新尝试 | FILE-AC09 |
| AC-9 | Activity 能定位全部上传、下载、读取、预览及每次失败和重试 | FILE-AC10 |
| AC-10 | 普通用户打开无权来源的历史，不泄露文件名、主题、路径、内容 | FILE-AC11 |
| AC-11 | 断开来源、删除材料：历史保留并标材料不可用，源邮箱和源文件不变 | FILE-AC12 |
| AC-12 | 拖放上传 → 进度 → 部分失败重试 → 预览 → 多选下载 → 历史详情一致可用；关闭预览回到原位置 | FILE-AC14 |
| AC-13 | 关闭进度面板不取消任务；失败重试可从进度面板和 Activity 进入，状态一致 | FILE-AC15 |

## 9. 依赖与实现

- 后端：`intake/materials.service.ts`、`core-record/core-record.client.ts`；其余缺失。
- 前端：缺失。
- 依赖：Core Record（材料主档）、Account & System Configuration（连接授权）、I15。被 I01、I02、I11 调用。

## 10. 待确认

1. 首期实现范围：只做手工上传 + 历史，还是邮件、文件夹一起做。
2. 邮件、文件夹的供应商和连接方式（PRD §13 待评审）。
3. 此模块放在 Interview 后端，还是直接放到 Core Record 作为公共服务（与材料主档迁移计划对齐）。
4. 文件大小、数量和格式上限；历史保留期。
