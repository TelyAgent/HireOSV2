# F02 线上缺陷 GitHub Issue 提交记录（2026-10-15）

以下五份正文依据 [线上测试报告](Test_Report_2026-10-15.md) 起草，用户已明确确认 AC，并于 2026-10-15 提交 GitHub：[Issue #155](https://github.com/TelyAgent/HireOSV2/issues/155)、[#156](https://github.com/TelyAgent/HireOSV2/issues/156)、[#157](https://github.com/TelyAgent/HireOSV2/issues/157)、[#158](https://github.com/TelyAgent/HireOSV2/issues/158)、[#159](https://github.com/TelyAgent/HireOSV2/issues/159)。线上样本为虚构资料；候选人详情页可能被后续测试修改。仅页面可见行为已实测，不能据此断定 API 或数据库缺陷。

共同环境：2026-10-15，已发布 `https://hireos.aipollo.me/hireos/screening/`，已登录会话，英语界面；浏览器构建号、线上服务版本和角色映射未知。本地 HEAD `c0e47a6` 不是线上构建号。测试通过 Paste profile 导入虚构样本，批次 `bbef7640-4547-428b-bb34-83396ae8fac0`，候选人 ID `6a8ad361-32b3-41bf-832d-e42707fbcf11`。没有核对已登录 API、数据库或审计日志。

## 1. [Bug] F02 候选人档案缺少解析字段状态与原文定位

### Type

Bug

### Subsystem

hireos-screening

### Problem

完整虚构简历中明确写有语言水平、证书、项目和到岗时间，但新候选人详情没有这些信息的展示；可见字段也没有“已知 / 未提供 / 部分识别”状态、材料版本和页码/段落定位，无法逐项对照原文。仅确认线上 UI 不满足 F02 FR-1、FLD-1 和 AC-1/7，尚未确认服务端是否存储这些数据。

### User Outcome

招聘人员能在候选人详情核对 F02 §4.1 所列每类信息，并定位每个值在原简历中的出处。

### Scope

F02 §4.1 全字段解析结果的接口与详情展示；字段状态、证据位置和可用原文跳转；无来源位置时明确提示；覆盖完整与稀疏样本的自动测试。

### Non-goals

更改 F01 导入格式限制、F03 身份合并、F08 评分规则；从原文编造未提供信息。

### Acceptance Criteria

AC-1：输入含语言、证书、项目、到岗时间及其余 §4.1 字段的固定简历，解析后的 API 和详情页可逐项查看字段值与“已知 / 未提供 / 部分识别”状态；没有写的字段显示“未提供”，不生成虚构值。
AC-2：每个有原文依据的字段返回所关联的简历版本及页码/段落或等效位置；在详情点击证据可打开对应原文位置。原文或位置不可用时明确说明，不能提供失效跳转。
AC-3：刷新页面后字段、状态和证据位置保持一致；自动测试对完整与稀疏样本核对 API 和详情，不只检查组件静态文本。

### References

`docs/product/Resume_Screening/F02_Profile_Parsing/PRD.md` FR-1、§4.1、FLD-1、AC-1/7；同目录 `User_Cases.md` UC-F02-01；`Test_Report_2026-10-15.md` F02-LIVE-01；`docs/product/HireOS_Command_JD_Management_UX_UI_Review_Standard_v1.0.md` 通用 U1/U6。

### Dependencies

None；若原文读取接口或资料模型需扩展，应在同一变更中同步前后端。

### Risk

medium

### Owner

@JsonSuCoder

### AI Ready

Yes

### Reproduction

简历库 → Paste profile → 粘贴测试报告所述完整虚构简历 → Add to library → 打开候选人详情。批次成功 1/1；详情显示经历、技能等，但没有语言、证书、项目、到岗信息与逐字段来源位置。本次新样本复现 1/1。

### Expected / Actual

预期：F02 全字段及其状态、证据位置可查。实际：上述字段和证据控件在详情页不可见；API/DB 状态未核验。

### Environment

见本文件共同环境；[线上虚构候选人详情](https://hireos.aipollo.me/hireos/screening/candidates/6a8ad361-32b3-41bf-832d-e42707fbcf11)。

### Severity

S2

## 2. [Bug] F02 重叠工作经历没有可核对的总工作年限

### Type

Bug

### Subsystem

hireos-screening

### Problem

详情显示两段重叠工作经历，但不显示总工作年限或“推导值”标记。招聘人员无法判断重叠月份是否被重复计算。仅确认线上 UI 缺失，未核对 API/DB 是否计算。

### User Outcome

招聘人员能看到从工作经历推导的总工作年限，并理解重叠区间只计算一次。

### Scope

依据有效工作经历月份计算总年限、API 返回和详情展示；标记推导值；覆盖重叠、无经历与开放结束日期的测试。

### Non-goals

由 AI 猜测简历未写出的就业日期；改变单段经历的原始起止日期。

### Acceptance Criteria

AC-1：固定样本包含 `2020-06～2022-06` 与 `2022-01～present` 两段经历时，API 和详情给出同一总工作年限并标为“推导值”；重叠的 `2022-01～2022-06` 只计算一次，自动测试固定当前日期以核对结果。
AC-2：无可用起止日期时显示“无法计算”或等效状态，不生成估算年限；自动测试覆盖。
AC-3：经历日期仍按 `YYYY-MM` 呈现，刷新后推导结果一致。

### References

`docs/product/Resume_Screening/F02_Profile_Parsing/PRD.md` §4.1、AC-7；同目录 `User_Cases.md` UC-F02-02；`Test_Report_2026-10-15.md` F02-LIVE-02。

### Dependencies

None；与本文件 Issue 1 同属档案详情，可协同实现。

### Risk

low

### Owner

@JsonSuCoder

### AI Ready

Yes

### Reproduction

打开本次虚构候选人详情；查看 2020-06～2022-06 和 2022-01～present 两段工作经历。页面未显示总工作年限或推导状态。本次复现 1/1。

### Expected / Actual

预期：总工作年限按不重叠月份推导并可核对。实际：详情无该值；API/DB 状态未核验。

### Environment

见本文件共同环境；[线上虚构候选人详情](https://hireos.aipollo.me/hireos/screening/candidates/6a8ad361-32b3-41bf-832d-e42707fbcf11)。

### Severity

S3

## 3. [Bug] F02 未提供工作授权仍被列为资料缺失

### Type

Bug

### Subsystem

hireos-screening

### Problem

测试简历未提供工作授权事实，候选人详情的 Missing information 仍列出 `work authorization`。这与 F02 WA-2、AC-9 相反，会误导招聘人员追索非必需信息。线上只验证了无授权事实场景，未验证角色权限和评分。

### User Outcome

没有授权事实的简历不会因该项被提示“资料不全”；有明确事实时，仅获授权角色可见。

### Scope

解析、存储与返回的 missingFields 规则和详情展示；无授权事实样本的自动回归；有授权事实时的角色权限回归。

### Non-goals

把工作授权改成必填；让该字段参与匹配或评分；推断签证或授权状态。

### Acceptance Criteria

AC-1：简历未说明工作授权或仅写 `Not stated` 时，API 的缺失字段和详情的 Missing information 均不包含工作授权；其他真正缺失字段仍正常显示。
AC-2：简历明确写出工作授权事实时，有权限角色可查看原文事实，无权限角色在 UI 只见“受限”且 API 不下发值；自动测试覆盖两种角色。
AC-3：工作授权值或缺失状态不改变同一候选人的匹配与评分结果；自动测试对照核验。

### References

`docs/product/Resume_Screening/F02_Profile_Parsing/PRD.md` §4.2 WA-1～3、AC-9；同目录 `User_Cases.md` UC-F02-06；`Test_Report_2026-10-15.md` F02-LIVE-03。

### Dependencies

角色权限语义与现有 #21、#24 相关；AC-2 的权限验收需与这两项的角色决定保持一致，AC-1 可独立修复与验收。

### Risk

medium

### Owner

@JsonSuCoder

### AI Ready

Yes

### Reproduction

通过 Paste profile 导入不含工作授权事实的完整虚构简历（原文仅写 `Work authorization: Not stated.`），打开详情。工作授权显示 Unknown，Missing information 列出 `work authorization`。本次复现 1/1。

### Expected / Actual

预期：未知授权不列为资料缺失。实际：列为缺失；权限和评分未核验。

### Environment

见本文件共同环境；[线上虚构候选人详情](https://hireos.aipollo.me/hireos/screening/candidates/6a8ad361-32b3-41bf-832d-e42707fbcf11)。

### Severity

S3

## 4. [Bug] F02 未被使用的档案字段纠正仍强制填写原因

### Type

Bug

### Subsystem

hireos-screening

### Problem

刚导入、详情仍显示 Searching for matching roles 的虚构候选人修改所在地时，纠正弹窗始终要求填写原因，空原因不能保存；已有未匹配测试候选人也相同。F02 COR-1 规定只有被有效推荐或评估使用的字段才必填原因。另外表单目前没有项目描述纠正入口，不能执行 UC-F02-10 指定操作。线上未取得服务端使用关系证明，需在修复验证中补齐。

### User Outcome

招聘人员可直接修正未被有效结果使用的字段；影响有效推荐或评估的纠正则留下原因。

### Scope

按字段与有效推荐/评估引用决定原因必填；前后端一致校验；COR-2 的原因快选与“其他”说明；可纠正项目描述；覆盖有/无引用的自动测试。

### Non-goals

取消所有纠正审计；改变原文；更改历史评估内容。

### Acceptance Criteria

AC-1：对经 API/数据证实未被有效推荐或评估引用的字段，空原因纠正可保存；刷新后新值仍在，审计保留空原因及必要操作者、时间信息。项目描述可作为此场景的测试字段。
AC-2：字段已被有效推荐或评估引用时，空原因在 UI 与 API 均被拒绝并给出可理解提示；填写原因后可保存。
AC-3：原因提供“解析错误 / 候选人补充或更正 / 来源资料更新 / 其他”选项；选“其他”且没有文字说明时，UI 与 API 均拒绝保存。
AC-4：自动测试分别覆盖无引用、有引用、仅过期引用的边界，并核对纠正不会改写原文。

### References

`docs/product/Resume_Screening/F02_Profile_Parsing/PRD.md` §4.3 COR-1/2、AC-10；同目录 `User_Cases.md` UC-F02-09/10；`Test_Report_2026-10-15.md` F02-LIVE-04。

### Dependencies

需要能够查询字段是否被有效推荐或评估引用；若该关系无法可靠判定，先在 Issue 留 `[AI-QUESTION]` 确认业务边界。

### Risk

medium

### Owner

@JsonSuCoder

### AI Ready

Yes

### Reproduction

打开刚由 Paste profile 导入、尚显示 Searching for matching roles 的虚构候选人 → Correct profile → 修改所在地，留空原因 → Save。弹窗的 `REASON FOR CORRECTION *` 必填，提示 `Say why the profile is being corrected — it is kept in the log.`，未保存；另一未匹配测试候选人也复现。两个页面复现 2/2；服务端引用关系未核验。

### Expected / Actual

预期：未被有效结果使用的字段原因选填；已使用时必填。实际：普通纠正 UI 一律必填，且没有项目描述字段。

### Environment

见本文件共同环境；[线上虚构候选人详情](https://hireos.aipollo.me/hireos/screening/candidates/6a8ad361-32b3-41bf-832d-e42707fbcf11)。

### Severity

S3

## 5. [Bug] F02 纠正后档案旧版本与审计记录在详情不可查

### Type

Bug

### Subsystem

hireos-screening

### Problem

虚构候选人的所在地纠正成功并在刷新后保留，成功提示称影响的筛选结果已标为待更新；但详情没有当前档案版本号、旧版本或纠正审计的查看入口，也没有原文入口，招聘人员无法核查修改前后和来源。仅证实 UI 不可见，不能断定后端没有保存版本或审计。

### User Outcome

招聘人员能从候选人详情追溯每次纠正的旧值、新值、操作者、时间和原因，并查看旧版档案与原材料。

### Scope

当前/历史档案版本、纠正历史及原文的受权读取入口；接口与页面一致性；保存纠正后刷新和审计自动测试。

### Non-goals

改写已有版本或原文；重做 F03 身份合并；在没有有效评估前置数据时断言评估刷新状态。

### Acceptance Criteria

AC-1：纠正候选人所在地后，详情显示新的档案版本号并可打开上一版本；两版分别保留各自的所在地值，刷新后仍可查。
AC-2：该次纠正记录可查旧值、新值、操作者、时间与原因；UI/API 与持久化记录一致，未授权角色不能读取受限字段的历史值。
AC-3：原材料仍可从相应简历版本打开，其内容在纠正前后完全相同；自动测试核对旧版和原文未被覆盖。

### References

`docs/product/Resume_Screening/F02_Profile_Parsing/PRD.md` FR-3、BR-2、COR-3、AC-3；同目录 `User_Cases.md` UC-F02-11；`Test_Report_2026-10-15.md` F02-LIVE-05。

### Dependencies

权限验收与 #21、#24 的角色语义决定相关；版本与审计显示可先依据现有权限边界实现。

### Risk

medium

### Owner

@JsonSuCoder

### AI Ready

Yes

### Reproduction

对本次虚构候选人把所在地从 Seattle 改为 Tacoma，填写 `QA synthetic profile correction 2026-10-15` 并保存；刷新。新值保留，但详情未提供旧版档案、档案版本号、纠正记录或原文入口。本次复现 1/1。

### Expected / Actual

预期：当前/旧版本、纠正审计和原文可查。实际：仅见新值与成功提示；后端持久化和审计状态未核验。

### Environment

见本文件共同环境；[线上虚构候选人详情](https://hireos.aipollo.me/hireos/screening/candidates/6a8ad361-32b3-41bf-832d-e42707fbcf11)。

### Severity

S2
