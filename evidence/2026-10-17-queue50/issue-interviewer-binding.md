### Type

Feature

### Subsystem

hireos-interview, hireos-identity

### Problem

Interview 的 Interviewer 目录与登录账号没有关联，无法可靠识别 #283 的本人待办和提交人。不得用姓名或邮箱猜测身份。

### User Outcome

管理员明确关联面试官与同工作区有效账号，为本人评分卡提交提供可信依据。

### Scope

复用成员设置页与现有 admin 权限；仅为未绑定目录记录创建显式账号关联，保存操作人和时间。Identity 提供受认证的成员有效性校验；Interview 服务端校验同工作区、有效成员及账号，拒绝失败降级。包含迁移、API、数据库及浏览器测试。

#### Owner confirmation and estimate

Owner 在当前 Codex 会话确认范围与 5 点，并授权创建本前置 Issue。复用现有 UI/角色/成员模型，但跨服务校验与持久审计比 3 点复杂；不包含换绑、角色重构，范围小于 8 点。#283 原 8 点、#284 剩余 2 点不变，不重复累计。

### Non-goals

不解绑/换绑，不自动关联，不发邀请邮件，不扩展角色体系，不更改历史评分卡提交人。评分卡实现归 #283。

### Acceptance Criteria

- AC-1: 管理员可以显式选择同工作区有效账号关联未绑定面试官，刷新后显示关联及操作人/时间。
- AC-2: 服务端拒绝非管理员、跨工作区、停用/移除/未激活账号和不存在的目标；Identity 不可用时不写入。
- AC-3: 同目标重复关联幂等；不同目标并发关联仅一次成功，不覆盖原关联；保留审计。
- AC-4: 历史目录保持未绑定，不猜测；覆盖迁移、数据库并发与失败路径，以及浏览器选择、失败保留和刷新。

### References

Refs #283, #284。`hireos-interview/job-Interview-backend/prisma/schema.prisma`；`hireos-interview/job-Interview-front/src/features/settings/MembersSection.tsx`；`hireos-identity/hireos-identity-backend/src/users/users.service.ts`；`evidence/2026-10-17-queue50/estimate-283-284.md`。

### Dependencies

复用现有 Identity 服务及 admin 角色；本项为 #283 前置，无未决产品依赖。

### Risk

medium

### Owner

@JsonSuCoder

### Estimate

5

### AI Ready

Yes

### User Flows

管理员进入成员设置，选择未绑定面试官及有效账号，确认关联；失败保留输入并可重试，成功刷新回读。非管理员不可操作；已关联记录只读。
