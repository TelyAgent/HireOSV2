# F01 资料接入与导入批次：线上测试及 UX/UI 审查报告

后续虚构 PDF、DOCX、扫描件及异常文件的实测结果见[格式与异常路径复测报告](Test_Report_Format_Exception_2026-10-15.md)。下文保留首次测试时的证据与统计。

测试日期：2026-10-15，约 09:35–10:00（Asia/Shanghai）  
结论：**不通过（fail）**。缺姓名资料仍被创建为候选人，违反 AC-5；粘贴来源被记录为 `manual_upload`，违反 FR-6。文件批次的部分成功可见，但异常文案和恢复指引不足。其余核心安全、权限与大批量断言缺少可控线上条件，**未验证**，不计为通过。

## 1. 范围、基线和证据

| 项 | 本次情况 |
|---|---|
| 需求基线 | [PRD](PRD.md) AC-1～AC-11、[User Journey](User_Journey.md)、[Loop_IO](Loop_IO.md)、[User Cases](User_Cases.md) UC-F01-01～20，均为 2026-10-14 草稿 |
| UX/UI 方法 | [JD Management UX/UI Review Standard v1.0](../../HireOS_Command_JD_Management_UX_UI_Review_Standard_v1.0.md) 的 U1～U10、P0～P3、证据和报告格式；职位版本、审批、发布等 JD 专属检查不适用于 F01 |
| 线上入口 | [简历库](https://hireos.aipollo.me/hireos/screening/library)，Chrome 已登录页面；页面显示账号“蔡敏”及“演示说明” |
| 测试身份 | 页面显示的登录账号；服务端角色、Workspace 和权限未核实，不能认定为 `recruiter_a` |
| 证据来源 | 页面可访问树、可见状态、导入后候选人详情和返回列表后的持久化复核；少量本地代码静态核对单独注明 |
| 环境限制 | 未取得线上构建号、已登录 API/DB、Material/ImportItem/AiRun/审计、角色测试账号、隔离邮箱、扫描引擎故障注入；未使用真实候选人文件 |
| 测试数据 | 仅提交虚构姓名与 `example.com` 地址；本次创建 3 名测试候选人，ID 见第 8 节 |

**判定口径：**“通过/失败”只用于实际执行且证据足够的断言；“部分观察”表示只验证了用例的一部分；“未执行”表示没有进行线上动作；“known gap”指文档或代码已标出的实现缺口，不能写作线上实测失败。下列 20 条用例按整条用例判定，不以子步骤通过替代整条通过。

## 2. 实际执行记录

| 证据 ID | 操作 | 预期 | 线上实际结果 | 结论 |
|---|---|---|---|---|
| F01-LIVE-01 | 打开简历库和上传弹窗 | 无需先选岗位即可导入 | 页面写明“简历可以在职位创建之前就先到达”；上传弹窗写“无需先选择职位” | 入口子项通过 |
| F01-LIVE-02 | 粘贴 `[UJ-TEST] Pia Nguyen`、邮箱、`Based in Ho Chi Minh City, Vietnam.` 与技能后提交 | 识别姓名、邮箱、纯地点；来源为 Paste | 批次 `c8590296-c71c-4fa0-8426-563ff222d580` 显示 1/1 成功；[候选人档案](https://hireos.aipollo.me/hireos/screening/candidates/0a1255a5-9ead-4d81-b3ae-9b7ca5822bf4)显示姓名、邮箱、`Ho Chi Minh City, Vietnam`；简历版本和列表来源均为 `manual_upload`。输入后未出现姓名/邮箱/所在地确认表单 | AC-5 部分通过；FR-6 失败 |
| F01-LIVE-03 | 一次选择虚构 `valid.txt`（133 字节）、`empty.txt`（0 字节）、`unsupported.csv`（30 字节） | 逐条处理；好文件入库，坏文件有明确原因；批次部分成功 | 批次 `858cc6aa-7c30-44fa-96a5-342ed77f1940` 为 3/3、部分成功；`valid.txt` 入库，[档案](https://hireos.aipollo.me/hireos/screening/candidates/3dedfca9-5e3c-4af7-9f1d-1ac15afcf0b7)可打开；空文件显示 `Bad Request Exception EMPTY_FILE`，CSV 显示 `Bad Request Exception UNSUPPORTED_FILE_TYPE`，两项均显示“无需操作” | AC-2 的独立结果和部分成功子项通过；异常解释和恢复子项失败 |
| F01-LIVE-04 | 粘贴**无姓名**的虚构资料：邮箱 `pia.noname.20261015@example.com`、地点、技能，然后提交 | 姓名必填；不能保存 | 提交按钮可点，批次 `8c5ec940-0203-4052-a0ee-668e2d703fa1` 显示 1/1 成功；[档案](https://hireos.aipollo.me/hireos/screening/candidates/f76a0404-2123-4270-abc9-47547c72f90f)创建，姓名为 `Pia Noname`，显然由邮箱本地部分推断；来源仍为 `manual_upload` | **AC-5 失败** |
| F01-LIVE-05 | 打开“从邮箱导入”页签 | 已连接测试邮箱可立即读取 | 页面存在“立即读取”按钮和已连接邮箱；本次没有点击，避免消费非隔离邮箱中的邮件 | 仅入口观察；UC-17 未验证 |

本次未对页面上既有候选人作任何编辑、删除或导出。首次进入列表及返回列表后，页面先短暂显示 0 人，随后加载出 55 人；在数据加载前没有可见“加载中”状态，可能使用户误以为空库。此项只作 UI 发现，不作为数据丢失结论。

## 3. 20 条用例执行矩阵

| 用例 | 结果 | 本次证据与限制 |
|---|---|---|
| UC-F01-01 不选岗位上传单个简历 | **部分观察** | F01-LIVE-01 和 `valid.txt` 入库；规定的 PDF、逐阶段 UI、CandidateSource API/DB 未验证 |
| UC-F01-02 多文件上传互不影响 | **部分通过** | F01-LIVE-03 证明三文件独立结果和批次部分成功；未用 DOCX/扫描 PDF，未核对 API 状态计数 |
| UC-F01-03 超过 20MB | **未执行** | 页面宣称 20MB；未上传大文件。静态代码的后端上限为 25MB，线上构建未核实，见第 6 节 |
| UC-F01-04 超过 10 页 | **known gap/未执行** | 未上传 11 页 PDF；文档已标未实现 |
| UC-F01-05 不支持的格式 | **部分观察** | CSV 被拒绝，显示技术错误码；`.png`、`.zip` 和候选人未生成的 DB 断言未核 |
| UC-F01-06 扫描件与空文件 | **部分观察** | 0 字节 TXT 被拒绝；扫描 PDF 和 Material.readStatus 未核 |
| UC-F01-07 加密 PDF 被隔离 | **known gap/未执行** | 未向线上提交加密 PDF；文档已标未实现 |
| UC-F01-08 宏与可执行文件被隔离 | **未执行** | 未向线上提交含宏或可执行文件；没有安全隔离数据和审计入口 |
| UC-F01-09 扫描引擎不可用时隔离 | **known gap/未执行** | 无故障注入；ClamAV 接入在文档中标为缺口 |
| UC-F01-10 批量失败只重试失败项 | **未执行** | 三文件批次的两项输入错误显示“无需操作”，不是可重试的解析失败；未运行 100 份批次 |
| UC-F01-11 取消批次 | **未执行** | 未对线上运行中批次执行取消 |
| UC-F01-12 提示注入不生效 | **未执行** | 无模型输入、工具调用和 AiRun 审计；未提交注入文件 |
| UC-F01-13 粘贴资料识别 | **失败** | F01-LIVE-02 地点识别正确；F01-LIVE-04 缺姓名仍创建候选人；无提交前字段确认 |
| UC-F01-14 CSV 映射预览与逐行导入 | **known gap/未执行** | 页面未见 CSV 导入入口；CSV 经文件上传通道被当作不支持格式拒绝，不能代替 CSV 流程测试 |
| UC-F01-15 CSV 敏感列与公式注入 | **known gap/未执行** | 无 CSV 映射/导入路径；未提交敏感列或公式值 |
| UC-F01-16 CSV 文件不合规 | **known gap/未执行** | 无 CSV 专用入口；未测试 GBK 和 1,001 行 |
| UC-F01-17 邮箱立即读取 | **部分观察** | F01-LIVE-05 仅证实入口及已连接状态；未读取、未验证附件与来源 |
| UC-F01-18 双击上传只生效一次 | **未执行** | 无重复提交测试及 DB 幂等证据 |
| UC-F01-19 非 Recruiter 角色不能导入 | **known gap/未执行** | 缺 Hiring Manager/Viewer 测试身份及已登录 API 403 核查 |
| UC-F01-20 HR Approver 查看隔离文件原文 | **known gap/未执行** | 缺 HR Approver 身份、隔离材料及原文授权 API |

统计：**失败 1 / 部分通过或部分观察 5 / 未执行 6 / known gap 且未执行 8 = 20**。本次没有一条整项用例获得全部 UI、API/DB 与记录断言的“通过”证据。

## 4. AC 覆盖与放行判断

| AC | 结论 | 依据 |
|---|---|---|
| AC-1 无岗位上传入库 | **部分观察** | TXT 无岗位入库；PDF 与 CandidateSource 未核 |
| AC-2 多文件独立结果 | **部分通过** | 三文件批次部分成功；状态计数/API 和指定文件类型未核 |
| AC-3 各类失败原因且不建人 | **未完成** | 空文件/不支持格式仅有技术错误；扫描、加密、20MB、10 页未核 |
| AC-4 100 份中一份失败且仅重试失败项 | **未验证** | 未运行 100 份，也无可控可重试失败 |
| AC-5 粘贴识别且姓名必填 | **失败** | 无姓名仍创建候选人；正常资料地点识别正确 |
| AC-6 取消批次保留已完成项 | **未验证** | 未执行取消 |
| AC-7 提示注入不改变 AI 行为 | **未验证** | 缺模型及审计证据 |
| AC-8 CSV 映射与逐行容错 | **known gap/未验证** | 无 CSV 导入入口 |
| AC-9 CSV 敏感列与公式 | **known gap/未验证** | 无 CSV 导入入口 |
| AC-10 加密 PDF/病毒隔离 | **known gap/未验证** | 无隔离和 ClamAV 证据 |
| AC-11 扫描不可用时隔离并重试 | **known gap/未验证** | 无扫描故障注入 |

按审查标准 §7，AC-5 的已复现主流程失败与未关闭的安全/权限验收缺口足以给出 **fail**；不能把未验证项算作通过。这里的安全/权限“缺口”是证据不足和文档已知未实现，**不是已实测线上泄露**。

## 5. 发现与最小修复方向

| ID / 严重级别 | 角色、步骤与证据 | 用户影响 | 建议与修复验收 |
|---|---|---|---|
| F01-UX-01 / **P1** | Recruiter，旅程步骤 9；F01-LIVE-04：无姓名文本直接提交并建人，档案将邮箱前缀推断为 `Pia Noname` | 错误身份进入简历库及后续匹配，用户没有机会确认 | 粘贴后展示可编辑的姓名、邮箱、地点；姓名为空时阻止提交。复测无姓名时 UI 提示且 API 不创建 Material/Candidate |
| F01-UX-02 / **P1** | Recruiter，步骤 9；F01-LIVE-02/04：粘贴档案的简历版本及列表来源均为 `manual_upload` | 无法追溯真实接入渠道，影响审计和重复识别 | 区分 Paste 与 Manual upload 的来源记录；以已登录 API/DB 核对 CandidateSource.channel 和 source_record_id，刷新 UI 一致 |
| F01-UX-03 / **P2** | Recruiter，步骤 3；F01-LIVE-03：空文件和不支持格式显示 `Bad Request Exception` + 错误码 + “无需操作” | 用户看到内部错误词，不知道应更换文件还是重试 | 用业务语言说明“文件为空，请选择有内容的文件”“格式不支持，请使用 PDF/DOCX/TXT”；非重试错误提供“重新选择文件”动作；检查单项失败不清空其他结果 |
| F01-UX-04 / **P2** | Recruiter，步骤 1/9；粘贴页只有一个文本框和“加入简历库”，提交前无识别结果预览 | 用户无法在入库前纠正被误识别的姓名、地点 | 展示预览与可编辑字段；复测姓名缺失、邮箱前缀和地点整句等边界 |
| F01-UX-05 / **P2** | Recruiter，返回简历库；列表先显示 0 人，之后加载 55 人 | 加载期间空库文案可能误导用户 | 列表加载时显示明确 loading 状态；只在请求完成且确实为空时显示空状态 |
| F01-GAP-01 / **P0 验收阻断，非实测缺陷** | HR Approver/Viewer；UC-19/20 与 AC-10/11 缺测试身份、隔离材料、扫描版本和服务端授权证据 | 不能证明隔离与权限边界 | 提供隔离账号/材料及只读 API/审计入口，按角色逐项核验 403、隔离原因和禁止副作用 |
| F01-GAP-02 / **P1 验收阻断** | Recruiter；UC-10/11/17 缺可控 100 份批次、可重试失败与隔离邮箱 | 不能证明取消、仅重试失败项、邮箱状态/来源 | 在隔离测试环境准备 seed 和故障注入后执行，核对批次/条目及候选人数量前后差值 |

## 6. 本地代码静态核对（不等于线上构建证据）

- `materials.service.ts` 当前仓库的 `MAX_FILE_SIZE` 为 **25MB**；F01 PRD 要求 **20MB**。前端上传页文案为 20MB，`folderFiles.ts` 对前端选择设置了小于 20MB 的上限。需以线上已登录 API 直接上传 20～25MB 文件确认服务端行为；不能从本地代码直接断言线上失败。
- `PasteTab.tsx` 以首个非空行命名 `.txt` 文件，通过文件批次路径处理；`ImportChannel` 目前没有 `paste` 枚举。该静态事实与 F01-LIVE-02/04 的 `manual_upload` 显示一致，仍需 DB 核实真实来源字段。
- `UploadTab.tsx` 仅在条目 `failed && retryable` 时显示重试按钮；`imports.service.ts` 将 `EMPTY_FILE`、`FILE_TOO_LARGE`、`UNSUPPORTED_FILE_TYPE` 设为不可重试。因此 F01-LIVE-03 没有重试按钮本身符合现有实现，但“无需操作”不符合用户恢复任务的文案需要。

## 7. U1～U10 应用性检查

| 项 | 结论 | 证据或限制 |
|---|---|---|
| U1 容易理解 | **部分通过** | 简历库和入口清楚；技术错误词与“无需操作”含义不清 |
| U2 容易上手 | **部分通过** | 上传/粘贴入口和格式限制可见；CSV 入口缺失 |
| U3 快速完成任务 | **部分通过** | 无岗位上传一步可达；识别错误需入库后再修正 |
| U4 下一步明确 | **失败** | 失败文件的“无需操作”未说明替换文件，粘贴提交前无确认动作 |
| U5 提示和按钮清楚 | **失败** | `Bad Request Exception`、错误码直接展示给用户 |
| U6 符合真实工作方式 | **未验证** | CSV、邮箱、100 份批次未形成完整实测路径 |
| U7 信息结构符合角色 | **未验证** | 仅一个登录账号，业务角色未证实 |
| U8 减少重复跳转 | **部分观察** | 成功条目可直接打开档案；缺少提交前识别修正 |
| U9 可恢复和可预期 | **失败** | 无姓名直接建人；输入错误没有明确重新选择动作；取消/故障路径未核 |
| U10 可访问、可读、可操作 | **未验证** | 本次未做键盘、焦点顺序、200% 缩放与读屏测试；状态文字不只靠颜色 |

```yaml
review:
  product: "Resume Screening / F01"
  surface: "简历库导入弹窗与候选人档案"
  role: "Other（已登录账号，Recruiter/TA 角色未核实）"
  journey_goal: "导入多来源简历，逐份确认是否入库并处理失败"
  evidence:
    source: "线上 Chrome 页面可访问树、可见状态、候选人详情与列表刷新复核"
    steps_checked: [1, 3, 9, 12]
  verdict: "fail"
  findings:
    - {id: "F01-UX-01", severity: "P1", category: "state", step: 9, title: "无姓名仍建人", evidence: "批次 8c5ec940 1/1 成功，档案名 Pia Noname", user_impact: "身份可能错误", recommendation: "姓名必填且提交前可确认", acceptance_check: "无姓名 UI/API 均不建人"}
    - {id: "F01-UX-02", severity: "P1", category: "state", step: 9, title: "粘贴来源记为手动上传", evidence: "两个粘贴档案均显示 manual_upload", user_impact: "来源不可追溯", recommendation: "单列 Paste 来源", acceptance_check: "UI 与 CandidateSource 同为 Paste"}
    - {id: "F01-UX-03", severity: "P2", category: "clarity", step: 3, title: "文件错误无业务恢复指引", evidence: "Bad Request Exception EMPTY_FILE/UNSUPPORTED_FILE_TYPE、无需操作", user_impact: "用户难以修复", recommendation: "说明原因并引导重选文件", acceptance_check: "两类输入错误均有清晰动作"}
  usability_check:
    understandable: "fail"
    learnable: "unknown"
    efficient: "unknown"
    next_action_clear: "fail"
    controls_clear: "fail"
    real_workflow_fit: "unknown"
    role_information_fit: "unknown"
    no_unnecessary_hops: "unknown"
    recoverable: "fail"
    accessible: "unknown"
  limits:
    - "未取得线上构建号、已登录 API/DB、审计与 AiRun"
    - "未取得多角色、隔离邮箱、扫描引擎故障注入和可控批次 seed"
```

## 8. 测试数据与后续复测

本轮新增的 3 名候选人均为虚构数据，未关联岗位、未外发。为保留复现证据，**未删除**：

| 来源操作 | 候选人 ID | 批次 ID |
|---|---|---|
| 正常粘贴 | `0a1255a5-9ead-4d81-b3ae-9b7ca5822bf4` | `c8590296-c71c-4fa0-8426-563ff222d580` |
| 三文件批次有效 TXT | `3dedfca9-5e3c-4af7-9f1d-1ac15afcf0b7` | `858cc6aa-7c30-44fa-96a5-342ed77f1940` |
| 无姓名粘贴 | `f76a0404-2123-4270-abc9-47547c72f90f` | `8c5ec940-0203-4052-a0ee-668e2d703fa1` |

复测优先级：先修复 AC-5 和来源记录，使用同一虚构资料重测 UI 与 API/DB；再用隔离环境的多角色账号、CSV/邮箱 seed、安全扫描与可控失败批次关闭 AC-2～11。超过 20MB、11 页、加密 PDF、含宏/可执行文件、扫描器故障和 100 份批次应在具备资源隔离及审计的测试环境执行，不应仅凭这份线上 UI 报告宣称通过。

本次只新增本地报告；未创建 GitHub Issue、未提交或推送仓库改动，未执行部署。现有工作区的其他未提交变更未改动。
