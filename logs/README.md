# logs/ — AI Coding 日志目录

存放你在开发中与 AI 工具的对话日志，和作品代码一并提交。

本仓库已提交 `inskr/` 下由日志归集工具导出的真实开发会话。后续 AI Coding 会话应按同一格式追加，并在最终提交前重新执行官方校验脚本。

## 本次同步范围（2026-11-01）

- 保留项目需求、设计、编码、缺陷审查、修复、测试、构建和真机调试准备相关对话。
- 按用户要求，整段排除 PPT 制作、模拟器启动/注入/截图/录屏，以及作品介绍文档、答辩稿和无关比赛检索会话；混合这些主题的会话及其子会话也整段排除。
- 已有且仍在范围内的 JSONL 文件保持原样；移除不在范围内的会话文件，并同步更新 `inskr/manifest.json`。Git 历史仍保留此前提交的记录。
- 新增会话使用组委会 `open-vela/.claude` 仓库的 Codex 对话解析器，从本机真实 rollout（包含压缩存档）导出用户与助手文本。解析器不导出系统/开发者环境指令、工具返回和推理内容。
- 对续接会话合并所有本地分段，消除相同时间、角色与正文的重复记录；不改写对话正文。不新增继承父会话全文的内部子代理日志或自动审批日志。
- 当前提交会话是导出时点的快照，结束时间见 manifest；后续消息尚未包含。该限制已登记在对应会话的 `data_completeness_warning` 字段。

本次筛选后共 61 个会话、7,348 条事件。日志文件、事件数与路径以 `inskr/manifest.json` 为准。

## 目录结构

```text
logs/
└── <github_login>/              # 你的 GitHub 用户名，一人一目录
    ├── manifest.json            # 会话清单
    └── <date>/                  # 日期 YYYY-MM-DD
        └── <tool>__<sid>.jsonl  # 一个会话一个文件（工具名与 session id 用 __ 连接）
```

- `<tool>`：`claude-code` / `opencode` / `codex` / `kiro`
- 每个 `.jsonl` 每行一个事件，由组委会提供的日志归集工具导出，**只提交 JSONL 本身**。

导出与提交的完整步骤、字段定义见[《AI Coding 日志归集与提交手册》](https://github.com/open-vela/docs/blob/dev-ai-contest-2026/zh-cn/contest_2026/ai_coding_log_guide.md)。
