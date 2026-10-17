# Six Issue Estimates - 2026-10-17

状态：建议值，待用户/Owner 确认；本轮只评估，不修改 GitHub，不开始新业务实现。分支仍为 `codex/issue-fixes`，保留已有未提交改动。点数包含实现、测试、文档与验收，不换算工时。

依据：六个 Issue 正文及评论、前一轮 human-decisions.md、对应 PRD/测试报告、本轮源码与测试入口核查。采用 `a2a_dev_process.md` 起始尺度；历史 #412 为 Owner 确认的 2 点前后端分页改动，评论记录本地检查、合并及关闭，但也明确浏览器加载更多未验证，故仅作有限参照，不能视为完整 QA 标杆。

## #93

Estimate: 5

状态：建议值，待确认。仅估算本 Issue 的 M6 门禁及接口接入，不含 #91 的整套审批实现。

- AC-1：10 必填、Level 选填；AI 草稿未 Keep、未保存时统一 UI 门禁，服务端拒绝同状态请求且不写审批记录。
- AC-2：规则结果统一到分析分组、计数、总体状态与入口；逐项覆盖 X1-X8、V1-V5、R1-R3 的阻断/Weak/Suggestions 分级，不能仅测三条示例。
- AC-3：Keep 后自动重查；覆盖处理中、失败、过期及 revision 变化竞态，禁止旧结果放行。
- AC-4：Ready 指向提交审批；无批准不能发布；一句话概述不因句数判 Weak，空值仍阻断。
- AC-5：UI 绕过、持久化副作用和隔离环境集成测试；同步 M6 规则/提示及 Issue 旧 11 项文字。

复用与证据：`hireos-jd/hireos-jd-front/src/features/workspace/publishGate.ts` 已有 unkept/revision/suggestion 判断；前后端已有 publish-gate 测试，但前端测试仍断言审批不可用，后端测试允许 clean analysis 直接 publish。不能把已有测试等同目标验收。

规模判断：跨分析、编辑保存、前后端门禁与规则矩阵，超过 3 点；已有分析和发布基础，不在本 Issue 重建审批/渠道，故不按 8 点估算。

依赖：`approvalActions.tsx` 的提交当前仅 mutate 前端状态，后端没有对应真实审批能力；GitHub #91 仍 OPEN/AI Ready No，且依赖 #15。5 点假定 #91 提供真实审批接口/批准记录供接入；外部等待不计点。不能将 #91 全部工作塞入这 5 点，也不能用 mock 接口声称 AC-1/3/5 的真实提交已验收。该依赖解除前保留未完成范围，不直接设为全部可执行/可关闭。

## #87

Estimate: 2

状态：建议值，待确认；依赖 #93 的共用门禁，不重复计算整套 M6 实现。

- AC-1：仅 Suggestions 时仍显示建议，不因建议拒绝前置检查；依最新规则，提交审批和审批后 Publish 分别验证，不绕审批。
- AC-2：缺一个必填项并有建议时，阻断数只含阻断项，建议独立展示。
- AC-3：真实 Weak/阻断仍禁止推进，提示与分析一致；覆盖 UI/API 的分级夹具。

复用：`completeness.ts`、`publishGate.ts` 和已有门禁测试；同步 M5/M8 旧用语与 #87 AC，使 To revise 不再混指 Suggestions。

规模判断：局部计数、分组和提示加多状态回归，超过单点 1；不新增接口/数据迁移或审批系统，不到 3。与 #93 共用的规则基础不再独立计量。

## #397

Estimate: 5

状态：建议值，待确认；作为 Written 覆盖决定修复的主 Issue。

- AC-1：未达标时允许 Passed，但提示覆盖并收集非空理由；后端校验且记录可信 actor/time，防止直接 API 绕过。
- AC-2：回看区分已发布结果与关闭决定，展示理由/决定人/时间；历史缺失如实显示未记录，不改写历史决定或候选人结果。
- AC-3：一致/相反组合、空理由、事务失败、重复/并发关闭、工作区隔离及 API/UI 一致性自动测试。

复用与数据：`case-lifecycle.service.ts` 已有关闭和 Task 完成的事务，但只保存 closeReason/closedAt；需增量迁移审计字段、DTO/API 透传及 ReleasePage 表单/回看。复用 `case-concurrency.test.cjs` 与 release 测试设施。审计展示仅在内部授权视图，不扩大候选人披露范围。

规模判断：跨数据、服务、前端且包含历史兼容与并发验证，超过 3；单子系统、增量字段、已有事务，无重算/历史回填/通知系统重建，不到 8。同步 W09/W11 相关规则及 API 说明。

假设/风险：未达标判断须沿真实已发布结果/对应评估版本核对，不能解析自由文本或把 UI 中默认 65 分阈值擅自当成经确认的全局产品标准。若现有结构缺乏可判定语义，实施时先记录具体问题，不默默扩展阈值政策；该风险不需要扩大到重建评分体系。

## #399

Estimate: 5

状态：按原完整范围独立估算，待确认；与 #397 重叠，不额外累计 5 点。

- AC-1：测评结论和关闭决定分开展示，组件测试确保不是同一个 Passed 状态。
- AC-2：人工覆盖的理由、决定人、时间经真实 API 持久化后可查；API/UI 集成验证。
- AC-3：低分未通过、正常通过、人工覆盖三组状态准确显示并可追溯。

理由：若独立修复，同样需要 #397 的迁移、校验、审计及 UI 链路，故为 5 而非把它误当成 1 点文案。复用/风险/回滚/验证与 #397 相同，不涉及跨系统交接改造，不到 8。

建议执行与统计：#397 主修复，#399 保留独立 AC 检查清单并关联同一证据；两者都完成才分别报告结果。该重复范围仅计一次交付量，不直接相加为 10 点。本轮不擅自以 duplicate 关闭任一 Issue。

## #325

Estimate: 8

状态：相对原 Issue 中“建议 5，待 Owner 确认”的复核建议；尚未覆盖原字段，待用户确认调整。

- AC-1：JD 结构化逐项 Required L 与来源 ID/版本端到端传入，存入对应 Rubric 版本；Overview/Rubric/Debrief 一致，不能只替换显示文本。
- AC-2：Must-have 使用逐项等级比较，不再以统一 DEBRIEF_BAR=3 代替；缺少等级不得伪装为 L3 或达标，保留已确认版本不被最新 JD 覆盖。
- AC-3：同项目 L3/L4、等级边界、未评分、缺失/非法来源、版本更新不改写历史等自动与本地集成回归。

证据：`core-record/jd-content.facade.ts` 获取泛型 requirements 后，`formatJdText` 只保留 label；`rubric.service.ts` 从纯文本分段生成能力卡，select/materialize/newVersion 都无逐卡等级；Prisma CapabilityCard 无等级字段；`intake/tasks.service.ts` 以 DEBRIEF_BAR 计算 Must-have。需要 JD 契约、映射、存储迁移及各显示/计算入口，不是已有字段单纯透传。

规模判断：横跨 JD 与 Interview、涉及版本兼容和迁移，超过 5；限制于逐项等级与判断链路，不重建 Rubric/评分/身份系统，可独立验收，按 8。不能依据实际耗时重估，调整来自本轮核实的跨系统缺口。同步 JD 接口和 I03/I09 文档。

边界：沿现有岗位和 Rubric 版本，不重写已确认要求；旧记录不能造等级。缺失等级的详细操作限制需依据既有门禁规格核对，不能私自扩大为新审批政策。

## #250

Estimate: 5

状态：建议值，待确认。用户在本轮追加确认：能力验证卡是现有 Rubric 页的候选人视图，复用同一能力 ID/JD 等级；Claim 按候选人隔离；STAR 复用现有生成能力，不新建独立卡片审批流程。

- AC-1：复用 #325 的等级字段和版本来源，逐卡展示等级/含义及可追溯来源，不再次估算 #325 的基础链路。
- AC-2：基于该候选人简历提供相关 Claim 与来源，明确待核实；无匹配显示规定空状态。无简历、读取失败与真实无匹配不能混成同一成功状态；同岗位多个候选人不串 Claim。
- AC-3：按同一能力 ID 关联 STAR；覆盖有/无简历、草稿/确认版、生成失败/待生成、版本切换及无其他候选人信息泄漏的 API/UI 回归。

复用与新增：BriefService 已有按 confirmed Rubric 生成、落库和读取 STAR；当前没有简历匹配输入，Rubric 按 Job 共享，需候选人级 Claim 查询/匹配、引用校验和视图适配，不能把 Claim 写进所有人共用的岗位卡。草稿视图的 STAR 状态需要与现有确认版生成门槛协调，不凭空生成内容。

规模判断：有明确复用路线但涉及候选人数据、来源校验和多状态展示，超过 3；#325 等级基础单独承接、不新建卡片工作流，故不到 8。同步 I03 FR-3/6/7 和数据说明，消除 Required L 可手改与 JD 权威来源的矛盾。

## Validation Plan and Approval

实际命令来源为 `.github/ci/projects.json` 和各项目 package.json：受影响后端运行 npm run build/lint/typecheck、npm test；JD 前端同上，Written 前端 build/lint/typecheck 并补现有 unit/browser 测试，Interview 前端 build/typecheck 并补已有 unit/browser 测试。迁移只在隔离本地数据库验证，浏览器测试用合成候选人；不写线上候选人数据。JD 前端当前 Node 环境可能需要 `NODE_OPTIONS=--no-experimental-webstorage npm test`。

本轮未执行应用测试，也没有新修复，不借用上一批通过结果作为本次验收。只做源码、文档与现有测试读取；缺少直接同规模、已完整验收的历史参照，主要采用仓库起始尺度。

用户确认点数后，先准备完整 Issue 正文，补齐/更新 Scope、Dependencies、AC 和 Estimate；通过 submission 校验后经 issue-submit 统一入口回填。真实未解除依赖保留 AI Ready No；已具备实施条件者再执行 execution 校验。按优先级连续处理可执行项，受阻项保留明确记录并继续下一项，不提 PR、不擅自 push/merge。
