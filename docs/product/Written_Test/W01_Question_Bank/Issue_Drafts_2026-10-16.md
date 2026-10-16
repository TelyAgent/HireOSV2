# W01 线上问题草稿（2026-10-16）

来源：[W01 线上测试报告](Test_Report_2026-10-16.md)。以下为 6 条**待审查的 Issue 草稿**，尚未创建 GitHub Issue。截图均为 2026-10-16 线上实测。Severity 采用仓库 Bug Form 的 S1–S4；报告中的 P0–P3 是 UX 审查优先级，两者不直接换算。Owner 未指定、Estimate 未获 Owner 确认，故 `AI Ready=No`。正式提交时应按 `.github/issue_body_template.md` 改写为独占三级标题字段并运行 Issue Contract 校验。

## 草稿 1｜题库缺少草稿发布和独立版本路径

**标题：** `[Bug] W01 题库无法按草稿发布与独立版本维护题目`

- **Type / Subsystem / Severity / Risk：** Bug / hireos-written / S2 / high
- **Problem：** 线上创建表单只有 `Create question`；已发布 Q-0001 的编辑表单只有 `Save changes`，详情只显示 Prompt、Rubric、Usage，没有 Versions。用户无法按 W01 约定先保存草稿、复核后发布，也无法查看旧版本。后端当前只在单条 `Question` 上自增整数 `version`，没有独立历史记录。**本轮未修改线上题目，不能声称已发送邀请内容发生变化。**
- **User Outcome：** 出题人能先保存草稿，再发布精确版本；编辑已发布题时生成可追溯的新版本，旧邀请仍指向原内容。
- **Scope：** W01 草稿/发布状态、QuestionVersion 历史、创建与编辑 UI、版本入口、发布幂等和旧邀请快照回归。
- **Non-goals：** 不改变现有题干内容，不处理 ZIP 导入或候选人评分流程。
- **Acceptance Criteria：**
  - **AC-1：** 创建有效题目后可保存为 Draft；Draft 不在新计划可选题中，发布前能查看并复核字段。
  - **AC-2：** 发布 v1 后编辑内容并发布生成 v2；Versions 显示当前与早期版本，v1 内容不可原地覆盖。
  - **AC-3：** 已发送 v1 邀请继续返回 v1 快照；两次快速发布只生成一个目标版本，并有自动回归测试。
- **References：** [W01 PRD](PRD.md) FR-8、FR-10、BR-2/3、AC-2；[测试报告](Test_Report_2026-10-16.md) W01-LIVE-01、UC-W01-06/08/10；[创建表单代码](../../../../hireos-written/hireos-written-front/src/components/QuestionCreateDrawer.tsx)；[Question 模型](../../../../hireos-written/hireos-written-backend/prisma/schema.prisma)。
- **Dependencies：** 发布是否需他人复核仍是 W01 PRD 待确认事项；QuestionVersion/RoleMapping/ScoringProfile 数据方案需产品与工程确认。旧邀请 seed 和迁移/回滚方案是验收依赖。
- **Reproduction：** 打开 [题库](https://hireos.aipollo.me/hireos/written/question-bank) → Create question，观察仅有 Create question；打开 Q-0001 → Edit question，观察仅有 Save changes，且详情无 Versions。重复可见；未提交修改。
- **Expected / Actual：** 预期有 Draft→Publish 和版本历史，修改已发布内容创建新版本；实际线上没有相应可操作路径。后端内容更新会自增版本整数，但现有证据不能证明独立历史和旧邀请行为。
- **Environment：** Chrome 已登录线上页面；页面显示用户「蔡敏」；线上构建号未知；本地参考提交 `c4b6105`，不代表线上版本。截图如下。
- **Owner / Estimate / AI Ready：** 待指定 / TBD / No。估算依据：涉及前后端、数据迁移、历史兼容和邀请回归；发布复核规则及版本数据方案未定，范围可能超过 8 点，需澄清并考虑拆分。

![草稿1：创建表单无草稿/发布动作](/Users/apple/work/HireOSV2/docs/product/Written_Test/W01_Question_Bank/evidence/2026-10-16/09-create-drawer.png)

![草稿1：已发布题编辑只有 Save changes](/Users/apple/work/HireOSV2/docs/product/Written_Test/W01_Question_Bank/evidence/2026-10-16/12-edit-published.png)

## 草稿 2｜Import ZIP 显示演示解析，不能上传和分类预览

**标题：** `[Bug] W01 Import ZIP 无法上传文件却显示固定解析结果`

- **Type / Subsystem / Severity / Risk：** Bug / hireos-written / S2 / high
- **Problem：** 线上 Import ZIP 弹窗显示 `Demo adapter`，Choose File 禁用；点击 `Parse (demo)` 后显示固定的「1 prompt · 2 materials · 1 internal answer key」提示。用户没有上传文件，也看不到旧候选人提交的分类预览和确认门禁，容易把演示提示误认为真实解析。
- **User Outcome：** 出题人能上传 ZIP，先核对题目、候选人材料、内部答案和旧提交的分类，再明确确认导入；内部资料不进入候选人视图。
- **Scope：** ZIP 上传、解析结果与错误状态、四类内容预览、人工确认前不入库、导入后 Draft 状态及隔离验证。
- **Non-goals：** 不改变已存在题目的版本，也不把旧候选人提交重新发送给候选人。
- **Acceptance Criteria：**
  - **AC-1：** 上传合成 ZIP 后，预览分别列出 1 个题目、2 份材料、1 份内部答案和 1 份旧候选人提交；旧提交清楚标为不会外发。
  - **AC-2：** 用户确认分类和隔离前，数据库中没有新题或材料；确认后题目以 Draft 入库，候选人预览/API 不含内部答案和旧提交。
  - **AC-3：** 损坏 ZIP 与含不允许内容的包返回可理解错误，可重新上传；自动测试覆盖成功、拒绝与无部分入库。
- **References：** [W01 PRD](PRD.md) FR-9、BR-5、AC-4；[测试报告](Test_Report_2026-10-16.md) W01-LIVE-02、UC-W01-12/13。
- **Dependencies：** Core FileVersion 接入、ZIP 安全策略、测试包及隔离测试环境；正式导入字段/文件类型需与 W01/W18 规格对齐。
- **Reproduction：** 打开线上 Question Bank → Import ZIP；观察 Choose File 禁用；点击 Parse (demo)，不选文件也出现固定解析提示。可重复复现。
- **Expected / Actual：** 预期文件上传后才解析并出现四类预览；实际没有上传，只有固定 toast，不能进入确认导入。
- **Environment：** Chrome 已登录线上页面；线上构建号未知；截图如下。本轮未上传文件或写入题库。
- **Owner / Estimate / AI Ready：** 待指定 / TBD / No。估算依据：前后端上传、解析安全、Core FileVersion、确认事务与候选人隔离跨模块；文件类型和扫描策略未定，需明确后再拆分/估算。

![草稿2：ZIP 文件选择禁用](/Users/apple/work/HireOSV2/docs/product/Written_Test/W01_Question_Bank/evidence/2026-10-16/07-import-zip.png)

![草稿2：未上传文件即显示固定解析提示](/Users/apple/work/HireOSV2/docs/product/Written_Test/W01_Question_Bank/evidence/2026-10-16/08-import-demo-result.png)

## 草稿 3｜Usage 将未知曝光记录显示为 0

**标题：** `[Bug] W01 题目 Usage 将未取得的外部记录显示为已确认的零次`

- **Type / Subsystem / Severity / Risk：** Bug / hireos-written / S3 / medium
- **Problem：** Q-0001 的 Usage 页把 `Used in cases` 和 `Candidates who have seen this version` 都显示为 `0`，没有 Case/候选人明细或数据来源说明。当前前端真实题映射把 `usageCount`、`seenByCount` 固定为 0；用户会把未知曝光情况误读为已核实的 0。
- **User Outcome：** 审阅者能区分「系统尚无外部记录」和「经核实确实为零」，并查看可追溯的 Case、候选人与岗位映射。
- **Scope：** Usage 统计来源与未知状态展示；有记录时的明细和版本对应；相关自动测试。
- **Non-goals：** 不改题目内容、评分结果或已发邀请。
- **Acceptance Criteria：**
  - **AC-1：** 未连接或未取得外部使用记录时，Usage 明确显示 `Unknown`，不显示 `0`。
  - **AC-2：** 有完整记录且确认无使用时可显示 `0`；有使用时列出 Case、已见候选人与准确的题目版本，汇总与明细一致。
  - **AC-3：** 自动测试覆盖未知、已核实零和非零三种数据状态。
- **References：** [W01 PRD](PRD.md) FR-7、AC-7；[测试报告](Test_Report_2026-10-16.md) W01-LIVE-03、UC-W01-04；[真实题映射](../../../../hireos-written/hireos-written-front/src/data/realQuestionsMerge.ts)。
- **Dependencies：** QuestionExposure / 使用记录的数据来源与权限需要确认；当前线上 UI 无法判断服务端是否已有完整历史。
- **Reproduction：** 打开线上 Q-0001 详情 → Usage；读取 `Used in cases 0`、`Candidates who have seen this version 0`，无外部明细。可重复复现。
- **Expected / Actual：** 预期未取得记录时显示 Unknown；实际显示 0，无法区分未知与已核实零。
- **Environment：** Chrome 已登录线上页面；线上构建号未知；截图如下。
- **Owner / Estimate / AI Ready：** 待指定 / TBD / No。若仅修正未知态则是局部展示与测试；若须建立跨业务记录与版本聚合，范围明显增加。数据来源未定，当前唯一建议 Estimate 为 TBD。

![草稿3：Usage 将未知展示为 0](/Users/apple/work/HireOSV2/docs/product/Written_Test/W01_Question_Bank/evidence/2026-10-16/05-usage.png)

## 草稿 4｜已发布题目没有停用操作

**标题：** `[Bug] W01 已发布题目缺少停用入口与新计划选用门禁`

- **Type / Subsystem / Severity / Risk：** Bug / hireos-written / S2 / high
- **Problem：** 线上已发布的 Q-0001 详情仅有 Preview candidate view、Delete question、Edit question，没有停用/Deprecated 操作。用户无法按 W01 规则停止新计划使用题目，同时保留旧邀请。**本轮未实际停用或检查旧邀请 API。**
- **User Outcome：** 题目维护者能有记录地停用不再适用的题；新计划不能选用它，已发送邀请仍保持原版本。
- **Scope：** 停用状态转换和历史、权限与并发校验、题库/计划选择器过滤、旧邀请回归。
- **Non-goals：** 不硬删除题目，不撤销已经发送的邀请。
- **Acceptance Criteria：**
  - **AC-1：** 有权限用户能将已发布题停用；详情和历史显示操作者、时间与 Deprecated 状态，重复停用不产生重复历史。
  - **AC-2：** 停用题不出现在新计划 Add from Question Bank 中；直接绕过 UI 选用时 API 返回明确 4xx。
  - **AC-3：** 已发送邀请继续读取发送时的题目版本和内容；自动测试覆盖三处行为。
- **References：** [W01 PRD](PRD.md) FR-11、AC-6；[测试报告](Test_Report_2026-10-16.md) W01-LIVE-04、UC-W01-11。
- **Dependencies：** 题目状态模型与版本方案（草稿 1）；计划选择器和邀请快照；专用测试题/旧邀请 seed。
- **Reproduction：** 打开线上 Q-0001 详情，观察页头只有 Preview、Delete、Edit；没有停用动作。可重复复现。
- **Expected / Actual：** 预期可停用并追溯状态变化，阻止新计划选用；实际只有删除与编辑，不能执行停用。
- **Environment：** Chrome 已登录线上页面；线上构建号未知；截图如下。
- **Owner / Estimate / AI Ready：** 待指定 / 5 / No（建议，待 Owner 确认）。依据：需跨后端状态、前端操作、计划选择器、旧邀请与回归测试；比局部 UI 修复大，若草稿 1 先完成并复用其历史模型，可复核下调范围。

![草稿4：已发布题详情无停用入口](/Users/apple/work/HireOSV2/docs/product/Written_Test/W01_Question_Bank/evidence/2026-10-16/03-detail-prompt.png)

## 草稿 5｜从详情返回题库后筛选条件丢失

**标题：** `[Bug] W01 题库进入详情再返回时搜索与岗位能力筛选丢失`

- **Type / Subsystem / Severity / Risk：** Bug / hireos-written / S3 / low
- **Problem：** 在 Question Bank 中设置岗位「高级 AI 产品经理」、能力「Workflow设计与流程建模」并搜索 `Q-0001`，点击结果进入详情；通过主导航返回题库后，搜索为空且两个筛选都回到 All。列表行没有规范要求的右侧预览，用户为查看多题详情需反复设置筛选。
- **User Outcome：** 招聘者连续筛题时可快速预览题目；进入详情并返回后仍保留原搜索、岗位、能力及合理的列表位置。
- **Scope：** 列表选中预览与详情往返的筛选/滚动状态保持；相应路由与 UI 测试。
- **Non-goals：** 不改变过滤匹配逻辑或题目内容。
- **Acceptance Criteria：**
  - **AC-1：** 列表选中题目时可在右侧查看预览，不必离开当前筛选结果；列表无直接发送候选人的动作。
  - **AC-2：** 从筛选结果打开详情后返回，搜索词、岗位、能力和列表位置保持；刷新/深链行为有确定规则。
  - **AC-3：** UI 自动测试覆盖「设置三项筛选 → 打开 Q-0001 → 返回 → 条件与结果仍在」。
- **References：** [W01 PRD](PRD.md) FR-2/3；[测试报告](Test_Report_2026-10-16.md) W01-LIVE-05、UC-W01-01/02；[题库页代码](../../../../hireos-written/hireos-written-front/src/pages/QuestionBankPage.tsx)。
- **Dependencies：** None；具体状态保持方式由实现选择。
- **Reproduction：** 设置上述三项筛选（截图 1）→ 点击 Q-0001 行进入详情 → 点击主导航 Question Bank；返回后筛选均为默认且出现两条题目（截图 2）。本轮重复操作复现。
- **Expected / Actual：** 预期右侧预览且返回保持筛选；实际直接跳详情，返回后筛选丢失。
- **Environment：** Chrome 已登录线上页面；线上构建号未知；截图如下。
- **Owner / Estimate / AI Ready：** 待指定 / 3 / No（建议，待 Owner 确认）。依据：涉及列表交互、状态保留与 UI 回归，属于完整的小功能；无需数据迁移或跨服务修改。

![草稿5：进入详情前岗位、能力和编号筛选已设置](/Users/apple/work/HireOSV2/docs/product/Written_Test/W01_Question_Bank/evidence/2026-10-16/13-filter-before-detail.png)

![草稿5：返回列表后三项筛选回到默认](/Users/apple/work/HireOSV2/docs/product/Written_Test/W01_Question_Bank/evidence/2026-10-16/14-filter-after-return.png)

## 草稿 6｜题库说明把发布对象写成 Case

**标题：** `[Bug] W01 题库发布说明误用 Case 导致题目与邀请动作不清`

- **Type / Subsystem / Severity / Risk：** Bug / hireos-written / S4 / low
- **Problem：** Question Bank 首屏说明写 `Publishing a case does not send it — invitations are a separate step.`。W01 的发布对象是题目/题目版本，Case 是另一个业务对象；当前文案可能让 HR 误解发布范围。
- **User Outcome：** 招聘者看首屏即能区分「发布题目供内部选用」与「向候选人发送邀请」。
- **Scope：** 题库首屏说明及相关中英文文案、文案回归测试。
- **Non-goals：** 不修改发布/邀请实际业务状态或权限。
- **Acceptance Criteria：**
  - **AC-1：** 题库说明明确以 Question/题目为发布对象，并说明发布不等于发送候选人邀请。
  - **AC-2：** 中英文界面用词与 W01 PRD 的 Question、Case、Invitation 对象保持一致；自动测试或文案快照覆盖关键句。
- **References：** [W01 PRD](PRD.md) FR-3；[测试报告](Test_Report_2026-10-16.md) W01-LIVE-06、UC-W01-01；[题库页代码](../../../../hireos-written/hireos-written-front/src/pages/QuestionBankPage.tsx)。
- **Dependencies：** 题目发布语义应以 W01 产品决策为准；如发布流程调整，文案同步确认。
- **Reproduction：** 打开线上 Question Bank，读取标题下方首句，看到 `Publishing a case does not send it`。每次打开均可见。
- **Expected / Actual：** 预期明确写题目发布与邀请发送是两个动作；实际使用 Case，易与案件发布混淆。
- **Environment：** Chrome 已登录线上页面；英文界面；线上构建号未知；截图如下。
- **Owner / Estimate / AI Ready：** 待指定 / 1 / No（建议，待 Owner 确认）。依据：文案与对应测试是单点修改，验证范围小。

![草稿6：题库说明写 Publishing a case](/Users/apple/work/HireOSV2/docs/product/Written_Test/W01_Question_Bank/evidence/2026-10-16/01-bank.png)
