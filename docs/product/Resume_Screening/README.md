# Resume Screening 主流程产品文档

按 [功能拆分](Resume_Screening_Feature_Breakdown.md) 的 F01～F11 主流程，每个功能一个文件夹。格式与 [JD_Management](../JD_Management/README_Modules.md) 下的模块文件夹保持一致。

| 文件 | 内容 |
|---|---|
| `PRD.md` | 产品文档：范围、功能需求、业务规则、数据、权限、验收标准 |
| `Loop_IO.md` | 输入输出闭环：用户在这个闭环里需要的输入、得到的输出，以及可供 AI 模拟测试的结构化流程和路径清单 |
| `User_Journey.md` | 用户旅程：四类角色各自在这个模块里怎么用、看到什么、不能做什么 |
| `User_Cases.md` | 功能测试用例：按 User Journey 整理，每条可单独执行，追溯到闭环路径和 PRD 验收标准 |

## 模块列表

| 编号 | 文件夹 | 功能 | 上游输入来自 | 输出交给 |
|---|---|---|---|---|
| F01 | [F01_Intake_Import](F01_Intake_Import/) | 资料接入与导入批次 | 用户文件、粘贴、CSV、邮箱 | F02、F03 |
| F02 | [F02_Profile_Parsing](F02_Profile_Parsing/) | 简历解析与候选人档案 | F01 | F03、F04、F06 |
| F03 | [F03_Duplicate_Detection](F03_Duplicate_Detection/) | 重复识别与身份复核 | F01、F02 | F04 |
| F04 | [F04_Resume_Library](F04_Resume_Library/) | 简历库 | F01～F03、F06 | F06、F07 |
| F05 | [F05_Job_Criteria](F05_Job_Criteria/) | 岗位与评分标准 | 用户 JD、JD Management | F06、F08 |
| F06 | [F06_Job_Discovery](F06_Job_Discovery/) | AI 岗位发现与推荐 | F02、F04、F05 | F07 |
| F07 | [F07_Job_Linking](F07_Job_Linking/) | 人工岗位关联 | F06 | F08、F09 |
| F08 | [F08_AI_Screening_Evaluation](F08_AI_Screening_Evaluation/) | AI 岗位筛选评估 | F05、F07 | F09、F10、F11 |
| F09 | [F09_Screening_Workspace_Ranking](F09_Screening_Workspace_Ranking/) | 筛选工作台、排序与批量筛选 | F07、F08 | F10、F11 |
| F10 | [F10_Candidate_Comparison](F10_Candidate_Comparison/) | 候选人对比 | F08、F09 | F11 |
| F11 | [F11_Human_Decision](F11_Human_Decision/) | 人工决定与例外审批 | F08～F10 | 交接投递（功能拆分 F12） |

## 依据

- [Resume Screening PRD v1.3](../../../hireos-screening/docs/Resume_Screening_PRD_v1.3.md)：需求基线。
- [原型 v2](../../design/Resume_Screening/HireOS-Resume-Screening-Prototype-v2.html)：页面与交互。
- [用户旅程 v0.2](../user-journeys/Resume_Screening_User_Journeys_v0.2.md)：已确认的产品决定（Must-have 即硬性、移除工作授权字段和招聘预算等）、Patch 1 规则的转述、测试数据。

## 公共约定

### 角色与权限

沿用 JD Management 的四类角色（[JD 九模块 User Journey §0.1](../JD_Management/HireOS_Command_JD_Management_Module_User_Journeys_v1.0.md)，2026-10-14 用户决定），按简历筛选的职责对应如下：

| 角色 | 登录后的主要目的 | 核心操作 | 默认限制 |
|---|---|---|---|
| Recruiter / TA | 把简历变成可筛选的候选人，推动关联、筛选和下一步 | 导入简历、纠正档案、处理重复复核、配置岗位标准（为标准负责人时）、确认关联、查看评估与改分、对比、提交决定、发送拒绝通知 | 不能替 HR Approver 批准例外；不能绕过过期、权限和工作流校验 |
| Hiring Manager | 判断候选人是否适合岗位，补充业务判断 | 查看评估与证据、改分、处理顾虑、对比与批注、确认关联和提交决定（为岗位负责人时）、例外审批中的 HM 方批准 | 不能导入简历、纠正档案；默认看不到薪资期望和工作授权；不能批准自己发起的例外 |
| HR Approver | 确认越过岗位底线的推进合规、可追溯 | 例外审批中的 HR 方批准；处理受限重复复核队列；查看受限字段、隔离文件和审计 | 不作普通筛选决定；不编辑岗位标准；AI 建议不能代替审批结论 |
| Viewer | 阅读获授权的岗位、候选人和评估结论 | 查看简历库、评估、对比的结论 | 不能导入、编辑、关联、改分、批注、导出、决定；看不到受限字段（接口也不下发） |

权限矩阵（默认值，标 * 的为本文推断，待确认）：

| 能力 | Recruiter / TA | Hiring Manager | HR Approver | Viewer |
|---|---|---|---|---|
| 导入简历（F01） | ✅ | ❌* | ❌ | ❌ |
| 查看简历库与档案（F02、F04） | ✅ | ✅ 仅所负责岗位的候选人* | ✅ | ✅ 只读 |
| 纠正档案（F02） | ✅ | ❌* | ❌ | ❌ |
| 重复复核（F03） | ✅ | ❌ | ✅ 含受限队列 | ❌ |
| 编辑 / 确认岗位标准（F05） | 岗位标准负责人 | 岗位标准负责人 | ❌* | ❌ |
| 确认岗位关联（F07） | 岗位负责人 | 岗位负责人 | ❌ | ❌ |
| 改分、处理顾虑与待核实项（F08） | ✅ | ✅ | ❌ | ❌ |
| 对比、批注（F10） | ✅ | ✅ | 只看 | 只看 |
| 导出（F10） | ✅ | ✅ | ✅ | ❌ |
| 普通决定（F11） | 岗位负责人 | 岗位负责人 | ❌ | ❌ |
| 例外审批（F11） | 发起 | HM 方批准 | HR 方批准 | ❌ |
| 发送拒绝通知（F11） | ✅ | ❌* | ❌ | ❌ |
| 联系方式 | ✅ | ✅ | ✅ | ❌ |
| 薪资期望、工作授权、受限证据 | ✅ | ❌* | ✅ | ❌ |
| 隔离文件原文、审计 | ❌ | ❌ | ✅ | ❌ |

「岗位负责人」「岗位标准负责人」由岗位配置决定，Recruiter / TA 或 Hiring Manager 都可以担任（PRD §2）。所有权限由服务端保证，不能只靠前端隐藏。

### 测试身份

| 身份 | 角色 | 说明 |
|---|---|---|
| recruiter_a | Recruiter / TA（线上演示角色 Emma Wilson） | 大多数闭环的默认执行者；测试岗位的负责人和标准负责人 |
| hm_a | Hiring Manager（线上演示角色 Daniel Park） | 测试岗位的用人经理；例外审批的 HM 方 |
| approver_a | HR Approver | 例外审批的 HR 方；受限重复复核队列 |
| viewer_a | Viewer | 只读；检查受限字段不下发、编辑类接口返回 403 |
| recruiter_other_scope | Recruiter / TA（无测试岗位和测试候选人的权限） | 检查越权与「无权查看的可能重复」 |

线上目前只有 HR / HM / Admin 三个演示角色，approver_a、viewer_a、recruiter_other_scope 需要先补测试账号（相关 Issue：#21、#24）。

### Seed（前置状态）目录

| Seed | 内容 | 使用模块 |
|---|---|---|
| S0_empty | 已登录；简历库、岗位均为空 | F01、F04、F05 |
| S_lib_nina | 简历库有 `[UJ-TEST] Nina Torres`（内容同用户旅程 §3.4） | F01、F02、F03 |
| S_lib_nina_restricted | 同 S_lib_nina，但执行者无权查看 Nina | F03 |
| S_job_draft | 岗位 `[UJ-TEST] Senior Backend Engineer II` 已创建，标准为草稿 | F05 |
| S_job_confirmed | 同上岗位，标准 v1 已确认；简历库为空 | F05、F06 |
| S_job_closed | 岗位已关闭，存在待确认推荐 | F06、F07 |
| S_dataset | 用户旅程 §3.4 标准数据集：岗位标准 v1 已确认，5 名候选人已入库，自动匹配完成，推荐均为待确认 | F06、F07、F09 |
| S_linked | S_dataset + Nina、Ben、Hoa 已关联，各有一份有效评估 | F08、F09、F10、F11 |
| S_linked_stale | S_linked + 标准 v2 已确认，已有评估为过期 | F05、F08、F11 |
| S_compare | S_linked + 一个包含 Nina、Hoa、Ben 的对比集合，快照 v1 | F10 |

所有测试岗位、候选人名称加 `[UJ-TEST]` 前缀，测试后清理。所有邮箱使用 `example.com`。

### 注入点

在节点的 `inject` 字段中标注，测试时对该节点各跑一次：

| 注入 | 含义 | 通过标准 |
|---|---|---|
| network_down | 断网 | 有失败提示和重试；输入不丢 |
| llm_fail | AI 失败 / 超时 | 状态显示失败或 unavailable；不显示假成功；不编造结果 |
| double_click | 重复点击提交类按钮 | 只生效一次 |
| refresh | 中途刷新 / 后退 | 不产生半成品 |
| http_500 | 保存接口返回 500 | 不显示已保存 |
| concurrent | 两个会话同时提交同一对象 | 只有一个生效；另一方看到冲突或已有结果，不覆盖 |
| scanner_down | 安全扫描引擎不可用 | 文件进入隔离，原因为「扫描未完成」，可重试 |

### 闭环文档格式

`Loop_IO.md` 的结构与 JD Management 一致：

1. **输入与输出**：按统一模板列出——输入（身份、前置状态、用户数据、外部依赖桩）和输出（UI、API / 数据、事件 / 审计、禁止副作用、交给下游）。
2. **结构化规格**：YAML，供 AI 模拟测试使用；字段含义见 [JD 闭环文档格式](../JD_Management/README_Modules.md#闭环文档格式)。节点类型：`action` 操作、`decision` 分支、`check` 断言、`terminal` 终态；断言按 `ui` 页面、`api` 接口响应、`db` 持久化数据、`record` AiRun / 审计、`ext` 外部（候选人通知、导出文件）分位置。
3. **测试数据**：路径中引用的数据名称。
4. **路径清单**：一条路径对应一个 test case，并标注对应的 PRD 验收标准（AC）。
5. **流程图**：由规格生成，不单独修改。
6. **待确认**。

断言原则：
- 权限类断言必须检查 `api`，不能只看 `ui`。
- AI 输出写判定条件，不写固定文字；同一输入至少跑 2 次。
- 后端未实现的功能，路径照写，测试中标记为 known gap，不写成通过。

## 用例统计（User_Cases.md）

| 模块 | 用例数 | ✅ 可测 | 🟡 部分可测 | ❌ 未实现 |
|---|---|---|---|---|
| F01 | 20 | 11 | 1 | 8 |
| F02 | 15 | 6 | 6 | 3 |
| F03 | 16 | 5 | 5 | 6 |
| F04 | 13 | 5 | 3 | 5 |
| F05 | 15 | 4 | 8 | 3 |
| F06 | 15 | 5 | 6 | 4 |
| F07 | 15 | 9 | 3 | 3 |
| F08 | 16 | 8 | 5 | 3 |
| F09 | 13 | 2 | 6 | 5 |
| F10 | 16 | 5 | 7 | 4 |
| F11 | 17 | 2 | 9 | 6 |
| **合计** | **171** | **62** | **59** | **50** |

状态为 2026-10-14 按代码目录和接口的初步核对，未实际执行。「✅ 可测」只表示功能已有实现、用例可以直接执行，不代表会通过；❌ 中大部分是权限类用例，需要先补四类角色的测试账号。

## 说明

- PRD 的「实现现状」是 2026-10-14 按代码目录和接口做的初步核对，没有逐项验证 AC。
- PRD Patch 1 不在仓库中，相关规则（置信度档位、推荐五档阈值、评分维度配置）引自用户旅程文档。
- 权限矩阵中标 * 的默认值是按 JD 四角色推断的，需要确认；原 Patch 1「Admin 可编辑任意岗位标准」在四角色下暂无对应角色，F05 改为只有岗位标准负责人可编辑。
- 支撑能力（任务、通知、首页统计、偏好学习、Files & Integrations、模型配置、权限审计）是功能拆分中的 F13～F19，未在此建文件夹。
