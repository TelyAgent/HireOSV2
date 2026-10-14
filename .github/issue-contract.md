# Issue 正文校验

创建 Issue 或修改任何正文字段（包括只更新 Estimate）前，先把完整的最终正文保存到文件，运行：

```bash
node .github/scripts/issue-contract.cjs /绝对路径/issue-body.md submission
```

退出码必须为 0 才提交。失败时按逐项错误修正；需求、环境或 Owner 尚不明确时保留事实与缺口，不填造数据。普通 Issue 的待分诊状态可以是 `Estimate=TBD`、`AI Ready=No`，但类型专属字段仍必填，Owner 仍需真实监督者。

执行前使用同一模块的就绪模式：

```bash
node .github/scripts/issue-contract.cjs /绝对路径/issue-body.md execution
```

该模式要求 `AI Ready=Yes`、Estimate 为 1/2/3/5/8；QA/Review 的 [context.cjs](scripts/context.cjs) 在采集前自动调用它。CLI 不调用 GitHub、不修改正文；直接绕过 CLI 的外部 API 写入不能由本地脚本阻止，Agent 必须按提交前步骤执行。

## 校验范围与标准

[Issue Forms](ISSUE_TEMPLATE/) 定义字段和下拉选项，[issue-contract.json](schemas/issue-contract.json) 保存对应机器契约。修改任一处时同步另一处，并运行 `node --test .github/scripts/automation.test.cjs`；测试逐项比对四类表单的必填字段及枚举，防止漂移。

[issue-contract.cjs](scripts/issue-contract.cjs) 校验：共用和类型专属必填字段非空、字段标题唯一且为三级、字段内子标题四级或更深、Type/Risk/Estimate/AI Ready/Severity 枚举、Owner 用户名格式，以及 AC 编号唯一且内容非空。代码块和 HTML 注释中的示例不会被当作字段或 AC 定义。可增加 `### Evidence`，其他附加解释放在已有字段的四级子标题下。

机器校验通过只证明正文结构和枚举合法。Owner 的实际身份、实施前点数确认、需求/依赖就绪、AC 是否充分以及历史审批顺序仍由 Agent 和 Human Supervisor 对证据核查。

## 自动待分诊 Bug 的例外

[ledger.cjs](scripts/ledger.cjs) 新建 QA Bug 时由可信调用路径选择 `ledger-bug` 模式，创建前调用同一校验器：

- Type 必须为 Bug，Estimate 必须为 TBD，AI Ready 必须为 No，并添加 `needs-triage`。
- 可复制来源 Issue 的单个合法 Owner 用户名；来源 Owner 格式无法解析时，只允许 `Pending human triage; source Issue #<number> owner to assign.`。该值仅供机器人分诊，不表示已指派或已批准实施。
- 所有 Bug 专属字段仍须存在。Expected / Actual 引用来源 AC 并记录 QA 观察；Environment 记录来源 PR、实际合并提交 SHA、run URL，未提供的浏览器/OS/device 明确为未知，分诊时补充。
- 不允许省略字段，也不允许将 No/TBD 待分诊正文作为可执行契约。正文中的机器人标记不授予例外；CLI 和执行入口无法选择机器人模式。

修复或实施前，监督者补齐具体预期、复现环境、Owner 和批准依据，并按普通提交及执行模式重新校验。已有 Issue 不在本次代码变更中自动回填。
