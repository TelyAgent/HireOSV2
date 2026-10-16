# W05 邀请与批量发送线上测试报告（2026-10-16）

## 1. 结论与范围

**结论：不通过（fail）。** 线上批量邀请入口显示空收件人列表，却没有添加收件人的操作；Continue 被拦截，Save draft & exit 跳转至 `Project not found.`。HR 无法从此入口完成批量邀请。单人邀请抽屉可切换 Timed / Deadline only，并在缺少截止时间或邮箱格式无效时提示；填入截止时间可进入候选人表单预览。预览缺少 W05 要求的题包版本、预计工作量、提交清单、规则及 From / Reply-To，且显示中文邀请正文。**未点击 Confirm send / Send invitations**，未向现有候选人发信。

| 项 | 本轮记录 |
|---|---|
| 线上入口 | [批量邀请](https://hireos.aipollo.me/hireos/written/invitations/new)；一个已存在的候选人计划页（URL 含内部 Case ID，见本地证据） |
| 时间/时区 | 2026-10-16 约 11:58–12:02，Asia/Shanghai；服务健康响应时间见 E06 |
| 身份/设备 | 已登录页面显示「蔡敏」；Chrome 桌面视口 1176×719；未取得 W05 指定的 `hr_emma` / 受限 HR / 候选人测试身份 |
| 输入依据 | [PRD](PRD.md)、[User Cases](User_Cases.md)、[User Journey](User_Journey.md)、[Loop IO](Loop_IO.md)、[公共约定](../README.md)、[UX/UI 审查标准 v1.0](../../HireOS_Command_JD_Management_UX_UI_Review_Standard_v1.0.md) |
| GitHub 上下文 | 未提供 W05 主 Issue/PR；检查了相关 [#48](https://github.com/TelyAgent/HireOSV2/issues/48) 的全部评论和 [#229](https://github.com/TelyAgent/HireOSV2/issues/229)（无评论）。二者不替代 W05 主 Issue。此为线上探索测试，不冒充合并后正式 QA |
| 代码参照 | 本地 `c4b610500d33a279c03251091c5f0af13b831318`，**不是已核实的线上构建 SHA**；源码只辅助解释，线上结论以 E01–E05 为准 |
| 用例结果 | 12 条：**1 失败、3 部分验证、8 阻塞、0 完全通过** |
| 数据变更 | 未创建邀请/批次、未发送邮件、未修改现有 Case/题目；仅在表单中临时输入测试截止时间与无效邮箱，随后取消 |

标准原本适用 JD Management；本报告复用用户旅程、U1–U10、证据要求及 P0–P3 分级，按 W05 的招聘邀请语境解释，不套用 JD 的激活/发布字段。未取得线上只读 DB、认证业务 API、邮件 simulation adapter、故障注入或可辨识的测试 seed。页面截图不能证明服务端权限、发信、持久化及幂等。未运行本地 build/lint/type/unit/integration；它们不计为线上测试通过。

## 2. 证据与执行步骤

| ID | 证据 | 操作、预期与实际 |
|---|---|---|
| E01 | [批量邀请空状态](evidence/2026-10-16/01-composer-no-recipients.jpg) | 打开 Composer：应可选择已确认关系的候选人；实际显示 `No recipients yet.`，无添加/搜索入口。点击 Continue 后提示 `Add at least one recipient.`；没有进入 Tests & materials |
| E02 | [草稿退出后项目不存在](evidence/2026-10-16/02-save-draft-project-not-found.jpg) | 在空名单状态点击 Save draft & exit：应可回到有效项目并重开草稿；实际跳转至 `assessments/prj_fin`，显示 `Project not found.`；重新打开 Composer 仍为空。因无可填写收件人，未能直接验证「有内容的草稿持久化」 |
| E03 | [单人 Timed 表单局部](evidence/2026-10-16/03-timed-validation.jpg) | 现有计划的 Send to candidate 打开抽屉：可访问树显示题目、Timed、90 分钟、Deadline、Recipient email、工作区 SMTP 发件人；截图只保留无个人信息的模式/期限区域。空截止时 Preview form 提示 `Set a deadline first.` |
| E04 | [Deadline only 表单局部](evidence/2026-10-16/04-deadline-only.jpg) | 切换 Deadline only 后隐藏时长，保留截止；空截止仍被拦截。表单填入测试截止 `2026-10-31 17:00` 后可进入预览 |
| E05 | [单人预览脱敏可访问树](evidence/2026-10-16/05-single-preview-ax.txt) | 预览显示 Deadline only、北京时间、岗位、题目及中文邀请正文；未见题包版本、预计工作量、提交清单、规则和 From / Reply-To。返回表单把邮箱临时改为无效格式，Preview form 提示 `Enter a valid recipient email first.`；未最终发送。树中姓名及邮箱已脱敏 |
| E06 | [Written 后端健康响应](evidence/2026-10-16/06-health.txt) | `curl -sS --max-time 15 -w '\nHTTP %{http_code}\n' https://hireos.aipollo.me/hireos/written/api/health`，退出码 0，HTTP 200、`phase-0`；仅证明健康端点可达 |
| E07 | [Composer 本地代码](../../../../hireos-written/hireos-written-front/src/pages/InvitationComposerPage.tsx) | `saveExit` 仅 toast + 导航（61–64 行）；`send` / `retry` 仅改组件状态（66–74 行）；四步标签、模拟发送见 23、200 行。此为源码风险，不能当作线上批量发送成功证据 |
| E08 | [单人抽屉与后端代码](../../../../hireos-written/hireos-written-front/src/components/SendToCandidateDrawer.tsx) | 53 行固定披露策略；87–96 行表单校验；99 行起真实 `createInvitation`；[后端服务](../../../../hireos-written/hireos-written-backend/src/invitations/invitations.service.ts) 71–76 行通过工作区账号发信。因此线上现有候选人不适合执行最终发送或故障注入 |

截图 E01–E04 不含候选人姓名或邮箱；E05 已脱敏。E07–E08 是本地源码，线上构建一致性未知。E02 的 `Save draft & exit` 可能触发应用内部逻辑，但本轮未见可继续的批次或项目，也无服务端写入证据。

## 3. 12 条用例逐项结果

| 用例 | 结果 | 实际执行与证据 | 解除条件 / 尚需验证 |
|---|---|---|---|
| UC-W05-01 单人 Timed 发送 | **部分验证** | Timed、90 分钟和截止字段可见；缺截止拦截（E03）。未 Confirm send | 隔离 Case + `example.com` 收件人 + simulation adapter，核邀请、邮件、状态和内容 |
| UC-W05-02 单人 Deadline only 发送 | **部分验证** | 切换后时长字段隐藏；填截止可预览 Deadline only（E04、E05） | 隔离发送后核 API/DB `durationMin=null` 与候选人页面 |
| UC-W05-03 缺截止时间不能发送 | **部分验证** | Preview form 提示 `Set a deadline first.`，无法进入最终确认（E03、E04） | 用隔离 Case 直接请求不带 deadline，核 4xx 与 Invitation 数量不变 |
| UC-W05-04 邀请冻结题目快照 | **阻塞** | 未发送；不能改现有候选人题目作验证 | 隔离题目、一次发送及后续修改，对比邀请快照 |
| UC-W05-05 单人发信失败后重试 | **阻塞** | 无受控退信注入；抽屉未展示 Delivery/Retry（E03，E08） | simulation adapter、失败 Delivery、重试接口与邮件/Invitation 计数 |
| UC-W05-06 双击发送只发一次 | **阻塞** | 未对现有收件人执行发送或双击 | 隔离 Case、幂等键和发送前后 DB/adapter 计数 |
| UC-W05-07 收件人必须已确认关系 | **阻塞** | Composer 无收件人、无添加入口，只显示规则说明（E01） | 两名含确认/未确认 Application 的 seed；核 UI 过滤和 API 权限门禁 |
| UC-W05-08 时间、提交渠道、披露说明 | **阻塞** | 空收件人无法进入第 3/4 步（E01）；本地 Composer 仅四步，见 E07 | 可操作收件人 seed；分别核两个模式、提交渠道与披露说明 |
| UC-W05-09 草稿退出再回来 | **失败（入口）/持久化未验证** | Save draft & exit 到 `Project not found.`；重入为空（E02）。无内容可填写，不能断言有内容草稿是否丢失 | 修通项目/收件人入口，填写三步后退出重入，核 UI、DB 和无发信 |
| UC-W05-10 逐人预览与独立邮件 | **阻塞** | 无法进入批量 Review & send（E01）。单人预览缺规格字段（E05） | 两人 seed、逐人预览、adapter 信封与正文核对；不得真实发信 |
| UC-W05-11 批量部分失败只重试失败项 | **阻塞** | 无批量发送入口进展与退信注入（E01） | 两人隔离批次、对其中一人注入 bounce，逐项 Delivery、Retry、DB/邮件数量 |
| UC-W05-12 批准后改关键条件使批准失效 | **阻塞** | 不能进入 Review & send 或批准状态（E01） | 明确批准规则并提供可编辑批次，核截止变更后旧批准失效 |

本轮实际走到 W05b 的 Recipients 入口与 Save draft & exit，以及 W05a 的表单、校验、预览。没有把前端提示或本地 fixture 当作真实交付结果。

## 4. AC 与关键业务规则

| AC / 规则 | 结论 | 证据与缺口 |
|---|---|---|
| AC-1 未确认关系者不得入收件人 | **阻塞** | 无添加/搜索入口或混合 seed（E01）；规则说明不等于权限证据 |
| AC-2 两人部分失败只重试失败项 | **阻塞** | 批量流程不可继续，无模拟退信与计数（E01） |
| AC-3 逐人预览版本、工作量、时区、From/Reply-To | **阻塞（批量）** | 批量预览不可达；单人预览能看到时区，但缺其余字段（E05） |
| AC-4 Timed 与 Deadline only 字段 | **UI 通过；发送数据未验证** | Timed 显示时长+截止，Deadline only 仅截止（E03、E04）；未核 DB |
| AC-5 改截止使旧批准失效 | **阻塞** | 无可达批准状态；产品还需确定是否二人批准 |
| AC-6 发送后题库修改不影响邀请 | **阻塞** | 未发送及修改隔离题目 |
| AC-7 草稿退出再进入保留 | **不满足入口；内容持久化未验证** | 保存跳到不存在项目，无法找到可继续草稿（E02）；源码无持久化调用（E07），但线上构建一致性未核 |
| BR-2/3 独立邮件与统一发件人 | **未验证/可见偏差** | 未发信；单人表单显示工作区 SMTP 发件人，非 PRD 指定 `hr@sendinglabs.com`（E03、E08）；实际邮件头未核 |
| BR-4 幂等与部分失败恢复 | **阻塞** | 无隔离发送、退信注入或 Delivery/Retry 证据 |

## 5. 按用户旅程的 UX/UI 审查

角色：HR / Recruiter；目标：对已确认招聘关系的候选人设置笔试条件、逐人预览并发送，然后追踪 Delivery。实际旅程在批量 Recipients 即中断；单人可到预览，但未外发。按标准，存在核心任务 P0 阻断，`verdict=fail`。

| 项 | 结论 | 证据、影响与限制 |
|---|---|---|
| U1 容易理解 | **部分** | 单人表单模式/截止明确；批量空状态说明关系要求，但没有可操作的收件人来源（E01、E03） |
| U2 容易上手 | **失败** | Invite candidates 首屏没有 Add/Search/从项目选择入口；新用户无法开始（E01） |
| U3 快速完成任务 | **失败** | 批量主任务无法越过 Recipients；Save draft 导向无效项目（E01、E02） |
| U4 下一步明确 | **失败** | `Project not found.` 无返回有效项目或恢复草稿动作；单人预览未说明发送后 Delivery 追踪（E02、E05） |
| U5 提示和按钮清楚 | **部分/失败** | Continue 的缺收件人提示明确；Save draft & exit 暗示保存，却只见无效跳转；预览缺发件人与内容细节（E01、E02、E05） |
| U6 符合真实工作方式 | **失败** | 无法按名单批量预览、发送及逐项追踪；单人发件人是工作区账号而非规格统一地址（E01、E03） |
| U7 信息结构符合角色目标 | **失败** | 批量页没有可选择对象、工作量或下一步；单人预览没有用于外发决定的版本、清单和规则（E01、E05） |
| U8 减少来回跳转 | **失败** | 草稿退出跳到不存在的项目，无法沿原上下文继续（E02） |
| U9 可恢复和可预期 | **失败/异常未验证** | 空名单下 Save draft 没有有效恢复路径；发信失败/结果未知、重试和重复点击未执行（E02） |
| U10 可访问、可读和可操作 | **部分/未验证** | 已访问按钮有可读名称，错误提示以文字呈现；未测完整键盘顺序、焦点回置、200% 缩放、对比度及移动端 |

### 发现与复验

| ID / 级别 | 旅程步骤、观察与证据 | 用户影响 / 最小修复 | 修复验收 |
|---|---|---|---|
| W05-LIVE-01 / **P0** | 批量步骤 1：无收件人且无添加入口；Continue 拦截（E01） | HR 无法完成批量邀请。接入可用的已确认 Application 选择及空态引导 | 有/无合格候选人各测；合格者可进入步骤 2，未确认者不可加入并有原因；API 另核门禁 |
| W05-LIVE-02 / **P1** | 步骤 9：Save draft & exit 到 `Project not found.`（E02） | 用户失去继续入口并可能误以为已保存。保存实际草稿并返回有效列表/项目 | 填写多步后退出重入，字段与批次持久，未发信；返回页可找草稿 |
| W05-LIVE-03 / **P1** | 单人预览：仅显示岗位、模式、截止、题目和邀请正文；缺版本、工作量、清单、规则、From/Reply-To（E05） | HR 无法核准外发内容。把真实邮件/候选页共用的完整预览及发件身份呈现出来 | 用隔离 seed 核预览、实际邮件、候选页逐字段一致 |
| W05-LIVE-04 / **P1** | 单人发送表单显示工作区 SMTP 发件人，预览正文为中文；英文雇主 UI 与 W05 英文邮件要求不一致（E03、E05；[#229](https://github.com/TelyAgent/HireOSV2/issues/229)） | 候选人语言/回复身份可能与期望不符。明确语言与平台发件策略并同步预览 | Owner 确认策略后，用 fake mail 验证英文/中文、From/Reply-To、时区与回复路径 |
| W05-LIVE-05 / **P1，源码风险** | 本地 Composer 的 send/retry 只改内存状态，保存也无持久化调用（E07） | 若线上构建一致，Delivery 会把模拟结果误作真实发送。先核构建，再接真实批次/通知结果 | 隔离批次的 UI、API、DB、adapter 四方逐人一致；失败项重试不重复成功项 |

W05-LIVE-05 不计为线上已复现邮件缺陷。W05-LIVE-04 的邮件头和候选人实际语言尚未发信验证；已确认的是发送前显示的发件人和预览语言。单人页面没有披露方式可选，E08 中固定为 `score_and_summary`，与 FR-11 的可选披露要求有偏差；因线上只执行到预览，此项记为源码与 UI 共同提示的待复验差异。

### 标准结构化审查记录

```yaml
review:
  product: "Written Test / W05 Invitation Sending"
  surface: "批量邀请 Composer、单人 Send to candidate 抽屉"
  role: "HR / Recruiter"
  journey_goal: "对已确认候选人预览、发送笔试邀请并追踪逐项交付"
  evidence:
    source: "线上 Chrome 截图/可访问树 E01–E05；线上健康响应 E06；本地源码 E07–E08"
    steps_checked: ["批量 Recipients", "Save draft & exit", "单人模式", "单人校验", "单人预览"]
  verdict: "fail"
  findings:
    - id: "W05-LIVE-01"
      severity: "P0"
      category: "learnability"
      step: "批量 Recipients"
      title: "空收件人列表无添加入口"
      evidence: "E01：No recipients yet；Continue 提示 Add at least one recipient"
      user_impact: "HR 无法发起批量邀请"
      recommendation: "提供有权限且已确认关系的候选人选择"
      acceptance_check: "可选者进入下一步；未确认者不可加入并说明原因"
    - id: "W05-LIVE-02"
      severity: "P1"
      category: "recoverable"
      step: "Save draft & exit"
      title: "草稿退出跳到不存在的项目"
      evidence: "E02：Project not found，重入仍为空"
      user_impact: "不能从原上下文继续"
      recommendation: "持久化草稿并返回可访问入口"
      acceptance_check: "填写后退出重入，内容、状态和无发信证据一致"
    - id: "W05-LIVE-03"
      severity: "P1"
      category: "clarity"
      step: "单人预览"
      title: "外发前预览缺版本、工作量、规则和发件身份"
      evidence: "E05：预览仅显示岗位、模式、截止、题目和邀请正文"
      user_impact: "HR 无法确认候选人将收到的完整条件"
      recommendation: "补全与真实交付同源的逐人预览"
      acceptance_check: "预览、fake mail、候选人页面逐字段一致"
  usability_check:
    understandable: "unknown"
    learnable: "fail"
    efficient: "fail"
    next_action_clear: "fail"
    controls_clear: "fail"
    real_workflow_fit: "fail"
    role_information_fit: "fail"
    no_unnecessary_hops: "fail"
    recoverable: "fail"
    accessible: "unknown"
  limits:
    - "无 W05 主 Issue/PR、线上构建 SHA 与隔离测试 seed"
    - "未发信；DB、邮件、幂等、失败重试、权限及 200%/键盘未验证"
```

## 6. 复测准备与交接

1. 修通批量收件人选择和有效项目/草稿恢复路径；给出线上构建 SHA、W05 主 Issue/PR，再复测 AC-1、AC-7 和批量步骤 1–5。
2. 按 [公共约定](../README.md#公共约定) 提供隔离 workspace、`S_case_plan_ready`、两名确认 Application 的收件人及一名未确认者；测试邮箱使用 `example.com`，发信只进 `simulation_only` adapter，并提供只读 Invitation/Delivery/Case 计数。
3. 提供 `mail_bounce`、重复请求和结果未知的受控注入；逐项验证 AC-2/3/5/6 及邮件信封、幂等、快照，不对真实候选人操作。
4. Owner 在关联 Issue 明确是否二人批准、统一发件人/平台通知过渡期、候选人语言及 auto-submit 的上线条件。未决规则不能由本报告代替决定。
5. 本轮没有发布 GitHub 评论、创建 Issue、push 或 PR；没有伪造正式 QA 的 Issue/PR/merge SHA 或声称未执行的自动测试通过。
