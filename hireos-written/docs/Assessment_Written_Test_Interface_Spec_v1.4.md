# HireOS Command — Assessment / Written Test Interface Specification

| 属性 | 定义 |
|---|---|
| 编号 / 文档版本 / 日期 | CMD-ASM-002 / v1.4 / 2026-09-11 |
| 当前配套 | [PRD v1.4](Assessment_Written_Test_PRD_v1.4.md) / [Design Brief v1.1](Assessment_Written_Test_Prototype_Design_Brief_v1.1.md) |
| 公共依据 | [架构v2.2](references/command-foundation-2026-09-11/HireOS_Command_Shared_Foundation_Data_Integration_and_Build_Plan_v2.2.md) / [数据v1.2](references/command-foundation-2026-09-11/HireOS_Command_Common_Data_Foundation_and_Database_Plan_v1.2.md) |
| 契约 | Assessment业务载荷4.0.0；公共Identity/Core/Bus正式schema版本由平台发布，本文件不替平台指定版本号 |
| 状态 | 拟定接口与接入规范，非DDL/已部署API；原型采用公共底座合成数据 |

## 1. 当前权威与变更范围

本版替代v1.3的架构/主档/认证/内部传输/平台数据所有权定义，保留题库、评分、修订、提交、候选人披露等业务语义。不同版本不能混用写入：v1.3的本地Candidate、CandidateSession、自建Connection/Model目录及内部邮件交接不能作为本版运行实现。

R必填，O可省略，C条件必填；数组R可空，标≥1时非空。时间UTC ISO8601，显示时区IANA。未知值null并附状态，不猜分、邮箱、版本或批准。已发布业务对象不可覆盖，修订增加版本。公共字段以平台字典为准；本文拟定字段必须通过契约CI和平台owner评审，不将未提供的AD/PDF/部署文件视为已验证依据。

## 2. Ownership & Allowed Paths

| 对象/域 | 唯一权威 | Assessment允许操作 |
|---|---|---|
| User/Workspace/Membership/Entitlement/Participant | Identity，iam | 统一身份/授权API，不注册独立用户、不存密码/OTP/session签发记录 |
| Candidate/Contact/ProfileVersion | Core，core | 同步Core API创建/查询/更正，经确认公共归并命令；无本地可写主档 |
| Job/RoleDefinitionVersion/Requirement | Core | 发布/引用公共标准；Assessment只存目标/试卷/计分Profile |
| Application/Cycle | Core | 有效人工关联决定后幂等创建/复用；准备期可无 |
| File/FileVersion/SourceRecord | Core | 登记/验权/版本、授权上传下载；Material/ArtifactRef统一映射此记录 |
| Question/Plan/Attempt/Response/Evidence/Evaluation/Result/Release/Task/Decision | Assessment，assessment | 本域事务写自身表，逻辑引用公共ID |
| Connection/MailIngress原信接收/Notification/Delivery执行 | 平台公共执行服务，自有schema | 提交执行请求、读取受权状态；本地仅业务意图、邮件消费/匹配决定及ref |
| Models/Policy/Quality/Run/Budget | AI Service，ai | 公共API；领域Rubric/Prompt及质量要求仍由Assessment提供 |
| Audit/Timeline | Audit服务，audit | 本地事务留审计待发布事实，公共消费投影；不直写audit |
| 其他L2产物与动作 | 对应模块私有schema | 只走总线，不同步查询/调用/跨表JOIN |
| Tasks总览/编排 | L3 | 聚合本域Task事件，命令通过总线路由到本域；用户前端到所属服务可由BFF代理 |

数据库：每个服务独立进程/私有schema/runtime凭据，Assessment无core/iam/ai/audit/其他L2的SELECT或写权限。Worker按任务域隔离，不用超级凭据。服务内FK完整；跨服务只存逻辑引用并由权威API/事件校验，无跨schema物理FK/触发器/视图/分布式事务。

公共UI/SDK独立版本建设一次，不依赖另一个L2源码/领域包。四类主档之外不能因“公共”把Task/Decision/Notification塞进Core。

## 3. IDs, Headers & References

### 3.1 公共引用（本版交换字段草案）

| 类型 | 字段 |
|---|---|
| PrincipalRef | user_id:string R；kind:employee/participant/service R；workspace_id:string R；身份与scope由统一令牌校验，不能信前端自报 |
| CandidateRef | candidate_id:string R；profile_version_id:string C（评估）；workspace_id:string R |
| JobRef | job_id:string R；role_version_id:string C（正式岗位评估）；workspace_id:string R |
| ApplicationRef | application_id/cycle_id/candidate_id/job_id/workspace_id:string R；由Core校验同一有效招聘关系 |
| FileVersionRef | file_id/file_version_id/workspace_id:string R；version_no:int≥1 R；checksum:string R；media_type:string R；size_bytes:int≥0 R；status:uploading/ready/failed R；交付和评估输入必须ready |
| DomainRef | module:string R；entity_type:string R；entity_id:string R；object_version:int≥1 R；workspace_id:string R；有限合法类型，禁止任意多态引用 |
| Reason | code/explanation:string R |

业务头：object_id/object_type:string R；schema_version=4.0.0 R；object_version:int≥1 R；workspace_id:string R；owner_module=assessment R；created_at/effective_at:datetime R；created_by:PrincipalRef R；source_refs:DomainRef[] R；core_input_manifest_ref:DomainRef O；supersedes_ref:DomainRef C（修订）；correlation_id:string R；data_classification/purpose:string R。

公共ID不再是本模块别名；source_system仅来源/外部适配元数据。organization_id如继续需要由Identity返回映射，不假定等于workspace。原ActorRef.actor_id映射统一user_id；service主体由Identity可信凭据识别。版本ID和version_no不得互换：Core返回二者并在字典中校验，不从字符串拼出版本ID。

CoreInputManifest（业务实体）：candidate_ref:CandidateRef O；job_ref:JobRef O；application_ref:ApplicationRef O；file_refs:FileVersionRef[] R；policy_refs:DomainRef[] R；captured_at:datetime R；current_validation_at:datetime R；freshness:current/stale/unavailable R。核心输入版本不可变；snapshot是固定输入/发布视图，不是另一个可编辑主档。

Projection（本域只读）：core_entity_type/id/version_id:string R；projected_fields:object R（白名单）；source_updated_at/projected_at:datetime R；freshness:current/stale/unknown R；可重建、不可写回。关键动作仍经Core验证当前状态与权限，不能仅信投影。

## 4. Core API Operations & Application Gate

允许调用平台草案命令：CreateCandidate、PublishProfileVersion、ConfirmCandidateIdentity、CreateJob、ConfirmRoleVersion、ConfirmApplicationLink、RegisterFileVersion及其受权查询。名称是逻辑契约，不声称平台已有URL。

CoreCommandIntent（Assessment本域）：request_id:string R；operation:string R（allowlist）；idempotency_key:string R；expected_version:int或null R；input_hash:string R；authorization_decision_ref:DomainRef C（关联/发布）；status:prepared/requested/core_committed/reconciling/completed/failed R；returned_core_refs:object[] R；last_error:Reason O。

流程：本地保存request_id/意图→结束本地事务→调用Core幂等API→保存返回公共ID及后续Task。响应丢失时同request_id查询/重试；Core已提交而本地失败则reconciling，不新造ID、不盲目删除Core对象。补偿须授权且满足Core不变量。不得持有数据库长锁等待远端流程。

目标/JD-only准备、题库、历史Intake不强制Application；通用无岗位能力测评application_ref省略。**正式岗位招聘测评发邀请前，必须有有效人工LinkDecision或可追溯上游确认，并经Core创建/复用Application。** Candidate主动邮件/AI匹配不替代关联。此为按公共关系基线收紧Assessment的产品默认规则，映射到PRD§3；不是声称Core自己判断是否应聘用。

同Core记录服务多个模块，模块停用不删除其他模块仍引用的主档。身份归并/拆分只调用Core受控命令，保留旧ID解析、业务影响与重评任务。

## 5. Domain Entity Catalog & Field Migration

以下业务字段继承 [v1.3字段目录](Assessment_Written_Test_Interface_Spec_v1.3.md) 中指定章节，**仅继承本表明确列出的业务内容**；统一替换为§3的头/引用/用户/文件类型，不继承旧架构与所有权。这样保留详尽题目字段而不重新定义公共模型。

| 当前实体 | 保留业务字段及来源 | 必须替换/补充 |
|---|---|---|
| AssessmentProject/Case | v1.3 §6项目、目标、owner、状态 | candidate/job/application全部Core Ref；Case是测评案件不是第二Application |
| QuestionBank/QuestionVersion/RoleMapping/ScoringProfile | §24题目、提示、类型、语言、Rubric、分配与版本 | 岗位/要求引用Core；材料FileVersionRef；作者PrincipalRef |
| Assessment/Blueprint/Section | §6/24发布试卷、目标、权重、题目绑定 | core_input_manifest_ref；禁止复制公共JD作为可写主档 |
| AssessmentPlan/PlanItem/PlanReview | §19计划项、必评、前置、coverage | Case引用公共身份；聚合规则不变 |
| PolicySnapshot/SubmissionPolicy | §20/26 timed/deadline_only、deadline、AI策略、提交规则 | 认证走Identity；email route按§7替代 |
| Invitation/Acceptance | §25的accepted/declined及状态机 | participant_user_id、participant_authorization_ref；统一邮箱，不存本地identity_id |
| Attempt/Response/SubmissionDraft/Receipt | §20/26首轮/修订、锁定、幂等、deadline | 公共文件ready引用；处理和可信收件时间分别保存 |
| Evidence/Evaluation/Score/Result | §7+§24.2criterion多能力算法 | FileVersion定位；共享AI run_ref；不在本域写AI运行表 |
| Feedback/Revision/Comparison | §21/33初稿、提示披露、变化、对比 | 不同帮助条件不可混排；公共ID版manifest |
| NextAction/Decision/HumanTask | §21/32动作、责任、状态、完成规则 | 留Assessment私有域，L3只聚合；assignee统一user_id |
| CandidateResultRelease | §27披露白名单、批准、发布、修订 | notification_request_ref指平台执行；不保存另一套Delivery执行权威 |
| Appearance/Models/Connection/Operation | §32/34仅业务使用和展示需求 | 平台拥有记录；Assessment持有服务ref/只读投影，无复制表 |
| ExecutionProfile/Adaptive/Calibration | §33/35领域约束、branch/评分证据与提案 | 执行Worker按域权限；共享AI/文件通过公共API |

本版§6–10给出完整对外新交接字段。无上表列入的旧公共实体表不能直接实施。尤其取消CandidateEmailIdentity、EmailChallenge、CandidateSession本地持久化契约；替换为统一Identity平台能力引用。旧MaterialEnvelope可作接入读投影但不产生第二File主表。score未知null、criterion fraction和=1、已发布对象不可变、个人视图不改团队权重保持有效。

## 6. Same-deployment Screening → Assessment → Interview

### 6.1 InternalAssessmentRequest（来源L2业务请求）

event业务data只包含：request_id/exchange_id:string R；package_version:int≥1 R；candidate_id:string R；job_id/application_id:string C（正式岗位请求）；input_artifact_ref:FileVersionRef R（ready）；requested_action:prepare_assessment/request_interview/review_only R；decision_ref:DomainRef R；summary:string R（简短无敏感原文）。来源是Screening时动作prepare_assessment，Assessment输出给Interview时request_interview/review_only。

公共ID和输入manifest在详细文件中对应，接收方经Core校验；外部请求和无正式关系材料可先Intake等待关联，不伪造缺字段。收到request不等于邀请/接受/排期，接收方仍验证本地规则及权限。

### 6.2 AssessmentArtifact（详细JSON文件）

artifact_schema_version=4.0.0 R；source_business_ref:DomainRef R；workspace_id:string R；core_input_manifest:CoreInputManifest R；assessment_refs/attempt_refs/evaluation_refs/result_refs:DomainRef[] R；result_snapshots:object[] R（按当前业务字段，非可编辑主档）；evidence_entries:object[] R；evidence_file_refs:FileVersionRef[] R；plan_summary:object O；feedback_disclosure_summary:string R；unassessed_competency_ids:string[] R；interview_focus:object[] R；authorization_scope:object R；produced_at:datetime R；supersedes_artifact_ref:FileVersionRef C（更正）；human_report_ref:FileVersionRef O。

authorization_scope字段：purpose:string R；allowed_recipient_modules:string[] R；allowed_workspace_id:string R；access_policy_ref:string R。它声明用途而不自行授予权限，Core和目标仍验权。内部notes/候选人不应知的内容按目标裁剪；CandidateResultRelease另行生成，不直接复用内部包。

Detailed payload不是事件正文。来源保存业务结果→向Core注册并上传JSON→校验FileVersion ready→本地保存交付记录和Outbox→发布仅含ref事件。不能以注册成功/URL已生成当文件ready。目标通过Core API取授权文件，核验schema、hash、主体、版本和用途，保存InputManifest/只读结果投影。缺文件发准备请求事件等待，禁止同步回调来源L2。

### 6.3 Receipt Event

receipt_id/request_id/exchange_id:string R；package_version:int R；source_artifact_ref:FileVersionRef R；receiver_module:string R；status:received/needs_review/imported/rejected R；target_business_ref:DomainRef C（imported）；reason:Reason C（needs_review/rejected）；processed_at:datetime R。接收结果经目标Outbox回总线，来源消费后更新交接读模型，不向对方发同步HTTP。

File ready、Bus published、Target received/imported、Target started各自不同。结果已final但无Interview部署可保留/导出；不需要默认发内部同步邮件。外部导出/跨部署交换仍支持完整自包含包、来源标识映射和授权校验。

## 7. Unified Participant Login & hr@ Mail Correlation

候选人通过Identity的受限参与者登录（OTP/magic link等平台能力），获得统一user_id和受限audience/scope。Candidate业务ID与登录User不同；ParticipantAuthorization由平台授权机制关联user_id/workspace_id/candidate_id及允许invitation_ids。Assessment验证平台会话，不存密码、签发独立业务登录身份或以邮箱作主键。员工同一user_id跨模块，不因进入Assessment重新注册。

Invitation新增/替换：participant_user_id:string C（完成验证后）；participant_authorization_ref:string C（接受时）；acceptance_ref:DomainRef C（accepted）；mail_thread_binding_ref:DomainRef R；notification_request_ref:string O。Acceptance含统一user_id、决定、policy/notice版本和时间。GET无验证消费/接受/开始动作，timed仍显式start。

### 7.1 统一对外邮箱替代每轮地址

**候选人From与Reply-To均为hr@sendinglabs.com。** 平台发送身份固定且已验证后才能真实发送；原型只预览配置，不向该真实地址发信。不能另造每轮plus-address作为From/Reply-To以绕过此要求。

MailThreadBinding（Assessment私有业务关联）：invitation_ref/attempt_ref:DomainRef R；candidate_id:string R；participant_user_id:string C（验证后）；platform_thread_ref:string R；outbound_message_refs:string[] R；correlation_token_hash:string R；round_number:int≥1 R；status:active/closed/revoked R；expires_at:datetime R。token是轮次匹配线索，不是认证凭据，不写公开事件。平台邮件原始数据留平台，仅返回最小匹配元数据和受权FileVersion refs。

关联依据：平台可信In-Reply-To/References链、已发送message ref、明确轮次标记/候选人选定任务。新写邮件无线程可用安全标记辅助，仍必须验证候选人与唯一任务；只有主题/姓名/最近一条邀请不够。多任务/多轮冲突进needs_confirmation；旧线程归旧轮，不能“自动转最近轮”。

auto-submit门槛保持：统一Identity已验证邮箱、发件邮箱匹配、可信邮件认证结果、唯一且有效线程、已接受、正确轮次、完整ready文件、无冲突、符合deadline。身份unknown/转发/共享邮箱歧义发送确认到已验证邮箱或人工复核，不仅依赖From/DMARC。多租户共用同发送地址时平台必须以可信thread映射workspace且校验授权，不能依赖来信自报workspace。

### 7.2 平台收件与本地消费

PlatformMailRef（只读）：mail_id/connection_ref/provider_message_id:string R；trusted_received_at/ingested_at:datetime R；from_email:string R；auth_status:aligned_pass/failed/unknown R；thread_ref:string或null R；raw_file_ref:FileVersionRef R；attachment_refs:FileVersionRef[] R。Assessment MailConsumption拥有classification、binding_ref、status、missing_deliverables、submission_ref及reason，不复制平台连接/投递记录。

先平台持久化/文件校验，Assessment提交服务依据策略commit并通过公共通知服务发候选人回执。完整邮件可不再登录确认；缺件/冲突/咨询不正式提交。文件核心注册失败保留待处理，不用本地文件主表绕行。迟到解析以trusted_received_at及最后必需补件时间判定；Identity/接受条件必须在截止前成立；Portal/确认模式按确认命令时间。重复邮件、上传/邮件并发同内容只有一个commit，不同内容锁定后不能覆盖。

结果批准后创建CandidateResultRelease，平台通知请求用release版本+recipient去重；Portal可读、通知排队、送达分别显示。内部任务通知经平台使用模块通知身份发员工公司邮箱，Assessment内部发送别名由平台配置确认，不在文档编造实际地址。

## 8. Platform Execution, Tasks & Shell Registration

NotificationRequest（Assessment意图）：request_id:string R；business_ref:DomainRef R；recipient_user_id:string R；template_ref:string R；channel:email/in_app R；sender_policy:unified_candidate_hr/internal_module R；content_projection_ref:FileVersionRef或DomainRef R；idempotency_key:string R；status:prepared/requested/reconciling/accepted/failed R；platform_delivery_ref:string C（accepted）。平台保存实际attempt/SMTP状态，Assessment只是投影/引用。平台接收HTTP成功不表示已送达。

HumanTask/Decision本域持有，task event经总线供L3聚合，assignee=统一user_id或明确queue；业务completion_ref成功后才completed。Audit本地Outbox可靠发布审计事实，公共服务消费；audit lag不冒充已同步。AI run记录只在AI Service，Assessment记录input manifest、领域验证、result与公共run_ref。

模块注册条目（设计草案，不选微前端框架）：module_id=assessment；level=L2；enabled；identity{audience,required_permissions}；ui{bundle_version,standalone_entry,embedded_entry,hide_global_navigation,deep_link_patterns}；api{service_route,openapi_ref}；events{produced,consumed,schema_refs}；data{private_schema:assessment,core_api_compatibility}；tasks{types,action_routes}。均R，schema_refs来自契约文件仓库+CI，无运行时registry数据库依赖。

Shell展示My Focus/Task Feed/Jobs/Overview/Settings/Copilot，装配无全局导航的bundle。浏览器/BFF代理用户到所属服务允许；Assessment后端经BFF调用Interview不允许。L3编排保存流程版本/步骤状态，通过总线请求L2动作；L2校验规则，不能在前端串长事务。公共Identity/Core+Assessment无Shell仍可运行本域任务与深链。

## 9. Transactions, Streams & Recovery

每服务自身Postgres schema里outbox/inbox；生产事务保存业务+outbox，消费者事务保存inbox+业务+receipt outbox后ACK。禁止全域共享可写Outbox。S0 Redis Streams，不同模块不同consumer group、同服务副本共group；pending认领、退避、死信、重放与保留有运维策略，Streams不作为永久事实源。

事件轻量envelope草案（平台字段最终核对）：event_id/type/schema_version/workspace_id/producer:string R；aggregate_id:string R；aggregate_version:int R；correlation_id:string R；causation_id:string或null R；occurred_at:datetime R；principal:PrincipalRef R；decision_ref:DomainRef C（授权业务请求）；data:object R（仅ID、版本、File refs、简短摘要）。令牌/全文答案/报告不入事件。

event_id是逻辑去重ID，不等于Redis entry ID。消费者key=consumer+workspace+event_id；业务唯一键=request_id/exchange_id+version+目标。相同键不同hash拒绝覆盖；乱序只归档旧版本，缺口等待/重放不猜状态。业务fact与request分开，AssessmentCompleted不等于StartInterviewRequested。

Core注册File成功但本地落库失败→同request_id恢复；File uploading不得发布；ready但Outbox失败→补发ref不重传主档；消费者提交后ACK前宕机→重投inbox去重；审计延迟展示pending。默认重试沿旧业务有界退避策略，禁止对权限/格式错误无限重试。trim不能越过需恢复的消费者，Outbox保留与备份/补放窗协调；具体容量和时限待平台工程确定。

| 故障 | 允许/阻塞 |
|---|---|
| 其他L2未部署 | Assessment仍完整运行，可导出；不发送虚假已接收 |
| Shell离线 | 独立入口使用统一身份/Core，已有本域业务不依赖L3 |
| Identity失效/当前权限无法证明 | 敏感新动作阻塞/重新认证，不本地自签凭据 |
| Core不可用 | 主档/文件/当前状态依赖动作等待；已有合法冻结输入草稿可保存 |
| 总线不可用 | 保存结果+Outbox，内部交接pending，不改走L2直调 |
| 平台邮箱/AI不可用 | 已有结果/人工流程可读；提交/评估按实际依赖排队，不伪造成功 |

## 10. API/Event Boundaries & Examples

Assessment自身HTTP领域端点建议/v4：projects、question-bank、plans、invitations、acceptances、attempts/submissions、evaluations、releases、revisions、tasks、handoffs。它们供浏览器/BFF/授权外部客户调用，**不是允许另一L2调用的后门**。SSO/OTP统一Identity入口，模型/文件/连接/预算走公共服务。所有业务写入认证、对象权限、Idempotency-Key及适用If-Match；读取cursor和版本过滤。

总线命令：assessment.prepare_requested、assessment.supplement_requested、interview.prepare_requested；事实：assessment.submission_committed、assessment.result_finalized、assessment.artifact_ready、assessment.handoff_receipted、assessment.task_updated。名称是注册草案，需与平台event schema仓库核对。

示例为内部交接事件的data部分（非完整envelope；ID为虚构，真实发布前必须向Core核验ready文件）：

```json
{
  "request_id":"req_demo_01",
  "exchange_id":"exchange_demo_01",
  "package_version":1,
  "candidate_id":"candidate_shared_demo",
  "job_id":"job_shared_demo",
  "application_id":"application_shared_demo",
  "requested_action":"request_interview",
  "artifact_file_id":"file_demo",
  "artifact_file_version_id":"file_version_demo_1",
  "artifact_schema_version":"4.0.0",
  "summary":"Assessment reviewed; follow-up requested."
}
```

上述使用紧凑File ID投影；完整InternalAssessmentRequest映射为input_artifact_ref并经Core获取checksum等元数据。不得把紧凑示例当未经校验的完整ArtifactRef。完整envelope按§9，principal/decision不省略。

错误沿结构化code/message/retryable/field_errors/correlation_id；新增CORE_UNAVAILABLE、CORE_RECONCILIATION_PENDING、PARTICIPANT_AUTH_REQUIRED、APPLICATION_LINK_REQUIRED、FILE_NOT_READY、L2_SYNC_CALL_FORBIDDEN、THREAD_AMBIGUOUS、CONTRACT_UNSUPPORTED。错误不得泄露其他workspace记录是否存在。

## 11. Compatibility & Migration

4.0.0是破坏性架构/身份/引用升级，不能对3.0.0静默加字段。尚未实现的原型直接使用共享数据seed；不先新建本地账号库。若真实存在旧数据，迁移需盘点、确认归并、权限/版本/引用对账、单一权威切换和恢复计划，本次不执行迁移。

| 旧定义 | 当前转换 |
|---|---|
| 模块local Candidate/Job/Application | 确认后映射Core公共记录，仅迁移期保留旧引用解析；运行期不双写 |
| CandidateEmailIdentity/Session | 平台统一user_id/ParticipantAuthorization；旧token失效策略由Identity评审 |
| Artifact/Material | File/FileVersion受控引用；保留原source/checksum，不另建平行主表 |
| 内部候选人邮件包/API同步 | 总线ID事件+ready JSON FileVersion；无主档重复运输 |
| 每轮Reply-To地址 | hr统一邮箱+平台thread/message refs+私有安全关联标识 |
| 本地AI/Connection/Delivery权威表 | 平台服务记录与本地意图/ref；保留历史审计不冒充当前owner |
| 运行时Schema Registry | 文件仓库+CI，注册表仅L3模块装配配置 |

外部ATS/跨部署仍保留external source ID映射、自包含包和媒体传输；其结果不是内部默认ID体系。单部署内部用户不做“模块账号映射”。所有变更须契约兼容检查，公共API版本按平台声明，不以文档v2.2/v1.2当API SemVer。

## 12. Contract Acceptance

| ID | 验收 |
|---|---|
| F01 | 同一user_id跨Screening/Assessment/Interview，不另注册；entitlement生效但不扩大对象权限 |
| F02 | 同候选人/岗位/关系/文件跨模块同Core ID，发布版本输入保持原ref |
| F03 | Assessment凭据SELECT/写core、iam、其他L2均被拒；Worker/BFF无旁路 |
| F04 | 基础层+Assessment无其他L2/Shell也能完整业务；Core失效如实阻塞 |
| F05 | Core提交响应丢失后同键恢复只生成一条Application/FileVersion |
| F06 | 文件uploading不能出交接事件；ready后轻量事件、目标经Core读取 |
| F07 | L2同步调用被网络/代码检查阻止，缺产物通过总线请求 |
| F08 | 总线重复/乱序/pending重启/ACK丢失只产生一次业务效果 |
| F09 | hr统一From/Reply-To，同人多任务/旧线程/新写邮件不误匹配 |
| F10 | 候选人统一参与者可登录，无员工Membership；转发邮件不获得权限 |
| F11 | Task/Decision本域，L3/Audit投影不能直接批准或完成任务 |
| F12 | Connection/通知/AI运行归平台，无重复可写表；源业务仍保留批准与证据 |
| F13 | Shell/Standalone同bundle、同Core seed、同任务；嵌入无双导航 |
| F14 | Profile当前版更新不会改旧评分，stale提示和重新确认有效 |
| F15 | 外部包导入身份不明先复核；不凭邮箱跨租户合并 |
| F16 | 旧3.0.0消费者收到4.0.0明确不支持，迁移/兼容边界记录，不假通过 |

原PRD题库、多能力、上传/邮件、修订、披露、Comparison、模型限制和可访问性验收继续有效，按当前主档/身份/总线路径执行。本文仅为设计接口，未运行真实服务测试或宣称满足数据库隔离。
