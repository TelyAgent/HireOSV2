### Type

Bug

### Subsystem

hireos-interview

### Problem

Rubric 缺少导出入口和可追溯产物，原范围还要求完整 I13 Activity。

### User Outcome

用户可导出所见已保存 Rubric 的 PDF 快照并查询生成记录，不将生成成功误报为下载成功。

### Scope

第一段：草稿/确认版 PDF、冻结快照、持久生成记录及 Rubric 页查询。第二段：完整 I13 Activity 接入，继续保留未完成，不能因第一段通过关闭本 Issue。

#### Human decision and estimate

2026-10-17 Owner 确认拆分及第一段 5 点。Estimate 字段仅计第一段；I13 后续范围未估算，不重复累计。依据见 evidence/2026-10-17-queue50/estimate-253-phase1.md。

### Non-goals

第一段不实现完整 I13/DownloadAttempt，不更改评分规则或评估包导出，不扩展角色权限，不声称浏览器已完成保存。

### Acceptance Criteria

- AC-1: 第一段：草稿与确认版均可导出，PDF 标明状态、版本和修订；拒绝页面所见版本已过期的请求，不悄悄导出其他版本。
- AC-2: 第一段：产物冻结能力、权重、等级锚点、已验证来源、确认信息，后续编辑不改变该产物；覆盖中英文多页 PDF、数据库一致性和来源未知情况。
- AC-3: 第一段：持久记录导出人、时间、版本及生成成功/失败，页面可查询；失败和跨工作区请求有测试，生成状态与下载状态分开。
- AC-4: 第二段未完成：完整接入 I13 Activity/产物与下载尝试契约。第一段验收不代表本项通过，Issue 保持打开。

### References

- docs/product/Interview/I03_Requirements_Rubric/PRD.md
- docs/product/Interview/I03_Requirements_Rubric/Test_Report_2026-10-15.md F-07
- docs/product/Interview/I13_Files_Integrations/PRD.md
- evidence/2026-10-17-queue50/estimate-253-phase1.md

### Dependencies

第一段复用现有 PDF 生成器及 #251 来源校验；第二段等待完整 I13 接入契约。

### Risk

medium

### Owner

@JsonSuCoder

### Estimate

5

### AI Ready

Yes

### Reproduction

打开草稿及已确认 Rubric，均无导出入口。

### Expected / Actual

预期可导出当前已保存版本并追溯；实际页面缺少入口。

### Environment

原观察：2026-10-15 Chrome 线上 Interview，构建号未知。本轮本地测试，不声称生产验收。

### Severity

S3
