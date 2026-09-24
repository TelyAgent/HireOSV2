import type { Competency } from "../store/types";

export const COMPS: Competency[] = [
  {
    id: "dsd",
    name: "Distributed Systems Design",
    nameZh: "分布式系统设计",
    must: true,
    req: 4,
    w: 22,
    round: "r1",
    ai: 4,
    jd: "Designs services that scale horizontally, degrade gracefully, and make explicit trade-offs between consistency, availability and latency.",
    jdZh:
      "设计可横向扩展、优雅降级的服务，并能明确权衡一致性、可用性与延迟。",
    anchors: [
      "Names a pattern by rote without applying it.",
      "Applies one known pattern to a familiar shape of problem.",
      "Weighs two viable designs but stops short of naming the deciding trade-off.",
      "Compares designs and names the signal that would change the decision.",
      "Does that under failure conditions the interviewer introduces mid-answer.",
    ],
  },
  {
    id: "bed",
    name: "Backend Engineering Depth (Go / Java)",
    nameZh: "后端工程深度（Go / Java）",
    must: true,
    req: 4,
    w: 22,
    round: "r1",
    ai: 2,
    jd: "Writes and reviews production-grade backend code; understands concurrency, memory and performance characteristics of the primary language stack.",
    jdZh:
      "能够编写和评审生产级后端代码，并理解主要语言栈的并发、内存与性能特征。",
    anchors: [
      "Writes code that runs.",
      "Writes idiomatic code but explains concurrency by analogy.",
      "Diagnoses a concurrency bug after being shown symptoms.",
      "Independently root-causes a concurrency or memory issue with tooling.",
      "Predicts a performance characteristic before measuring it, then confirms it.",
    ],
  },
  {
    id: "poir",
    name: "Production Ownership & Incident Response",
    nameZh: "生产环境责任与事故响应",
    must: true,
    req: 3,
    w: 18,
    round: "r2",
    ai: 3,
    jd: "Takes end-to-end ownership of services in production, including on-call, incident response and postmortems.",
    jdZh: "对生产服务承担端到端责任，包括值班、事故响应和事后复盘。",
    anchors: [
      "Has been on a rotation, never driven a response.",
      "Follows a runbook during an incident someone else is driving.",
      "Drives an incident to mitigation and writes the postmortem.",
      "Ships the fix, tracks follow-ups to closure.",
      "Changes a system or process so the same class of incident cannot recur.",
    ],
  },
  {
    id: "sca",
    name: "Security & Compliance Awareness",
    nameZh: "安全与合规意识",
    must: true,
    req: 3,
    w: 13,
    round: "r2",
    ai: null,
    jd: "Applies least-privilege and data-handling practices; recognizes compliance-relevant decisions before they become incidents.",
    jdZh:
      "践行最小权限与数据处理规范，并在问题演变为事故前识别与合规相关的决策。",
    anchors: [
      'States the term "least privilege" without an example.',
      "Follows access rules set by someone else.",
      "Makes one concrete least-privilege or data-handling decision and explains why.",
      "Catches a compliance-relevant edge case before it ships.",
      "Shapes a team norm or review step that prevents a class of exposure.",
    ],
  },
  {
    id: "tc",
    name: "Technical Communication",
    nameZh: "技术沟通",
    must: false,
    req: 3,
    w: 13,
    round: "r1",
    ai: 4,
    jd: "Explains technical trade-offs clearly to varied audiences and checks understanding rather than assuming it.",
    jdZh:
      "能向不同受众清楚解释技术权衡，并主动确认理解，而非预设对方已经理解。",
    anchors: [
      "Explanation only makes sense to someone who already knows the answer.",
      "Explains correctly to a peer, loses a mixed audience.",
      "Explains clearly and checks understanding once.",
      "Adapts the explanation live when the audience is confused.",
      "Gets a mixed audience to a shared decision in one pass.",
    ],
  },
  {
    id: "cm",
    name: "Collaboration & Mentorship",
    nameZh: "协作与辅导",
    must: false,
    req: 3,
    w: 12,
    round: "r2",
    ai: 4,
    jd: "Works effectively across teams and helps raise the level of engineers around them.",
    jdZh: "能够跨团队高效协作，并帮助身边的工程师提升能力。",
    anchors: [
      "Works alone by default.",
      "Collaborates when asked, rarely initiates.",
      "Brings a data-backed disagreement to a partner team and resolves it.",
      "Actively adjusts approach to help a struggling teammate improve.",
      "Raises the practice of a whole team, not just one person.",
    ],
  },
];

export const R1_SCORES: Record<string, number> = {
  dsd: 4,
  bed: 4,
  tc: 4,
};

// STAR (Situation/Task/Action/Result) follow-up questions for the Interview Brief's
// business capability lane, one set per competency. The Brief only ever shows the first
// three stages (S/T/A) to keep each card compact — Result stays available for the live
// interview follow-up but isn't printed on the prep card.
export const BRIEF_STAR: Record<string, { en: [string, string][]; zh: [string, string][] }> = {
  dsd: {
    en: [
      ["SITUATION", "What system or service were you responsible for, and what made the situation difficult?"],
      ["TASK", "What outcome or reliability goal did you personally need to achieve?"],
      ["ACTION", "What design did you choose, and how did you weigh consistency, availability, and latency?"],
      ["RESULT", "What changed after launch, and what production evidence shows the design worked?"],
    ],
    zh: [
      ["背景", "你当时负责什么系统或服务？问题为什么复杂？"],
      ["任务", "你个人需要达成什么结果或可靠性目标？"],
      ["行动", "你选择了什么设计？如何权衡一致性、可用性和延迟？"],
      ["结果", "上线后带来了什么变化？有哪些生产数据证明设计有效？"],
    ],
  },
  bed: {
    en: [
      ["SITUATION", "What production issue or performance constraint were you facing?"],
      ["TASK", "What did you need to diagnose, improve, or deliver?"],
      ["ACTION", "Which tools and technical steps did you use to find and fix the root cause?"],
      ["RESULT", "What measurable impact did the fix have, and how did you prevent regression?"],
    ],
    zh: [
      ["背景", "你当时遇到什么生产问题或性能瓶颈？"],
      ["任务", "你需要诊断、改进或交付什么？"],
      ["行动", "你使用了哪些工具和技术步骤定位并修复根因？"],
      ["结果", "修复带来了什么可量化影响？你如何防止问题复发？"],
    ],
  },
  tc: {
    en: [
      ["SITUATION", "Who was the audience, and what made the technical topic hard to explain?"],
      ["TASK", "What decision or shared understanding did you need the audience to reach?"],
      ["ACTION", "How did you adapt the explanation and check whether people understood?"],
      ["RESULT", "What decision was made, and what happened because the communication worked?"],
    ],
    zh: [
      ["背景", "当时的听众是谁？这个技术主题为什么难以解释？"],
      ["任务", "你希望听众达成什么决策或共识？"],
      ["行动", "你如何调整解释方式，并确认对方真正理解？"],
      ["结果", "最终做出了什么决策？沟通有效带来了什么结果？"],
    ],
  },
  poir: {
    en: [
      ["SITUATION", "What incident happened, and what was the customer or system impact?"],
      ["TASK", "What were you accountable for during the response?"],
      ["ACTION", "What did you do to mitigate the incident and coordinate the response?"],
      ["RESULT", "What changed afterward, and which follow-up actions were closed?"],
    ],
    zh: [
      ["背景", "当时发生了什么事故？对客户或系统造成了什么影响？"],
      ["任务", "在事故响应中，你具体负责什么？"],
      ["行动", "你采取了哪些缓解措施？如何协调响应过程？"],
      ["结果", "事后系统或流程发生了什么变化？哪些后续行动已经关闭？"],
    ],
  },
  sca: {
    en: [
      ["SITUATION", "What data, access, or compliance-sensitive situation were you handling?"],
      ["TASK", "What security or privacy decision did you personally need to make?"],
      ["ACTION", "What access-control or data-handling steps did you take, and why?"],
      ["RESULT", "How did you verify the decision reduced exposure or met the requirement?"],
    ],
    zh: [
      ["背景", "你当时处理的是什么数据、权限或合规敏感场景？"],
      ["任务", "你个人需要做出什么安全或隐私决策？"],
      ["行动", "你采取了哪些权限控制或数据处理措施？为什么？"],
      ["结果", "你如何验证这个决策降低了暴露风险或满足了要求？"],
    ],
  },
  cm: {
    en: [
      ["SITUATION", "What collaboration or mentoring challenge was the teammate or partner facing?"],
      ["TASK", "What did you need to help the team or person accomplish?"],
      ["ACTION", "How did you adapt your approach when the first explanation or plan did not work?"],
      ["RESULT", "What improved for the teammate or team, and how do you know?"],
    ],
    zh: [
      ["背景", "当时同事或合作方遇到了什么协作或辅导难题？"],
      ["任务", "你需要帮助团队或这个人完成什么？"],
      ["行动", "当第一次解释或方案没有奏效时，你如何调整方法？"],
      ["结果", "同事或团队最终有哪些改善？你如何确认改善发生了？"],
    ],
  },
};

export const EVIDENCE: Record<string, import("../store/types").EvidenceItem[]> =
  {
    dsd: [
      {
        ref: "Round 1 answer to Q1",
        timecode: "00:04:12",
        source: "transcript",
        text: "Redesigned order-routing service from single-region to active-active across two regions, cutting P99 latency 40% and surviving a full region failover in production.",
        sourceText:
          "The one I'd point to is the order-routing service. It started single-region, and we redesigned it to active-active across two regions. We instrumented both paths and watched P99 during a regional failover drill; the strict path added about 40ms, but we never saw a double-charge.",
        tag: "Strong evidence",
      },
    ],
    bed: [
      {
        ref: "Round 1 answer to Q2",
        timecode: "00:11:47",
        source: "transcript",
        text: "Proposed a queue-based shock absorber plus autoscaling policy for the checkout spike scenario; correctly identified the database connection pool as the binding constraint.",
        sourceText:
          "First I'd put a queue-based shock absorber in front of checkout and scale consumers from queue depth. The first hard limit is the database connection pool, so I'd protect that with admission control before adding instances.",
        tag: "Strong evidence",
      },
      {
        ref: "Round 1 answer to Q4",
        timecode: "00:18:05",
        source: "transcript",
        text: "Described debugging a goroutine leak caused by a missing context cancellation in a fan-out call, including the pprof workflow used to find it.",
        sourceText:
          "In production we saw goroutines climb without CPU moving. I compared pprof snapshots and found a fan-out call whose child requests did not inherit context cancellation. We fixed the propagation, added a leak test, and watched the goroutine count flatten after deploy.",
        tag: "Strong evidence",
      },
      {
        ref: "Round 1, follow-up",
        timecode: "00:12:32",
        source: "transcript",
        text: "When asked to size the connection-pool trade-off precisely, gave a qualitative answer but could not estimate an order of magnitude.",
        sourceText:
          "I'd tune the pool against observed saturation and leave headroom for failover. I don't have a useful order-of-magnitude estimate without the current query latency and database limits.",
        tag: "Medium evidence",
      },
    ],
    poir: [
      {
        ref: "Round 2 answer to Q5 (manual notes)",
        source: "manual",
        text: "Led response to a P1 payment-webhook outage: identified a thundering-herd retry bug, shipped a jittered backoff fix, and authored a postmortem with three follow-up action items, all closed.",
        sourceText:
          "Candidate led the P1 response. Found the thundering-herd retry pattern, coordinated a jittered-backoff patch, then owned the postmortem and closed all three follow-up items.",
        tag: "Strong evidence",
      },
    ],
    sca: [
      {
        ref: "Round 2 answer to Q6 (manual notes)",
        source: "manual",
        text: 'Gave a generic answer about "following least privilege" for access control but could not describe a specific access-control decision she had personally made.',
        sourceText:
          "Said the team follows least privilege. Could not name a specific access-control decision she personally made or how she validated it.",
        tag: "Weak evidence",
      },
    ],
    tc: [
      {
        ref: "Round 1, general observation",
        timecode: "00:04:12–00:07:02",
        source: "transcript",
        text: "Explained a clear, well-structured trade-off narrative for the region-failover redesign, checking understanding with the panel before moving on.",
        sourceText:
          "The hardest trade-off was consistency versus latency on inventory holds during checkout. We accepted eventual consistency on non-critical counts but kept strict consistency on the hold-and-charge path. Does that level of detail answer what you were looking for?",
        tag: "Strong evidence",
      },
    ],
    cm: [
      {
        ref: "Round 2 answer to Q7 (manual notes)",
        source: "manual",
        text: "Walked a struggling peer through a database-migration write-up, but did not describe adjusting her approach when he stayed confused.",
        sourceText:
          "Walked a teammate through the migration write-up. No concrete example of changing the explanation or coaching method after the teammate remained blocked.",
        tag: "Medium evidence",
      },
    ],
    resume: [
      {
        ref: "Résumé",
        source: "resume",
        text: 'Résumé claims "led migration to microservices architecture" without specifying scope or personal contribution.',
        sourceText:
          "Led migration to microservices architecture, improving platform scalability and developer velocity.",
        tag: "Weak evidence",
      },
    ],
  };

export const LIVE_TRANSCRIPT = [
  {
    time: "00:03:41",
    speaker: "David Kim",
    text: "Let's start with system design. Walk me through a distributed system you designed end-to-end — what were the hardest trade-offs?",
  },
  {
    time: "00:04:12",
    speaker: "Elena Torres",
    text: "Sure — the one I'd point to is the order-routing service. It started single-region, and we redesigned it to active-active across two regions. The hardest trade-off was consistency versus latency on inventory holds during checkout.",
  },
  {
    time: "00:05:20",
    speaker: "Elena Torres",
    text: "We accepted eventual consistency on non-critical inventory counts but kept strict consistency on the actual hold-and-charge path, using a regional leader election for that slice only.",
  },
  {
    time: "00:06:48",
    speaker: "David Kim",
    text: "How did you validate that was the right line to draw?",
  },
  {
    time: "00:07:02",
    speaker: "Elena Torres",
    text: "We instrumented both paths and watched P99 during a real regional failover drill. The strict path added about 40ms but we never saw a double-charge.",
  },
  {
    time: "00:11:20",
    speaker: "David Kim",
    text: "Let's change gears — how would you evolve our checkout service to handle a 10x traffic spike during flash sales?",
  },
  {
    time: "00:11:47",
    speaker: "Elena Torres",
    text: "First I'd put a queue-based shock absorber in front of checkout and scale consumers from queue depth. The first hard limit is the database connection pool, so I'd protect that with admission control before adding instances.",
  },
  {
    time: "00:12:32",
    speaker: "Elena Torres",
    text: "I'd tune the pool against observed saturation and leave headroom for failover. I don't have a useful order-of-magnitude estimate without the current query latency and database limits.",
  },
  {
    time: "00:18:05",
    speaker: "Elena Torres",
    text: "In production we saw goroutines climb without CPU moving. I compared pprof snapshots and found a fan-out call whose child requests did not inherit context cancellation.",
  },
];