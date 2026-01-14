# 股票看板

一个基于 React + TypeScript 的 A 股数据看板项目，聚焦行情展示、筛选与自选管理，支持分时趋势、板块/行业视图和个股详情分析，适合用作日常盘中观察与快速筛选工具。

体验链接：https://chengzuopeng.github.io/stock-dashboard/

## 数据来源：stock-sdk
项目的所有行情与数据接口由 [stock-sdk](https://stock-sdk.linkdiary.cn/) 提供。
- 接入层：`src/services/sdk.ts`，封装缓存、重试与统一调用
- 参考文档：`sdk.md`
- 使用范围：实时行情、分时、板块/行业、选股与详情页数据

## 功能亮点
- 看板总览：自选快照 + 市场信息汇总
- 热力图：按行业/板块/自选维度查看市场热度
- 板块详情：板块成分股与走势概览
- 自选管理：分组管理、批量展示、快速添加
- 尾盘选股：条件筛选 + 分时趋势图辅助判断
- 个股详情：多周期图表、关键指标、资金与成交信息

## 页面与模块说明
- 总览：`/` - 自选快照、榜单入口
- 热力图：`/heatmap` - 维度/指标可配置
- 榜单：`/rankings` - 涨跌榜、成交榜等
- 板块：`/boards` - 行业/概念板块列表与详情
- 自选：`/watchlist` - 分组管理与行情列表
- 尾盘选股：`/eod-picker` - 条件筛选与分时趋势
- 个股详情：`/s/:code` - 价格、K 线、资金等

## 数据与缓存策略
- SDK 请求统一走 `src/services/sdk.ts`
- 内存缓存（TTL）用于减少重复请求
- 关键页面使用轮询刷新（如行情、分时）

## 本地存储
- 自选分组与配置：`src/services/storage.ts`
- 常用设置、筛选条件与历史记录保存在 localStorage

## 技术栈
- React 19 + TypeScript
- Vite
- ECharts（echarts-for-react）
- framer-motion

## 项目结构
- `src/pages`：功能页面（看板、自选、热力图、板块、选股、详情）
- `src/components`：公共组件与布局
- `src/services/sdk.ts`：stock-sdk 适配与缓存封装
- `src/services/storage.ts`：本地配置与自选持久化
- `src/utils`：格式化与通用工具

## 开发
```bash
yarn install
yarn dev
```

## 构建
```bash
yarn build
```

## Lint
```bash
yarn lint
```

## 本地预览
```bash
yarn preview
```

## 说明
- 代码与页面以 A 股为主要对象，部分模块可扩展到港股/美股
- 若需修改刷新频率或缓存策略，可在 `src/services/sdk.ts` 调整
