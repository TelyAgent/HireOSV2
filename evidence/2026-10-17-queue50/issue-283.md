### Type

Feature

### Subsystem

hireos-interview

### Problem

Review 只有逐项保存，没有独立提交记录；首页待提交计数写死为零，下游直接读取可变草稿，无法审计已提交版本。

### User Outcome

面试官独立提交评分卡，带理由修订并显式重新提交；本人待办与下游评分依据准确。

### Scope

独立草稿/提交状态、不可变提交快照、提交校验、原提交人修订、并发与幂等、本人待办、Review UI；Debrief/决定生成/评估包读取最新已提交版本，不改汇总算法。历史无提交记录的评分保留草稿，不补造提交。

#### Human decisions and estimate

Owner 已在 Codex 会话确认：轮次完成后，本轮能力逐项填写分数或明确 Unknown 及理由，推荐及理由必填；逐项保存仍为草稿。仅原提交人填写原因创建修订草稿，显式重新提交，旧版本保留；修订草稿不替换下游已提交版本。本人已完成轮次的首次草稿和修订草稿计入待办，提交后减一。确认 Estimate 8；#426 的账号关联 5 点与 #284 剩余 2 点单独计算。估算依据：跨持久状态、并发写入、三处下游读取与浏览器回归，比 5 点复杂；复用单子系统评分模型，无新审批/算法。

### Non-goals

不扩展 HR/HM 代改权限，不重构角色体系，不改变 AI 起草或 Debrief 汇总算法，不自动改写旧决定/已发布包，不自动猜测面试官账号。

### Acceptance Criteria

- AC-1: 逐项保存为草稿；仅已完成轮次且逐项明确分数/Unknown与理由、推荐与理由齐备时可独立提交；未填写不冒充 Unknown。
- AC-2: 本人负责的已完成轮次首次草稿/修订草稿纳入待提交计数，提交后减一；重复提交幂等。
- AC-3: 仅原提交人带原因创建修订草稿，再显式提交新版本，旧版本及操作人/时间/原因可查；提交后不可直接修改。
- AC-4: 数据库及浏览器覆盖草稿、首次/重复提交、并发保存/提交、过期冲突、修订及计数变化、失败输入保留。
- AC-5: Debrief、决定生成及新评估包只读取最近已提交版本；修订草稿和无提交记录的历史分数不进入正式依据；已有发布产物不自动重写。

### References

`docs/product/Interview/I08_Review_Scorecard/PRD.md`；`docs/product/Interview/I08_Review_Scorecard/User_Journey.md`；`docs/product/Interview/I08_Review_Scorecard/Test_Report_2026-10-15.md`；`evidence/2026-10-17-queue50/estimate-283-284.md`。Refs #284, #426。

### Dependencies

#426 显式账号关联，本地实现及验收已完成，尚未提交/部署；本分支联动交付。原始目录记录不能直接当作登录账号。

### Risk

medium

### Owner

@JsonSuCoder

### Estimate

8

### AI Ready

Yes

### User Flows

已绑定面试官完成轮次，逐项保存、填写推荐与理由，独立提交，待办更新；原提交人带原因修订草稿，显式重新提交，下游再读取新版本。冲突保留输入，重复请求不新增版本。
