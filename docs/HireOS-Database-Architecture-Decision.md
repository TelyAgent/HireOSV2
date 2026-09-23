# HireOS 数据库架构决策

## 1. 决策结论

HireOS 的五个业务子系统不应共用一套业务表，也不建议一开始就部署五个完全独立的数据库服务器。

推荐采用：

> **共享 PostgreSQL 基础设施，按子系统划分独立 Schema，统一主档由 Core Record Service 独占写入。**

也就是说：

- 物理层可以共用一个 PostgreSQL 集群或实例；
- 逻辑层必须按 Schema、数据库角色和数据所有权隔离；
- 每个业务子系统只写自己的私有表；
- `Candidate`、`Job`、`Application`、`File` 等跨系统主档由 Core Record Service 统一维护；
- 其他子系统通过 Core Record API 访问主档，不能直接连接主档表；
- 子系统之间通过标准事件通信，不通过互相直连数据库实现集成。

## 2. 架构背景

HireOS 的目标同时包括：

1. JD、Screening、Assessment、Interview、Offer 五个子系统可以独立迭代和上线；
2. 后续组合成一个统一工作台时，账号、主档、时间线和业务语义可以打通。

如果五个系统一开始共用所有业务表，会导致：

- 一个子系统的表结构变更影响其他子系统；
- 任意服务都可能修改同一份业务事实；
- 无法明确数据责任人；
- 独立发布和独立迁移困难；
- 后续拆分时需要大量重构。

如果五个系统一开始使用完全独立数据库，又会带来：

- 主档同步复杂；
- Candidate、Job、Application 容易出现多份副本；
- 跨系统查询和一致性成本较高；
- 早期项目需要维护过多基础设施。

因此，当前最合适的是“共享物理基础设施，独立逻辑数据边界”。

## 3. 推荐的数据库形态

### 3.1 当前阶段

```text
一个 PostgreSQL 实例
│
├── core_record schema
├── jd schema
├── screening schema
├── assessment schema
├── interview schema
└── offer schema
```

当前阶段可以使用同一个 PostgreSQL 实例，但应提前为每个子系统规划独立 Schema。

### 3.2 生产初期

```text
一个 PostgreSQL 集群
│
├── Core Record 数据库或 schema
├── JD schema
├── Screening schema
├── Assessment schema
├── Interview schema
└── Offer schema
```

生产环境应进一步配置：

- 每个子系统独立数据库用户；
- 子系统用户只拥有自己 Schema 的写权限；
- 其他 Schema 默认无直接访问权限；
- Core Record 只通过服务 API 暴露主档读写能力；
- 迁移由对应子系统独立执行；
- 审计和跨系统事件保留统一 correlation ID。

### 3.3 规模扩大后

当某个子系统出现独立扩展需求时，再按压力和合规要求拆分数据库：

```text
Core Record 独立数据库
Screening 独立数据库
Assessment 独立数据库
Interview 独立数据库
Offer 独立数据库
```

这不是第一天必须完成的事情。只要早期已经做到 Schema、权限和数据所有权隔离，后续物理拆库可以渐进完成。

## 4. 五个子系统的数据边界

### 4.1 Core Record Service

Core Record 是跨系统主档的唯一写入方，负责：

- `Candidate`
- `Job`
- `Application`
- `File` 或 `Material` 主档
- 主档 ID、状态和基础关联关系
- 跨系统稳定引用所需的标准字段

其他子系统不得自行创建另一份 Candidate、Job 或 Application 作为事实来源。

### 4.2 JD 子系统

JD 子系统负责：

- JD 草稿；
- JD 解析过程；
- 岗位内容版本；
- Criteria 草稿和确认记录；
- 岗位创建与编辑界面；
- JD 侧的操作历史。

JD 创建岗位时，应调用 Core Record API 创建或更新 `Job`，而不是在 `jd` Schema 内再维护一份独立 Job 主档。

### 4.3 Screening 子系统

Screening 子系统负责：

- 候选人导入和材料消费记录；
- 岗位推荐；
- Pre-link Match；
- Screening Session；
- Screening Evaluation；
- Evidence、Concern、Verification Item；
- Candidate Comparison；
- Screening Decision；
- Handoff Package；
- Delivery Attempt 和 Receipt；
- Screening 侧审计和运行历史。

Screening 可以保存必要的只读投影，例如：

```text
candidate_id
job_id
application_id
display_name_snapshot
job_title_snapshot
```

但这些字段只是展示或计算用的投影，不是主档事实，也不能反向修改 Core Record。

### 4.4 Assessment 子系统

Assessment 子系统负责：

- 测评模板；
- 测评版本；
- 测评实例；
- 测评邀请；
- 测评答卷；
- 测评评分和结果；
- 测评供应商回执。

Assessment 通过 `candidate_id`、`job_id`、`application_id` 引用主档，但不拥有这些主档实体。

### 4.5 Interview 子系统

Interview 子系统负责：

- 面试流程；
- 面试轮次；
- 面试场次；
- 面试官分配；
- 面试评分表；
- 面试反馈；
- 面试录音、转写和相关产物引用。

Interview 不应直接修改 Screening 的评估或决定，也不应直接写 Core Record 的业务结果。跨系统状态变化通过 API 或标准事件完成。

### 4.6 Offer 子系统

Offer 子系统负责：

- Offer 草稿；
- 薪资和条款版本；
- 审批；
- 发送；
- 候选人响应；
- Offer 状态和回执。

Offer 可以读取 Candidate、Job 和 Application 的主档信息，但不能把自己的 Offer 数据写入 Core Record 的主档表。

## 5. 三条数据访问路径

每个业务子系统访问数据只能有三种路径。

### 路径一：读写自己的私有数据

```text
Screening Service
    └── 直连 screening schema
```

这是本地事务路径，不经过事件总线。

### 路径二：访问统一主档

```text
Screening Service
    └── Core Record API
          └── core_record schema
```

子系统拿不到 Core Record 数据库连接，也不应直接查询 Core Record 表。

### 路径三：通知其他系统发生变化

```text
Screening Service
    └── Event Bus
          ├── Assessment
          ├── Interview
          ├── Offer
          └── Timeline / Task
```

事件只携带稳定 ID、变更摘要和必要的版本信息，不携带大量主档正文或敏感材料。

## 6. 数据访问规则

必须遵守以下规则：

| 规则 | 要求 |
|---|---|
| 私有表写入 | 只能由所属子系统写入 |
| 主档写入 | 只能由 Core Record Service 写入 |
| 跨系统调用 | 通过 API 或事件，不直接查对方表 |
| 事件用途 | 通知变化、驱动投影和异步任务 |
| 本地事务 | 子系统自己的事实必须先落自己的 Schema |
| 事件可靠性 | 业务写入与 Outbox 事件发布保持一致 |
| 历史结果 | 评估、决定、偏好和 Package 采用追加版本，不覆盖历史 |
| 跨系统引用 | 使用稳定的 `candidate_id`、`job_id`、`application_id` |
| 权限隔离 | 每个子系统使用独立数据库角色 |

## 7. 事件和队列的区别

事件总线和任务队列可以共用 Redis 基础设施，但语义不同。

### Queue

Queue 表示一项任务只由一个消费者处理一次，例如：

- 简历解析；
- 文件导入；
- 发送邮件；
- 生成报告；
- 重试失败任务。

任务完成后通常从队列消费掉，但任务状态应保存在对应子系统数据库中。

### Event Bus

Event Bus 表示一件业务事实发生，允许多个系统订阅和重放，例如：

- `job.confirmed`
- `screening.completed`
- `screening.decision_made`
- `candidate.advanced`
- `screening.handoff.receipted`

事件不应代替主档写入，也不应作为唯一事实来源。

## 8. 当前项目与目标架构的差距

当前 `hireos-screening/job-Resume-Screening-backend` 属于早期演进阶段：

```text
一个 NestJS 进程
一个 PostgreSQL 数据库
默认使用 public schema
Candidate、Job、Application、Screening 数据暂时在同一个 schema
```

这是 Phase 0 至 Phase 7 的合理过渡实现，目的是先验证业务流程和 API 契约。

但它还没有完全达到最终组合架构，主要差距包括：

- Core Record Service 尚未独立；
- Screening 还直接持有 Candidate、Job、Application 的表；
- 子系统 Schema 尚未真正拆分；
- 事件总线和 Outbox/Inbox 尚未完成；
- 当前开发认证仍是本地身份；
- 外部 Assessment、Interview、Offer 尚未真实接入。

## 9. 推荐迁移路线

### 阶段一：先冻结数据所有权

在当前数据库结构不大时，先明确每张表的 owner：

```text
Candidate / Job / Application / Material
    -> Core Record

ScreeningEvaluation / ScreeningDecision / HandoffPackage
    -> Screening
```

即使暂时仍在同一个 `public` Schema，也不允许新代码跨模块直接写表。

### 阶段二：引入 Core Record Service

先将以下能力抽成 Core Record API：

- 创建和更新 Candidate；
- 创建和更新 Job；
- 创建和更新 Application；
- 查询 Candidate、Job、Application；
- 材料主档和文件引用；
- 主档状态变更；
- 稳定 ID 和版本校验。

Screening 的写入逻辑改为调用 Core Record API。

### 阶段三：迁移 Schema

将 Screening 私有表迁移到 `screening` Schema：

- screening sessions；
- screening evaluations；
- dimensions；
- concerns；
- verification items；
- comparisons；
- decisions；
- packages；
- delivery attempts；
- receipts。

随后限制 Screening 数据库角色，禁止其写入 Core Record 表。

### 阶段四：接入 Outbox/Inbox 和事件总线

每个子系统本地事务中同时写入：

```text
业务表
Outbox 表
```

由发布器将 Outbox 事件发送到事件总线。消费者使用 Inbox 或消费位点实现：

- 幂等；
- 重试；
- 乱序检测；
- 失败恢复；
- 事件重放。

### 阶段五：按压力和合规要求拆库

只有在出现以下需求时才拆成独立数据库：

- 子系统需要独立扩缩容；
- 数据驻留或租户隔离要求不同；
- 迁移和发布节奏差异明显；
- 查询负载互相影响；
- 需要独立备份和恢复；
- 团队边界已经稳定。

## 10. 对当前 Screening 项目的直接建议

当前不建议立即建立五个 PostgreSQL 实例，也不建议立刻把所有代码拆成微服务。

建议按以下顺序推进：

1. 保持当前一个 PostgreSQL 实例；
2. 在代码层冻结 Core Record 与 Screening 的数据所有权；
3. 给 Screening 私有表增加明确的模块前缀或迁移目标；
4. 把 Candidate、Job、Application 的写入集中到 Core Record 模块；
5. 引入 Outbox 事件表；
6. 再将 Screening 私有表迁移到 `screening` Schema；
7. 后续 Assessment、Interview、Offer 按相同方式接入。

最终判断标准不是“数据库服务器有几个”，而是：

- 谁拥有数据；
- 谁可以写数据；
- 谁通过 API 访问主档；
- 谁通过事件通知变化；
- 是否可以在不修改其他子系统业务代码的情况下独立发布。

## 11. 最终架构摘要

```text
统一工作台 / Shell
        │
        ├── JD Service
        ├── Screening Service
        ├── Assessment Service
        ├── Interview Service
        └── Offer Service
                │
                ├── 各自私有 Schema
                ├── Core Record API
                ├── Event Bus
                ├── Queue
                ├── Object Storage
                └── Audit / Timeline

PostgreSQL：
  可以先共用一个实例；
  必须按 Schema、角色和所有权隔离；
  主档由 Core Record 独占写入。
```

