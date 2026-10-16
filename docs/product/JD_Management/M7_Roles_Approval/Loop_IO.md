# M7 输入输出闭环：角色权限与审批

| 项 | 内容 |
|---|---|
| 模块 | M7（P0） |
| 版本 / 日期 | v1.1 / 2026-10-15（纳入邮件审批决定） |
| 同目录文档 | [产品文档](PRD.md) · [User Journey](User_Journey.md) |
| 格式说明 | 见 [模块索引 README](../README_Modules.md#闭环文档格式) |
| 实现现状 | ❌ 审批和服务端角色权限未实现；本文件的路径在实现前全部标记 known gap |

本模块拆成两个子流程：**M7a 审批**（Recruiter → HR Approver）、**M7b 角色可见范围**（Hiring Manager、Viewer、角色变更）。

## 1. 结构化规格

```yaml
# ---------- M7a 审批 ----------
flow_id: M7a
actors: [recruiter_a, approver_a]
seed: S_job_ready_with_confidential   # 职位 J：必填合格，含 Confidential 块和预算字段，由 recruiter_a 创建
entry: M7a.N1
max_loop: 2

nodes:
  - {id: M7a.N1, type: action, actor: recruiter_a, do: "打开职位 J，点击提交审批", inject: [double_click]}
  - {id: M7a.G1, type: decision, on: "文档是否 Ready"}
  - {id: M7a.C1, type: check, expect: {ui: "提交审批不可用并说明原因", api: "直接调用返回 422", db: "无审批请求"}}
  - {id: M7a.C2, type: check, expect: {ui: "显示审批人和冻结的版本", db: "审批请求 status=pending，记录候选版本哈希、提交人、时间"}}
  - {id: M7a.C9, type: check, expect: {ext: "发送的审批邮件含对应请求的审批按钮", db: "邮件引用冻结的候选版本"}}
  - {id: M7a.N6, type: action, actor: approver_a, do: "从邮件审批按钮进入对应请求，登录后确认批准、退回或拒绝"}
  - {id: M7a.C10, type: check, expect: {ui: "未登录不能提交决定", api: "决定回传到对应审批请求", db: "记录人工审批人、决定、冻结版本、时间及必要理由；M8 门禁读取同一结果"}}
  - {id: M7a.N7, type: action, do: "对仍 pending 的冻结请求推进时钟至提交后 24 小时"}
  - {id: M7a.C11, type: check, expect: {db: "系统把该冻结版本标记 approved，决定来源=系统超时；不自动 Publish", record: "发送邮件通知"}}
  - {id: M7a.N2, type: action, actor: recruiter_a, do: "尝试批准自己提交的请求（调用决定接口）"}
  - {id: M7a.C3, type: check, expect: {api: "403", db: "请求仍为 pending"}}
  - {id: M7a.N3, type: action, actor: approver_a, do: "从待我审批进入候选版本"}
  - {id: M7a.C4, type: check, expect: {ui: "显示内容、与上一版的差异、风险、可见范围"}}
  - {id: M7a.N4, type: action, actor: approver_a, do: "作出决定 D"}
  - {id: M7a.G2, type: decision, on: "D 的类型与是否填写理由"}
  - {id: M7a.C5, type: check, expect: {ui: "不能提交，提示必须填写理由", db: "请求仍为 pending"}}
  - {id: M7a.C6, type: check, expect: {db: "status=approved；决定记录人工审批人、版本哈希、时间"}}
  - {id: M7a.C7, type: check, expect: {db: "status=changes_requested 或 rejected；记录理由", ui: "Recruiter 看到退回理由"}}
  - {id: M7a.N5, type: action, actor: recruiter_a, do: "请求 pending 时修改文档内容"}
  - {id: M7a.C8, type: check, expect: {db: "旧请求 status=superseded", api: "approver_a 对旧请求作出决定返回 409 或 422"}}
  - {id: M7a.T1, type: terminal, state: approval.approved}
  - {id: M7a.T2, type: terminal, state: approval.changes_requested_or_rejected}
  - {id: M7a.T3, type: terminal, state: approval.superseded}
  - {id: M7a.T4, type: terminal, state: approval.not_submitted}

edges:
  - [M7a.N1, M7a.G1]
  - [M7a.G1, M7a.C1, {when: "seed 改为 S_job_incomplete"}]
  - [M7a.C1, M7a.T4]
  - [M7a.G1, M7a.C2, {when: "Ready"}]
  - [M7a.C2, M7a.C9, {when: "测邮件审批"}]
  - [M7a.C9, M7a.N6]
  - [M7a.N6, M7a.C10]
  - [M7a.C2, M7a.N7, {when: "24 小时内无人决定"}]
  - [M7a.N7, M7a.C11]
  - [M7a.C11, M7a.T1]
  - [M7a.C2, M7a.N2, {when: "测自审批"}]
  - [M7a.N2, M7a.C3]
  - [M7a.C2, M7a.N3]
  - [M7a.N3, M7a.C4]
  - [M7a.C4, M7a.N4]
  - [M7a.N4, M7a.G2]
  - [M7a.G2, M7a.C5, {when: "D 属于 reject_no_reason / changes_no_reason"}]
  - [M7a.G2, M7a.C6, {when: "D = approve"}]
  - [M7a.C6, M7a.T1]
  - [M7a.G2, M7a.C7, {when: "D 属于 reject_with_reason / changes_with_reason"}]
  - [M7a.C7, M7a.T2]
  - [M7a.C2, M7a.N5, {when: "测审批中修改"}]
  - [M7a.N5, M7a.C8]
  - [M7a.C8, M7a.T3]

---
# ---------- M7b 角色可见范围 ----------
flow_id: M7b
actors: [hm_a, viewer_a, approver_no_restricted]
seed: S_job_ready_with_confidential
entry: M7b.G0

nodes:
  - {id: M7b.G0, type: decision, on: "当前角色"}
  - {id: M7b.N1, type: action, actor: hm_a, do: "修改字段 F 并保存"}
  - {id: M7b.G1, type: decision, on: "F 是否为授权字段"}
  - {id: M7b.C1, type: check, expect: {db: "保存成功，记录修改人和时间"}}
  - {id: M7b.C2, type: check, expect: {ui: "字段只读", api: "直接调用返回 403", db: "值不变"}}
  - {id: M7b.N2, type: action, actor: viewer_a, do: "打开职位 J"}
  - {id: M7b.C3, type: check, expect: {ui: "只读；无编辑类按钮；Confidential 不可见", api: "GET 响应中不含 Confidential 正文"}}
  - {id: M7b.N3, type: action, actor: viewer_a, do: "直接调用编辑、保存、提交审批、发布接口"}
  - {id: M7b.C4, type: check, expect: {api: "全部 403", db: "无变化"}}
  - {id: M7b.N4, type: action, actor: approver_no_restricted, do: "打开含 restricted 字段的候选版本"}
  - {id: M7b.C5, type: check, expect: {ui: "restricted 字段不可见", api: "响应不含 restricted 值"}}
  - {id: M7b.N5, type: action, do: "管理员把 viewer_a 改为 recruiter，viewer_a 立即再次请求；再改回"}
  - {id: M7b.C6, type: check, expect: {api: "改为 recruiter 后立即可编辑；改回后立即 403", ui: "改回后不再展示缓存的敏感内容"}}
  - {id: M7b.T1, type: terminal, state: no_unauthorized_change}

edges:
  - [M7b.G0, M7b.N1, {when: "hm_a"}]
  - [M7b.N1, M7b.G1]
  - [M7b.G1, M7b.C1, {when: "F 属于 hm_allowed_fields"}]
  - [M7b.G1, M7b.C2, {when: "F 属于 hm_denied_fields"}]
  - [M7b.G0, M7b.N2, {when: "viewer_a"}]
  - [M7b.N2, M7b.C3]
  - [M7b.C3, M7b.N3]
  - [M7b.N3, M7b.C4]
  - [M7b.G0, M7b.N4, {when: "approver_no_restricted"}]
  - [M7b.N4, M7b.C5]
  - [M7b.N5, M7b.C6]
  - [M7b.C1, M7b.T1]
  - [M7b.C2, M7b.T1]
  - [M7b.C4, M7b.T1]
  - [M7b.C5, M7b.T1]
  - [M7b.C6, M7b.T1]
```

## 2. 测试数据

| 名称 | 内容 |
|---|---|
| 身份 | recruiter_a、hm_a、approver_a、approver_no_restricted、viewer_a |
| S_job_ready_with_confidential | recruiter_a 创建；必填合格；Confidential 块 `Internal budget ceiling: 100000 USD`；预算字段 |
| hm_allowed_fields | 职责、成功标准（清单待确认） |
| hm_denied_fields | 内部预算、Confidential 块 |
| approve | 批准 |
| changes_with_reason / changes_no_reason | 退回，带 / 不带理由 |
| reject_with_reason / reject_no_reason | 拒绝，带 / 不带理由 |

## 3. 路径清单

| 路径 | 节点序列 | 数据 | 终态 |
|---|---|---|---|
| P1 未 Ready 不能提交 | M7a: N1 → G1 → C1 | seed 改为 S_job_incomplete | not_submitted |
| P2 提交审批 | M7a: N1 → G1 → C2 | — | pending |
| P3 不能自审批 | M7a: … → C2 → N2 → C3 | — | pending |
| P4 HM 改授权字段 | M7b: G0 → N1 → G1 → C1 | hm_allowed_fields | 保存成功 |
| P5 HM 改预算 | M7b: G0 → N1 → G1 → C2 | hm_denied_fields | 值不变，403 |
| P6 批准 | M7a: … → N3 → C4 → N4 → G2 → C6 | approve | approved |
| P7 退回 / 拒绝不填理由 | M7a: … → N4 → G2 → C5 | changes_no_reason、reject_no_reason | pending |
| P8 退回 / 拒绝填理由 | M7a: … → N4 → G2 → C7 | changes_with_reason、reject_with_reason | changes_requested / rejected |
| P9 审批中修改 | M7a: … → C2 → N5 → C8 | — | superseded |
| P10 Viewer 只读 | M7b: G0 → N2 → C3 | — | 无变化 |
| P11 Viewer 写接口 | M7b: … → N3 → C4 | — | 全部 403 |
| P12 角色变更立即生效 | M7b: N5 → C6 | — | 按新角色生效 |
| P13 审批人无 restricted 权限 | M7b: G0 → N4 → C5 | — | restricted 不可见 |
| P14 双击提交 | P2 在 N1 注入 double_click | — | 只有 1 个 pending 请求 |
| P15 24 小时无人处理 | M7a: N1 → C2 → N7 → C11 | 时钟快进；仍 pending 的冻结版本 | 系统批准，来源可辨，发邮件，不自动发布 |
| P16 邮件审批回传 | M7a: N1 → C2 → C9 → N6 → C10 | 已登录 approver_a、冻结版本 | 批准、退回或拒绝回传到对应请求；未登录不能决定 |

## 4. 流程图（由规格生成）

```mermaid
flowchart TD
  subgraph M7a["M7a 审批"]
    a1["M7a.N1 Recruiter 提交审批<br/>注入：双击"] --> ag1{"M7a.G1 Ready?"}
    ag1 -->|"否"| ac1["M7a.C1 ✔ 不可提交，422"]
    ag1 -->|"是"| ac2["M7a.C2 ✔ pending，冻结版本"]
    ac2 --> em["M7a.C9 ✔ 发送含审批按钮的邮件"] --> em2["M7a.N6 邮件入口作出决定"] --> em3["M7a.C10 ✔ 决定回传到对应请求"]
    ac2 --> t24["M7a.N7 24 小时仍 pending"] --> tc["M7a.C11 ✔ 系统批准、标明来源并发邮件"]
    ac2 --> a2["M7a.N2 Recruiter 自审批"] --> ac3["M7a.C3 ✔ 403"]
    ac2 --> a3["M7a.N3 Approver 打开候选版本"] --> ac4["M7a.C4 ✔ 内容、差异、风险"]
    ac4 --> a4["M7a.N4 作出决定"] --> ag2{"M7a.G2 决定 / 理由"}
    ag2 -->|"无理由的退回 / 拒绝"| ac5["M7a.C5 ✔ 不能提交"]
    ag2 -->|"批准"| ac6(["M7a.C6 ✔ approved"])
    ag2 -->|"有理由的退回 / 拒绝"| ac7(["M7a.C7 ✔ 记录理由"])
    ac2 --> a5["M7a.N5 审批中修改内容"] --> ac8(["M7a.C8 ✔ superseded"])
  end
  subgraph M7b["M7b 角色可见范围"]
    bg0{"M7b.G0 角色"}
    bg0 -->|"HM"| b1["M7b.N1 修改字段"] --> bg1{"授权字段?"}
    bg1 -->|"是"| bc1["M7b.C1 ✔ 保存成功"]
    bg1 -->|"否"| bc2["M7b.C2 ✔ 只读，403"]
    bg0 -->|"Viewer"| b2["M7b.N2 打开职位"] --> bc3["M7b.C3 ✔ 响应无敏感正文"] --> b3["M7b.N3 调写接口"] --> bc4["M7b.C4 ✔ 全部 403"]
    bg0 -->|"无 restricted 权限的 Approver"| b4["M7b.N4 打开候选版本"] --> bc5["M7b.C5 ✔ restricted 不可见"]
    b5["M7b.N5 改角色再改回"] --> bc6["M7b.C6 ✔ 立即生效"]
  end
```

## 5. 待确认

- 审批已确定仅 HR Approver 一步；24 小时未决由系统批准并发邮件。自动批准邮件的收件人、模板、发送失败处理仍待确认。
- Hiring Manager 授权字段清单。
- 角色由超级管理员在系统设置分配，每人仅一个；作用范围及超级管理员与业务角色关系仍待确认（影响 M7b.N5）。
- 邮件审批已确定支持批准、退回、拒绝，须登录的 HR Approver 确认；理由填写、回传失败/重复/过期反馈仍待确认。
