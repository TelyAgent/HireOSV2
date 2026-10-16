# I04 面试计划线上测试报告

| 项 | 结果 |
|---|---|
| 测试日期 | 2026-10-15（北京时间） |
| 环境 | [HireOS Interview 线上环境](https://hireos.aipollo.me/hireos/interview/)，Chrome 桌面浏览器，已登录 Admin / HR 账号 |
| 对照版本 | 本目录 `PRD.md` v1.0（2026-10-14）、`User_Journey.md`、`User_Cases.md`、`Loop_IO.md` v1.0（2026-10-15，均为待评审草稿）；`docs/product/HireOS_Command_JD_Management_UX_UI_Review_Standard_v1.0.md` |
| 测试方式 | 线上 UI 只读路径、状态和文案核对；本地产品文档用于预期及已知缺口识别 |
| 结论 | **fail（I04 全量验收不通过）**。已观察到确认/排期状态与前置标准矛盾、已排期轮次无人负责；I04 文档另列 5 项未实现用例。未执行的用例均标为未验证或已知缺口，不记为通过。 |

## 1. 角色、目标与范围

主旅程是 HR / Recruiter 将已确认的 Rubric 分配到轮次，明确目标能力、负责人和必问题，批准后交给 I05 排期。Hiring Manager 参与审阅；Interviewer 只读负责轮次。应可选择一次规划全部轮次或逐轮规划，检查 Must-have 覆盖，编辑未来轮次时产生新版本，已完成轮次不得改写。

本次核对 5 个已有项目：2 个草稿、2 个进行中、1 个已发布。仅执行页面导航、打开只读抽屉，以及点击只返回提示的前置门槛和补面入口。没有新增或改动线上项目、候选人、轮次、计划或排期。项目为已有数据，创建历史不可见；对旧数据出现的异常，只断言“线上当前可见状态不符合预期”，不推定新建接口一定可复现。没有 `S_rubric_confirmed` 等隔离 seed、第二角色账号或可安全清理的 `[UJ-TEST]` 项目，因此写入、API/DB、并发、权限、AI 生成均未实测。

## 2. User Journey 逐步结果

| 步骤 | 预期 | 线上操作与可见证据 | 结果 |
|---|---|---|---|
| 1 打开 Plan | Rubric 未确认时阻止规划并说明原因 | 打开[草稿项目](https://hireos.aipollo.me/hireos/interview/project/af66de98-b3b9-4ff6-bf3a-72352129cf96/overview)，Plan 按钮禁用；点击后提示“Confirm the rubric in Requirements & Rubric first.”。另一个草稿项目同样提示。 | **部分通过**：UI 门槛有效；API 拒绝未测；现存数据有反例 F-01。 |
| 2 选择规划方式 | Plan all rounds / Plan one round at a time，解释两种方式 | 被测[进行中 Plan](https://hireos.aipollo.me/hireos/interview/project/5f57f693-470d-4d27-96dd-592aafdd8db6/plan)及[已发布 Plan](https://hireos.aipollo.me/hireos/interview/project/1cbc3fb1-48f8-4a2b-ae68-27ebcc1af804/plan)仅展示轮次卡，没有规划方式选择。产品文档明确标记切换未实现。 | **已知缺口**：UC-I04-09、AC-7；可编辑状态未单独实测。 |
| 3 新增/编辑轮次 | 名称、形式、时长、负责人、能力、题目数/必问题数、目标；名称或负责人缺失应阻止保存 | 打开[进行中项目](https://hireos.aipollo.me/hireos/interview/project/5f57f693-470d-4d27-96dd-592aafdd8db6/plan)第 2 轮抽屉：上述字段可见，确认后的输入只读，Owner 为 Unassigned，能力和目标为空。没有可编辑的隔离数据，未提交空值。 | **部分通过**：字段可见；必填校验未测；现存状态不合格 F-02/F-03。 |
| 4 检查能力覆盖 | 能力映射到各轮，未覆盖 Must-have 高亮 | 被测 Plan 页面仅有轮次卡及问题数，没有 Rubric × Round 覆盖区域；[财务运营项目 Rubric](https://hireos.aipollo.me/hireos/interview/project/3027ca2b-7aa1-42db-aa76-4a941d39f2f3/rubric)甚至无能力卡。产品文档标记能力覆盖检查未实现。 | **已知缺口**：UC-I04-05、AC-3；未对可编辑计划执行保存。 |
| 5 批准并交给排期 | Rubric 已确认、每轮就绪才批准；记录批准人/时间，排期解锁 | [财务运营项目 Overview](https://hireos.aipollo.me/hireos/interview/project/3027ca2b-7aa1-42db-aa76-4a941d39f2f3/overview)显示 Rubric 未确认，但 Plan confirmed、三轮 Scheduled；[Plan](https://hireos.aipollo.me/hireos/interview/project/3027ca2b-7aa1-42db-aa76-4a941d39f2f3/plan)显示三轮 Owner 均 Unassigned。另一个进行中项目第 2 轮也在[排期页](https://hireos.aipollo.me/hireos/interview/project/5f57f693-470d-4d27-96dd-592aafdd8db6/schedule)显示 Scheduled、Unassigned。 | **失败**：F-01/F-02；批准动作、API/DB 持久化和双击幂等未测。 |
| 6 首轮完成后修改未来轮次 | 已完成轮次锁定；未来轮次编辑形成新计划版本并重新批准 | [已发布项目](https://hireos.aipollo.me/hireos/interview/project/1cbc3fb1-48f8-4a2b-ae68-27ebcc1af804/plan)两轮完成，轮次抽屉只读且提示“completed and locked”；进行中项目确认计划的未完成轮次也只读，提示已排期后不可取消确认。未见计划版本。 | **部分通过**：完成轮次 UI 锁定；未来轮次版本与 API 锁定未测，文档标记版本未实现（F-04）。 |
| 7 补证轮 | Debrief 发起后显示证据目标、负责人、截止日期和排期下一步 | 未找到可安全使用的 `S_evidence_requested` 项目。[进行中项目 Schedule](https://hireos.aipollo.me/hireos/interview/project/5f57f693-470d-4d27-96dd-592aafdd8db6/schedule)有“Add make-up round”按钮，点击仅提示“A make-up round would inherit rubric v1 and only the competencies scoped to it.”，未打开轮次表单或生成记录；产品文档标记 Debrief 补证交接未实现。 | **已知缺口**：UC-I04-10；按钮只验证了提示，Debrief 发起路径未实测。 |

### 页面与交接补充检查

| 检查 | 结果 |
|---|---|
| 轮次卡 | 名称、形式、时长、负责人、题目数/必问题数可见；目标能力和目标说明没有在被测卡片上显示，违反 PRD FR-2（F-03）。 |
| Plan → Brief | [财务运营项目 Plan](https://hireos.aipollo.me/hireos/interview/project/3027ca2b-7aa1-42db-aa76-4a941d39f2f3/plan)写“3 questions (2 mandatory) — view in Brief”；点击后[Brief](https://hireos.aipollo.me/hireos/interview/project/3027ca2b-7aa1-42db-aa76-4a941d39f2f3/brief)提示先确认 Rubric，无法看到承诺的问题（F-05）。 |
| 逾期状态 | 进行中项目第 2 轮排期为 2026-10-11 22:41 UTC+8；10 月 15 日仍显示 Scheduled、Join link、Unassigned，没有可见逾期提示（F-06）。 |
| 批准记录 | 被测 Plan 页面只显示“Plan confirmed”，未显示批准人、批准时间或计划版本；后端是否存储未验证（F-04）。 |

## 3. 11 个 User Cases 与 7 条 AC 覆盖

| 用例 | AC / 预期 | 本次结论 | 证据或限制 |
|---|---|---|---|
| UC-I04-01 未确认 Rubric 不能规划 | AC-1 | **部分通过** | 草稿 UI 入口阻断；批准 API 未测；已有数据违反前置状态（F-01）。 |
| UC-I04-02 规划并批准 | FR-7 | **未验证** | 无隔离的 `S_rubric_confirmed` 项目；未保存或批准计划。现存确认计划可只读查看。 |
| UC-I04-03 缺少名称或负责人 | FR-3 | **未验证** | 未对线上已有计划提交缺失字段；现存已确认轮次负责人为空（F-02）。 |
| UC-I04-04 新增轮次后重新批准 | AC-2 | **未验证** | 未新增轮次；文档状态为部分可测。 |
| UC-I04-05 Must-have 未覆盖 | AC-3 | **已知缺口** | 产品文档标记未实现；被测 Plan 无覆盖区。 |
| UC-I04-06 完成轮次锁定和新版本 | AC-4 | **部分通过 / 已知缺口** | 完成轮次 UI 只读；未来轮次新版本文档标记未实现，API/DB 未测（F-04）。 |
| UC-I04-07 并发编辑 | AC-5 | **未验证** | 缺双会话及隔离测试数据；不能把文档称有乐观锁当作线上通过。 |
| UC-I04-08 Interviewer 只读与 403 | AC-6 | **已知缺口 / 未验证** | 文档标记业务角色校验未实现；没有 Interviewer 账号，未发编辑 API 请求。 |
| UC-I04-09 逐轮规划 | AC-7 | **已知缺口** | 产品文档标记未实现；被测页面未见方式切换。 |
| UC-I04-10 Debrief 补证轮 | FR-11 | **已知缺口** | 产品文档标记未实现；Schedule 的“Add make-up round”仅返回说明提示；无 `S_evidence_requested` seed，Debrief 交接未测。 |
| UC-I04-11 双击批准 | FR-7 | **未验证** | 未对线上真实计划执行批准。 |

**AC 汇总：**AC-1、AC-4 仅有部分 UI 证据；AC-3、AC-6、AC-7 对应已知缺口；AC-2、AC-5 无线上执行证据。没有任何 AC 达到 UI + 必要 API/DB 证据完整通过。`User_Cases.md` 的状态统计列将“未实现”写为 5 项，但表格可见 UC-I04-05、06、08、09、10 共 5 项；本报告按逐条用例判定。

## 4. 缺陷与验收建议

### F-01 · P1 · Rubric 未确认但计划及排期显示已完成

- **步骤与证据：**打开[财务运营项目 Overview](https://hireos.aipollo.me/hireos/interview/project/3027ca2b-7aa1-42db-aa76-4a941d39f2f3/overview)：Rubric 未确认、Plan confirmed、三轮 Scheduled；Rubric 页面无能力卡，Brief 仍提示先确认 Rubric。
- **影响：**HR 与面试官可能把缺少岗位标准的轮次误认为可执行。当前只证明现存数据异常，无法从页面断定其形成方式。
- **修复与验收：**为现存异常显示“需修复”并阻断新增排期；对新计划的读取/写入及批准接口校验已确认 Rubric 版本。以有/无确认 Rubric 的 seed 验证 UI、API、Plan、Brief 和 Schedule 状态一致。

### F-02 · P1 · 确认与排期后的轮次没有负责人

- **步骤与证据：**[社交媒体运营项目 Plan](https://hireos.aipollo.me/hireos/interview/project/5f57f693-470d-4d27-96dd-592aafdd8db6/plan)第 2 轮 Owner: Unassigned；同轮 Schedule 显示 Scheduled。财务运营项目三轮均为 Unassigned，计划与排期仍显示完成。
- **影响：**交接对象不明，准备、出席和反馈容易遗漏；已排期计划又被锁定，界面未提供明确补救路径。
- **修复与验收：**按 PRD FR-3 在保存时阻止空负责人，在批准/排期时再次验证；对历史异常提供可审计的指派或重新排期。复测缺负责人提交、有效负责人批准、后续个人任务归属。

### F-03 · P1 · 轮次的目标能力和目标说明缺失

- **步骤与证据：**财务运营项目的已确认轮次抽屉中 Competencies covered 与 Interview goal and notes 均为空且只读；已发布项目已完成轮次抽屉也为空。被测轮次卡只显示题目数，未展示 PRD FR-2 要求的目标能力和目标说明。
- **影响：**无法判断每轮考什么、是否重复或遗漏 Must-have；面试官缺少明确准备目标。
- **修复与验收：**确认前验证目标能力和轮次目标；卡片展示摘要，覆盖区展示 Rubric × Round 关系。以含已覆盖/未覆盖 Must-have 的 seed 复测。

### F-04 · P1 · 计划版本与批准记录不可见，未来轮次新版本未实现

- **步骤与证据：**被测 Plan 页面仅显示确认状态，没有批准人、时间或版本。I04 PRD、Loop_IO、User_Cases 明确标记“计划版本未实现”；进行中项目已排期的未来轮次只读，并提示只有任何轮次未排期时才能取消确认。
- **影响：**首轮完成后无法按 AC-4 清楚调整下一轮并追溯新旧批准范围；审核人看不出当前轮次使用哪个版本。
- **修复与验收：**定义计划版本及轮次对批准版本的引用；允许未执行轮次调整、重新批准并保留完成轮次原版本。验证 UI、API、DB 和审计记录；批准人是否含 HM 待产品确认。

### F-05 · P2 · 问题数与“view in Brief”承诺不一致

- **步骤与证据：**财务运营项目 Plan 卡写“3 questions (2 mandatory) — view in Brief”，点击后 Brief 要求先确认 Rubric，没有对应问题。
- **影响：**面试官可能直到准备时才发现题目不可用。
- **修复与验收：**把计划题目配额与已生成问题实体分开标注；有问题才提供可查看入口，缺失时指向解除前置条件。逐项核对必问题标记与真实问题。

### F-06 · P2 · 过期场次仍显示 Scheduled，没有处理指引

- **步骤与证据：**进行中项目第 2 轮排期为 2026-10-11 22:41 UTC+8；10 月 15 日仍显示 Scheduled、Join link、Unassigned，未见 Overdue 或记录结果入口。
- **影响：**HR 难以识别场次已过期并处理缺席、取消或改期。
- **修复与验收：**对已过预定时间且未完成的场次提示逾期及下一步，并与个人任务和项目状态一致。此项属于 I04→I05 交接问题，修复归属可在 I05 确定。

## 5. U1–U10 应用性检查

| 标准 | 结论 | 依据 |
|---|---|---|
| U1 容易理解 | 失败 | Plan confirmed 与 Rubric 未确认、问题不可查看并存（F-01、F-05）。 |
| U2 容易上手 | 部分通过 | 草稿入口清楚提示 Rubric 前置条件；规划方式缺失。 |
| U3 快速完成任务 | 未验证 | 未执行新增、编辑和批准；空负责人及无目标会阻碍交接。 |
| U4 下一步明确 | 失败 | 已排期空负责人及逾期场次缺少处理路径。 |
| U5 提示和按钮清楚 | 失败 | “view in Brief”不能查看卡片承诺的问题。 |
| U6 符合真实工作方式 | 失败 | 无能力覆盖、新版本和逐轮规划，未满足多轮面试准备。 |
| U7 信息结构符合角色目标 | 失败 | 轮次卡缺目标能力/说明；批准人与版本不可见。 |
| U8 减少跳转和重复输入 | 部分通过 | Plan 可链接 Brief，但缺内容后仍需回 Rubric。 |
| U9 可恢复和可预期 | 未验证 | 并发、双击、保存失败未测；已排期后未来轮次修改路径不清。 |
| U10 可访问、可读和可操作 | 未验证 | 未执行 1366×768、200% 缩放、键盘/焦点/屏幕阅读器；PRD 要求抽屉关闭和保存按钮不被遮挡。 |

## 6. 结论、复测条件与产品待决

按指定评审标准，当前 I04 **不通过全量验收**：主旅程中的能力覆盖、逐轮规划、未来轮次版本和 Interviewer 权限仍是文档已知缺口；已有线上数据又显示前置状态与负责人异常。只读测试不能证明这些异常由当前新建流程造成，也不能证明接口权限或并发行为。

复测需按 `Interview/README.md` 准备可清理的 `[UJ-TEST]` seed：`S_rubric_draft`、`S_rubric_confirmed`、`S_plan_approved`、`S_round1_completed`、`S_evidence_requested`，以及 HR 与 Interviewer 身份。执行 11 个 UC 的 UI/API/DB 断言和两会话注入，保留截图、响应和版本记录；测试后清理数据。产品仍需决定 HM 是否参与批准、计划版本模型、AI 起草时机和 Panel 面试官模型，不能用本次测试自行补定。
