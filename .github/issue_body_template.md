<!-- CLI/API Issue 正文模板；复制到临时文件，替换全部填写提示后再提交。
Type 选择 Feature、Bug、Design 或 Tech Debt。
Risk 选择 low、medium 或 high。
提交前调用 .agents/skills/estimate-issue/SKILL.md 评估 Estimate，字段仅填写唯一值，分析依据按技能输出规则保留。
Estimate 使用 1、2、3、5、8 或 TBD，规则见 a2a_dev_process.md 的 Estimate 管理规则。
AI Ready 默认 No，只有需求、AC 和依赖明确且 Owner 已确认 Estimate 点数后才改为 Yes。
按 .github/ISSUE_TEMPLATE/ 对应表单的 attributes.label 追加类型专属三级标题：
Feature: User Flows。
Bug: Reproduction、Expected / Actual、Environment、Severity（S1/S2/S3/S4）。
Design: User Flow、Target Platforms、Component Constraints、UI States、Design Handoff。
Tech Debt: Technical Evidence、Compatibility / Rollback。
填写专属字段时参考对应表单的 description；字段内部子标题使用 #### 或更深层级。
提交前检查字段完整且非空、三级标题名称准确且唯一、枚举取值正确、AC 编号唯一，删除本注释。
保存完整的最终正文后运行 node .github/scripts/issue-contract.cjs <正文文件> submission；退出码 0 后提交。执行前使用 execution 模式。只更新 Estimate 也检查完整正文，例外见 .github/issue-contract.md。
使用 gh issue create --body-file <临时文件> 或结构化 API body 参数提交正文。
此模板不授予创建外部 Issue 的权限，授权仍遵循 AGENTS.md 和当前任务。
-->

### Type

填写任务类型。

### Problem

填写当前问题、影响和证据。

### User Outcome

填写用户完成后得到的结果。

### Scope

填写本次包含的工作。

### Non-goals

填写明确的范围边界；无则填写 None。

### Acceptance Criteria

- AC-1: 填写输入、预期结果和验证方法。

### References

填写规格、设计、API、ADR 等链接；无则说明原因。

### Dependencies

填写关联 Issue/API/服务；阻塞项使用 Blocked by: #编号，无则填写 None。

### Risk

填写风险等级。

### Owner

填写真实 Human Supervisor 的 @GitHub用户名。

### Estimate

TBD

### AI Ready

No
