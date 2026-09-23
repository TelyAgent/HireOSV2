#!/usr/bin/env python3
"""Generate five Chinese PDF resumes for manual HireOS upload tests."""

from __future__ import annotations

from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.platypus import KeepTogether, Paragraph, SimpleDocTemplate, Spacer


ROOT = Path(__file__).resolve().parent

RESUMES = [
    {
        "filename": "01-林若晨-AI产品经理.pdf",
        "name": "林若晨",
        "title": "AI 产品经理",
        "city": "上海",
        "email": "ruochen.lin82@gmail.com",
        "phone": "+86 138 2694 7318",
        "expected_salary": "35-45K · 15 薪",
        "summary": "7 年 B2B SaaS 与 AI 产品经验，专注将大模型能力落地到客服、知识管理和运营场景。擅长从业务问题拆解、方案验证到规模化上线，曾负责百万级用户产品的增长与体验优化。",
        "experience": [
            ("星澜智能科技｜高级产品经理｜2022.04—至今", [
                "负责企业知识助手产品线，完成检索增强生成、工作流编排与权限体系的产品规划；服务 180 余家企业客户。",
                "牵头客服质检智能化项目，与算法、设计、交付团队协作，将人工抽检覆盖率从 8% 提升至 72%，平均处理时长降低 41%。",
                "建立 AI 功能灰度、反馈归因与评测机制，推动 6 个行业模板上线，续费客户的功能使用率提升 28%。",
            ]),
            ("云桥软件｜产品经理｜2019.07—2022.03", [
                "负责运营中台、客户画像和自动化触达能力，围绕业务目标完成需求优先级与季度路线图管理。",
            ]),
        ],
        "education": "华东理工大学｜信息管理与信息系统｜学士",
        "skills": "AI 产品规划、LLM 应用、RAG、用户研究、B 端 SaaS、数据分析、Figma、SQL",
    },
    {
        "filename": "02-周启航-AI项目经理.pdf",
        "name": "周启航",
        "title": "AI 项目经理",
        "city": "深圳",
        "email": "qihang.zhou79@gmail.com",
        "phone": "+86 139 8175 4260",
        "expected_salary": "32-40K · 14 薪",
        "summary": "9 年复杂项目交付经验，近 4 年负责 AI 平台与行业智能化项目。熟悉从立项、需求澄清、资源统筹到上线验收的全过程，能够在多团队协作中识别风险并保障关键节点交付。",
        "experience": [
            ("远川数字科技｜项目经理｜2021.06—至今", [
                "统筹金融知识助手项目，协调产品、算法、后端、安全与客户方 5 个团队，10 个月完成从 POC 到全量上线。",
                "搭建里程碑、风险台账和质量门禁机制，项目按期交付率由 76% 提升至 94%，上线后三个月重大缺陷为零。",
                "主导模型效果、数据合规和客户验收三类问题的闭环，支持项目在 6 家区域机构复制落地。",
            ]),
            ("智维云服务｜交付经理｜2017.08—2021.05", [
                "负责企业软件实施及持续运营，推动需求变更、培训和上线支持等跨部门协作。",
            ]),
        ],
        "education": "武汉理工大学｜项目管理｜学士",
        "skills": "项目计划、敏捷交付、风险管理、AI 项目实施、供应商管理、Jira、飞书项目、数据看板",
    },
    {
        "filename": "03-陈子墨-AI后端工程师.pdf",
        "name": "陈子墨",
        "title": "高级后端工程师｜AI 平台",
        "city": "杭州",
        "email": "zimo.chen85@gmail.com",
        "phone": "+86 137 6058 1942",
        "expected_salary": "40-50K · 16 薪",
        "summary": "8 年后端研发经验，长期负责高并发服务、数据链路和 AI 应用平台建设。具备模型服务接入、检索链路、可观测性及成本治理经验，关注稳定性与工程效率。",
        "experience": [
            ("知行云计算｜高级后端工程师｜2020.09—至今", [
                "负责 AI 应用平台的服务端架构，交付模型网关、会话编排、知识库检索和用量计费等核心服务。",
                "设计异步任务与缓存分层策略，将高峰期请求 P95 从 1.9 秒降至 680 毫秒，日均稳定处理 900 万次调用。",
                "建设 OpenTelemetry 链路追踪、SLO 和自动化回滚机制，核心 API 年度可用性达到 99.96%。",
                "与算法团队完成多模型路由和评测数据回流，单次任务平均推理成本降低 32%。",
            ]),
            ("拓源网络｜后端工程师｜2017.07—2020.08", [
                "负责订单、账户和消息服务的开发与性能优化，参与容器化发布体系建设。",
            ]),
        ],
        "education": "浙江大学｜计算机科学与技术｜学士",
        "skills": "Python、Go、FastAPI、PostgreSQL、Redis、Kafka、Kubernetes、LLM Gateway、RAG、OpenTelemetry",
    },
    {
        "filename": "04-许安然-AI产品设计师.pdf",
        "name": "许安然",
        "title": "产品设计师｜AI 体验方向",
        "city": "北京",
        "email": "anran.xu91@gmail.com",
        "phone": "+86 136 9247 6081",
        "expected_salary": "30-38K · 14 薪",
        "summary": "6 年数字产品设计经验，聚焦 AI 工具、数据产品和企业协同场景。擅长将复杂能力转化为清晰、可信和可操作的体验，并能通过研究和数据验证设计效果。",
        "experience": [
            ("明途 AI｜高级产品设计师｜2021.03—至今", [
                "主导智能工作台、提示词配置和知识库管理体验设计，建立 AI 结果引用、置信提示和人工复核等交互规范。",
                "完成 20 余次企业用户访谈与可用性测试，重构任务创建流程后，首次配置成功率从 58% 提升至 84%。",
                "与产品、算法和前端共同制定组件规范，支持 4 条业务线复用，设计交付周期缩短 30%。",
            ]),
            ("北岸互动｜产品设计师｜2018.07—2021.02", [
                "负责企业服务产品的体验设计、设计系统维护与上线复盘。",
            ]),
        ],
        "education": "中国传媒大学｜数字媒体艺术｜学士",
        "skills": "Figma、设计系统、用户研究、AI 交互、信息架构、原型设计、可用性测试、数据驱动设计",
    },
    {
        "filename": "05-宋嘉言-财务运营经理.pdf",
        "name": "宋嘉言",
        "title": "财务运营经理｜AI SaaS",
        "city": "广州",
        "email": "jiayan.song88@gmail.com",
        "phone": "+86 135 7812 4609",
        "expected_salary": "35-42K · 13 薪",
        "summary": "10 年财务与运营管理经验，服务过快速增长的 SaaS 与科技业务。擅长预算与滚动预测、收入成本分析、业务流程治理和跨部门经营支持。",
        "experience": [
            ("启明智能服务｜财务运营经理｜2020.01—至今", [
                "建立订阅收入、模型调用成本和客户毛利的月度经营分析机制，为管理层提供产品定价与资源投入建议。",
                "搭建年度预算、滚动预测和费用授权流程，覆盖 4 个业务单元；预算偏差由 18% 收敛至 7%。",
                "协同销售、交付和技术团队梳理合同回款与云资源成本，年度经营性现金流改善 26%。",
                "负责审计资料、税务筹划及融资尽调支持，推动财务系统与 CRM、项目系统的数据对账自动化。",
            ]),
            ("维度科技｜高级财务分析师｜2015.07—2019.12", [
                "负责预算编制、经营报表、成本归集和业务部门财务支持。",
            ]),
        ],
        "education": "暨南大学｜会计学｜学士",
        "skills": "FP&A、预算管理、滚动预测、SaaS 收入分析、成本治理、经营报表、审计协作、Excel、Power BI",
    },
    {
        "filename": "06-陈昊天-全栈工程师.pdf",
        "name": "陈昊天",
        "title": "全栈工程师",
        "city": "上海",
        "email": "haotian.chen93@gmail.com",
        "phone": "+86 138 4517 6293",
        "expected_salary": "28-35K · 14 薪",
        "summary": "5 年全栈开发经验，长期负责 B 端 SaaS 与协作办公平台的前后端业务功能交付。熟悉从需求拆解、接口设计到上线维护的完整流程，注重代码质量、测试覆盖和跨团队协作效率。",
        "experience": [
            ("聚才云招聘科技｜全栈工程师｜2021.05—至今", [
                "负责招聘协作平台的候选人管理、面试安排和权限模块开发，使用 React、TypeScript 和 NestJS 完成前后端功能交付。",
                "主导面试日程与第三方会议服务的接入，支持自动排期和邮件通知，用人经理排期耗时从平均 25 分钟降至 6 分钟。",
                "重构候选人列表与筛选接口，引入分页、索引优化和缓存策略，核心查询响应时间从 1.4 秒降至 320 毫秒。",
                "推动前端组件库与后端接口规范统一，建立 Playwright 端到端测试套件，线上功能性缺陷同比下降 45%。",
            ]),
            ("方舟数据技术｜前端工程师｜2019.03—2021.04", [
                "负责企业管理后台的页面开发与组件维护，参与接口联调、性能优化和版本发布。",
            ]),
        ],
        "education": "上海大学｜软件工程｜学士",
        "skills": "TypeScript、React、Node.js、NestJS、PostgreSQL、Redis、REST API、Vite、Ant Design、Playwright",
    },
    {
        "filename": "07-赵今朝-高级产品经理.pdf",
        "name": "赵今朝",
        "title": "高级产品经理",
        "city": "北京",
        "email": "jinzhao.zhao86@gmail.com",
        "phone": "+86 137 2946 5810",
        "expected_salary": "38-48K · 15 薪",
        "summary": "8 年 B2B SaaS 产品经验，覆盖招聘协作、企业办公和交易平台方向。擅长从业务痛点出发完成产品规划、跨部门推动和数据驱动的迭代优化，具备完整的 0 到 1 与规模化经验。",
        "experience": [
            ("聚才云招聘科技｜高级产品经理｜2021.08—至今", [
                "负责招聘协作平台的产品规划，统筹岗位管理、候选人流程、面试安排和用人决策等核心模块的路线图。",
                "主导面试全流程重构项目，联合工程、设计和客户成功团队上线智能排期与协同评估功能，招聘周期平均缩短 22%。",
                "建立产品需求评审、灰度发布和数据复盘机制，季度需求交付准确率从 71% 提升至 93%。",
                "推动客户成功团队反馈闭环，梳理高频问题优先级，核心付费客户续约率提升至 96%。",
            ]),
            ("云枢企业服务｜产品经理｜2018.03—2021.07", [
                "负责企业协同办公产品的需求管理与版本迭代，完成从原型设计到上线复盘的全流程工作。",
            ]),
        ],
        "education": "南京大学｜工商管理｜硕士",
        "skills": "产品规划、需求分析、B 端 SaaS、跨部门协作、数据分析、SQL、Axure、Figma、项目管理",
    },
    {
        "filename": "08-顾亦辰-AI算法工程师.pdf",
        "name": "顾亦辰",
        "title": "AI 算法工程师",
        "city": "深圳",
        "email": "yichen.gu84@gmail.com",
        "phone": "+86 136 5029 7741",
        "expected_salary": "45-55K · 16 薪",
        "summary": "6 年机器学习与自然语言处理算法经验，专注大语言模型微调、检索增强生成和效果评测体系建设。擅长将算法能力封装为可复用服务，并推动模型效果与推理成本的持续优化。",
        "experience": [
            ("星澜智能科技｜AI 算法工程师｜2021.09—至今", [
                "负责企业知识助手的检索与生成链路优化，设计混合检索、重排序和引用溯源机制，答案准确率从 71% 提升至 89%。",
                "主导领域大模型微调与提示词工程，覆盖客服质检、合同摘要等场景，人工复核通过率提升 35%。",
                "搭建离线评测集与在线效果监控体系，支持 6 个业务模板的模型版本对比与灰度发布决策。",
                "推动模型路由与批量推理策略优化，单位任务推理成本降低 30%，GPU 资源利用率提升 22%。",
            ]),
            ("云帆数据实验室｜算法工程师｜2019.03—2021.08", [
                "负责文本分类、命名实体识别等 NLP 模型的训练、调优与线上服务化部署。",
            ]),
        ],
        "education": "中山大学｜计算机科学与技术｜硕士",
        "skills": "Python、PyTorch、LLM 微调、RAG、Prompt Engineering、向量数据库、Transformer、模型评测、MLOps",
    },
    {
        "filename": "09-苏晚晴-AI测试工程师.pdf",
        "name": "苏晚晴",
        "title": "AI 测试工程师",
        "city": "杭州",
        "email": "wanqing.su90@gmail.com",
        "phone": "+86 133 6748 2915",
        "expected_salary": "24-30K · 14 薪",
        "summary": "5 年测试与质量保障经验，近 3 年专注 AI 产品的效果评测与自动化测试体系建设。擅长设计覆盖功能、性能和模型效果的测试方案，推动缺陷问题闭环与发布质量把控。",
        "experience": [
            ("知行云计算｜AI 测试工程师｜2022.02—至今", [
                "负责企业知识助手与模型网关的测试策略设计，建立功能测试、回归测试和模型效果评测三条测试线。",
                "构建提示词与生成结果的自动化评测流水线，覆盖 12 类业务场景，评测效率提升 4 倍，人工复核工作量降低 60%。",
                "主导灰度发布前的核心链路回归测试，推动测试左移，上线后重大缺陷同比下降 50%。",
                "与算法、后端团队共同建立缺陷分级与归因机制，平均问题定位时间从 2 天缩短至 6 小时。",
            ]),
            ("拓源网络｜测试工程师｜2019.06—2022.01", [
                "负责业务系统的功能测试、接口测试与自动化脚本维护，参与发布质量把关。",
            ]),
        ],
        "education": "杭州电子科技大学｜软件工程｜学士",
        "skills": "自动化测试、Python、Playwright、Postman、AI 效果评测、Prompt 测试、缺陷管理、CI/CD、测试用例设计",
    },
]


def build_resume(resume: dict[str, object]) -> Path:
    pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))
    path = ROOT / str(resume["filename"])
    styles = getSampleStyleSheet()
    title = ParagraphStyle("resume-name", parent=styles["Title"], fontName="STSong-Light", fontSize=22, leading=28, textColor=HexColor("#172B4D"), spaceAfter=4)
    role = ParagraphStyle("resume-role", parent=styles["Normal"], fontName="STSong-Light", fontSize=11, leading=16, textColor=HexColor("#2563EB"), spaceAfter=8)
    body = ParagraphStyle("resume-body", parent=styles["BodyText"], fontName="STSong-Light", fontSize=9.5, leading=15, textColor=HexColor("#26364A"))
    heading = ParagraphStyle("resume-heading", parent=styles["Heading2"], fontName="STSong-Light", fontSize=11, leading=16, textColor=HexColor("#173B70"), spaceBefore=12, spaceAfter=4)
    employer = ParagraphStyle("resume-employer", parent=body, fontName="STSong-Light", fontSize=10, leading=14, textColor=HexColor("#172B4D"), spaceBefore=4, spaceAfter=2)
    bullet = ParagraphStyle("resume-bullet", parent=body, leftIndent=12, firstLineIndent=-8, bulletIndent=2, spaceAfter=2)
    story = [
        Paragraph(str(resume["name"]), title),
        Paragraph(str(resume["title"]), role),
        Paragraph(f"{resume['email']}　|　{resume['phone']}　|　{resume['city']}", body),
        Paragraph(f"期望薪资：{resume['expected_salary']}　|　期望城市：{resume['city']}", body),
        Spacer(1, 6),
        Paragraph("职业概述", heading),
        Paragraph(str(resume["summary"]), body),
        Paragraph("工作经历", heading),
    ]
    for employer_line, bullets in resume["experience"]:
        items = [Paragraph(employer_line, employer)]
        items.extend(Paragraph(line, bullet, bulletText="•") for line in bullets)
        story.append(KeepTogether(items))
    story.extend([
        Paragraph("教育经历", heading),
        Paragraph(str(resume["education"]), body),
        Paragraph("专业技能", heading),
        Paragraph(str(resume["skills"]), body),
    ])
    doc = SimpleDocTemplate(
        str(path), pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm,
        topMargin=16 * mm, bottomMargin=16 * mm, title=str(resume["name"]), author=str(resume["name"]),
    )
    doc.build(story)
    return path


if __name__ == "__main__":
    for candidate in RESUMES:
        print(build_resume(candidate))
