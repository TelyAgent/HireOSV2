#!/usr/bin/env python3
"""Generate seven Chinese PDF resumes for manual HireOS upload tests (internet company set)."""

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
        "filename": "01-邓思远-高级前端工程师.pdf",
        "name": "邓思远",
        "title": "高级前端工程师",
        "city": "上海",
        "email": "siyuan.deng76@outlook.com",
        "phone": "+86 138 4172 6053",
        "expected_salary": "38-48K · 15 薪",
        "summary": "6 年前端研发经验，长期负责千万级日活消费者产品的前端架构与性能优化。主导过组件库与设计系统从 0 到 1 建设，熟悉高并发场景下的工程化实践。",
        "experience": [
            ("潮汐科技｜高级前端工程师｜2021.05—至今", [
                "负责首页、活动和社区三条产品线的前端架构设计与重构，支撑日均 1200 万活跃用户的稳定访问。",
                "主导团队级组件库与设计系统建设，覆盖 12 个业务方接入，跨团队交付效率提升 35%。",
                "推动首屏渲染优化和包体积治理，首屏加载时间从 2.4 秒降至 1.1 秒，核心页面跳出率下降 18%。",
                "接入 A/B 实验平台与埋点体系，支持产品团队完成 40 余次线上实验。",
            ]),
            ("蓝海互动｜前端工程师｜2019.03—2021.04", [
                "负责电商详情页和购物车模块的开发与联调，参与前端工程化规范制定。",
            ]),
        ],
        "education": "同济大学｜软件工程｜学士",
        "skills": "JavaScript、TypeScript、React、Vue、Webpack、Vite、性能优化、设计系统、Next.js",
    },
    {
        "filename": "02-姚锦程-测试开发工程师.pdf",
        "name": "姚锦程",
        "title": "测试开发工程师",
        "city": "深圳",
        "email": "jincheng.yao83@outlook.com",
        "phone": "+86 139 5268 7041",
        "expected_salary": "28-35K · 14 薪",
        "summary": "5 年测试开发经验，专注接口自动化、UI 自动化与质量门禁体系建设。推动过测试左移和 CI/CD 质量卡点落地，具备完整业务线质量保障经验。",
        "experience": [
            ("速联网络｜测试开发工程师｜2021.08—至今", [
                "负责核心交易链路的测试方案设计与自动化覆盖，接口自动化覆盖率从 45% 提升至 89%。",
                "搭建 UI 自动化与性能测试平台，将回归测试周期从 3 天压缩至 6 小时。",
                "推动质量门禁接入 CI/CD 流水线，上线前缺陷拦截率提升 40%。",
                "参与需求评审和技术方案评审，累计识别并规避 20 余项质量风险。",
            ]),
            ("恒信科技｜测试工程师｜2019.06—2021.07", [
                "负责功能测试、缺陷跟踪与回归测试执行，参与自动化脚本编写。",
            ]),
        ],
        "education": "华南理工大学｜软件工程｜学士",
        "skills": "Python、Pytest、Selenium、Playwright、接口自动化、性能测试、CI/CD、缺陷分析",
    },
    {
        "filename": "03-方逸飞-SRE工程师.pdf",
        "name": "方逸飞",
        "title": "SRE / 运维工程师",
        "city": "北京",
        "email": "yifei.fang80@outlook.com",
        "phone": "+86 137 4826 0159",
        "expected_salary": "42-52K · 16 薪",
        "summary": "7 年运维与 SRE 经验，长期负责核心业务系统的稳定性保障和基础设施自动化。具备大规模 Kubernetes 集群运维、监控告警体系建设和故障应急响应经验。",
        "experience": [
            ("云枢科技｜高级 SRE 工程师｜2020.10—至今", [
                "负责核心交易系统的可用性保障，制定 SLO/SLA 指标体系，年度可用性达到 99.98%。",
                "主导 Prometheus、Grafana、ELK 监控告警平台建设，故障平均发现时间从 12 分钟降至 90 秒。",
                "推动容量规划与成本治理项目，年度基础设施成本降低 22%，同时保障大促峰值稳定性。",
                "建立故障应急响应机制与 On-call 值班体系，主导 15 次重大故障复盘及改进措施落地。",
            ]),
            ("嘉世信息｜运维工程师｜2018.03—2020.09", [
                "负责服务器运维、发布系统维护和基础监控告警配置。",
            ]),
        ],
        "education": "北京理工大学｜计算机科学与技术｜学士",
        "skills": "Kubernetes、Docker、Prometheus、Grafana、ELK、Python、Go、Shell、容量规划、故障应急",
    },
    {
        "filename": "04-柳晓萌-用户增长经理.pdf",
        "name": "柳晓萌",
        "title": "用户增长经理",
        "city": "杭州",
        "email": "xiaomeng.liu84@outlook.com",
        "phone": "+86 136 7920 4518",
        "expected_salary": "30-38K · 14 薪",
        "summary": "6 年用户增长与运营经验，专注获客、留存和商业化转化全链路增长策略。擅长通过 A/B 实验驱动增长漏斗优化，具备从 0 到 1 搭建增长体系的经验。",
        "experience": [
            ("星阅传媒｜用户增长经理｜2021.02—至今", [
                "负责用户增长策略制定与落地，覆盖获客、激活、留存和转化四大环节。",
                "设计并执行 120 余次 A/B 实验，核心留存指标提升 24%，激活转化率提升 19%。",
                "协调投放、内容和产品团队，推动跨部门增长项目落地，年度新增用户规模增长 65%。",
                "建立用户增长数据看板，定期输出分析报告，支持管理层增长决策。",
            ]),
            ("弘阳互娱｜市场运营专员｜2019.01—2021.01", [
                "负责社交媒体运营和渠道投放执行，参与用户获取活动策划。",
            ]),
        ],
        "education": "浙江工商大学｜市场营销｜学士",
        "skills": "用户增长、A/B 实验、SQL、漏斗分析、渠道投放、私域运营、数据驱动决策",
    },
    {
        "filename": "05-乔思彤-视觉设计师.pdf",
        "name": "乔思彤",
        "title": "视觉设计师",
        "city": "广州",
        "email": "sitong.qiao87@outlook.com",
        "phone": "+86 135 2649 7803",
        "expected_salary": "26-32K · 14 薪",
        "summary": "5 年视觉设计经验，专注品牌视觉体系与产品视觉设计。具备从 0 到 1 搭建品牌视觉规范的经验，擅长将品牌调性转化为一致的多渠道视觉表达。",
        "experience": [
            ("尚品文化｜视觉设计师｜2021.06—至今", [
                "主导品牌视觉体系搭建，包括 Logo、色彩、字体和图形规范，统一 8 条业务线视觉表达。",
                "负责核心产品视觉设计输出，包括界面视觉、图标和插画，产品视觉一致性评分提升至 92 分。",
                "设计年度营销活动物料，覆盖线上广告、社交媒体和线下物料，参与活动曝光量超 3000 万。",
                "建立设计素材库与规范文档，新人上手周期从 3 周缩短至 1 周。",
            ]),
            ("风尚创意｜平面设计师｜2019.07—2021.05", [
                "负责品牌物料设计与客户提案支持，参与多个品牌全案项目。",
            ]),
        ],
        "education": "广州美术学院｜视觉传达设计｜学士",
        "skills": "Figma、Photoshop、Illustrator、品牌设计、设计规范、插画、动效设计",
    },
    {
        "filename": "06-韩子墨-商务拓展经理.pdf",
        "name": "韩子墨",
        "title": "商务拓展经理",
        "city": "上海",
        "email": "zimo.han82@outlook.com",
        "phone": "+86 133 8046 2957",
        "expected_salary": "32-40K · 15 薪",
        "summary": "6 年商务拓展与渠道合作经验，长期负责互联网商业化渠道的合作伙伴开发与谈判。具备丰富的行业资源和商务合同把控能力，擅长推动复杂合作项目落地。",
        "experience": [
            ("锐峰商业｜商务拓展经理｜2021.04—至今", [
                "负责核心商业化渠道合作伙伴的挖掘与谈判，年度新增合作伙伴 45 家，合作转化率提升 30%。",
                "设计分成模式与联合营销方案，推动 3 个重点合作项目达成年化千万级合作规模。",
                "维护存量合作伙伴关系，续约率保持在 88% 以上，推动合作深度持续提升。",
                "协调产品、法务、财务团队完成合作条款审核与项目落地，平均签约周期缩短 25%。",
            ]),
            ("汇通网络｜商务专员｜2018.09—2021.03", [
                "负责渠道合作跟进与商务资料准备，协助完成合同谈判与签署。",
            ]),
        ],
        "education": "上海财经大学｜工商管理｜学士",
        "skills": "商务谈判、渠道合作、合同管理、资源整合、数据分析、跨部门协作",
    },
    {
        "filename": "07-秦雨桐-HRBP.pdf",
        "name": "秦雨桐",
        "title": "HRBP",
        "city": "北京",
        "email": "yutong.qin85@outlook.com",
        "phone": "+86 132 6748 0391",
        "expected_salary": "30-36K · 14 薪",
        "summary": "6 年人力资源经验，长期担任核心业务部门 HRBP，专注组织发展、人才梯队建设和员工关系管理。擅长将人力资源策略与业务目标结合，支持组织快速变化中的人才适配。",
        "experience": [
            ("远景科技｜HRBP｜2021.01—至今", [
                "为核心研发和产品部门提供人才规划与组织发展支持，覆盖 400 余人团队。",
                "主导关键岗位招聘需求分析与面试评估，核心岗位招聘周期从 45 天缩短至 28 天。",
                "推动绩效管理与人才盘点体系落地，搭建关键岗位继任者计划，覆盖 90% 核心岗位。",
                "处理员工关系事务，主导组织架构调整期间的沟通与稳定性保障。",
            ]),
            ("鼎新集团｜人力资源专员｜2019.02—2020.12", [
                "负责招聘执行、入离职手续办理和员工满意度调研。",
            ]),
        ],
        "education": "中国人民大学｜人力资源管理｜学士",
        "skills": "招聘管理、绩效管理、员工关系、组织发展、人才盘点、劳动法规、数据分析",
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
