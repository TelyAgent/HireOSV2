# F01 线上缺陷 GitHub Issue 草稿与提交记录

本文件保留 2026-10-15 线上可见且可复现的九项问题的 Issue 正文草稿。用户已确认全部 AC；九项已提交 GitHub，提交时 `AI Ready=Yes` 并添加 `bug` 标签。用户决定 CSV 暂不支持，因此未创建 CSV 缺口 Issue。所有样本均为虚构资料。

提交记录：[1 / #160](https://github.com/TelyAgent/HireOSV2/issues/160) · [2 / #161](https://github.com/TelyAgent/HireOSV2/issues/161) · [3 / #162](https://github.com/TelyAgent/HireOSV2/issues/162) · [4 / #163](https://github.com/TelyAgent/HireOSV2/issues/163) · [5 / #164](https://github.com/TelyAgent/HireOSV2/issues/164) · [6 / #165](https://github.com/TelyAgent/HireOSV2/issues/165) · [7 / #166](https://github.com/TelyAgent/HireOSV2/issues/166) · [8 / #167](https://github.com/TelyAgent/HireOSV2/issues/167) · [9 / #168](https://github.com/TelyAgent/HireOSV2/issues/168)。[CSV 阶段决定](https://github.com/TelyAgent/HireOSV2/issues/160#issuecomment-6189064282)已记录在 GitHub。

共同测试环境：2026-10-15，Chrome，macOS，已登录 `https://hireos.aipollo.me/hireos/screening/library`；页面显示账号“蔡敏”，服务端角色和线上构建号未知。已登录 API、数据库、安全审计状态未核验。报告：[首次测试](Test_Report_2026-10-15.md)、[格式与异常路径复测](Test_Report_Format_Exception_2026-10-15.md)。

## 1. [Bug] F01 粘贴无姓名资料仍创建候选人

### Type

Bug

### Subsystem

hireos-screening

### Problem

线上将只有邮箱、地点、技能而没有姓名的粘贴资料成功入库，并把邮箱前缀推断为姓名 `Pia Noname`。错误身份进入后续档案和匹配流程，违反 F01 AC-5。

### User Outcome

招聘人员在提交前能确认姓名；缺少姓名的资料不会生成候选人。

### Scope

粘贴入口姓名识别、必填校验，以及服务端防绕过校验。

### Non-goals

CSV 导入；修改既有候选人档案；真实简历数据迁移。

### Acceptance Criteria

AC-1：粘贴仅含邮箱、地点和技能的资料时，姓名保持未填写并提示必填；提交被阻止，UI 刷新后及 API/数据库均无新候选人和成功导入项。
AC-2：粘贴含明确姓名的资料时可提交，档案姓名与用户确认的姓名一致；不得将邮箱本地部分自动作为已确认姓名。
AC-3：绕过前端直接提交无姓名粘贴资料时，服务端返回可识别的校验错误，不创建候选人；自动测试覆盖无姓名和正常姓名两种输入。

### References

`docs/product/Resume_Screening/F01_Intake_Import/PRD.md` FR-3、AC-5；`User_Cases.md` UC-F01-13；`Test_Report_2026-10-15.md` F01-LIVE-04。

### Dependencies

None；与本组 Issue 8 的预览交互可协同实现，但本 Issue 的服务端校验可独立验收。

### Risk

medium

### Owner

@JsonSuCoder

### AI Ready

Yes

### Reproduction

简历库→导入→粘贴；输入 `pia.noname.20261015@example.com`、地点和技能，不输入姓名；点击加入简历库。批次 `8c5ec940-0203-4052-a0ee-668e2d703fa1` 显示 1/1 成功；候选人 `f76a0404-2123-4270-abc9-47547c72f90f` 显示 `Pia Noname`。本次复现 1/1。

### Expected / Actual

预期：姓名必填，不保存。实际：自动生成姓名并成功建人。

### Environment

见本文件共同测试环境；[线上档案](https://hireos.aipollo.me/hireos/screening/candidates/f76a0404-2123-4270-abc9-47547c72f90f)。

### Severity

S2

## 2. [Bug] F01 粘贴导入被记录为手动上传来源

### Type

Bug

### Subsystem

hireos-screening

### Problem

两次线上粘贴导入后，候选人列表和简历版本均显示 `manual_upload`，不能追溯真实接入渠道，违反 FR-6。

### User Outcome

招聘人员能从候选人档案和导入记录准确辨认资料来自粘贴。

### Scope

粘贴来源的持久化、接口返回和界面展示；新导入资料的自动测试。

### Non-goals

CSV；修改历史记录的来源；邮箱、推荐和职位网站渠道。

### Acceptance Criteria

AC-1：通过粘贴入口成功导入的资料，服务端来源字段记录为 Paste，关联来源记录 ID 可追溯，列表和档案刷新后均显示粘贴来源。
AC-2：通过文件上传入口导入同类 TXT，来源仍为 Manual upload；自动测试区分两个入口。

### References

`docs/product/Resume_Screening/F01_Intake_Import/PRD.md` FR-6；`Test_Report_2026-10-15.md` F01-LIVE-02/04。

### Dependencies

None；如需调整来源枚举及跨服务 API，按仓库规则在同一 PR 内处理调用方和被调方。

### Risk

medium

### Owner

@JsonSuCoder

### AI Ready

Yes

### Reproduction

从粘贴入口提交含姓名的虚构资料；批次 `c8590296-c71c-4fa0-8426-563ff222d580` 成功。打开候选人 `0a1255a5-9ead-4d81-b3ae-9b7ca5822bf4` 及简历列表，来源显示 `manual_upload`；另一无姓名粘贴也相同。复现 2/2。

### Expected / Actual

预期：来源为 Paste。实际：来源为 `manual_upload`。

### Environment

见共同测试环境；[线上档案](https://hireos.aipollo.me/hireos/screening/candidates/0a1255a5-9ead-4d81-b3ae-9b7ca5822bf4)。

### Severity

S2

## 3. [Bug] F01 11 页 PDF 超出上限仍成功入库

### Type

Bug

### Subsystem

hireos-screening

### Problem

BR-2 规定最多 10 页，线上 11 页 PDF 被成功导入并创建候选人。超限输入进入下游处理，违反 AC-3。

### User Outcome

上传时获知页数超限，文件不进入简历库。

### Scope

PDF 页数服务端校验、逐项失败状态、用户可读原因与边界测试。

### Non-goals

更改 10 页上限；CSV；处理已入库超页记录的清理。

### Acceptance Criteria

AC-1：10 页且其余条件有效的 PDF 可正常继续导入；11 页 PDF 在创建候选人前被拒绝，批次项明确显示“超过 10 页”。
AC-2：绕过前端直接上传 11 页 PDF 时服务端同样拒绝；自动测试核对无候选人、无成功导入项。
AC-3：混合批次中超页文件失败不阻断其他合规文件。

### References

`docs/product/Resume_Screening/F01_Intake_Import/PRD.md` BR-2、AC-3；`Test_Report_Format_Exception_2026-10-15.md` F01-FMT-01。

### Dependencies

None。

### Risk

medium

### Owner

@JsonSuCoder

### AI Ready

Yes

### Reproduction

上传本地验证为 11 页的虚构 `UJ-TEST-F01-11-pages.pdf`（SHA-256 前 16 位 `5ace5a9bd1b02429`）；批次 `25b8cc1b-a16f-4ea3-85ac-9362635e3cac` 显示新候选人已入库，档案 `44903d86-12df-4693-b6f5-6cbab7162330` 可打开。复现 1/1。

### Expected / Actual

预期：超过 10 页被拒绝、不建人。实际：成功创建候选人。

### Environment

见共同测试环境；[线上档案](https://hireos.aipollo.me/hireos/screening/candidates/44903d86-12df-4693-b6f5-6cbab7162330)。

### Severity

S2

## 4. [Bug] F01 加密 PDF 显示为扫描件解析失败，隔离状态不可见

### Type

Bug

### Subsystem

hireos-screening

### Problem

本地确认加密的 PDF 在线上显示“无法从该扫描件中提取可读文本”“解析失败”“无需操作”，没有按 AC-10 展示隔离及加密原因。线上数据库安全状态尚未核验，因此现有证据证明的是用户可见的错误分类和隔离结果缺失，不能据此声称底层一定未隔离。

### User Outcome

用户明确知道文件因加密而被隔离，且不会进入 AI 和简历库。

### Scope

加密 PDF 识别、安全状态及原因、导入结果呈现、禁止下游处理的自动测试。

### Non-goals

解密文件；收集或存储密码；病毒扫描、宏检测；CSV。

### Acceptance Criteria

AC-1：上传带密码的有效 PDF 后，导入项显示隔离状态和加密原因，不使用“扫描件无法提取文字”文案。
AC-2：服务端安全状态记录为隔离，且该文件不创建候选人、不触发 AI；自动测试核对状态及副作用。
AC-3：未加密、可读 PDF 保持正常导入；纯图片扫描 PDF 继续走无可读文本的失败路径。

### References

`docs/product/Resume_Screening/F01_Intake_Import/PRD.md` FR-7、SEC-2、AC-3、AC-10；`Test_Report_Format_Exception_2026-10-15.md` F01-FMT-02。

### Dependencies

None；线上 Material、安全审计状态需在修复验收时核验。

### Risk

high

### Owner

@JsonSuCoder

### AI Ready

Yes

### Reproduction

上传本地确认 `is_encrypted=True` 的虚构 `UJ-TEST-F01-encrypted.pdf`（SHA-256 前 16 位 `c94bee9d6370fe42`）；批次 `25b8cc1b-a16f-4ea3-85ac-9362635e3cac` 中该项显示扫描件解析失败，无隔离提示。复现 1/1。

### Expected / Actual

预期：隔离并说明加密原因。实际：显示扫描件读取失败；底层隔离状态未知。

### Environment

见共同测试环境；仅有 UI 结果和本地文件加密预检，未取得 Material/审计记录。

### Severity

S2

## 5. [Bug] F02 姓名误识别为所在地并触发错误疑似重复复核

### Type

Bug

### Subsystem

hireos-screening

### Problem

首批 PDF 的姓名行含日期数字，线上将 `Location: Hanoi, Vietnam` 当作姓名，并仅凭低置信度姓名/文件名相似关联到此前虚构 TXT 候选人，阻断正常入库。现有证据表明姓名解析错误及其重复复核后果，独立的 F03 判定阈值缺陷尚未证实。

### User Outcome

带日期等附加文本的真实姓名被正确识别；地点字段不成为姓名，避免无根据的重复复核。

### Scope

F02 姓名提取及字段标签排除，F03 对解析结果的消费和复核原因呈现，回归测试。

### Non-goals

改变所有查重阈值；合并或删除现有疑似重复记录；CSV。

### Acceptance Criteria

AC-1：对包含姓名、同一行日期及单独 `Location:` 行的 PDF/DOCX 样本，姓名字段为实际姓名，地点字段为纯地点，`Location:` 不会作为姓名。
AC-2：该样本与不同姓名、不同邮箱的既有虚构候选人比较时，不因地点标签被当成姓名而进入疑似重复；若有其他真实匹配证据，复核页说明具体依据。
AC-3：自动测试覆盖带日期姓名行和普通姓名行，普通 PDF/DOCX 导入结果不回退。

### References

`docs/product/Resume_Screening/F02_Profile_Parsing/PRD.md`、`docs/product/Resume_Screening/F03_Duplicate_Detection/PRD.md`；`Test_Report_Format_Exception_2026-10-15.md` F01-FMT-05。

### Dependencies

None；F02/F03 责任边界需在定位后确定，同属 hireos-screening。

### Risk

medium

### Owner

@JsonSuCoder

### AI Ready

Yes

### Reproduction

上传首批虚构 PDF `UJ-TEST-F01-valid.pdf`（SHA-256 前 16 位 `4848ee5aef0f958c`），姓名行含日期数字；批次 `b980fe4d-03e1-43f3-ab0a-7c45486acfb3` 进入[重复复核](https://hireos.aipollo.me/hireos/screening/duplicates/adfd5473-603f-4738-9c63-4ce7f90fb7b5)，页面将 `Location: Hanoi, Vietnam` 显示为姓名，置信度 35%。复现 1/1；首批 DOCX 也进入复核，但具体字段未核。

### Expected / Actual

预期：真实姓名被识别，地点只作地点，不因字段误识别触发重复。实际：地点成为姓名并触发低置信度复核。

### Environment

见共同测试环境；线上解析原始 API/DB 未核验。本地解析器逻辑提供排查线索，但不是已证实的线上根因。

### Severity

S2

## 6. [Bug] F01 损坏 PDF 被误报为扫描件无文字

### Type

Bug

### Subsystem

hireos-screening

### Problem

损坏的伪 PDF 与纯图片扫描件共用“无法从该扫描件中提取可读文本”提示，用户无法判断是重新获取文件还是换可复制文字版本。

### User Outcome

用户看到与损坏文件相符的原因及重新选择文件的动作。

### Scope

PDF 解码失败和无文本扫描件的错误分类及文案、自动测试。

### Non-goals

修复损坏文件；OCR；CSV。

### Acceptance Criteria

AC-1：上传损坏 PDF 时逐项显示“文件损坏或无法解析”及重新选择文件的动作，不称其为扫描件；不生成候选人。
AC-2：上传有效但无可复制文字的图片型 PDF 时显示“扫描件无可读文字”，与损坏 PDF 区分；自动测试覆盖两类输入。

### References

`docs/product/Resume_Screening/F01_Intake_Import/PRD.md` AC-3、BR-2a；`Test_Report_Format_Exception_2026-10-15.md` F01-FMT-03。

### Dependencies

None；与本组 Issue 4 共用 PDF 错误分类路径时需避免互相覆盖。

### Risk

low

### Owner

@JsonSuCoder

### AI Ready

Yes

### Reproduction

上传只有伪 PDF 头和无效正文的 36 字节 `UJ-TEST-F01-corrupt.pdf`（SHA-256 前 16 位 `ea0dd7558ef43a79`）；批次 `25b8cc1b-a16f-4ea3-85ac-9362635e3cac` 显示扫描件无可读文本，解析失败。复现 1/1。

### Expected / Actual

预期：损坏或无法解析的说明。实际：扫描件无文字的错误说明。

### Environment

见共同测试环境；未取得服务端解析错误码。

### Severity

S3

## 7. [Bug] F01 空文件及不支持格式显示内部错误和错误恢复指引

### Type

Bug

### Subsystem

hireos-screening

### Problem

空 TXT 和不支持的 PNG 虽被拒绝，但逐项结果展示 `Bad Request Exception`、内部错误码及“无需操作”。用户无法理解应更换文件。两种输入归于同一个用户可见错误呈现缺陷。

### User Outcome

用户能看懂失败原因，并能选择替换文件继续导入。

### Scope

空文件和不支持格式的错误映射、中文文案、重新选择文件动作与混合批次回归测试。

### Non-goals

将不支持格式变为支持；CSV 导入；为不可重试输入添加原文件重试。

### Acceptance Criteria

AC-1：0 字节 TXT 失败时显示“文件为空，请选择有内容的文件”，不展示 `Bad Request Exception` 或裸错误码，并提供重新选择文件动作。
AC-2：PNG 等不支持格式失败时显示支持 PDF/DOCX/TXT 的说明和重新选择文件动作，不展示内部错误词或“无需操作”。
AC-3：混合批次的合规文件保持成功，失败项保留可理解结果；自动测试覆盖空文件、不支持格式及正常文件。

### References

`docs/product/Resume_Screening/F01_Intake_Import/PRD.md` AC-2、AC-3；`Test_Report_2026-10-15.md` F01-LIVE-03；`Test_Report_Format_Exception_2026-10-15.md` F01-FMT-04。

### Dependencies

None。

### Risk

low

### Owner

@JsonSuCoder

### AI Ready

Yes

### Reproduction

上传 0 字节 `empty.txt`，批次 `858cc6aa-7c30-44fa-96a5-342ed77f1940` 显示 `Bad Request Exception EMPTY_FILE` 和“无需操作”；上传 `UJ-TEST-F01-image.png`，批次 `25b8cc1b-a16f-4ea3-85ac-9362635e3cac` 显示 `Bad Request Exception UNSUPPORTED_FILE_TYPE` 和“无需操作”。两类各复现 1/1。

### Expected / Actual

预期：业务原因及替换文件入口。实际：内部错误和“无需操作”。

### Environment

见共同测试环境；未验证读屏状态。

### Severity

S3

## 8. [Bug] F01 粘贴资料在保存前没有可编辑的识别预览

### Type

Bug

### Subsystem

hireos-screening

### Problem

粘贴页只有文本框与“加入简历库”；输入后没有姓名、邮箱、地点识别结果预览或确认表单。姓名和地点即使识别错误，用户也只能在入库后发现。FR-3 要求识别后填入表单。

### User Outcome

用户在入库前看到并更正识别字段。

### Scope

粘贴识别预览、姓名/邮箱/地点编辑及提交值一致性测试。

### Non-goals

CSV 映射预览；改动 PDF/DOCX 上传交互；历史档案修订。

### Acceptance Criteria

AC-1：粘贴含姓名、邮箱和 `Based in Ho Chi Minh City, Vietnam.` 的资料后，保存前显示可编辑字段；地点预填为 `Ho Chi Minh City, Vietnam`，不包含整句话。
AC-2：用户修改姓名或地点后提交，档案和服务端保存值与确认值一致；自动测试覆盖更正路径。
AC-3：识别不到姓名时预览中姓名为空且明确标记必填，不能静默采用邮箱前缀作为姓名；与本组 Issue 1 的校验结果一致。

### References

`docs/product/Resume_Screening/F01_Intake_Import/PRD.md` FR-3、AC-5；`User_Journey.md` J4；`Test_Report_2026-10-15.md` F01-UX-04。

### Dependencies

与本组 Issue 1 共享无姓名校验的用户体验，但可独立验收预览交互。

### Risk

medium

### Owner

@JsonSuCoder

### AI Ready

Yes

### Reproduction

简历库→导入→粘贴；输入 `[UJ-TEST] Pia Nguyen`、虚构邮箱、`Based in Ho Chi Minh City, Vietnam.` 和技能。页面只有文本框和提交按钮，没有识别结果表单；提交后档案才显示解析字段。复现 1/1。

### Expected / Actual

预期：入库前可查看和修正识别字段。实际：直接保存，无预览。

### Environment

见共同测试环境；[线上档案](https://hireos.aipollo.me/hireos/screening/candidates/0a1255a5-9ead-4d81-b3ae-9b7ca5822bf4)。

### Severity

S3

## 9. [Bug] F04 简历库加载时短暂显示 0 人和空库状态

### Type

Bug

### Subsystem

hireos-screening

### Problem

简历库首次打开及返回后，在数据请求完成前短暂显示 0 人和空库提示，之后才显示真实 55 人或 63 人。加载中状态缺失，容易让用户误判数据丢失；没有证据表明数据真的丢失。

### User Outcome

用户清楚知道列表正在加载，只有请求完成且结果为空时才看到空库状态。

### Scope

简历库加载状态与空状态切换、慢响应和空响应自动测试。

### Non-goals

调整候选人实际数量；重做列表布局；CSV。

### Acceptance Criteria

AC-1：首次进入或返回简历库时，请求未完成期间显示明确加载状态，不显示“0 人”或空库引导。
AC-2：请求成功且确实无候选人时才显示 0 人和空库引导；请求失败时显示错误与重试入口。
AC-3：自动测试使用延迟响应和空响应验证三种状态的切换。

### References

`docs/product/Resume_Screening/F04_Resume_Library/PRD.md`；`docs/product/Resume_Screening/F01_Intake_Import/Test_Report_2026-10-15.md` F01-UX-05。

### Dependencies

None。

### Risk

low

### Owner

@JsonSuCoder

### AI Ready

Yes

### Reproduction

打开或从候选人档案返回简历库；请求加载前页面先显示 0 人和空状态，随后显示 55 人；格式复测时加载后可见 63 人。重复观察到该过渡现象。

### Expected / Actual

预期：请求完成前显示加载中。实际：短暂显示空库，之后显示已有候选人。

### Environment

见共同测试环境；仅依据 Chrome 页面观察，未采集网络时序。

### Severity

S3

## 分诊备注

- 本轮按九个独立可见问题创建九个 Bug Issue；F02/F03 的误识别与错误复核作为一条因果链，不凭现有证据另立 F03 阈值 Bug。
- CSV 暂不支持，因此未提交 CSV 缺口 Issue。现行 F01 PRD 仍写 CSV 与 AC-8/9，需要另行同步产品规格；本轮不把 CSV 拒绝视为缺陷。
- Issue 4 只断言线上 UI 分类错误，底层隔离状态留待修复验收核对；不夸大为已证实的安全绕过。
- Issue 9 属于 F04 页面问题，但来自 F01 测试观察；用户已确认作为独立 Issue 提交。
