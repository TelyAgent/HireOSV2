## Linked Issue

Closes #____

<!-- 必须关联一个本仓库的 Issue，且该 Issue AI Ready=Yes；其他依赖写 Refs #n。CI 的 Issue contract 检查会强制这一条。 -->

## What Changed

<!-- 问题、实现后的行为和变更边界。 -->

## Subsystems

<!-- 勾选受影响的子系统。 -->
- [ ] hireos-jd
- [ ] hireos-interview
- [ ] hireos-screening
- [ ] hireos-written
- [ ] hireos-core-record
- [ ] gateway / scripts / docker

## Spec / Design References

<!-- Issue 链接的 Spec、Design、API、docs/adr/。 -->

## Acceptance Criteria

- [ ] AC-1: <!-- 逐项照抄 Issue 的 AC，并附证据 -->

## Test Evidence

- build / lint / typecheck:
- Unit / integration (`npm test`):
- 手动或浏览器验证（地址、截图）:
- Design differences:

<!-- 没执行的要说明原因和补齐方式；N/A 要说明为什么不适用，不能当作通过。 -->

## Database

- [ ] 无 schema 变更
- [ ] 有 Prisma migration：<!-- 路径，以及对线上已有数据的影响 -->

## AI Review

- [ ] Claude review passed（CI 自动发布评论）
- [ ] Security review passed / N/A（说明理由）

## Risk & Rollback

- Risk: <!-- low / medium / high -->
- Rollback: <!-- 回滚步骤、迁移和兼容性影响 -->

## Deploy

<!-- 合并后需要部署的服务，例如 jd-backend、jd-frontend；不需要就写 None。部署由人执行。 -->

## Documentation

- [ ] Updated（PORTS.md / 部署指南 / ADR 等）/ N/A（说明理由）

## Human Supervisor

@____

<!-- 正式讨论使用 [AI-PLAN] / [AI-QUESTION] / [AI-EVIDENCE] / [AI-BLOCKED] / [HUMAN-DECISION] / [AI-RESULT]；外部决定要回写 GitHub。 -->
