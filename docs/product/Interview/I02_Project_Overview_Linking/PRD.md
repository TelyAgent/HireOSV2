# I02 产品文档：项目概览与候选人关联

| 项 | 内容 |
|---|---|
| 模块 | I02 / 主闭环第 2 步 |
| 版本 / 日期 | v1.0 / 2026-10-14（草稿，待评审） |
| 主角色 | HR / Recruiter；Interviewer 只读 |
| 原型页面 | 项目页 `Overview` 标签；`Link candidate` 弹窗；右侧简历预览抽屉（[原型](../../../design/Interview/index.html)） |
| 实现现状 | 🟡 前端 `ProjectOverviewPage` 读取 `GET tasks/:id`；后端 `PATCH tasks/:id/intake`（状态与人工审阅）、`POST tasks/:id/materials`（附加筛选 / 测评 / 其他材料）。现有 Task 创建时必须带简历，没有「先建项目、后关联候选人」的关联接口；重复材料处理、未归类附件 Triage、Recent activity 未实现。未逐项验证 AC |
| 依据 | [PRD v1.5 §3.2、§3.4、§8.1](../HireOS_Command_Interview_PRD_v1.5.md)、[任务列表 PRD §6–§9](../HireOS_Command_Interview_Task_List_Status_and_Sorting_PRD_v1.0.md) |

## 1. 背景与目标

项目详情是所有后续步骤的入口。用户需要一眼看清：这个项目是哪个岗位、有没有关联候选人、手里有哪些材料、哪些要求还没有证据、面试排到哪一轮、下一步该做什么。

**目标**：Overview 汇总项目现状并给出下一步；在这里完成候选人关联和材料归档；缺失的资料显示为 Unknown，不被当作通过或失败。

## 2. 范围

| 包含 | 不包含 |
|---|---|
| 项目头部：岗位名、岗位信息、状态标签、候选人（或「Candidate not linked」） | 新建项目（I01） |
| 四个区块：Source materials、Requirement coverage、Interview rounds、People on this project | 评分标准编辑（I03） |
| Recent activity：创建、确认、提交 Scorecard、确认结论等事件 | 文件历史本身（I13 Activity） |
| Link candidate：选择候选人 + 可选上传简历，一步完成 | 候选人档案编辑（Resume Screening） |
| 重复材料处理（保留新版本，旧版本标 superseded）、未归类附件 Triage | |
| 草稿横幅与步骤门槛：未确认标准 / 未关联候选人 / 未批准计划时的提示和禁用 | |
| 项目内导航：Overview → Requirements & Rubric → Interview Plan → Schedule → Interview Brief → Live Interview → Review → Debrief → Decision & Next Steps → Evaluation Package | |

## 3. 功能需求

| ID | 需求 |
|---|---|
| FR-1 | Source materials 列出 JD、简历、筛选报告、测评报告；每项显示文件名、来源和状态；缺失的项显示「Optional input; absence never blocks the flow」或「missing evidence is shown as Unknown」 |
| FR-2 | 检测到重复的筛选报告时显示 `Duplicate · needs resolution`，HR 点 Resolve 后保留新版本，旧版本标为 superseded，不删除 |
| FR-3 | 无法归类的附件显示 `Unassigned · needs triage`，HR 点 Triage 匹配到具体材料类型；未匹配的附件不会成为证据 |
| FR-4 | Requirement coverage 显示每项能力是否已有候选人证据 / 面试证据；未关联候选人时提示「All six competencies need candidate evidence」 |
| FR-5 | Interview rounds 显示每轮名称、时间、面试官和状态（Not scheduled / 时间 / Completed） |
| FR-6 | People on this project 列出 HR、Hiring Manager、各轮面试官 |
| FR-7 | Link candidate 弹窗：选择候选人后自动附上该候选人的默认简历，也可以只上传一份简历并确认；两者都没有时提示「Select a candidate or upload a résumé.」 |
| FR-8 | 关联成功后项目头部显示候选人姓名和背景摘要，状态从 `No candidate linked` 前进 |
| FR-9 | 草稿横幅按进度提示：未确认标准 → 去确认 Rubric；已确认未关联 → 先关联候选人；已关联未批准计划 → 先批准计划 |
| FR-10 | 项目内导航的门槛：未关联候选人时 Brief / Live / Review 等面向候选人的步骤给出「Link a candidate before …」提示；未批准计划不能排期和开始面试；未完成任何轮次不能进 Review；未完成决定和双方确认不能发布评估包 |
| FR-11 | 简历入口点击后从右侧打开预览抽屉，关闭后回到原位置；未上传简历时入口为弱态，不打开 |
| FR-12 | Interviewer 打开 Overview 只读；顶部导航中除 Overview、Brief、Live Interview、Review 外的标签置灰并不可点击 |

## 4. 业务规则

| ID | 规则 |
|---|---|
| BR-1 | 关联候选人前，项目只代表岗位；不能出现候选人相关的证据或评分 |
| BR-2 | 已接入的 Candidate、Job、前序证据仍由来源模块维护；关联只保存引用，不复制事实 |
| BR-3 | 重复材料保留全部历史版本；只改变「当前版本」指向 |
| BR-4 | 未匹配的附件永远不会被静默当成证据 |
| BR-5 | 一个项目只关联一名候选人；同一候选人面试同一岗位只有一个项目，复用而不是复制 |

## 5. 数据

| 方向 | 对象 | 关键字段 |
|---|---|---|
| 输入 | InterviewTask | 岗位、候选人、状态、版本 |
| 输入 | TaskMaterial | 类型（resume / screening / assessment / other）、当前版本、来源 |
| 输出 | Candidate / Resume 引用 | candidate_id、resume material_id |
| 输出 | 材料处理记录 | 重复处理结果（superseded）、Triage 结果 |
| 输出 | 活动记录 | 事件类型、操作人、时间 |

## 6. 权限

- HR / Recruiter：关联候选人、上传材料、处理重复和 Triage。
- Hiring Manager：查看；是否可以关联候选人待确认。
- Interviewer：只读 Overview，只能看到分配给自己的轮次相关信息；关联接口返回 403。

## 7. 非功能要求

- 关联候选人、处理重复的操作重复提交只生效一次。
- 1366 × 768 下四个区块可换行显示，不需要横向滚动。

## 8. 验收标准

| ID | 验收 | 对应 |
|---|---|---|
| AC-1 | JD-only 项目的 Overview 显示岗位信息和「Candidate not linked」，简历、筛选、测评均显示为可选缺失，不显示 Pass | §12 缺可选资料 |
| AC-2 | 选择候选人并确认后，头部显示候选人，默认简历出现在 Source materials | 原型 Link candidate |
| AC-3 | 重复的筛选报告 Resolve 后，新版本为当前版本，旧版本仍可查看并标 superseded | 原型 Overview |
| AC-4 | 未 Triage 的附件不出现在任何证据列表中 | §8.7.1 |
| AC-5 | 未关联候选人时点击 Interview Brief，提示先关联候选人且不进入 | 原型门槛 |
| AC-6 | Interviewer 身份下只能进入 Overview、Brief、Live Interview、Review；调用关联接口返回 403 | 原型 assignee |
| AC-7 | 未上传简历时简历入口为弱态，点击不打开抽屉 | 任务列表 PRD §9 |

## 9. 依赖与实现

- 后端：`intake/tasks.service.ts`（`get`、`updateIntake`、`attachMaterial`）、`intake/candidates.service.ts`。
- 前端：`pages/project/ProjectOverviewPage.tsx`、`pages/project/ProjectShell.tsx`、`components/FlowNav.tsx`、`components/Drawers.tsx`（简历预览）。
- 依赖：I01、I13（材料）、I15（角色）。下游 I03–I11。

## 10. 待确认

1. 现有模型 Task 必须有候选人，「先建项目后关联」需要改模型还是新增关联接口（同 I01 待确认 4）。
2. Hiring Manager 是否可以关联候选人、处理材料。
3. #243 已由 Owner 确认先复用现有 Revision，只展示已记录的近期活动，不补造完整 I13 事件流。
4. 关联后发现候选人选错了，是否允许解除关联；已有评分时如何处理。

## 11. #243 已记录的近期活动

- `GET /api/tasks/:id/activity` 为只读接口，校验项目所属工作区；返回最近 20 条 Revision，按 createdAt、id 倒序稳定排序。
- 响应仅含记录 ID、操作人 ID、时间和已知事件类型；未知类型明确显示未知，不返回任意 payload 或内部决定理由。
- Overview 区分加载、暂无已记录活动与读取失败，失败可局部重试；切换项目不复用旧项目结果。
- 当前仅覆盖现有审阅和决定等真实 Revision，不保证记录了创建、Scorecard 等所有行为；空记录不代表没有发生操作。不新增迁移或事件写入流程。

## 12. #246 筛选报告 Resolve

- Owner 确认同项目多个 screening 报告按重复处理；历史多报告不推测当前报告。只有一份时可显示当前，添加新报告不自动替换已有当前指向。
- `GET /api/tasks/:id/screening-reports` 返回 revision、currentId、needsResolution、reports 和 history。报告状态为 current / superseded / unresolved；已处理集合外的新报告为 unresolved。读取使用一致性快照。
- `POST /api/tasks/:id/screening-reports/resolve` 输入 materialId 和 expectedRevision。人工选择后原子更新指向并保存成员集合、操作者、时间与处理版本。旧材料内容保留，前端支持展开已提取文本；没有可读取文本时明确提示，不伪造原文件预览。
- 同一操作人、相同输入版本和选择的重试返回 replayed，不重复写历史；过期集合或不同人的竞争返回 409 SCREENING_REPORTS_CHANGED。添加 screening 附件与 Resolve 共用项目行锁；重复附加同文件不增版本。
- 兼容迁移 `20261017235000_screening_resolution` 只新增字段和历史表，不补造历史选择/操作者。部署先迁移并生成 Prisma client，再启动新代码。旧版本附加接口不能维护新并发令牌，回滚应用时须暂停材料写入；保留新增数据，不回滚删除处理历史。
- 不修改旧评分、决定或已发布包，不实现完整 I13、Triage、角色权限或新的报告解析链路。

## 13. #247 附件归类

- Owner 确认本轮仅允许 other 单向归为 screening/assessment。不支持归为简历/JD、重新归类或撤销，不改变候选人/岗位关联。
- `POST /api/tasks/:id/materials/triage` 输入 materialId、kind。检查当前工作区及项目材料关联，原子保存类型、triagedBy 和 triagedAt；没有历史审计的数据保持空值。
- 同人同目标请求重试返回 replayed，其他已归类情况返回 409 MATERIAL_ALREADY_CLASSIFIED；非法目标类型拒绝。归为 screening 时使用 #246 的项目锁并递增成员版本，保留已有当前报告，因此旧 Resolve 输入会冲突。
- Overview 将 other 放在独立的 Unassigned attachments 区块，不列入已分类材料；成功后刷新材料与筛选报告区块，已分类材料显示归类人/时间。归类不等于内容已验证，不自动生成评分或改写评估包。
- 当前评分和评估包证据来源为能力评分及转写引用，不读取 other 附件；保留这一排除规则。不实现通用 I13 证据接入。
- 迁移 `20261017235500_material_triage` 添加 nullable 审计字段，无历史回填。先迁移/生成客户端再启动新代码；回滚时暂停归类写入并保留审计数据。
