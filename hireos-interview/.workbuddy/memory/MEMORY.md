# HireOS Interview — 项目事实

## 技术栈
- 前端 `frontend/`: React 19 + Antd 5 + Tailwind v4 + Vite 7 + TypeScript 5.8 + React Router 7
- 原型参考 `frontend/HireOS-Interview-Developer-Handoff-v1.0/prototype/`
- 全局状态用 React Context + Reducer,持久化到 `localStorage["hireos_prefs"]`

## 关键路径
- `frontend/src/store/StoreContext.tsx` — 全局 store、reducer、初始化与系统主题检测
- `frontend/src/data/comps.ts` — 6 个能力项(中英名、must/req/w/round/ai/jd/anchors) + 证据数组 + 模拟转写
- `frontend/src/data/i18n.ts` — en/zh LANG 字典 + 状态映射 + ZH_TEXT_MAP + 文件活动/列表默认值
- `frontend/src/pages/ProjectA.tsx` — ProjectShell + Overview/Rubric/Plan/Schedule/Brief
- `frontend/src/pages/ProjectB.tsx` — Live/Review/Debrief/Decision/Package

## 启动 dev server
```bash
cd /Users/qmk/work/job-Interview/frontend
CODEBUDDY_BROKER_TRACE_ID="" npm run dev
```
broker 绕过前缀必须有,否则 npm/vite 会被 sandbox 拒绝。

## 默认演示数据
- 单个 wired 项目: Senior Backend Engineer / Elena Torres / Aug 18 2026
- Round 1 已完成(David Kim),Round 2 已完成(Priya Nair)
- HR (Sarah Chen) 已确认,HM (David Kim) 未确认
- 决策已选 "Recommend for offer",但 `decRecorded=false`
- 6 项能力:R1 三项 (dsd/bed/tc) 已记录人工分, R2 三项 (poir/sca/cm) 中 sca=null(Unknown),其他为 3-4

## 用户偏好(已学到)
- 偏好成本可控:批量查询 + TTL 缓存 + 活跃优先
- 关注体验而非覆盖率:JD-only 即可启动、其他材料可选