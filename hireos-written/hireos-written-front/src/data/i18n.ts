/**
 * UI-chrome translation table, ported verbatim from the prototype's `I18N_ZH`
 * map (docs/hireos-assessment-prototype.html). Usage mirrors the prototype's
 * `t(sourceString)` call: pass the literal English source string used in JSX
 * and get back its Chinese translation when `state.lang === "zh"`, else the
 * source string unchanged. A handful of keys collided in the original object
 * literal (JS takes the last one); those are resolved here the same way.
 */
export const ZH: Record<string, string> = {
  "My Tasks": "我的任务", "My Focus": "我的关注", "Task Feed": "任务动态", "Assessments": "测评项目", "Jobs": "职位",
  "Overview": "概览", "Question Bank": "题库", "Comparisons": "候选人对比", "Files & Integrations": "文件与集成",
  "Settings": "设置", "Workspace": "工作区", "Command": "指挥台", "Assessment (embedded)": "测评（嵌入模式）",
  "HireOS · Written Test": "HireOS · 笔试测评", "Written Test": "笔试测评",
  "Search projects, candidates...": "搜索项目、候选人…", "Toggle navigation": "切换导航", "Search": "搜索",
  "Notifications": "通知", "Appearance": "外观", "Demo tools": "演示工具", "Switch demo role": "切换演示角色",
  "Standalone entry": "独立入口", "Workspace Shell": "工作区壳层", "Demo role": "演示角色",
  "Language": "语言",

  "My Work": "我的工作台", "Signed in as": "当前登录：", "Accessible workspace": "可访问的工作区",
  "As of": "截至", "scope:": "范围：", "workspace": "工作区", "restricted (see P21)": "受限（见 P21）",
  "My open tasks": "我的待办任务", "Unique task_id, open/in_progress/waiting": "去重后的任务数，含未开始/进行中/等待中",
  "Reviews awaiting me": "待我评审", "Same filter as list view": "与列表视图筛选条件一致", "Due today": "今日截止",
  "Available to claim": "可认领", "Active projects": "进行中项目", "Awaiting acceptance": "待接受邀请",
  "Awaiting submission": "待提交", "Submission issues": "提交异常", "Results to release": "待发布结果",
  "Delivery issues": "交付问题", "Unavailable": "不可用", "More statistics": "更多统计", "Tasks": "任务",
  "Assigned to me": "分配给我", "Team Tasks": "团队任务", "Created or followed": "由我创建或关注",
  "Completed": "已完成", "Nothing here.": "暂无内容。", "No action cards for you right now.": "当前没有需要你处理的事项。",
  "Claim": "认领", "Start": "开始", "Wait": "等待", "Resume": "继续", "Open →": "打开 →", "Due": "截止",
  "Waiting:": "等待原因：", "Source:": "来源：", "Assigned to": "负责人：", "Last handled by": "最近处理人：",
  "Startup Team Access: any valid employee can open and directly work these tasks — no claiming or manager approval required. The original assignee stays on record and is notified when you act.":
    "初创团队权限：任何在职员工都可以直接打开并处理这些任务——无需认领或经理审批。原负责人仍会保留在记录中，你操作时会收到通知。",

  "Open": "待处理", "In progress": "进行中", "Waiting": "等待中", "Cancelled": "已取消",
  "Accepted": "已接受", "Started": "已开始", "Submitted": "已提交", "Incomplete": "信息不全",
  "Needs confirmation": "待确认", "Quarantined": "已隔离", "Duplicate": "重复项",
  "Final": "已定稿", "AI draft — not final": "AI 草稿 — 未定稿", "Draft": "草稿",
  "Active": "进行中", "Evaluated": "已评估", "Review pending": "待评审", "Issue open": "存在问题",
  "Concept": "构思中", "In review": "评审中",
  "Internal only": "仅限内部", "Final — not released": "已定稿 — 未发布", "Awaiting confirmation": "待确认",
  "Released": "已发布", "Linked — no plan yet": "已关联 — 尚无方案",
  "Planned": "已规划", "Ready to release": "可发布", "Invited": "已邀请",

  "Result release": "结果发布", "Evaluation review": "评估评审", "Submission issue": "提交异常",
  "Reviewer queue": "评审队列", "Plan review": "方案评审", "Delivery recovery": "交付恢复",

  "Reusable questions, mapped to multiple roles and competencies. Publishing a case does not send it — invitations are a separate step.":
    "可复用的题目，已映射到多个岗位与能力项。发布案例并不会自动发送——邀请候选人是单独的一步。",
  "Search title or code…": "按标题或编号搜索…", "All roles": "全部岗位", "All competencies": "全部能力项",
  "Import ZIP": "导入 ZIP", "Create question": "新建题目", "Code": "编号", "Title": "标题", "Role tags": "岗位标签",
  "Competencies": "能力项", "Type": "类型", "Difficulty": "难度", "Version": "版本", "Status": "状态",
  "No questions match these filters.": "没有符合当前筛选条件的题目。",
  "ZIP file": "ZIP 文件",
  "On confirm, this demo will show a parsed preview: 1 prompt, 2 materials, 1 internal answer key. Old candidate submissions found inside a ZIP are never re-exported.":
    "确认后，本演示会展示解析预览：1 个题目、2 份材料、1 份内部评分标准。ZIP 中发现的旧候选人提交内容不会被重新导出。",
  "Parse (demo)": "解析（演示）",

  "Question not found.": "未找到该题目。", "Preview candidate view": "预览候选人视图", "Edit / Builder": "编辑 / 编排器",
  "Prompt": "题目描述", "Materials": "材料", "Rubric": "评分标准", "Usage": "使用情况", "Versions": "版本记录",
  "Required deliverables": "要求提交的内容", "None specified": "未指定",
  "No materials attached.": "未附加材料。", "Candidate-visible materials": "候选人可见的材料", "Preview": "预览",
  "Reviewer only — never shown to candidates.": "仅评审可见 — 候选人永远看不到。",
  "of overall": "占总分比例", "Internal answer key": "内部评分标准", "(Reviewer only):": "（仅评审可见）：",
  "Used in cases": "已用于案例数", "Candidates who have seen this version": "已看到此版本的候选人数",
  "Role mappings": "关联岗位数", "Mapped roles:": "关联岗位：",
  "Current": "当前版本", "Earlier revision": "历史版本", "Superseded": "已被取代",
  "will block publish.": "—— 将阻止发布。", " OK.": " 无误。",
  "Candidate preview —": "候选人预览 —",
  "This is exactly what the candidate will see — no rubric, internal notes, or answer key.": "这与候选人实际看到的内容完全一致 —— 不含评分标准、内部备注或评分要点。",
  "What to submit": "需要提交的内容", "None": "无",

  "Builder —": "编排器 —",
  "Editing creates a new derived version. Sent invitations always keep the exact version they were sent with.":
    "编辑会生成一个新的派生版本。已发送的邀请始终保留其发送时的确切版本。",
  "Draft the assessment before inviting candidates. Prompt, materials and rubric are not yet defined for this concept.":
    "邀请候选人前请先完成测评草拟。此构思尚未定义题目描述、材料与评分标准。",
  "Sections": "章节", "Prompt & materials": "题目与材料", "Deliverables": "交付物",
  "Competency allocation": "能力项分配", "Quality review": "质量审查",
  "AI generate": "AI 生成", "Requirement → competency → evidence needed → blueprint → question → rubric.": "需求 → 能力项 → 所需证据 → 蓝图 → 题目 → 评分标准。",
  "Generate draft rubric": "生成草拟评分标准", "Generating… (demo latency)": "生成中…（演示延迟）",
  "Generation failed (simulated timeout).": "生成失败（模拟超时）。", "Retry": "重试",
  "Competency allocation (criterion fraction)": "能力项分配（各项占比）",
  "Multi-competency questions split credit by criterion. Fractions must sum to exactly 100% — no double-scoring.":
    "涉及多项能力的题目按各项占比分配分数。占比之和必须恰好为 100% —— 不可重复计分。",
  "Remove": "移除", "Fractions sum to 100%. Ready to publish.": "占比之和为 100%，可以发布。",
  "+ Add competency": "+ 添加能力项", "New competency": "新能力项",
  "Publish preview": "发布预览",
  "Quality review flagged: competency weights need redistribution before this can publish cleanly.":
    "质量审查提示：发布前需要重新分配能力项权重。",
  "Save & publish new version": "保存并发布新版本", "Save draft (not published)": "保存草稿（未发布）",

  "Import": "导入", "Create project": "新建项目",
  "Required:": "必修：", "Optional:": "选修：", "Secondary role:": "次要岗位：",
  "Candidates": "候选人数", "Issues open": "存在问题",
  "Other open roles at LinX Technology": "LinX Technology 其他在招岗位",
  "Sourced from the org's job description compilation (VietnamWorks + internal records) — not yet piloting the Assessment module.":
    "来源于公司职位描述汇编（VietnamWorks + 内部记录）—— 尚未在测评模块中试点。",
  "Job ID": "职位编号", "No job link on file": "暂无职位链接记录",
  "Draft a project from this JD": "根据此职位描述创建项目草稿",

  "Project not found.": "未找到该项目。",
  "Compare candidates": "候选人对比", "Select from screened candidates": "从已初筛候选人中选取", "Add candidate": "添加候选人",
  "Required case FIN-001 · Optional FIN-002 · Secondary role mapping demo via FIN-004/FIN-008 (Strategic Investment Associate)":
    "必修案例 FIN-001 · 选修 FIN-002 · 次要岗位映射演示：FIN-004/FIN-008（Strategic Investment Associate）",
  "Candidate": "候选人", "Application": "申请", "Plan": "方案", "Score": "分数",
  "Confirmed link": "已确认关联", "Confirm the candidate's role link first": "请先确认候选人的岗位关联",
  "Answers uploaded, awaiting submission": "答案已上传，待提交", "Open plan →": "打开方案 →",

  "A new public Candidate record is created first, then linked to this role — no per-module candidate account is created.":
    "系统会先创建一个新的公共候选人记录，再与该岗位关联 —— 不会为每个模块单独创建候选人账户。",
  "Full name": "姓名", "Email (fictional demo domain)": "邮箱（虚构演示域名）",
  "Create candidate (Core)": "创建候选人（核心系统）",
  "exists in Core but has no confirmed hiring relationship yet. A formal invitation cannot be sent until this is confirmed by a person — receiving an email never creates this link automatically.":
    "已存在于核心系统中，但尚未确认招聘关系。在有人确认此关联之前，无法发送正式邀请 —— 收到邮件不会自动创建该关联。",
  "Proposed role:": "拟定岗位：", "Confirm link → create Application": "确认关联 → 创建申请",
  "is already linked to this role.": "已与该岗位关联。", "Open plan": "打开方案",
  "These candidates already have a Screening result for": "以下候选人已有针对该岗位的初筛结果：",
  ". Picking one reuses that shared record and result — no résumé re-upload or repeated role confirmation.":
    "。选择其中一位会复用其共享记录与结果 —— 无需重新上传简历或重复确认岗位关联。",
  "No unassigned screened candidates for this role right now.": "该岗位目前没有未分配的已初筛候选人。",
  "Screening:": "初筛结果：", "screened": "初筛于",
  "Create assessment plan": "创建测评方案", "Select at least one candidate first.": "请先至少选择一位候选人。",

  "Case not found.": "未找到该案例。", "'s plan": "的方案",
  "Confirm the candidate's role link first — invitations for a formal role assessment require a confirmed Application.":
    "请先确认候选人的岗位关联 —— 正式岗位测评邀请需要已确认的申请记录。",
  "Answers uploaded — awaiting candidate submission. The attempt is still in progress and has not been scored; HR owner and Hiring manager were notified.":
    "答案已上传 —— 等待候选人提交。此次作答仍在进行中且尚未评分；HR 负责人与用人经理已收到通知。",
  "Ownership": "责任人", "Routes notifications only — not required to act (Startup Team Access)": "仅用于通知路由 —— 并非行动前提（初创团队权限）",
  "HR owner": "HR 负责人", "Hiring manager": "用人经理", "Review assignee": "评审负责人",
  "— Not set (defaults to initiator) —": "— 未设置（默认为发起人）—",
  "No HR owner or Hiring manager set — this doesn't block sending; the initiator is the default contact.":
    "尚未设置 HR 负责人或用人经理 —— 这不会阻止发送；发起人将作为默认联系人。",
  "Plan structure": "方案结构", "Single round": "单轮次", "Multiple rounds": "多轮次",
  "+ Add round": "+ 添加轮次",
  "Release condition": "发布条件", "Manual release": "手动发布",
  "After previous round is submitted": "上一轮提交后", "After previous round is reviewed": "上一轮评审完成后",
  "Round 1 has no previous round to depend on.": "第 1 轮没有可依赖的上一轮。",
  "Deadline": "截止时间",
  "Not ready to release yet —": "尚未满足发布条件 ——",
  "You can still plan and add tests; sending is blocked until the condition is met.": "你仍可以规划方案与添加测试；条件满足前无法发送。",
  "No plan items in this round yet. Add a test to get started.": "此轮次尚无方案项。添加一项测试即可开始。",
  "Add test": "添加测试", "Approve plan": "批准方案",
  "Invite candidate": "邀请候选人",
  "Add at least one test first": "请先添加至少一项测试",
  "History": "历史记录",
  "Invitations": "邀请记录", "Invitation": "邀请记录",
  "min timed": "分钟限时", "Deadline only": "仅设截止时间", "deadline": "截止",
  "View submission →": "查看提交 →", "Add from Question Bank": "从题库中添加",

  "Invite candidates": "邀请候选人",
  "Recipients": "收件人", "Tests & materials": "测试与材料", "Timing & submission": "时间与提交",
  "Result disclosure": "结果披露", "Review & send": "审核并发送",
  "Back": "上一步", "Continue": "继续", "Save draft & exit": "保存草稿并退出",
  "newly added to this batch": "本批次新添加", "No recipients yet.": "暂无收件人。",
  "+ Add Priya Kapoor (demo, new candidate)": "+ 添加 Priya Kapoor（演示，新候选人）",
  "Each recipient must already have a confirmed role link (Core Application) before they can appear here.":
    "每位收件人必须已有确认的岗位关联（核心系统申请记录）才能出现在此处。",
  "No plan items found for these recipients — add a test from the Question Bank on their plan page first.":
    "未找到这些收件人的方案项 —— 请先在其方案页面从题库中添加一项测试。",
  "Est.": "预计", "Materials:": "材料：", "none": "无",
  "Estimated candidate workload shown per test; total varies by which tests each recipient's plan includes.":
    "系统按每项测试展示候选人预计工作量；总量因各收件人方案中包含的测试而异。",
  "Mode": "模式", "Timed": "限时", "Duration once started (minutes)": "开始后的时长（分钟）",
  "Submission channel": "提交渠道",
  "Portal upload (draft until Submit)": "门户上传（提交前均为草稿）", "and": "以及",
  "email reply from the verified address to the unified inbox. Complete answers sent from the verified email in the correct thread can be submitted automatically:":
    "从已验证邮箱回复到统一收件箱。从已验证邮箱在正确邮件串中发送的完整答案可自动提交至：",
  "(From/Reply-To — simulated only, no real mail is sent).": "（发件人/回复地址 —— 仅为模拟，不会发送真实邮件）。",
  "Score + summary": "分数 + 摘要", "Summary only (no numeric score)": "仅摘要（不含具体分数）",
  "Never includes internal ranking, reviewer notes, or the internal answer key.": "不包含内部排名、评审备注或内部评分标准。",
  "Preview shown per recipient: template, question package version, estimated workload, timezone":
    "以下按收件人展示预览：模板、题目包版本、预计工作量、时区",
  "and Reply-To.": "及回复地址。",
  "Disclosure:": "披露方式：", "Summary only": "仅摘要",
  "From / Reply-To:": "发件人 / 回复地址：", "(simulated)": "（模拟）",
  "Send invitations (demo)": "发送邀请（演示）",
  "Delivery": "发送情况", "Sent": "已发送", "Simulated bounce": "模拟退信",

  "Submission Inbox": "提交收件箱",
  "Task and status match first; email plumbing (Message-ID, DKIM/SPF, hash) lives in Details for Operations.":
    "任务与状态匹配优先展示；邮件底层信息（Message-ID、DKIM/SPF、哈希）在“运维详情”中查看。",
  "Unknown sender": "未知发件人",
  "From": "发件人", "Received": "已收到", "(trusted receipt time)": "（可信接收时间）", "Match": "匹配依据",
  "Attachments": "附件", "Missing:": "缺失：", "Request missing files": "请求补交文件",
  "do not auto-confirm on subject/name alone.": "不要仅凭主题/姓名自动确认。",
  "Confirm assignment": "确认归属", "Not a match": "不匹配",
  "Sender authentication failed and attachment type is restricted (macro-enabled). Held for Operations review — not auto-processed.":
    "发件人身份验证失败，且附件类型受限（含宏）。已转交运维审查 —— 不会自动处理。",
  "Technical details": "技术细节",

  "Attempt not found.": "未找到该次作答。", "round": "第", "Processed": "处理时间",
  "Original archive": "原始压缩包",
  "Identity & round match": "身份与轮次匹配", "Candidate:": "候选人：", "Round:": "轮次：",
  "Task binding: confirmed": "任务绑定：已确认",
  "Go to evaluation →": "前往评估 →",

  "No evaluation yet for": "尚无评估：", "Back to Submission Inbox": "返回提交收件箱",
  "This submission is incomplete — resolve the missing deliverable before scoring.": "该提交尚不完整 —— 请先补齐缺失的交付物再评分。",
  "Evidence has not finished processing.": "证据尚未处理完成。",
  "evaluation": "评估", "Overall (human)": "总分（人工）", "Any missing required criterion → Unknown": "任一必评项缺失 → 未知",
  "Overall (AI)": "总分（AI）", "Draft only, not a hiring probability": "仅为草拟分数，非录用概率",
  "Coverage / Confidence": "覆盖度 / 置信度", "Full": "完整", "Partial": "部分", "Shown separately from score": "与分数分开展示",
  "Criteria": "评分项", "max": "满分", "Human": "人工", "Confidence:": "置信度：", "Coverage:": "覆盖度：",
  "High": "高", "Medium": "中", "Low": "低",
  "View evidence": "查看依据",
  "Override reason (required — old AI value stays visible in history)": "修改理由（必填 —— 历史记录中仍会保留原 AI 分数）",
  "Accept all AI scores": "采纳全部 AI 评分", "Re-run AI (demo)": "重新运行 AI（演示）",
  "Finalize evaluation": "定稿评估",

  "No finalized result for this case yet.": "该案例尚无已定稿的结果。",
  "Release": "结果发布", "Internal reference": "内部参考", "overridden": "已修改",
  "Finalized by": "定稿人：", "Candidate preview": "候选人预览侧", "Disclosure policy:": "披露策略：",
  "Outcome:": "结论：", "Strong performance on this assessment.": "本次测评表现优异。",
  "Below the bar for this role on this assessment.": "本次测评未达到该岗位的要求标准。",
  "Score:": "分数：", "Feedback:": "反馈：",
  "Clear structure; accounting treatment mostly correct with one gap in variance analysis.": "结构清晰；会计处理大体正确，差异分析部分存在一处不足。",
  "Next step:": "下一步：", "HR will follow up with next steps.": "HR 将跟进后续步骤。",
  "Never includes: internal ranking, reviewer notes, or the internal answer key.": "绝不包含：内部排名、评审备注或内部评分标准。",
  "Approve & publish": "批准并发布", "Internal review complete": "内部评审已完成",
  "Disclosure content approved for release": "披露内容已批准发布", "Finalize & publish result": "定稿并发布结果",
  "Published": "已发布",
  "Delivery does not guarantee delivery — a bounce would still leave the result visible internally.":
    "发布不等于送达 —— 即便退信，结果在内部仍然可见。",
  "Next action": "下一步操作",
  "A proposal is prepared first; sending only happens after approval — sorting or comparing candidates never triggers a send.":
    "系统会先准备好方案；只有获批后才会发送 —— 排序或对比候选人本身不会触发发送。",
  "Request revision": "请求修改", "Add supplemental test": "添加补充测试",
  "Prepare Interview handoff": "准备面试交接", "Hold": "暂缓", "Close testing": "结束测评",
  "Revision round": "修改轮次", "requested — candidate has been notified.": "已发起 —— 候选人已收到通知。",
  "Open revision workspace →": "打开修改工作区 →",
  "Feedback shown to candidate": "展示给候选人的反馈", "New deadline": "新截止时间",
  "The prior round stays locked and visible; this creates a new round with its own invitation and thread.":
    "上一轮保持锁定并可见；本操作会创建一个拥有独立邀请与邮件线程的新轮次。",
  "Send revision request (demo)": "发送修改请求（演示）",

  "Revision": "修改", "Not yet accepted by candidate": "候选人尚未接受",
  "Not comparable yet — no revised answers received. Original stays available below.": "暂时无法对比 —— 尚未收到修改后的答案。下方仍可查看原始版本。",
  "Not comparable — awaiting revised submission.": "暂时无法对比 —— 等待修改后的提交。",
  "Improved": "有提升", "No change": "无变化",
  "Original": "原始版本", "Feedback": "反馈", "Revised": "修改后",
  "Approve revised scores": "批准修改后的分数",

  "Delivery not found.": "未找到该交付记录。", "Handoff": "交接", "Handoff to": "交接至",
  "Interview not enabled in this workspace — export still works; nothing here is a real cross-service call.":
    "本工作区尚未启用 Interview 模块 —— 导出功能仍可使用；此处不涉及任何真实的跨系统调用。",
  "Advance next step (demo)": "推进下一步（演示）", "Export report-only package": "导出仅报告版数据包",
  "Result finalized": "结果已定稿", "Preparing shared artifact": "正在准备共享文件",
  "File ready": "文件已就绪", "Event queued": "事件已排队",
  "Intake received": "已接收", "Imported": "已导入",

  "New comparison": "新建对比",
  "Comparison not found.": "未找到该对比记录。", "Compare": "对比详情", "Refresh": "刷新", "Export": "导出",
  "Current summary": "当前摘要", "Same stage": "同一阶段", "Changes since last round": "较上一轮的变化",
  "Both results are final and directly comparable.": "两份结果均已定稿，可以直接对比。",
  "One or more results are AI-draft, not final — shown for reference only. No clear overall leader can be claimed across different evaluation stages.":
    "至少一份结果仍为 AI 草拟、尚未定稿 —— 仅供参考。不同评估阶段之间不能直接判定总体领先者。",
  "Key differences": "主要差异", "Unknown": "未知",
  "Dimension": "维度", "Overall": "总分", "AI draft": "AI 草稿", "Not provided": "未提供",

  "Drag files here, or": "将文件拖到此处，或", "browse": "浏览",
  "— registers a FileVersion, not a per-module copy.": "—— 会登记为一个文件版本，而非各模块各自留存一份副本。",
  "File": "文件", "Size": "大小", "Used by": "使用于",
  "Attempt": "作答记录", "Question material": "题目材料", "Unassigned": "未分配",
  "Download": "下载",
  "last sync": "上次同步", "Reauthorize": "重新授权", "Auth required": "需要重新授权",
  "Read now": "立即读取", "Pause": "暂停", "Connected": "已连接",
  "Files": "文件", "Connections": "连接", "Activity": "动态",

  "Theme": "主题", "Accent": "强调色", "Text size": "文字大小",
  "Light": "浅色", "Dark": "深色", "Deep": "深邃", "System": "跟随系统",
  "Blue": "蓝色", "Teal": "青色", "Violet": "紫罗兰",
  "Small": "小", "Large": "大",
  "Applies instantly across tables, menus, evidence highlights and overlays. Saved for this account":
    "会立即应用到表格、菜单、证据高亮与弹层中。设置已保存到当前账户",
  "— demo uses local storage, not real cloud sync across devices.": "（演示版使用本地存储，并非跨设备的真实云同步）。",
  "Reset to defaults": "恢复默认设置", "Done": "完成",

  "Preferences": "偏好设置", "AI Models": "AI 模型",
  "Organization and Team layers govern official scoring. Personal views never change team results. Appearance (theme, accent, text size) lives in the":
    "组织层与团队层决定正式评分规则。个人视图不会改变团队结果。外观设置（主题、强调色、文字大小）位于顶部工具栏的",
  "icon in the top bar.": "图标中。",
  "Team access policy — Startup Team Access": "团队访问策略 —— 初创团队权限",
  "Any valid, active employee of this workspace can create/edit/publish questions, plan, invite, score/override, finalize/release, revise, supplement, hand off, export and resolve exceptions — HR, Hiring Manager, owner and reviewer fields route notifications and default follow-ups, but they are not access-control gates. There is no approval queue and no dual sign-off; sending or publishing is the acting employee's own confirmation, recorded as performed_by. Base limits still apply: valid company login, candidates see only their own tasks and published results, companies stay isolated, and deactivated accounts cannot act. See Team Tasks on":
    "本工作区内任何有效在职员工都可以创建/编辑/发布题目、制定方案、发送邀请、评分/修改、定稿/发布、请求修改、补充测试、交接、导出并处理异常 —— HR、用人经理、责任人与评审人字段仅用于路由通知和默认跟进，并非访问控制关卡。没有审批队列，也不需要双重签核；发送或发布即代表操作员工本人的确认，会以 performed_by 字段记录。基本限制依然适用：需要有效的公司登录，候选人只能看到自己的任务与已发布结果，各公司数据相互隔离，已停用账户无法操作。前往",
  "to act directly on a colleague's open work.": "上的团队任务，即可直接处理同事的未完成工作。",

  "Locked": "已锁定",
  "Feedback signals": "反馈信号", "from Interview outcomes and human overrides": "来自 Interview 结果与人工修改",
  "Feature": "特性", "Direction": "方向", "Strength": "强度", "Source": "来源", "Eligibility": "是否可用",
  "increase": "提升", "decrease": "降低",
  "Eligible": "可用", "Prohibited — excluded": "禁止 —— 已排除",
  "Proposed shared preferences": "拟议的共享偏好设置", "pending review — never auto-applied": "待审核 —— 绝不会自动生效",
  "No proposals pending.": "暂无待处理提案。",
  "Basis:": "依据：", "Sample size": "样本量",
  "Reject": "拒绝", "Activate new version": "启用新版本", "Awaiting Admin review": "等待管理员审核",
  "Version history": "版本历史", "Activated": "启用时间", "By": "操作人",
  "Roll back to this": "回滚到此版本",

  "All prices, latency and quality figures are sample data. Order: hard constraints → quality → cost/latency → published preference.":
    "所有价格、延迟与质量数据均为示例数据。优先级顺序：硬性约束 → 质量 → 成本/延迟 → 已发布的偏好设置。",
  "Task": "任务", "Primary": "主用模型", "Fallback": "备用模型", "Budget": "预算",
  "Nominal": "正常", "Fallback active": "已启用备用",
  "Sample data — no real vendor is called by this prototype.": "示例数据 —— 本原型不会调用任何真实供应商。",
};

export function translate(lang: "en" | "zh", source: string): string {
  if (lang !== "zh") return source;
  return ZH[source] ?? source;
}
