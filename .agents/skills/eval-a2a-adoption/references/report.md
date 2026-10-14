# 报告与计算输入

生成可独立阅读的 `report.md`；原始采集、人工判定和自动计算互相链接。报告至少包含：

1. 评级/未完成状态、仓库、开始与结束时间、标准 SHA/工作树版本、观察窗口和时区。
2. 文件完整性清单：根文件、完整引用图、每条引用的 source:line/原文、标准化目标、必需/排除依据、存在/缺失/未知结果与核验版本；缺失项的完整引用链、直接/间接类别及修复建议。
3. 评级规则及依据：文件门槛、基础判定、四周三个指标、逐项是否达到良好/优秀，说明按每周而非平均判定。
4. 样本选择依据与实际数量；最新 Issue 表和 PR 表（编号/链接、created_at、当前阶段、每项结果/证据、对象结论）。违规与 unknown 分列，不仅给通过率。
5. 每周统计表：区间、Feature 数、Bug 数、Estimate 合计、未知值数量、对两个档位各项差距。
6. 周产出纳入/排除明细：Issue、Type、首次验收关闭事件、开工 Estimate、Owner 确认、AC/PR 证据、排除原因。重开、取消、重复、汇总父项的处理有出处。
7. 主要问题和改进建议：规则来源、证据、影响、建议动作、验证改进的方法。不会自动创建 Issue 或发布正式评论。
8. 完整性与限制：样本不足、分页/权限缺口、采集期间变化、本地未发布规范、无法还原编辑/删除历史、四周窗口早于采用时间等。不能把跨团队点数或 Bug 关闭量解释为业务价值/缺陷率改善。

## assessment.json

使用以下结构作为 `scripts/grade.py` 输入。脚本验证关键字段、计算完整周、去重和评级；**是否真实合规、验收和点数确认由 Agent 对证据判断**。原始对象保存在独立文件，用 evidence 链接关联，避免在评级输入里重复全部大段正文。

```json
{
  "schema_version": 2,
  "repository": "OWNER/REPO",
  "evaluated_at": "2026-10-13T08:00:00Z",
  "timezone": "Asia/Shanghai",
  "file_integrity": {
    "result": "pass",
    "complete": true,
    "files": [{"path": "a2a_dev_process.md", "status": "pass", "chain": ["a2a_dev_process.md"], "evidence": ["完整仓库树与递归引用核查记录"]}]
  },
  "collection": {"selection_complete": true, "samples_complete": true, "metrics_complete": true},
  "baseline": {
    "result": "pass",
    "evidence": ["原始采集/检查清单路径或GitHub链接"],
    "reason": "所有样本的适用项均通过"
  },
  "samples": {
    "issues": [{"number": 12, "created_at": "2026-10-12T01:00:00Z", "result": "pass", "evidence": ["检查明细路径"]}],
    "prs": [{"number": 13, "created_at": "2026-10-12T02:00:00Z", "result": "pass", "evidence": ["检查明细路径"]}]
  },
  "deliveries": [
    {
      "number": 12,
      "type": "Feature",
      "eligible": true,
      "accepted_closed_at": "2026-10-11T01:00:00Z",
      "estimate": "3",
      "estimate_confirmed": true,
      "evidence": ["验收、首次有效关闭事件及Owner确认链接"]
    },
    {
      "number": 14,
      "type": "Bug",
      "eligible": false,
      "reason": "重复关闭，依据……",
      "evidence": ["取消或重复依据链接"]
    }
  ],
  "limitations": []
}
```

示例仅说明结构，不是假项目的评估结论；真实 files 必须包含完整递归清单，不能只检查根文件。对象明细检查项另外保存并在 evidence 中引用。

- `schema_version=2` 和 `file_integrity` 必填，旧版输入不能跳过新硬门槛。
- `file_integrity.files` 每个标准化仓库相对目标只列一次，包含根文件，status 为 pass/missing/unknown/na；chain 从 `a2a_dev_process.md` 到目标，evidence 含引用来源和存在/缺失核验，unknown/na 必须有 reason。全部引用边、外部链接和无法解析的引用在单独清单中留存。
- `file_integrity.complete` 表示引用闭包遍历完成。任一 missing → result=fail（即使 complete=false）；无 missing 但有 unknown 或遍历未完 → unknown；否则 pass。脚本拒绝结论与清单矛盾。
- 文件门槛 fail 时可仅提供版本、仓库、评估时间、时区及 file_integrity，其他阶段无需收集；脚本直接输出不合格，weeks 为空并注明后续阶段未评估，不能解读为交付数量为零。
- `evaluated_at` 为冻结范围的采集开始时间，带 UTC offset；周边界由脚本计算，报告另记采集结束时间。
- `baseline.result` / 样本 result：`pass / fail / unknown`；不可把 na 当作整个对象结论。一个必需项 fail → 对象 fail；没有 fail 但必需项 unknown → unknown；其他适用项通过 → pass。
- `samples` 必须是按创建时间选出的两组样本，最多各 10 个；样本对象与 baseline 的 fail/unknown/pass 保持一致，脚本检测矛盾。不足样本以实际数组记录，不构造虚拟对象。
- `selection_complete=true` 表示已确认两组最新样本的准确归属；列表分页失败而不能确认范围时为 false，已看到候选违规也不能据此正式评级。
- `samples_complete=true` 表示样本必要证据读取完整，不表示有满 10 个样本。任一列表为零无法证明基础流程落地。
- `metrics_complete=true` 仅在四周候选 Issue、相关事件和验收等必要证据完整时填写。明确无符合条件的交付为 0；读取失败不可填写空数组并宣称完整。
- `deliveries` 纳入完整候选集合的人工判定；每个 Issue 只保留一次首次有效关闭事件。`eligible=false` 要有排除理由；`eligible=null` 为纳入资格未知（无法确认 Type/验收/事件），阻止正式升级判定。
- `eligible=true` 必须有 Type=Feature/Bug、首次验收后关闭时间和证据。已证明交付，但 Estimate 缺失/TBD/非法或确认未知时可保留原值、`estimate_confirmed=false`，脚本记未知点数，不把它当 0。
- 相同编号的相同记录仅去重，不重复累计；冲突记录或重复排除/纳入需先核实，脚本拒绝互相矛盾的输入。
- `limitations` 解释数据缺口；`rating.json` 的 confirmed 指标是可见明细的已证实数值，不是缺失数据的估算。

## rating.json

脚本输出文件完整性结果和清单、`status=complete|incomplete`、`rating=不合格|合格|良好|优秀|null`、`baseline`、四周左右边界、每周三个已确认指标、`unknown_estimates`、`good/excellent` 的逐项差距及总体是否达标、限制。文件缺失时优先直接 `rating=不合格`，无需样本归属证据；后续阶段未评估时 `status=incomplete` 不影响确证的不合格结论。没有文件缺失的确证且已确认样本归属、有基础违规时，即使其他证据未完整仍可 `rating=不合格, status=incomplete`；没有文件缺失的确证且选样范围无法确认时须 `rating=null`。文件完整性 unknown 阻止合格及更高评级，但不抵消已确证的样本违规。将输出与检查明细组合成 Markdown 报告，并核对每个指标可以从输入重算。

## GitHub 采集参考

API 行为以官方文档为准，使用时优先采用当前连接器/CLI 的分页与字段能力：

- [Issues API](https://docs.github.com/en/rest/issues/issues#list-repository-issues)：包含 PR；`since` 依据更新时间。
- [Pull requests API](https://docs.github.com/en/rest/pulls/pulls#list-pull-requests)：按 created 降序取样本。
- [Timeline API](https://docs.github.com/en/rest/issues/timeline#list-timeline-events-for-an-issue) 和 [事件类型](https://docs.github.com/en/rest/using-the-rest-api/issue-event-types)：核实关闭、重开与关联事件，不能仅依当前状态重建完整历史。
