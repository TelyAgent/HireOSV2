# HireOS Command — JD Management 线上版本测试报告

**测试日期**：2026-10-13（Asia/Shanghai）  
**线上地址**：<https://hireos.aipollo.me/hireos/jd/jobs>  
**浏览器**：Chrome（已登录账号显示为“蔡敏”）  
**依据**：

- `HireOS_Command_JD_Management_User_Journeys_v0.1.md`（文件正文当前标注 v0.2）
- `HireOS_Command_JD_Management_UX_UI_Review_Standard_v1.0.md`
- JD Copilot Agent PRD v0.2 与 JD 完整性标准 v0.1（作为旅程预期依据）

## 1. 结论

线上 JD Management 的职位库、已有职位工作区、手动创建表单、完整性分析和发布门禁可访问，且已有职位刷新后内容保持，说明管理主路径具备可测试的基础能力。

但 AI 创建主路径当前不能完成：Quick Start 发送回答后返回 **“Sign-in service is unavailable.”**，没有生成草稿、没有打开 Workspace，也没有创建职位。这是 P0 主流程阻断，J1 不能通过；同一错误会导致 Copilot 的“新对话”无法恢复，形成 P1 级恢复性问题。线上权限多角色、真实发布渠道、文件解析、外部链接抓取和多浏览器兼容性本次未能完成验证，不能判定为通过。

## 2. 执行范围与证据

| 证据 | 线上观察 |
|---|---|
| E1 | Job Library 首屏：14 个职位，7 Published / 7 Draft；表格显示 Job title、Hiring status、Active version、Department、Owner、Location、HC、Updated。 |
| E2 | Create a Job 面板：Quick Start、Start with a Job Title、Upload a JD、Paste a Link or Text、Create Manually 五个入口均可见，并有说明文案。 |
| E3 | Quick Start 发送两行非敏感测试回答后，显示 `Sign-in service is unavailable.`；无 Agent 追问、无草稿、无 Workspace。 |
| E4 | 点击 New conversation 后，错误消息和原 Quick Start 会话仍保留；再次从 Job Library 打开 New job 才恢复为 Create a Job 初始状态。 |
| E5 | 现有 Draft `AI 产品经理` 工作区：状态 Draft、JD ID `JD-2026-0011`、Not published、Publish disabled；显示 Public / Internal / Confidential 可见性分区。 |
| E6 | 对现有职位点击 Analyze 后，生成 `9 / 11 required items passed`，列出 2 个缺失项（Level、Public salary range）、3 个 Suggestions，并展示 AI Review 的待修改项与 Completed 清单。 |
| E7 | 刷新现有职位后仍回到同一职位工作区，正文与分析结果保留；证明本次观察到的持久化行为。 |
| E8 | Create Manually 表单包含 Job title、Location、Headcount、Level、Employment type、Department、Role summary、Responsibilities、Requirements、Preferred；空提交提示 `Please enter a job title.`，招聘人数 `0` 提示 `Headcount must be a whole number of 1 or more.`。 |

截图在本次线上审查会话中已捕获：AI 错误状态、职位工作区、Analysis 结果。由于浏览器连接器只返回内存截图，未将截图伪装成仓库文件；本报告以截图对应的 DOM、状态和可见文案作为可复核证据。

## 3. User Journey 测试矩阵

状态含义：**通过** = 本次观察满足可见预期；**失败** = 明确出现与预期相反的结果；**部分通过** = 仅验证到旅程的一部分；**阻塞** = 当前环境或线上能力不具备，不能据此判断产品通过。

| 旅程 | 结果 | 本次执行与证据 | 结论 |
|---|---|---|---|
| J1 Quick Start 创建 | **失败（P0）** | E2 → E3；入口和三问文案可见，但发送后为 Sign-in service unavailable，未生成 JD。 | AI 创建主流程不可用。 |
| J2 从职位名称开始 | **阻塞（P0）** | 可确认入口存在；因 E4 的会话重置问题和 AI 服务错误，未能完成 3 版本生成及创建。 | 需修复会话/服务后复测。 |
| J3 上传 JD | **阻塞（P1）** | 入口可见；未执行真实文件上传，未验证解析、一致性及异常文件。 | 需准备测试文件并复测。 |
| J4 粘贴链接或文案 | **阻塞（P1）** | 入口可见；未验证链接抓取、正文解析和失败提示。 | 需 AI 服务恢复后复测。 |
| J5 手动创建 | **部分通过（P0）** | E8 验证表单字段、空提交、逐项必填和 Headcount=0 边界；未保存完整职位，避免产生线上测试数据。 | 前端校验可用；服务端校验、成功保存、持久化未验证。 |
| J6 补全、Analyze、AI 修复 | **部分通过（P0）** | E5–E7 验证 Analyze、分析分组、缺失项、建议项、Publish disabled 和刷新持久化；未执行 AI fix/Undo，也未把职位补齐到可发布。 | 管理/审查路径部分可用，闭环未完成。 |
| J7 权限 | **阻塞（P0）** | 当前只有一个已登录账号；未获得 Owner/Admin/Member/非参与者账号。 | 按原脚本暂缓，不能判定权限安全。 |
| J8 发布与版本 | **阻塞（P0）** | 观察到 Draft、Not published、Publish disabled、Version history；线上未执行真实发布。 | 真实发布渠道、v1/v2、对比/恢复未验证。 |
| J9 编辑一致性 | **部分通过（P1）** | 工作区字段、可见性分组、状态、分析结果和版本入口可见；未覆盖标题联动、字段行显示规则的全部编辑场景。 | 需补充编辑变更与刷新验证。 |
| J10 异常/边界/线上专项 | **部分通过（P2）** | 已验证 AI 服务失败状态、会话无法重置、空提交、Headcount=0、刷新持久化；未验证网络中断、并发冲突、幂等和服务端绕过校验。 | 需要专项环境与账号。 |

## 4. UX/UI 标准审查

| 标准 | 观察结论 | 级别 |
|---|---|---|
| U1 容易理解 | 页面显示 Job Library、职位标题、Draft、JD ID、Not published、Publish disabled；用户能判断当前对象和状态。 | 通过（当前页面） |
| U2 容易上手 | 首屏有 New job；创建面板给出五种入口和一句话说明。 | 通过（入口层） |
| U3 快速完成任务 | AI 主流程发送后无法继续，且没有草稿或 Workspace。 | **P0 失败** |
| U4 下一步明确 | 分析面板能给出 To complete、To revise、Suggestions；但 AI 错误只给出服务不可用，没有重试/恢复路径。 | P1 问题 |
| U5 提示和按钮清楚 | Publish 明确为 disabled；Analyze 有数量标记；空表单和 Headcount=0 有明确文案。 | 部分通过 |
| U6 符合真实工作方式 | 编辑器区分 Public、Internal、Confidential，且有 Copilot/Analysis/Version history；审批、权限、渠道交接未验证。 | 部分通过 |
| U7 信息结构符合角色目标 | 当前账号显示统一 Job Library；本次只有一个账号，未能验证 HR、管理者、面试官差异化首屏。 | 阻塞 |
| U8 减少重复输入和跳转 | New conversation 未清掉失败会话；用户需要关闭/回到列表/重新打开 New job 才能恢复初始入口。 | **P1 失败** |
| U9 可恢复和可预期 | 加载时有 Analyzing…、保存状态有 Saved；AI 失败后保留输入但没有可见重试或错误恢复动作。 | **P1 问题** |
| U10 可访问、可读、可操作 | 主要控件有可读文本，错误和状态不是只靠颜色；键盘顺序、200% 缩放、屏幕阅读器和焦点管理未完成专项测试。 | 部分通过/限制 |

## 5. 缺陷与建议

### F-001 — Quick Start 提交后登录服务不可用

- **严重度**：P0
- **复现**：Job Library → New job → Quick Start → 输入两行非敏感回答 → Send。
- **实际**：显示 `Sign-in service is unavailable.`；没有第三问追问、没有生成状态完成、没有草稿、没有 Workspace。
- **预期**：Agent 继续收集三问并生成一份可检查的职位草稿。
- **影响**：J1 主流程不可用；J2/J4 等依赖 AI 服务的创建流程也无法完成。
- **建议**：检查线上 Agent 请求的认证/会话依赖；失败时保留输入、提供 Retry/Back to creation options，并记录可关联的 request ID。

### F-002 — New conversation 未重置失败状态

- **严重度**：P1
- **复现**：在 F-001 错误出现后点击 New conversation。
- **实际**：原 Quick Start 问题、用户输入和错误仍保留；没有回到 Create a Job 初始入口。
- **预期**：清空当前会话并展示五种创建入口，或明确提示新会话创建失败及恢复动作。
- **建议**：新会话生成新 conversation ID，清空消息、步骤状态和输入；在失败状态增加显式 Retry / Start over。

### F-003 — AI 错误状态缺少可恢复动作

- **严重度**：P1
- **实际**：错误文本可见，但没有 Retry、查看服务状态、复制错误详情或回到入口的主动作。
- **建议**：错误卡片提供 Retry 与 Start over；重试必须幂等，不能重复创建职位；保留原始回答。

### F-004 — 角色和权限无法按 User Journey 验证

- **严重度**：P0（验收阻塞，不等同于已确认产品漏洞）
- **实际**：本次仅有蔡敏账号；无法验证 Owner/Admin/Member/非参与者、Confidential 服务端过滤和发布权限。
- **建议**：提供隔离的 A/B/C/D 测试账号和测试职位；补做 UI、直接链接访问、Network 响应体三层检查。

## 6. 本地工程验证补充

这部分不是线上产品结果，但用于判断当前前后端是否具备继续修复和复测的基础：

| 项目 | 命令/结果 |
|---|---|
| JD 前端 | `npm ci` 成功；`npm run typecheck`、`npm run build`、`npm run lint` 均通过。Build 有 JS chunk 约 1.57 MB、gzip 约 501.87 kB 的体积警告。 |
| JD 后端类型检查 | `npm run typecheck` 通过；直接 `npx tsc -p tsconfig.build.json` 通过。 |
| JD 后端构建 | 官方 `npm run build` 受 `chokidar` watchAssets 触发 `EMFILE: too many open files, watch` 阻塞，属于本地文件句柄/构建配置问题，不能写成产品线上失败。 |
| JD 后端测试 | `node --test test/*.test.cjs`：1 个测试通过，0 失败。 |

## 7. 限制与复测前置条件

1. 本次线上账号只有一个，不能验证 HR、管理者、面试官或 Owner/Admin/Member 差异。
2. 未进行真实职位发布、外部渠道交付、撤回或公开页面验证，避免对外产生测试发布。
3. 未上传文件、未提交链接、未创建完整 `[UJ-TEST]` 职位，因此没有新增需要清理的线上测试职位。
4. 未完成 Safari/Edge、200% 缩放、键盘全流程、屏幕阅读器、Network 层服务端权限和并发冲突测试。
5. 修复 F-001 至少应先复测 J1；修复 F-002/F-003 后再复测 J2–J4、J6 的 AI fix/Undo；提供多角色账号和测试渠道后再执行 J7/J8。

**总体判定：当前线上版本不满足 JD Management User Journey 的主流程验收条件；管理工作区和表单校验可继续迭代，但 AI 创建链路必须先修复。**

问题已汇总到独立跟踪表单：[HireOS_Command_JD_Management_Issue_Tracking_Form_20261014.md](HireOS_Command_JD_Management_Issue_Tracking_Form_20261014.md)。
