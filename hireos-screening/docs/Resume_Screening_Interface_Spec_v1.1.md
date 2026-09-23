# HireOS Command — Resume Screening Interface Specification

| 文档属性 | 内容 |
|---|---|
| 编号 / 版本 / 日期 | CMD-SCR-002 / v1.1 / 2026-09-08 |
| 状态 | Draft for Review；字段级逻辑契约，非已部署 API |
| 配套 PRD | [Resume Screening PRD v1.3](Resume_Screening_PRD_v1.3.md) |
| 权威范围 | Screening 输入、输出、实体、事件、交接、状态、版本和可靠性 |
| Schema 基线 | 2.0.0；新增关联前流程并调整必填语义，不能将文档v1.1误认为Schema小版本兼容 |

本版是配套PRD v1.3的完整逻辑接口规范。§1–15保留并修订已有筛选、证据、决定及下游契约；§16–21补齐输入输出通道、关联前匹配、重复识别、公共任务、对比与模型服务。新增对象同样遵循通用头、权限、版本、幂等和审计规范。仅提供建议API映射，不表示已经实现服务。

**流程基线：接收材料 → 重复识别/入库 → AI岗位匹配 → 人工确认关联 → 正式筛选/对比 → 人工下一步决定 → 授权交付 → 目标独立接收处理。** 任意前序/后序业务模块未安装时，仍可通过本地快照、手动输入和文件/邮件交付完成本模块业务。

## 1. Conventions & Common Types

R=必填；O=可省略；C=满足条件时必填。R 数组允许 `[]`，除非注明 ≥1；空数组表示已确认没有，未处理必须有 status。未知值不得猜填；可空字段用 `null` 并附状态。时间为 ISO 8601 UTC；展示时区另用 IANA；ID 为不透明 string；分数与权重为有限 number，禁止 NaN/Infinity。

所有业务对象按租户授权；workspace_id 为租户边界，organization_id 是组织业务标识，二者须有授权映射，不假定相等。各模块本地 ID 可不同，不要求全局注册；传输引用通过 mapping 解析。发布对象不可覆盖，修订新版本。

| 类型 | 字段级定义 |
|---|---|
| Ref | entity_type:string R；entity_id:string R；version:int≥1 R；source_system:string R。精确版本，不接受 latest |
| ActorRef | actor_id:string R；actor_type:human/agent/service R；身份由认证上下文校验，不能信任客户端自报 |
| Reason | code:string R；explanation:string R；业务原因不得用空白占位 |
| ArtifactRef | artifact_id:string R；version:int R；content_hash:string R（sha256:hex）；media_type:string R；access_scope:string R；size_bytes:int O |
| MoneyRange | min/max:number或null R（至少一个已知）；currency:ISO4217 R；period:hour/month/year R；basis:gross/net/unknown R；data_status:known/unknown R。完全未知时对象为null |
| ValueWithStatus | value:JSON或null R；data_status:known/unknown/not_applicable/disputed R；evidence_refs:Ref[] R。known 要有值 |
| Approval | approval_id:string R；actor:ActorRef R（human）；decision_ref:Ref R；approved_at:datetime R；role_at_action:string R；policy_ref:Ref R |
| ExternalRef | system:string R；entity_type:string R；external_id:string R；external_version:string O |
| SourceEntry | source_ref:Ref R；artifact_ref:ArtifactRef C（文件）；inline_snapshot:object C（结构化来源）；snapshot_hash:string R；两种快照载体至少一个 |

### 1.1 Common Object Header

本表适用于下文所有独立持久化实体、请求、包和事件 payload；嵌套 value object 不重复头。

| 字段 | 类型/必填 | 约束 |
|---|---|---|
| object_id / object_type | string / R | 稳定 ID 与注册类型 |
| schema_version / object_version | semver / R；int / R | 2.0.0；从 1 递增 |
| workspace_id / organization_id | string / R | 必须匹配授权租户/组织 |
| source_system / owner_module | string / R | 原生产系统与事实权威；转发不改生产来源 |
| created_at / effective_at | datetime / R | 记录与生效时间 |
| created_by | ActorRef / R | 原生产者 |
| source_refs | Ref[] / R | 派生对象 ≥1，根对象可空 |
| supersedes_ref | Ref / C | 修订时必填，与本 object_id 对应旧版本 |
| data_classification / purpose | string / R | 内部敏感数据等级与使用目的 |
| job_id / candidate_id / application_id | string / C | 正式Application及其ScreeningEvaluation/Decision/Transition全部必填；关联前评估仅candidate/job必填、application必须为空；LibraryEntry/Intake/Task按subject可无job/application |
| correlation_id | string / R | 跨操作追踪，不用来替代实体去重 |

## 2. Core Entities, Ownership & Relationships

| 实体 | 所有权 / 主键（均有通用头） | 关系 |
|---|---|---|
| Organization / User | M0 或本地身份适配器，只读投影 | Organization 1:N User memberships |
| ScreeningProject / Job | 本地或 JD 来源快照 | Project N:1 Job；Job 1:N RoleCriteriaSnapshot |
| JobRequirement / MatchDimension / Rubric | 随 RoleCriteriaSnapshot 不可变 | Requirement N:1 Dimension；Dimension 1:1 rubric版本 |
| Candidate | 本地 canonical record，外部主数据只映射 | Candidate 1:N Profile、Resume；不含岗位分数 |
| CandidateProfile / ResumeVersion / CandidateSource | 来源负责原文；本地负责导入快照 | Profile N:M SourceVersion；Resume 1:N ResumeVersion |
| Application | 人工LinkDecision确认后的本地案件或共享域映射 | 恰好一个 Candidate × Job；再次申请用新 cycle |
| ScreeningSession / Batch | Screening | Session 1:N Evaluation；Batch 1:N BatchItem |
| ScreeningEvaluation / DimensionScore | Screening | Application 1:N Evaluation；Evaluation 1:N DimensionScore |
| AIClaim / EvidenceItem / EvidenceLink | 原生产模块拥有 | Claim N:M Evidence；Evidence N:M Requirement，经 Link |
| Concern / VerificationItem | Screening 创建；目标可产出 resolution | Evaluation 1:N；Concern 0:N VerificationItem |
| Recommendation / ScreeningDecision | AI建议归评估；决定归授权人 | Evaluation 1:1 Recommendation；Evaluation 0:N Decision版本 |
| PreferenceProfile / PreferenceSignal / FeedbackEvent | 对应 scope owner / 原反馈者 | Profile N:M Signal；Signal N:1 Feedback；Profile有版本 |
| RankingSnapshot | Screening | Cohort 1:N Snapshot；成员精确引用 Evaluation |
| WorkflowTransition / HandoffPackage / Receipt | 来源 / 来源 / 接收方 | Decision 0:N Transition；Transition 1:N delivery attempts |
| AgentRun / AuditRecord / ExternalIdentityMap | 本地运行、审计、映射能力 | 可共享机制，不能改变事实权威 |

约束：同一 job/candidate/active application cycle 的重复导入关联原 Application；不能用姓名合并 Candidate。跨租户 Ref 一律拒绝，即使实体 ID 恰好相同。一个 requirement 默认属于一个计分 dimension，避免重复计权；额外标签映射不参与聚合。

### 2.1 Project, Job, Candidate & Application Fields

以下为各实体除通用头外的字段。

| 实体 | 字段 / 类型 / 必填 | 语义 |
|---|---|---|
| Organization | name:string R；policy_ref:Ref R | 有效组织配置 |
| UserProjection | display_name:string R；membership_ref:Ref R；status:active/inactive R | 权限实时读取，不由快照永久授权 |
| ScreeningProject | title:string R；job_ref:Ref R；mode:standalone/integrated R；owner_ref:ActorRef R；status:draft/active/closed R | JD-only 可创建 |
| Job | title:string R；external_refs:ExternalRef[] R；role_criteria_ref:Ref O | criteria 未确认时可无 |
| Candidate | display_name:string R；external_refs:ExternalRef[] R；contact_ref:Ref O；identity_status:provisional/confirmed/disputed R | 缺姓名可用明确临时显示名，不能编造身份 |
| Application | job_ref/candidate_ref:Ref R；cycle_id:string R；origin:applied/sourced/referred/imported R；status:active/paused/closed R；screening_status:not_started/in_progress/review_pending/decided R；owner_ref:ActorRef R；external_refs:ExternalRef[] R | 核心关系创建后不可直接换人换岗 |
| ExternalIdentityMap | local_ref:Ref R；external_ref:ExternalRef R；mapping_status:proposed/confirmed/rejected R；confirmed_by:ActorRef C | confirmed 时确认人必填；唯一租户+system+type+external_id |
| CandidateSource | channel:upload/application/scout/job_board/agency/referral/ats/email/folder/api R；source_record_id:string O；received_at:datetime R；submitted_by:ActorRef O；original_uri:string O；authorization_ref:Ref R | 原 URL 仅来源信息，不保证实时可用；不得抓取未获授权来源 |
| ResumeVersion | resume_id:string R；candidate_ref:Ref R；artifact_ref:ArtifactRef R；source_ref:Ref R；parse_status:pending/succeeded/partial/failed/quarantined R；parser_version:string C | 已解析时 parser_version 必填 |

### 2.2 CandidateProfile Snapshot

| 字段 | 类型/必填 | 说明 |
|---|---|---|
| candidate_ref / display_name | Ref R / string R | 对应本地候选人 |
| data_status | complete/partial / R | complete 表示本次预期输入处理完成，不代表能力证据充分 |
| source_entries | SourceEntry[] / R ≥1 | 锁定原始材料版本 |
| resume_version_refs | Ref[] / R | 可空，结构化资料可替代简历 |
| employment_history | EmploymentEntry[] / R | entry_id、company_name、title:string R；start/end:ValueWithStatus R；responsibilities/achievements:string[] R；evidence_refs:Ref[] R；verification_status:unverified/verified/disputed R |
| skills | SkillEntry[] / R | skill_id或label 至少一项string；level:ValueWithStatus R；evidence_refs:Ref[] R |
| education / certifications / projects | ProfileFact[] / R | fact_id:string R；kind:string R；statement:string R；period:ValueWithStatus O；evidence_refs:Ref[] R；verification_status 同上 R |
| location / work_authorization / languages | ValueWithStatus / R | 不根据姓名、国籍或现地址猜工作授权 |
| compensation_expectation | MoneyRange或null / R | 未知另在 missing_fields 标记 |
| contact_ref | Ref / O | 仅通信动作需要，默认不入评分包 |
| missing_fields | string[] / R | JSON field paths；空数组不保证满足岗位条件 |
| corrections | Correction[] / R | field_path:string、old_source_ref:Ref、reason:Reason、corrected_by:ActorRef，均R；可空 |

## 3. Role Criteria & Policies

### 3.1 RoleCriteriaSnapshot（JD Input Contract）

| 字段 | 类型/必填 | 校验 |
|---|---|---|
| job_ref / title | Ref R / string R | 与 Application 同岗位 |
| status | draft/confirmed/superseded/withdrawn / R | 运行仅 confirmed |
| origin | jd_module/local_confirmed/external_import / R | 外部输入也须本地确认可用性 |
| jd_version_ref / requirement_graph_ref | Ref / O | 外部未提供不伪造；本地 requirements 仍必填 |
| jd_text | string / R | 自包含可读岗位定义 |
| department / team / seniority / location / employment_type | ValueWithStatus / R | 明确 unknown/not_applicable |
| hiring_manager_ref / recruiter_ref | ActorRef / O | 决策门槛适用时须有效对应人员 |
| responsibilities | string[] / R ≥1 | 岗位职责 |
| requirements | JobRequirement[] / R ≥1 | 见下表 |
| dimensions | MatchDimension[] / R ≥1 | 所有 requirements 引用可解析 |
| compensation_range | MoneyRange或null / R | 不等同 Offer 预算批准 |
| scoring_policy_ref / workflow_policy_ref | Ref / R | 精确版本 |
| confirmed_by / confirmed_at | ActorRef / C；datetime / C | confirmed 必填；human |
| content_hash | string / R | 规范化内容摘要 |

| 嵌套实体 | 字段 / 类型 / 必填 | 约束 |
|---|---|---|
| JobRequirement | requirement_id:string R；description:string R；dimension_id:string R；competency_ids:string[] R；priority:must_have/nice_to_have R；is_hard_constraint:bool R；constraint_kind:location/authorization/certification/language/skill/experience/compensation/other O；predicate:object C；required_level:string O；evidence_standard:string R；criterion_weight:number R | dimension 内权重和为1；predicate 在可机器判定时必填，字段为operator:eq/gte/lte/in/range、expected:JSON、unit:string O；禁止从自由文本猜硬门槛 |
| MatchDimension | dimension_id:string R；name:string R；description:string R；weight:number≥0 R；applicability:applicable/not_applicable R；rubric_ref:Ref R；rubric_anchors:RubricAnchor[] R ≥2 | 适用维度权重和为1；不可全部0 |
| RubricAnchor | score:number[0,100] R；behavior_description:string R；evidence_expectation:string R | 包含0与100锚点；不是概率 |

### 3.2 ScreeningPolicySnapshot

| 字段 | 类型/必填 | 约束 |
|---|---|---|
| algorithm_version / rubric_set_hash | string / R | 聚合和评分基线 |
| min_coverage | number[0,1] / R | 默认0.70 |
| recommendation_rules | RecommendationRule[] / R ≥1 | rule_id:string、priority:int、conditions:object、outcome:RecommendationEnum 均R；按priority升序首命中；必须最后有 unconditional review |
| confidence_method / confidence_version | string / R | 定义置信度计算，不与匹配分数混用 |
| ai_policy_ref / retention_policy_ref | Ref / R | 有效配置 |
| allowed_preference_features | string[] / R | 岗位相关 allowlist |
| prohibited_features | string[] / R | 受保护属性及禁止代理 |
| unknown_hard_constraint_action | review/block_transition / R | 默认 review；推进规则单独判断 |
| model_baseline_ref / prompt_template_ref | Ref / R | 同 cohort 不混基线 |
| decision_policy_ref | Ref / R | 审批与覆盖权限 |

RecommendationRule.conditions 是下列字段的 AND：eligibility_in:EligibilityEnum[] O、min_score:number O、min_coverage:number O、max_open_blockers:int O、unconditional:bool O；unconditional=true 时不得附其他条件。overall=null 不满足任何 min_score 条件。推荐阈值由岗位策略确认，不能由模型临时发明。

### 3.3 WorkflowPolicySnapshot

| 字段 | 类型/必填 | 说明 |
|---|---|---|
| allowed_targets | assessment/interview/human_review 数组 / R | 允许目标 |
| assessment_disposition | required/optional/not_required / R | 未安装不自动改写 required |
| decision_approvals_required | int≥1 / R | 默认1；配置可双人 |
| required_approval_roles | string[] / R | 满足人数且角色规则 |
| exception_approval_roles | string[] / R | 默认 HR、HM，两位不同人 |
| block_on_unresolved_hard_requirement | bool / R | true时必须解决或有效例外 |
| allow_stale_basis_exception | bool / R | 默认false |
| target_routes | Route[] / R | target_module:string、transport:email/file/api、destination_ref:Ref 均R |

## 4. Screening Input Contract

### 4.1 ScreeningRequest

| 字段 | 类型/必填 | 说明 |
|---|---|---|
| request_id / session_ref | string R / Ref R | 请求和业务筛选session |
| job_id / candidate_id / application_id | string / R | 与通用头一致，不允许错配 |
| role_criteria_snapshot | RoleCriteriaSnapshot / R | confirmed自包含快照 |
| candidate_profile_snapshot | CandidateProfile / R | partial允许；至少一个可用来源 |
| resume_version_refs | Ref[] / R | 无简历时[] |
| screening_policy_snapshot / workflow_policy_snapshot | 对应对象 / R | 有效、精确版本 |
| effective_preference_snapshot | PreferenceProfile / R | 无偏好也传显式空规则版本，不能隐式latest |
| input_manifest | InputManifest / R | 见§4.2 |
| requested_by / requested_at | ActorRef R / datetime R | 系统可请求分析，不能批准决定 |
| run_mode | ai_assisted/manual / R | 人工路径也锁定输入 |
| batch_ref | Ref / O | 批次条目关联 |
| idempotency_key | string / R | 业务重试稳定键 |

接收允许 incomplete intake，但不得将 incomplete Intake 冒充有效 ScreeningRequest。正式岗位Screening运行缺人工确认Application、confirmed标准/可用来源返回 INPUT_NOT_READY；可创建补资料任务。共享服务不可达但本地快照有效可继续；缺有效权限/策略则禁止相关动作。

### 4.2 InputManifest & AgentRun

| 对象 | 字段 / 类型 / 必填 | 用途 |
|---|---|---|
| InputManifest | manifest_id:string R；entries:ManifestEntry[] R ≥1；manifest_hash:string R；captured_at:datetime R | 完整输入冻结 |
| ManifestEntry | kind:role/profile/source/policy/preference/rubric/workflow/parser/prompt/model R；ref:Ref R；content_hash:string R；snapshot:object或string C；artifact_ref:ArtifactRef C | 至少有一个快照载体；模型用可重建配置元数据，不要求模型权重副本 |
| AgentRun | evaluation_ref:Ref R；status:queued/running/succeeded/failed/cancelled R；provider/model_identifier/model_version:string C；prompt_ref:Ref C；prompt_hash:string C；parameters:object C；parser_version:string C；input_manifest_ref:Ref R；started_at/completed_at:datetime C；output_hash:string C；error:ErrorEnvelope C | AI已启动时模型/prompt/参数必填；结束时completed_at；成功output_hash；失败error；人工不伪造AgentRun |
| ScreeningSession | application_ref:Ref R；purpose:initial/rescreen/correction R；status:open/closed R；evaluation_refs:Ref[] R；owner_ref:ActorRef R | 重评新Evaluation，历史保留 |

## 5. Screening Output Contract

### 5.1 ScreeningResult / ScreeningEvaluation

ScreeningResult 是 Evaluation 的边界表示；独立实体 ID 用 object_id，`screening_id` 是相同值的兼容别名。结果生成不等于人工复核或交接完成。

| 字段 | 类型/必填 | 约束 |
|---|---|---|
| screening_id / session_ref | string R / Ref R | evaluation稳定ID与session |
| status | queued/running/completed/failed/cancelled / R | completed表示评估完成，不表示eligible/Advance |
| evaluation_mode / ai_status | ai_assisted/manual R；available/unavailable/not_requested R | 人工评估无AI建议时用null |
| input_manifest_ref / input_snapshot | Ref R / InputManifest R | 自包含重建依据 |
| eligibility_status | eligible/likely_eligible/needs_verification/not_eligible / C | completed必填 |
| eligibility_results | EligibilityResult[] / C | completed必填，覆盖全部适用hard requirements |
| overall_score | number[0,100]或null / R | 低覆盖、失败或未运行必须null |
| scale | object / R | {min:0,max:100,label:"role_match"} |
| evaluation_status | evaluated/insufficient_evidence/not_evaluated / R | 与运行status分离 |
| coverage / confidence | number[0,1]或null / R | coverage按权重；confidence方法由policy指定，无依据为null |
| dimension_scores | DimensionScore[] / R | completed覆盖全部维度；未评维度显式状态 |
| strengths / claims | AIClaim[] / R | strengths为正向子集，claim_id一致，不重复生成实体 |
| concerns / verification_items | Concern[] R / VerificationItem[] R | 可空，不省略 |
| evidence_items / evidence_links | EvidenceItem[] R / EvidenceLink[] R | 精确版本与源定位 |
| missing_information | MissingInformation[] / R | field_path:string、requirement_id:string O、reason:string、verification_item_ref:Ref O |
| recommendation | Recommendation或null / R | AI失败/人工路径可null |
| human_decision_ref | Ref或null / R | 当前读模型指针；历史包冻结决定版本 |
| ranking_context | RankingContext或null / R | 未纳入cohort则null |
| model_version / policy_version | string或null R / int R | model_version须与AgentRun一致；无AI为null |
| agent_run_ref | Ref / C | AI路径已有run时必填 |
| freshness | current/stale/restricted/withdrawn / R | 输入更正/撤回后更新读模型并发事件，原版本不覆盖 |
| completed_at | datetime / C | completed必填 |

### 5.2 EligibilityResult, DimensionScore, Recommendation

| 对象 | 字段 / 类型 / 必填 | 规则 |
|---|---|---|
| EligibilityResult | requirement_id:string R；status:met/provisionally_met/not_met/unknown/conflicting/not_applicable R；reason:Reason R；evidence_refs:Ref[] R；confidence:number或null R；verification_item_refs:Ref[] R | met/not_met需可支撑证据；unknown/conflicting须验证项；provisionally_met不等于独立验证 |
| DimensionScore | dimension_id:string R；status:evaluated/unknown/not_evaluated/not_applicable R；score:number或null R；weight:number R；rubric_ref:Ref R；criterion_results:CriterionResult[] R；reason:Reason R；supporting_evidence_refs/counter_evidence_refs:Ref[] R；confidence:number或null R | score非null iff evaluated；覆盖不足转unknown |
| CriterionResult | requirement_id:string R；status:evaluated/unknown/not_applicable R；score:number或null R；evidence_refs:Ref[] R；reason:Reason R | 已评价有证据；null非0 |
| Recommendation | outcome:strong_advance/advance/review/hold/do_not_advance R；reason:Reason R；rule_id:string R；key_claim_refs:Ref[] R；open_verification_refs:Ref[] R；suggested_target:assessment/interview/human_review/none R | 不含批准效力 |

确定性聚合：先对维度内适用要求按 criterion_weight 归一化；任一适用要求 unknown 时该维度默认unknown（本聚合策略不对半维度评分）。再令 A=适用维度集合，E=已评价集合，coverage=ΣE weight/ΣA weight；当coverage≥min_coverage，overall=ΣE(weight×score)/ΣE weight，否则null。所有适用维度为空时拒绝无效标准。内部保留小数，UI四舍五入整数；排序使用未舍入值。eligibility 聚合优先级：任何not_met→not_eligible；否则unknown/conflicting→needs_verification；否则provisionally_met→likely_eligible；否则eligible。不存在适用hard requirements时eligible，并记录no_hard_constraints。

### 5.3 RankingSnapshot

| 字段 | 类型/必填 | 规则 |
|---|---|---|
| cohort_id / job_ref | string R / Ref R | 岗位内比较 |
| baseline | object / R | role_criteria_ref、policy_ref、rubric_hash、model_baseline_ref、prompt_ref、effective_preference_ref、algorithm_version均R |
| view_scope / owner_ref | team/personal R / ActorRef C | personal必填owner |
| members | RankingMember[] / R | application_ref、evaluation_ref、eligibility_bucket、score:number或null、coverage:number、rank:int或null、reason:string均R |
| excluded | ExcludedMember[] / R | application_ref:Ref、reason_code:string均R |
| generated_at / algorithm_version | datetime R / string R | 固定时点集合 |
| member_set_hash | string / R | 包括所有成员及Evaluation版本 |

Rank仅在相同eligibility bucket且overall非null的人内按score降序、coverage降序计算，完全同值用竞争排名1,1,3；ID只作稳定显示。unknown score成员rank=null。RankingContext={ranking_ref:Ref R,cohort_id:string R,bucket:string R,rank:int或null R,total_in_bucket:int R}。无可比结果不能补名次。

## 6. Evidence Schema, Claims & Concerns

### 6.1 EvidenceItem

| 字段 | 类型/必填 | 语义 |
|---|---|---|
| evidence_id | string / R | object_id别名 |
| source_ref / source_version_hash | Ref R / string R | 原材料精确版本 |
| source_type | resume/profile/application_answer/referral/assessment/interview/human_note / R | 不把Resume claim变成test evidence |
| evidence_kind | candidate_claim/documented_fact/observed_demonstration/third_party_claim / R | 来源性质 |
| statement | string / R | 忠实摘要，不增加事实 |
| quote | string / O | 可展示授权范围内原文 |
| locator | EvidenceLocator / R | 见下表 |
| requirement_ids | string[] / R | 无映射可空 |
| provenance_root_id | string / R | 同一原始自述转述共享root，不当独立验证 |
| verification_status | unverified/verified/disputed/unverifiable / R | verified需明确验证依据 |
| verification_refs | Ref[] / C | verified时≥1，不能自证循环 |
| confidence | number[0,1]或null / R | 提取/支持置信度，不是候选人能力 |
| observed_at / extracted_at | datetime O / datetime R | 区分事实时间与处理时间 |
| availability | available/restricted/deleted/unavailable / R | 不可访问不伪造定位 |
| access_policy_ref / retention_policy_ref | Ref / R | 来源访问与保留 |

EvidenceLocator：kind=pdf/text/json/media/manual R；page:int≥1 C(pdf)；char_start/char_end:int C(text，0-based半开区间，基于固定提取文本版本)；json_pointer:string C(json)；start_ms/end_ms:int C(media)；note_id:string C(manual)；section_label:string O。所需定位字段不足时不得发布为available，需修复或unavailable说明。

### 6.2 AIClaim & EvidenceLink

| 对象 | 字段 / 类型 / 必填 | 说明 |
|---|---|---|
| AIClaim | claim_id:string R；evaluation_ref:Ref R；statement:string R；claim_type:strength/observation/inference R；requirement_ids:string[] R；evidence_refs:Ref[] R；confidence:number或null R；verification_status:unverified/verified/disputed R；origin:ai/human R | strength必须≥1支持证据；inference显式标记，不变原始事实 |
| EvidenceLink | link_id:string R；evidence_ref:Ref R；target_ref:Ref R；relationship:supports/contradicts/context_only R；requirement_id:string O；rationale:string R | N:M关联，target可Claim、Concern或CriterionResult；context_only不能作为扣分依据 |

### 6.3 Concern Schema

| 字段 | 类型/必填 | 规则 |
|---|---|---|
| concern_id / evaluation_ref | string R / Ref R | 稳定版本实体 |
| concern_type | skill_gap/experience_gap/compensation/location/authorization/context_adaptability/evidence_conflict/missing_information/other / R | other需说明 |
| title / description | string / R | 描述与岗位相关问题 |
| basis | observed_mismatch/hypothesis/missing_information / R | hypothesis不冒充事实 |
| severity / confidence | low/medium/high/blocker R；number或null R | blocker须岗位硬条件支持，不能仅凭猜测 |
| requirement_ids | string[] / R ≥1 | 具体岗位关系 |
| evidence_refs | Ref[] / R | observed_mismatch≥1；missing可空 |
| missing_field_paths | string[] / C | basis=missing_information时≥1 |
| verification_item_refs | Ref[] / R ≥1 | 明确如何验证 |
| verification_status | open/in_progress/confirmed/dismissed/accepted_risk / R | accepted_risk不是事实验证通过 |
| resolution | ConcernResolution或null / R | 未解决null |

ConcernResolution={outcome:confirmed/dismissed/accepted_risk R,reason:Reason R,evidence_refs:Ref[] R,resolved_by:ActorRef R,resolved_at:datetime R,approval_refs:Ref[] C}。accepted_risk需对应审批，原能力分数/资格不被改成通过；confirmed/dismissed必须有结果证据或可审计人工核验记录。

### 6.4 VerificationItem

| 字段 | 类型/必填 | 说明 |
|---|---|---|
| verification_item_id / evaluation_ref | string R / Ref R | 追踪同一问题 |
| requirement_ids / concern_refs | string[] R / Ref[] R | 至少有岗位要求关联 |
| question / reason | string R / Reason R | 可直接交给下一模块的问题 |
| method | document_request/candidate_question/assessment/interview/reference_check / R | 不代表自动发起外部核验 |
| target_stage / priority | screening/assessment/interview R；low/medium/high R | 建议目标 |
| acceptance_criteria | string / R | 什么证据足以关闭问题 |
| source_evidence_refs | Ref[] / R | 已有背景 |
| owner_ref / due_at | ActorRef O / datetime O | 未分配可省略 |
| status | open/assigned/in_progress/resolved/inconclusive/cancelled / R | inconclusive仍为缺口 |
| outcome / resolution_evidence_refs | met/not_met/unknown/not_applicable或null R；Ref[] R | resolved需非null结果和≥1依据 |
| resolved_by / resolved_at | ActorRef C / datetime C | resolved/inconclusive/cancelled时必填 |
| resolution_reason | Reason / C | 关闭或无法判定必填 |

下游通过 VerificationResolution 消息返回 verification_item_ref、outcome、evidence_refs、reason、resolved_by、resolved_at（均R）；Screening验证权限和来源后追加本地版本，下游不直接写Screening表。结果影响原结论时创建重评任务，不覆盖已交付包。

## 7. Preference Profile, Signal & Feedback

### 7.1 PreferenceProfile

| 字段 | 类型/必填 | 规则 |
|---|---|---|
| profile_id | string / R | 稳定逻辑profile |
| scope / scope_id | organization/team/role/user/effective R；string R | 不跨组织学习 |
| status | draft/proposed/active/superseded/rejected / R | 正式run仅active |
| rules | PreferenceRule[] / R | 空数组表示显式无附加偏好 |
| parent_refs / contributing_profile_refs | Ref[] / R | effective列全部组成版本 |
| signal_refs | Ref[] / R | 人工初始配置可空 |
| policy_ref | Ref / R | allowlist、治理与范围 |
| effective_hash | string / R | 解析后规则摘要 |
| approved_by / activated_at | ActorRef C / datetime C | 共享版本active需授权human；空默认由受控初始化策略创建 |
| conflict_resolution | string[] / R | 逐项记录继承/覆盖决定 |

PreferenceRule={feature_key:string R,requirement_id:string O,dimension_id:string O,weight_adjustment:number R,usage:official_scoring/personal_view R,rationale:string R}。正式计分需引用岗位已有维度，解析后重新归一化并产出confirmed基线，不改hard条件。治理策略优先，Role覆盖Team/Org默认；User仅personal_view。effective snapshot可由服务在获批组成版本下确定性生成，保留source_refs与策略依据。

### 7.2 PreferenceSignal

| 字段 | 类型/必填 | 规则 |
|---|---|---|
| signal_id / feedback_event_ref | string R / Ref R | 每个反馈+feature+scope唯一 |
| scope / scope_id | organization/team/role/user R；string R | 来源权限范围 |
| feature_key / direction / strength | string R；increase/decrease/neutral R；number[0,1] R | 不以操作次数无限累加 |
| extraction_method / model_run_ref | explicit_reason/rule/ai R；Ref C | AI提炼必填run |
| evidence_refs / confidence | Ref[] R；number或null R | 记录支持的业务依据 |
| eligibility | eligible/insufficient_context/prohibited/retracted / R | 非eligible不得训练 |
| status | proposed/accepted/rejected/retracted / R | 不直接激活profile |
| valid_from / expires_at | datetime R / datetime O | 避免无限继承过时偏好 |
| reviewer_ref / review_reason | ActorRef C / Reason C | accepted/rejected/retracted需记录 |

### 7.3 FeedbackEvent

| 字段 | 类型/必填 | 规则 |
|---|---|---|
| feedback_event_id / occurred_at / actor | string R / datetime R / ActorRef R | 追加事实记录 |
| evaluation_ref / input_manifest_ref | Ref / R | 当时实际看到的版本 |
| action | shortlist/advance/hold/reject/override_ai/change_score/concern_incorrect/strength_important/request_information / R | 统一事件taxonomy |
| target_ref | Ref / R | 具体evaluation/concern/claim |
| ai_recommendation_snapshot | Recommendation或null / R | 无AI时null |
| human_decision_ref | Ref / C | 决定相关action必填 |
| before_value / after_value | JSON或null / R | 对改分等记录差异 |
| reason | Reason / R | 不足理由仍记录反馈，但signal不可用 |
| learning_eligibility | eligible/insufficient_context/prohibited/opted_out / R | 应用policy，不默认训练 |
| supersedes_feedback_ref | Ref / C | 纠正反馈时必填，旧事件不可改写 |

反馈采集、提案聚合、审核与激活均为完整范围；提案聚合需记录样本数、时间窗口、feature分布、评估结果和审批；共享版本不得无人审核激活。偏好变化不追溯修改历史结果或人工决定。

## 8. Human Decision & Workflow Transition

### 8.1 ScreeningDecision

| 字段 | 类型/必填 | 约束 |
|---|---|---|
| decision_id / evaluation_ref | string R / Ref R | 精确评估依据 |
| input_manifest_ref | Ref / R | 不接受仅latest |
| outcome | strong_advance/advance/hold/reject / R | Strong Advance也是人工结果，不是AI自动复制 |
| reason / decided_by / decided_at | Reason R / ActorRef R / datetime R | human，当前有权 |
| status | pending_approval/approved/superseded/revoked / R | approved须满足policy |
| approval_refs | Ref[] / R | 与本决定版本绑定 |
| override_ai | bool / R | 不同方向时true，原推荐保留 |
| exception_refs | Ref[] / R | 无例外[] |
| policy_ref / expected_evaluation_version | Ref R / int R | 防止陈旧提交 |

HumanAssessment：evaluation_ref:Ref R、dimension_overrides:DimensionScore[] R、reason:Reason R、assessed_by:ActorRef R（human）、assessed_at:datetime R。它是独立对象；AI结果保持不变。ranking默认仍用统一AI基线；人工排序须新scope和明示排序算法。

ExceptionRecord：scope:string R、requirement_refs:Ref[] R、workflow_stage:string O、reason:Reason R、approval_refs:Ref[] R、policy_ref:Ref R、expires_at:datetime O、status:active/revoked/expired R。审批人数/角色依WorkflowPolicy；例外不改变原not_met/unknown证据状态。

### 8.2 WorkflowTransition

| 字段 | 类型/必填 | 说明 |
|---|---|---|
| transition_id / decision_ref | string R / Ref R | 招聘推进须Advance类且approved；human_review分派使用ReviewTask |
| from_stage / target_stage | screening R；assessment/interview R | human_review是协作分派，使用独立ReviewTask，无需伪造Advance |
| workflow_policy_ref | Ref / R | 锁定路由和门槛 |
| requested_by / requested_at | ActorRef R / datetime R | 人工显式推进授权 |
| status | requested/blocked/dispatch_pending/awaiting_receipt/accepted/declined/cancelled / R | 不表示目标业务完成 |
| assessment_disposition | required_pending/required_completed/optional/not_required/waived / R | Interview路由须满足适用规则 |
| prerequisite_refs / exception_refs | Ref[] / R | 声明依据；无测评不虚构成绩 |
| package_ref / exchange_id | Ref C / string C | dispatch_pending及以后必填 |
| blocker_codes | string[] / R | blocked时非空 |
| target_case_ref / receipt_ref | Ref C / Ref C | accepted时由目标提供 |
| expected_application_version | int / R | 防并发重复推进 |

状态：requested→blocked或dispatch_pending→awaiting_receipt→accepted/declined；发送失败仍dispatch_pending并单独记录attempt；取消未接收请求→cancelled。accepted后撤销通过新 ChangeNotice/CancelRequest 由目标确认，不能直接倒改为cancelled。来源 ScreeningDecision 和报告完成状态不因目标失败回滚。

ReviewTask统一使用§18的HumanTask，task_type=screening_review；application/evaluation作为subject_refs。分派不属于招聘推进，不另建孤立待办体系。

## 9. Handoff Contracts: JD / Assessment / Interview

### 9.1 Exchange Envelope（邮件/文件/API 通用）

| 字段 | 类型/必填 | 定义 |
|---|---|---|
| exchange_id / package_ref | string R / Ref R | 同一交接稳定ID，包精确版本 |
| producer / recipient | string R / string R | 来源与目标系统或人员路由 |
| requested_action | review_only/create_assessment/create_interview/update_material/withdraw_material / R | 报告交付不默认启动业务 |
| correlation_id / schema_version | string R / semver R | 追踪与兼容 |
| payload / manifest | object R / PackageManifest R | 自包含必要快照与附件清单 |
| payload_hash | string / R | SHA256规范化JSON；签名字段排除自身 |
| transport / sent_at | email/file/api R / datetime O | 各次attempt另记 |
| reply_route_ref / authorization_ref | Ref O / Ref R | 回执路由与本次交付授权 |

PackageManifest={entries:PackageEntry[] R,package_hash:string R,access_limitations:string[] R}；PackageEntry={path:string R,media_type:string R,content_hash:string R,size_bytes:int R,required:bool R}。文件使用安全相对路径，拒绝绝对路径/路径穿越。逻辑包至少包含manifest.json、payload.json、可独立阅读的report.md以及必要授权材料或本地可用快照。临时URL不替代必要快照；受限原文可裁剪为获授权摘录并显式限制。

### 9.2 JD → Screening

RoleDefinitionPackage={role_criteria_snapshot:RoleCriteriaSnapshot R,source_job_ref:Ref R,change_reason:Reason O,supersedes_package_ref:Ref C}，置于Exchange Envelope。无JD模块时本地确认生成同型快照，source_system=screening_local，保留原JD来源。

接收核验：Schema、租户、摘要、来源映射、要求ID唯一、维度权重、rubric和工作流引用完整。draft只进入待确认Intake；confirmed才可运行。收到新JD版本标受影响Evaluation stale并创建重评任务，不覆盖旧标准或自动重发下游。

### 9.3 ScreeningPackage（标准输出包）

| 字段 | 类型/必填 | 定义 |
|---|---|---|
| status | prepared/published/superseded/withdrawn / R | 与Evaluation状态分离 |
| review_status | unreviewed/human_reviewed / R | unreviewed仅review_only |
| screening_ref / match_assessment_ref | Ref / R | 都可映射同一Evaluation，保留旧Interview语义 |
| application_snapshot | Application / R | 本地案件+外部映射 |
| role_snapshot / candidate_profile_snapshot | RoleCriteriaSnapshot R / CandidateProfile R | 目标无需实时回源 |
| evaluation_snapshot | ScreeningResult / R | 证据、缺口、AI运行与当时基线 |
| decision_snapshot | ScreeningDecision或null / R | review_only可null；启动请求需approved Advance |
| evidence_items / claims / concerns / verification_items | 对应数组 / R | 引用均须可解析到本包或授权快照 |
| input_manifest | InputManifest / R | 精确版本追溯 |
| ranking_context | RankingContext或null / R | 默认不含其他候选人信息 |
| transition_ref | Ref / C | create_assessment/create_interview必填 |
| summary | string / R | 可独立阅读：结论、理由、缺口、复核状态 |
| published_by / published_at | ActorRef C / datetime C | published必填；动作授权须验证 |
| access_limitations | string[] / R | 裁剪、不可访问源等 |

### 9.4 Screening → Assessment

AssessmentHandoffRequest 包含 ScreeningPackage，加以下字段：

| 字段 | 类型/必填 | 约束 |
|---|---|---|
| assessment_objectives | Objective[] / R ≥1 | objective_id:string、requirement_ids:string[]、description:string、evidence_to_collect:string均R |
| verification_item_refs | Ref[] / R | 对应包中真实问题 |
| requested_assessment_type | string / O | 建议，目标自行确认计划 |
| deadline / locale | datetime O / string O | 不替代目标邀请确认 |
| contact_ref | Ref / C | 发送邀请前由目标核验可解析，不必复制到所有包 |
| transition_snapshot | WorkflowTransition / R | approved人工推进及门槛 |

Assessment接收仅建立本地Intake，核验测试配置、联系方式及权限后才发邀请。返回Receipt包括target_case_ref。结果通过AssessmentOutcomeNotice返回assessment_ref、application_mapping、completion_status、outcome、score/scale（有分数时）、evidence_refs、verification_resolutions、completed_at（均按条件）；completion_status=completed不等于outcome=pass。Assessment自主拥有测试证据，不允许Screening改写。

### 9.5 Screening → Interview

InterviewHandoffRequest 包含 ScreeningPackage，加以下字段：

| 字段 | 类型/必填 | 定义 |
|---|---|---|
| interview_objectives | Objective[] / R ≥1 | 待验证能力与背景 |
| gaps_to_verify | VerificationItem[] / R | 稳定ID、问题、已有证据、验收标准 |
| assessment_disposition | required_completed/optional/not_required/waived / R | required_pending不得交接启动；optional无结果如实标未提供 |
| assessment_package_refs | Ref[] / R | 未提供[]，不制造通过 |
| exception_refs | Ref[] / C | waived或越过明确底线时必填 |
| transition_snapshot | WorkflowTransition / R | 人工授权 |
| candidate_contact_ref | Ref / O | 实际排期前由Interview补齐 |

Interview可以独立启动且不要求Screening包；本表约束的是从Screening主动交接的请求。它自行核验本地计划、输入和审批，不能将上游Advance当作Interview最终结论。返回VerificationResolution或InterviewOutcomeNotice仅更新证据/反馈，不自动重写旧筛选决定。

### 9.6 与既有 Interview Interface v1.0 的字段映射

| 旧字段 | 本契约来源 / 适配行为 |
|---|---|
| screening_ref / match_assessment_ref / status | package对应refs；Evaluation completed映射旧completed；package发布状态另留 |
| input_profile_ref / input_requirement_graph_ref | profile精确ref；有外部graph则引用，否则传本地confirmed graph映射，禁止虚造外部ID |
| candidate_role_match[] | CriterionResult逐requirement映射match_status、score、scale、evidence、confidence |
| claims[] | AIClaim + Evidence source refs + verification_status |
| evidence_refs / uncertainties / contradictions | Evidence、missing_information、conflicting Eligibility/EvidenceLink |
| recommendation / rationale | Recommendation；无AI以明确unavailable扩展或人工来源适配，不伪造AI |
| gaps_to_verify | VerificationItem映射requirement_id/question_to_resolve/source_refs，保留稳定ID扩展 |
| StageEligibilityRecord | WorkflowTransition + WorkflowPolicy + ExceptionRecord；不能伪造上游门槛通过 |

旧消费者若强制共享Application/前序包/全局graph或不支持unavailable，先协商适配版Schema；不能静默满足冲突字段。Independent input规则采用Interview PRD v1.5与Module Boundaries v2.0；本文件不声称旧Interface已被修改。

### 9.7 DeliveryReceipt & ChangeNotice

| 对象 | 字段 / 类型 / 必填 | 说明 |
|---|---|---|
| DeliveryReceipt | receipt_id:string R；exchange_id:string R；package_ref:Ref R；payload_hash:string R；status:received/needs_review/imported/rejected R；received_at:datetime R；processed_at:datetime C；target_case_ref:Ref C；reason:Reason C；missing_fields:string[] R | imported需case_ref和processed_at；rejected/needs_review需reason；received不是接受启动 |
| ChangeNotice | notice_id:string R；affected_refs:Ref[] R ≥1；change_type:corrected/superseded/restricted/withdrawn R；replacement_ref:Ref C；reason:Reason R；effective_at:datetime R；required_action:review/restrict_use/replace_snapshot R | 更正有replacement；接收方本地评估影响、反馈处理结果 |

Transition accepted只在目标明确imported且接受请求时成立；review_only的imported不推进业务。对人工邮件没有机器回执时显示sent_no_receipt/awaiting_confirmation，不伪造目标确认。通知来源变更不保证远程删除已交付普通附件。

## 10. Batch Contracts & Logical Operations

### 10.1 Batch

Batch={batch_id:string R,job_ref:Ref R,baseline_manifest:InputManifest R,requested_by:ActorRef R,status:queued/running/completed/partial_success/failed/cancelled R,items:BatchItem[] R≥1,counts:object R,created_at:datetime R,completed_at:datetime C}。

BatchItem={item_id:string R,source_ref:Ref R,application_ref:Ref O,request_ref:Ref O,evaluation_ref:Ref O,status:received/needs_mapping/queued/running/completed/failed/cancelled R,attempt_count:int R,error:ErrorEnvelope C}。counts按当前条目互斥状态计算，合计等于items数。全部成功为completed；成功与失败混合为partial_success；全部失败为failed；取消优先标cancelled并保留完成数。重复导入先归并同一来源/案件，不能重复计为成功人次。

### 10.2 Logical Operations（建议HTTP映射，尚未部署）

| 操作 | 建议路径 | 输入→输出 / 约束 |
|---|---|---|
| Create intake | POST /v1/screening-intakes | 来源材料→intake_id/status/missing_fields |
| Confirm role | POST /v1/role-snapshots/{id}/confirm | expected_version + human确认→新confirmed版本 |
| Screen | POST /v1/screening-requests | ScreeningRequest→202 request_ref/evaluation_ref/status_url |
| Batch screen | POST /v1/screening-batches | Batch请求→202 batch_ref |
| Get result | GET /v1/screenings/{id}?version=N | ScreeningResult；缺version为明确标注的当前读模型 |
| Decide | POST /v1/screenings/{id}/decisions | Decision submission→Decision；If-Match必需 |
| Feedback | POST /v1/screenings/{id}/feedback | FeedbackEvent→持久化ref |
| Publish package | POST /v1/screenings/{id}/packages | requested_action/recipient/decision_ref→Package；校验授权 |
| Transition | POST /v1/workflow-transitions | WorkflowTransition请求→202 transition_ref |
| Receive package | POST /v1/screening-exchanges | Exchange→Receipt；导入异步时received |
| Receive receipt | POST /v1/delivery-receipts | Receipt→确认；不产生新请求 |
| Resolve verification | POST /v1/verification-items/{id}/resolutions | VerificationResolution→新版本 |
| Cancel batch | POST /v1/screening-batches/{id}/cancel | reason+expected_version→状态；已完成结果保留 |

所有mutation用Idempotency-Key；读写权限逐对象验证；POST返回对象ref和审计correlation_id。确认/决定/取消绝不由GET或邮件链接预抓取触发。文件导入执行同等校验，无API也能使用同一业务逻辑。

## 11. Events

事件采用at-least-once投递；业务事实和outbox在本地同一事务提交。消费者维护inbox去重，不假设全局顺序。

EventEnvelope字段：event_id:string R、event_type:string R、event_version:semver R、occurred_at:datetime R、producer:string R、workspace_id/organization_id:string R、aggregate_ref:Ref R、aggregate_sequence:int R、correlation_id:string R、causation_id:string O、actor:ActorRef R、payload:object R、payload_hash:string R。event_id重试不变；人工动作actor=human，后台传播仍保留原decision_ref。

| 事件 | 生产者 / 触发 | 必填payload（除Envelope） | 消费与效力 |
|---|---|---|---|
| job.criteria.updated | JD/本地标准，新confirmed版本 | old_ref,new_ref,reason | 标影响结果stale，安排重评 |
| resume.received | Intake，保存来源版本 | source_ref,candidate_ref或pending_mapping_id | 启动解析，不代表分析完成 |
| screening.requested | Screening，有效请求受理 | request_ref,application_ref,manifest_ref | 排队 |
| screening.completed | Screening，Evaluation完成 | evaluation_ref,application_ref,manifest_ref | 通知复核，不自动推进 |
| screening.failed | Screening，任务终止失败 | request_ref,error | 运营重试/人工路径 |
| screening.decision_made | Screening，人工决定approved | decision_ref,evaluation_ref,outcome | 审计/反馈；仍需显式transition |
| screening.package.published | Screening，报告发布 | package_ref,review_status | 可交付Hold/Reject报告 |
| screening.handoff.requested | Screening，已授权交接 | transition_ref,exchange_id,package_ref,target | 发送/目标Intake |
| screening.handoff.receipted | Delivery，回执通过校验 | transition_ref或null,receipt_ref | 更新交付状态 |
| candidate.advanced | 本地Workflow，目标接受推进 | application_ref,transition_ref,decision_ref,target_case_ref | 通知/可选总览，不代表目标完成 |
| candidate.rejected | Screening，人工Reject approved | application_ref,decision_ref | 不默认对外发拒绝邮件 |
| screening.feedback.recorded | Screening，反馈提交 | feedback_ref,learning_eligibility | 合规信号提炼 |
| preference.profile.activated | scope owner，新版本激活 | old_ref或null,new_ref,approval_refs | 仅影响新run/显式重评 |
| verification.resolved | 原解决模块 | verification_item_ref,resolution_ref | 导入核验/影响复核 |
| screening.input.invalidated | 原来源更正/撤回 | affected_refs,notice_ref | 限制使用、通知接收者 |
| screening.batch.completed | Screening，批次终态 | batch_ref,counts,status | 结果通知，可partial |

消费者按aggregate_sequence检测缺口/乱序，旧版本归档不覆盖新版本；缺事件可读取受控当前快照对账。不得仅凭未授权事件字符串改变Application。邮件自动回复/回执不转换成新的screening.requested，防循环。

## 12. Versioning, Idempotency & Audit

### 12.1 Versioning

文档v1.0、Schema 2.0.0、object_version=N独立。删除字段、改变含义/类型、optional变required、状态机不兼容为major；可忽略新字段为minor；不改变语义的修正为patch。新增枚举若消费者无unknown分支视为major。

生产/消费方声明支持范围，不兼容返回UNSUPPORTED_SCHEMA。迁移采用显式适配并保留原包、映射版本、摘要和丢失字段说明；未知必需语义不能丢弃。旧major支持窗口须上线前确定，不能提前撤除。发布标准、输入快照、Evaluation、决定、偏好与Package均追加修订；提示/模型变化产生新Run、新结果，不覆盖旧分数。

### 12.2 Idempotency

API去重范围=(workspace_id,operation,idempotency_key)，保存规范化请求hash与原结果。相同键同hash返回原结果；不同hash返回409 IDEMPOTENCY_CONFLICT。重评用新key并purpose=rescreen，重复重试沿用旧key。关键决定/交接去重记录至少保留至相关案件及审计保留期结束，不能靠短期缓存保证唯一。

跨通道去重=(workspace_id,producer,exchange_id,package_version,recipient)，相同键不同hash拒绝。接收新包版本更新原case，不新建候选人/邀请；业务新轮次必须显式新请求ID。Inbox写入、目标case创建和回执outbox同事务。ACK丢失重发返回同receipt。Email transport message ID只是attempt标识，不替代exchange_id。

并发写必须If-Match或expected_object_version；不符409 VERSION_CONFLICT。AI输出与人工决定分别存储。当前结果指针变动通过审计记录，历史快照不变。发送失败不撤销决定或报告。

### 12.3 AuditRecord

| 字段 | 类型/必填 | 定义 |
|---|---|---|
| audit_id / occurred_at / actor | string R / datetime R / ActorRef R | 追加记录 |
| action / object_ref | string R / Ref R | 实际操作及精确对象版本 |
| before_ref / after_ref | Ref或null / R | 创建/撤销可null，保留差异引用 |
| reason | Reason / C | 改分、override、例外、撤回、终止重试必填 |
| authorization_policy_ref / authorization_result | Ref R / allowed/denied R | 当时授权判定，含拒绝尝试 |
| correlation_id / request_id | string R / string O | 故障和链路追踪 |
| input_manifest_ref / agent_run_ref | Ref / C | 评估生成相关必填适用字段 |
| content_hash | string / R | 内容完整性；不把原始PII写入通用日志 |

必须审计：来源导入/读取/导出、映射确认、解析纠正、标准确认、AI运行、人工改分/决定/审批、偏好激活、交接/回执、版本更正、权限拒绝和资料删除。审计只存事实与必要理由，不要求模型隐藏思维链。按策略保留/删除PII，删除后保留允许的tombstone与版本摘要，注明原文不再可复原；不承诺无限审计可重放。

## 13. Errors, Recovery & Security

ErrorEnvelope={code:string R,message:string R,retryable:bool R,field_paths:string[] R,correlation_id:string R,responsible_module:string R,suggested_action:string R,retry_after_seconds:int O,details:object O}。不暴露跨租户数据或敏感供应商响应。

| 错误码 / HTTP建议 | 可重试 | 行为 |
|---|---|---|
| INVALID_SCHEMA / 422 | 否 | 标字段路径，人工修复 |
| INPUT_NOT_READY / 422 | 否 | 补标准/资料，不编造值 |
| TENANT_MISMATCH / 403；ACCESS_DENIED / 403 | 否 | 拒绝，不返回其他租户实体细节 |
| REFERENCE_UNRESOLVED / 422 | 否 | 请求快照或修复映射 |
| UNSUPPORTED_SCHEMA / 422 | 否 | 协商适配或升级 |
| IDEMPOTENCY_CONFLICT / 409 | 否 | 保留原结果，调查生产方 |
| VERSION_CONFLICT / 409；STALE_INPUT / 409 | 否 | 刷新并复核，不能盲重试决定 |
| PARSE_FAILED / 422 | 视原因 | 坏文件补格式；临时服务问题可重试 |
| FILE_QUARANTINED / 422 | 否 | 隔离材料，不进入AI |
| AI_GENERATION_FAILED / 503 | 是 | 新attempt有界重试，失败可人工评估 |
| POLICY_UNAVAILABLE / 503 | 是 | 禁止依赖未知策略的操作，不用开放默认值 |
| HUMAN_DECISION_REQUIRED / 422 | 否 | 请求有效人工批准 |
| WORKFLOW_BLOCKED / 422 | 否 | 显示硬条件/阶段缺口，按策略处理 |
| RATE_LIMITED / 429 | 是 | 遵循Retry-After，租户公平排队 |
| DOWNSTREAM_UNAVAILABLE / 503 | 是 | 排队/重试，来源完成不回滚 |
| EVIDENCE_CONFLICT / 422 | 否 | 保留双向证据，生成验证项；评估可needs_verification完成 |
| PACKAGE_WITHDRAWN / 409 | 否 | 停止新用途，目标处理影响 |

异步业务问题写任务状态和ErrorEnvelope，不承诺都对应同步HTTP。默认最多5次自动attempt，指数退避加抖动（初始30秒、最大30分钟），供应商Retry-After优先；耗尽转dead-letter和负责人任务。该默认运行策略需配置版本；手动重试保留原attempt历史与幂等业务键。

文件/邮件/履历中的文字一律是不可信业务内容，不可控制系统工具。按workspace、job、用途与对象授权，传输/存储加密，URL受控且有有效期；日志和候选人通知不包含内部评分。原始薪资/工作授权材料最小范围可见，非必要不传下游。跨模块删除/撤回通知只能要求接收方处理，不宣称可回收所有邮件附件。

## 14. Contract Examples & Acceptance

以下为字段片段示例，不是省略通用头后可直接提交的完整请求。ID为示意值。

```json
{
  "eligibility_status": "needs_verification",
  "eligibility_results": [{
    "requirement_id": "req-work-auth",
    "status": "unknown",
    "reason": {"code": "NOT_PROVIDED", "explanation": "资料未说明工作授权"},
    "evidence_refs": [],
    "confidence": null,
    "verification_item_refs": [{"entity_type":"VerificationItem","entity_id":"verify-01","version":1,"source_system":"screening"}]
  }],
  "overall_score": null,
  "coverage": 0.55,
  "evaluation_status": "insufficient_evidence"
}
```

聚合例：适用维度weight=0.5/0.3/0.2，前两维score=80/60，第三维unknown；coverage=0.8，overall=(0.5×80+0.3×60)/0.8=72.5，UI显示73及80%覆盖率。未知硬条件仍保持needs_verification，72.5不能使其自动通过。若仅第一维已评，则coverage=0.5，overall=null。

| 编号 | 合同验收 |
|---|---|
| CT-01 | 独立导入JD+Profile，无外部全局ID，能生成完整快照和报告 |
| CT-02 | 同人跨岗位/租户错配Ref被拒；姓名相同不自动合并 |
| CT-03 | unknown分数必须null；coverage公式与例子一致；硬条件独立 |
| CT-04 | 已评分项缺证据或定位不合法时拒绝发布有效已评分结果 |
| CT-05 | 简历与面试复述共享provenance_root，不算两份独立验证 |
| CT-06 | AI Advance、人工Reject只产出Reject决定，无自动推进 |
| CT-07 | 相同键同内容返回原结果；不同内容409；邮件和文件同包只建一个case |
| CT-08 | v2已导入后v1晚到不覆盖、不重复发邀请 |
| CT-09 | JD/偏好/model变更分新cohort，历史排名可复原 |
| CT-10 | required Assessment未满足且无豁免，Interview启动被阻；独立无前序不伪造豁免 |
| CT-11 | Hold/Reject报告可发布review_only；unreviewed包不得启动目标流程 |
| CT-12 | 目标离线/ACK丢失，本地决定与报告保留，重试无重复副作用 |
| CT-13 | 两人并发决定产生版本冲突，审批不会跨版本复用 |
| CT-14 | 批次部分失败仅重试失败项；counts合计正确 |
| CT-15 | 源撤回后停止新交接并通知已登记接收者，保留影响审计 |
| CT-16 | 禁止feature生成prohibited Signal；用户显示偏好不改变正式团队标准 |
| CT-17 | AI失败人工路径可完成且推荐null，AgentRun不伪造成功 |
| CT-18 | JSON/file/email三种交付通过相同schema、权限、摘要和幂等检查 |

实施前工程交付：JSON Schema/OpenAPI、状态转换测试、契约fixtures、producer/consumer兼容矩阵、权限矩阵、保留策略、容量与SLO。本文已定义产品接口语义，这些工程产物不能静默改变未知处理、人工门槛、独立运行或事实所有权。

## 15. References & Change Log

参考 [Interview Interface v1.0](HireOS_Command_Interview_Interface_Spec_v1.0.md)、[Interview PRD v1.5](HireOS_Command_Interview_PRD_v1.5.md)、[Module Boundaries v2.0](HiOS_Command_Module_Boundaries_and_Interface_Spec_v2.0.md) 和 [原筛选对话](chatgpt-conversation://6a9ffa40-a8b8-83ea-b375-5e6bbc00def5)。旧接口的共享业务服务和强制前序依赖按新独立运行原则适配；不修改旧文件。

| 版本 | 变更 |
|---|---|
| v1.0 | 首次字段级契约；覆盖本地实体、输入/输出、Evidence/Concern/Verification、偏好反馈、人工决定、批次、事件、三方交接、兼容映射、审计、幂等及异常 |
| v1.1 | 2026-09-08：对齐PRD v1.3；补齐四类输入输出通道、无岗位入库、重复识别、关联前推荐与人工link、公共任务、候选人对比及模型路由。Schema提升2.0.0，明确旧消费者适配边界。 |

## 16. Module Boundaries & Transport Contracts

### 16.1 模块交互总表

| 对方 / 方向 | 必须交互的数据 | 可选数据 | 通道 / 责任 |
|---|---|---|---|
| M0 → Screening | workspace、有效身份权限、AI/保留/流程策略版本 | 团队/负责人、时区、默认路由 | 本地配置适配器或API；关键操作实时鉴权 |
| JD → Screening | Job标识/本地映射、confirmed RoleCriteriaSnapshot、岗位open/paused/closed状态 | 外部JD/requirement graph版本 | 邮件、文件、API、手动录入；缺外部JD服务本地确认标准 |
| Apply/Scout/ATS/Referral → Screening | 来源、候选人资料/简历、输入授权 | 外部候选人/申请ID、明确申请意向、联系方式 | 邮件、文件、手动、API；来源意向不自动变正式Application |
| Files → Screening | MaterialEnvelope、材料快照、提取/检查状态、操作ref | 建议归属、正文与附件父子关系 | 版本化事件/API或本地适配；文件Available不等于业务导入完成 |
| Screening → Files | MaterialConsumptionReceipt、ExportArtifactRef | 业务关联/补充说明 | 独立回执；源文件不被业务决定修改 |
| Screening ↔ Model Routing | task_type、精确输入/policy、数据类别、预算/期限；实际模型/输出及attempt记录 | 受限候选模型集合 | 公共调用接口/本地适配；模型只生成建议 |
| Screening ↔ Tasks | subject_refs、required_action、负责人/队列、版本；完成依据与状态 | 截止、协作者、提醒策略 | 事件/API/本地事务；人工作业与AI运行分离 |
| Screening → Assessment | §9 ScreeningPackage、人工Advance/Transition、测评目标、待验证项 | 建议测试类型、时限、获准联系方式 | 邮件/文件/API；Assessment核验本地计划后才邀请 |
| Screening → Interview | §9 ScreeningPackage、人工Advance/Transition、面试目标、待验证项、测评适用状态 | 已有AssessmentPackage、候选人联系方式 | 邮件/文件/API；Interview自行计划/审批，不继承为最终决定 |
| Assessment/Interview → Screening | 接收回执；补证结果/来源版本/候选人岗位映射 | 阶段结果用于反馈学习 | 事件/API、导入邮件/文件；不覆盖原始筛选结论 |
| Screening → 授权HR/HM或外部系统 | 可独立阅读的报告、包版本、复核状态、缺口 | 对比图表和获准附件 | 下载、邮件、文件导出；没有系统ACK也可完成人员交付 |

Screening不向Offer直接发放或批准录用。Job search结果筛选由其来源模块定义业务，公共Task承接人工待办；不因为任务共享而取得该模块全部数据。

### 16.2 四类输入方式

| 方式 | 用户/系统提供 | 校验与反馈 |
|---|---|---|
| 手动表单/粘贴 | JD文本、Profile字段、来源说明；可不选Job | 创建Intake；缺失字段明确标注，JD标准需人确认；不虚造简历或Application |
| 手动文件上传/文件夹读取 | PDF/DOCX/TXT/CSV或结构化交换包；扫描规则/授权 | 类型、大小、安全、文件稳定性、摘要、重复检测；逐项返回材料及消费状态 |
| 邮件正文/附件 | 授权邮箱范围、message_id、发件/接收时间、正文及附件 | 正文/附件分别保留来源；未知意图进待确认Intake；回执/自动回复不创建新请求 |
| API/事件 | 版本化对象、认证、Idempotency-Key、correlation_id | Schema/租户/引用/摘要/幂等校验；异步返回accepted及状态查询引用 |

非结构化邮件/文件只需可读资料即可入Intake，不要求用户手写JSON。系统提取为候选结构化字段，重要身份、岗位标准及岗位关联由人确认。发件地址、邮件标题、默认上传目录只能提供归属线索，不能替代权限或确认。建议岗位不是正式job link。

### 16.3 IntakeEnvelope & MaterialEnvelope

所有以下独立对象继承§1通用头。

| 对象 | 字段级定义（类型；必填） |
|---|---|
| IntakeEnvelope | intake_id:string R；channel:manual/file/email/api R；source_system:string R；received_at:datetime R；submitted_by:ActorRef O；authorization_ref:Ref R；material_refs:Ref[] R；inline_fields:object O；suggested_job_refs:Ref[] R；external_refs:ExternalRef[] R；status:received/validating/needs_review/accepted/rejected/failed R；error:ErrorEnvelope C（失败） |
| MaterialEnvelope | material_id:string R；version:int R；source_type:string R；source_ref:Ref R；artifact_ref:ArtifactRef R；checksum:string R；content_type:string R；read_status:pending/available/failed R；extraction_status:not_requested/pending/complete/partial/failed R；security_status:pending/passed/quarantined R；operation_ref:Ref R；target_module:string O；project_ref:Ref O |
| EmailSource | connection_ref:Ref R；message_id:string R；received_at:datetime R；sender:string R；body_material_ref:Ref O；attachment_material_refs:Ref[] R；in_reply_to:string O；exchange_id:string O；direction:inbound/outbound R；classification:business_input/receipt/auto_reply/unknown R |
| MaterialConsumptionReceipt | material_ref:Ref R；consumer_module:string R；status:unassigned/pending/accepted/needs_review/rejected/failed R；business_object_refs:Ref[] R；reason:Reason C（复核/失败/拒绝） |
| ExportArtifactRef | artifact_ref:ArtifactRef R；producer_module:string R；subject_refs:Ref[] R；generation_status:requested/generating/ready/failed/cancelled R；access_policy_ref:Ref R；operation_ref:Ref R |

Intake至少有一项material或inline_fields。Files中的business import accepted表示消费方成功接收材料，不表示人已确认Candidate×Job；关联状态只由LinkDecision/Application表示。邮件正文含个人信息时受同等材料权限约束。

### 16.4 输出方式与交付状态

| 方式 | 产物 | 完成含义 |
|---|---|---|
| 页面查看/手动下载 | Screening报告、原文权限内材料、Comparison图表；需要机器交换时导出完整包 | 生成ready、下载requested/transfer_served分开；不能声称已存用户磁盘 |
| 文件导出 | §9 manifest.json + payload.json + report.md，必要材料快照；对比可PNG/PDF | 原子写入完成标识后可导入；半包不得消费；不改动源文件 |
| 邮件交付 | 可读摘要/报告、明确请求动作、包或受控文件链接、业务任务URL、版本 | queued/submitted/delivered/bounced/failed/unknown；送达不等于目标接受 |
| API/事件 | ExchangeEnvelope、异步任务/对象refs、Receipt | 202受理不等于imported；需接收方明确回执 |

DeliveryAttempt字段：attempt_id、exchange_id、package_ref、transport、recipient_ref、requested_at、status均R；provider_message_id O；finished_at C（结束）；error C（失败）；retry_of O。邮件联系人必须来自获授权配置或明确用户输入；不能根据名称猜邮箱。默认先向内部请求人/目标路由交付，候选人通知使用单独模板和授权动作。

手动转交给人时可保存HumanDeliveryConfirmation：exchange_id、package_ref、confirmed_by(human)、confirmed_at、reason均R；表示人工确认交付，不伪造目标系统case_id或能力评估结果。target_case_ref未知则不产生机器candidate.advanced事件。

## 17. Library, Deduplication & Human Linking Contracts

### 17.1 Core Objects

| 对象 | 字段级定义 |
|---|---|
| LibraryEntry | entry_id:string R；candidate_ref:Ref O（身份未确认可无）；profile_ref:Ref O；material_refs:Ref[] R≥1；owner_ref:ActorRef或queue_ref二者至少一个；tags:string[] R；retention_policy_ref:Ref R；status:available/restricted/deleted R；created_at:datetime R。job/application非必填 |
| DuplicateCheck | check_id:string R；input_material_ref:Ref R；algorithm_version:string R；status:pending/complete/partial/failed R；matches:DuplicateMatch[] R；checked_at:datetime C（结束）；error:ErrorEnvelope C |
| DuplicateMatch | existing_ref:Ref R；kind:exact_file/same_content/possible_same_person/new_resume_version R；similarity:number或null R；reasons:string[] R；comparison_evidence_refs:Ref[] R；review_required:bool R |
| DuplicateResolution | check_ref:Ref R；outcome:reuse_file/same_person_new_version/different_person/defer R；chosen_candidate_ref:Ref C（同人）；reason:Reason R；resolved_by:ActorRef R（human，确定性复用文件可service）；resolved_at:datetime R；supersedes_resolution_ref:Ref O |
| JobDiscoveryRequest | candidate_profile_ref:Ref R；job_scope_ref:Ref R；policy_ref:Ref R；requested_by:ActorRef R；trigger:upload/profile_changed/job_changed/manual R；idempotency_key:string R |
| JobDiscoveryRun | request_ref:Ref R；job_snapshot_refs:Ref[] R；input_manifest:InputManifest R；status:not_started/running/recommendations_ready/no_match/no_open_jobs/insufficient_data/failed R；recommendation_refs:Ref[] R；reason:Reason C（无推荐/失败）；model_run_refs:Ref[] R |
| PreLinkMatchEvaluation | candidate_ref/job_ref:Ref R；application_id:null R；role_snapshot/profile_snapshot/policy_snapshot:对应对象 R；eligibility_results、dimension_scores、evidence_items、concerns、verification_items:对应数组 R；overall_score:number或null R；coverage:number R；reason:Reason R；input_manifest:InputManifest R |
| CandidateJobRecommendation | recommendation_id:string R；candidate_ref/job_ref/prelink_evaluation_ref:Ref R；status:proposed/confirmed/dismissed/deferred/stale/withdrawn R；rationale:Reason R；task_ref:Ref O；application_ref:Ref C（confirmed）；proposal_source:ai/manual/imported_intent R |
| LinkDecision | candidate_ref/job_ref:Ref R；recommendation_ref:Ref O（直接人工选岗可无）；input_manifest_ref:Ref R；action:confirm/dismiss/defer R；actor:ActorRef R（human）；reason:Reason R；decided_at:datetime R；expected_proposal_version:int C（有提案）；application_ref:Ref C（confirm成功）；prior_confirmation_ref:Ref O |

PreLinkMatchEvaluation内证据/维度类型复用§5–6；相应通用头application_id可空，evaluation_ref可指PreLinkMatchEvaluation。不得以缺Application拒绝这些对象，也不得将它们作为正式下游推进依据。

### 17.2 确认事务与状态约束

1. 文件去重以租户+content hash识别，可复用存储但保留各渠道来源；文本相似只提示，身份归并须人工核验。不按姓名或文件名自动合并。
2. 原有Application缺失时，AI只能建推荐和人工任务。LinkDecision confirm校验岗位open、输入freshness及权限后，原子创建/复用Application、写decision和outbox；唯一键=(workspace,candidate,job,cycle_id)。同键重试返回同一Application。
3. 外部申请意向仅保留ExternalRef及来源，不直接建正式关系。若已有有效人工确认记录，导入时映射复用，保留确认依据；不重复确认或伪造确认人。
4. confirm不产生Advance/邀请。创建screening_review或next_step任务，之后依§8生成人工决定与Transition。
5. no_match/no_open_jobs留库，failed建立异常处理；新岗位/资料变更可重跑，不自动link。跨岗位推荐顺序依独立版本化discovery policy，不按不同岗位overall裸分排序。
6. 输入相同的PreLink评估可被新的正式ScreeningEvaluation引用复用；原对象不可原地添加Application伪装原本已关联。任何输入/模型/策略变化须新评估。
7. 身份更正/拆分保留映射及来源，定位受影响推荐、任务、评估和包，标stale并安排复核；不无痕改人。

## 18. Shared Human Task Contract

HumanTask统一承接简历重复复核、岗位关联、screening review、job search结果筛选、下一步处理及补证；不与ModelRun、ReadRun或BatchItem共用状态实体。

| 字段 | 类型/必填 | 规则 |
|---|---|---|
| task_id / source_module / task_type | string / R | source_module拥有业务完成定义 |
| subject_refs / source_version | Ref[] R≥1 / int R | 无岗位任务可仅关联LibraryEntry/Recommendation |
| required_action / completion_rule | string R / object R | rule_id:string、required_result_type:string、required_approval_policy_ref:Ref O；可机器校验 |
| assignee_ref / queue_ref | ActorRef C / Ref C | 活动任务至少一个有效责任去向；领取后唯一主负责人 |
| collaborator_refs | ActorRef[] / R | 不扩大访问权限 |
| priority / status | low/normal/high/urgent R；open/in_progress/waiting/completed/cancelled R | overdue派生，不是状态 |
| due_at / waiting_reason / resume_at | datetime O / Reason C / datetime O | waiting需reason及resume_at或resume_event_type |
| resume_event_type | string / O | 与恢复时间至少一个，waiting适用 |
| needs_refresh | bool / R | true禁止旧版本决定 |
| created_at / started_at / completed_at | datetime R / datetime C / datetime C | 相应动作时记录 |
| completion_ref / cancellation_reason | Ref C / Reason C | completed需业务成功依据；cancelled需理由 |
| dedupe_key / reminder_policy_ref | string R / Ref R | 来源事件/对象版本+动作+责任范围去重 |
| parent_task_ref / supersedes_task_ref | Ref / O | 父子及替换不重复计算 |

TaskActionRequest={task_ref:Ref R,action:claim/reassign/start/defer/resume/submit/cancel R,expected_version:int R,actor:ActorRef R,reason:Reason C,payload:object C}。submit调用来源业务校验与写入，成功后任务completed；不提供绕过业务确认的通用“勾选完成”。转派需新负责人授权，领取并发409；反复点击使用幂等键。

TaskStatsSnapshot={workspace_id:string R,user_ref:Ref O,scope:personal/team R,as_of:datetime R,timezone:string R,counts:object R,filter_snapshot:object R,availability:available/stale/unavailable R}。counts包括open/in_progress/waiting/unassigned/due_today/overdue/completed_in_window/cancelled_in_window，按task_id去重；个人统计只包含本人责任，队列可领取单列，父子/机器任务分开。权限受限不显示其他人任务细节。

ReminderPolicy={rule_ref:Ref R,triggers:string[] R,channels:in_app/email数组 R,timezone:string R,quiet_hours:object O,lead_time_minutes:int O,repeat_interval_minutes:int O,max_reminders:int R,escalation_queue_ref:Ref O}。ReminderAttempt含task_ref、rule_ref、recipient_ref、scheduled_at、status、dedupe_key R；发送时重新检查任务状态/负责人/权限。完成、取消、转派撤销旧未发送提醒；邮件失效不妨碍站内任务。

独立模式本地业务事务写Task和outbox；集成聚合消费task.requested/updated/completed/cancelled并按版本去重。业务成功但投影未同步时对账恢复，不重复发邀请。来源失效取消/替换旧任务并保留链路，不能因旧事件晚到重新打开。

## 19. Candidate Comparison Contract

| 对象 | 字段级定义 |
|---|---|
| ComparisonSet | set_id:string R；job_ref:Ref R；application_refs:Ref[] R≥2；owner_ref:ActorRef R；collaborator_refs:ActorRef[] R；visibility_policy_ref:Ref R；purpose:string R |
| ComparisonRequest | set_ref:Ref R；mode:same_stage/current_summary/round_changes R；target_role_snapshot_ref:Ref R；dimension_ids:string[] R；input_result_refs:Ref[] R；previous_snapshot_ref:Ref C（round_changes）；idempotency_key:string R |
| ComparisonSnapshot | snapshot_id:string R；set_ref:Ref R；mode:string R；input_manifest:InputManifest R；target_role_ref:Ref R；cells:ComparisonCell[] R；differences:DifferenceSummary[] R；limitations:string[] R；generated_at:datetime R；model_run_ref:Ref C（AI）；freshness:current/stale/restricted R |
| ComparisonCell | application_ref:Ref R；dimension_id:string R；value:JSON或null R；unit:string O；evaluation_status:evaluated/unknown/not_evaluated/not_applicable R；source_stage:string R；evidence_refs:Ref[] R；verification_status:string R；comparability:comparable/limited/not_comparable R；reason:string C（不可比/受限） |
| DifferenceSummary | difference_id:string R；application_refs:Ref[] R；requirement_ids:string[] R；statement:string R；supporting/counter_evidence_refs:Ref[] R；confidence:number或null R；limitations:string[] R；verification_item_refs:Ref[] R |
| ComparisonAnnotation | annotation_id:string R；snapshot_ref:Ref R；target_id:string R；body:string R；author:ActorRef R；created_at:datetime R；supersedes_ref:Ref O |
| NextStepProposal | proposal_id:string R；application_ref:Ref R；snapshot_ref:Ref R；action:assessment/interview/request_information/hold/reject R；reason:Reason R；status:proposed/submitted/superseded R；decision_ref:Ref C（已决定） |

只允许同岗位、已人工关联的Application。所有Comparison对象继承通用头，但多人对象不设置单一candidate_id/application_id，以成员application_refs为准。不同轮次材料可并列但未评估不等于低分；不同量尺无映射不得混算。保存snapshot锁定每位候选人输入和比较限制；源变更标stale。对比生成/导出不通知候选人或推进，NextStepProposal必须走§8。

ComparisonExportRequest={snapshot_ref:Ref R,format:png/pdf/markdown/json R,selected_application_refs:Ref[] R,layout:single_page/paginated R,requested_by:ActorRef R}。复核当前权限；单页过多必须明确选子集或分页，不静默漏人。机器输出复用Exchange manifest，导出图仅供阅读，不代替完整交接包。

## 20. Shared Model Routing Contract

继承Interview PRD v1.6公共模型要求，Screening保留领域prompt、rubric和人工决定。

| 对象 | 字段级定义 |
|---|---|
| ModelTaskRequest | task_type:resume_parse/profile_normalize/duplicate_similarity/job_discovery/prelink_match/screening_evaluate/evidence_extract/candidate_compare/preference_signal_extract R；subject_refs:Ref[] R；input_manifest:InputManifest R；policy_ref:Ref R；data_classification:string R；purpose:string R；output_schema_version:string R；budget_ref:Ref R；deadline:datetime R；idempotency_key:string R |
| ModelTaskResult | run_ref:Ref R；status:succeeded/failed/no_eligible_model/outcome_unknown R；output_ref:Ref C（成功）；attempt_refs:Ref[] R；actual_model_version:string C（已调用）；validation_status:passed/failed/not_run R；error:ErrorEnvelope C（失败） |
| ModelAttempt | attempt_id:string R；run_ref:Ref R；provider/model/deployment/region:string R；policy_ref/prompt_ref:Ref R；started_at:datetime R；completed_at:datetime C；usage:object或null R；estimated_cost:number或null R；actual_cost:number或null R；currency:string R；fallback_reason:Reason O；status:string R |

先过滤权限、数据地域/用途、能力和质量门槛，再按预算/时限及偏好选型。并发预算预占、重试/回退累计费用、未知成本不记0；回退不得放宽硬限制。ModelRun关联既有AgentRun，避免两套矛盾结果。换模型/回退的结果只有实际基线满足§5.3时才可同cohort排名。

## 21. Operations, Events, Migration & End-to-End Acceptance

### 21.1 新增逻辑操作与事件

| 操作 | 建议映射 | 输出/事件 |
|---|---|---|
| 接收手动/邮件/文件材料 | POST /v2/intakes | IntakeEnvelope；material.received |
| 重复复核 | POST /v2/duplicate-checks/{id}/resolutions | DuplicateResolution；duplicate.resolved |
| 岗位推荐 | POST /v2/job-discovery-runs | 202 run_ref；job_recommendations.ready |
| 人工确认关联 | POST /v2/link-decisions | LinkDecision/Application；candidate_job.link_confirmed |
| 我的任务查询 | GET /v2/tasks?scope=mine | 授权HumanTask列表及分页游标 |
| 任务动作 | POST /v2/tasks/{id}/actions | 来源业务结果+Task状态；task.updated/completed |
| 生成对比 | POST /v2/comparison-snapshots | 202 snapshot_ref；comparison.completed |
| 导出/交付 | POST /v2/exports 或 /v2/exchanges | ExportArtifact/Exchange；delivery状态 |

新增事件沿用§11 Envelope；payload最少包含对应对象精确ref和subject_refs；完成事件含result_ref，失效含reason及replacement_ref（适用）。新接口使用/v2；§10中旧/v1路径仅为历史建议，Schema2.0实现应统一映射/v2并做消费者协商，不能向只支持旧Schema的端点静默发送。

### 21.2 迁移与兼容

旧1.0.0只适用于已关联后的筛选对象。适配器可将新正式ScreeningPackage映射旧消费者需要的字段，但必须验证人工link、决定和缺口保留；旧消费者无法表达的unreviewed/unknown/新任务语义不强塞为成功。关联前对象、Task和Comparison不降级为旧Application或虚构评估。

传输方式变化不改变业务去重：同包从邮件、文件、API重复到达按§12同键处理。输入内容变更需新object_version，旧包晚到不回滚。人工link、正式决定和发送分别有幂等键与审计，不用一个“处理完成”覆盖三者。

### 21.3 端到端验收

| 编号 | 场景 | 预期 |
|---|---|---|
| E2E-01 | 无JD模块，手动上传简历且无开放岗位 | 文件检查/去重后入库，no_open_jobs，无Application，可查看历史 |
| E2E-02 | 邮件收到同一简历的正文和附件，并从文件再次导入 | 保留每个来源，检测重复，身份不擅自合并，不重复建任务 |
| E2E-03 | JD文件导入并人工确认标准，AI推荐两个岗位 | 生成两个匹配提案，人工确认一个仅建一个Application |
| E2E-04 | Link确认后选择暂缓 | 关系已建立，下一步Hold，无笔试/面试邀请 |
| E2E-05 | 人工Advance并选择Assessment，邮件交付 | 自包含包+目标；邮件送达不算目标imported，回执后更新transition |
| E2E-06 | 工作流允许直接Interview | 含待验证项及assessment disposition，无虚构笔试成绩；目标独立建Intake |
| E2E-07 | 下游无系统，仅HR手动下载报告 | 来源业务完成；下载与人工转交独立记录，不伪造机器case_ref |
| E2E-08 | Assessment通过文件返回补证结果 | 映射相同Application与VerificationItem，保留来源版本，旧筛选结论不覆盖 |
| E2E-09 | 两人同时领取任务/确认同一link | 一方版本冲突或返回已有结果，只建一个有效关系 |
| E2E-10 | 任务完成、转派及提醒排队同时发生 | 发送前核验责任人/状态，不发过期提醒；任务统计一致 |
| E2E-11 | 生成多人对比后导出图 | 证据、限制、版本可追溯；没有任何自动推进或候选人通知 |
| E2E-12 | 模型回退、预算不足或供应商不合规 | 受控回退或明确失败；无擅自放宽策略，无模型失败转no_match |

本文件定义字段和业务契约，实际认证连接、邮箱地址、目录路径、通知模板、容量及机器Schema须在实施配置中落实；不得将未配置真实通道描述为已发送或已接收。
