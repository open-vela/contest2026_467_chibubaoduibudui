# 训练状态与结果比较修复（2026-10-24）

基于当前 `c0d85b9`，分支 `codex/training-session-integrity`。检查 F:/、F:/项目/、项目根目录及 src/test/scripts/docs 后未发现适用 AGENTS.md。已有未跟踪目录、文件与历史输出保留；构建前复制旧 dist 到本轮 output 目录。用户已明确要求直接执行，实施不等待设计确认、不合并、不推送、不创建 PR。

## 实施范围

1. `index.ux` 的拳击阶段为 preparing → running → paused → reconnecting → running，失败进入独立 boxingFailure 页面，完成才进入 boxingResult。有效三轴首样本建立基线后才创建 30 秒时钟、记录两项健康基线和正式开练时间。继续使用原有 1600ms 启动/重连超时。显式订阅错误与无效三轴样本进入失败流程（准备、训练和重连阶段均覆盖）；没有出拳不代表数据失效，不新增未经设备验证的静默周期看门狗。
2. `health-quality.js` 独立配置 `END_WINDOW_MS = 10000`，允许结果比较调用通过 `endWindowMs` 覆盖；不改变心率 60000ms、压力 300000ms 有效期。按设备测量时间选取有效结束样本，窗口两端均包含；必须晚于基线和正式开练时间，并位于实际训练区间。暂停边界不包含，恢复边界包含，完成边界包含。迟到接收不能替代测量时间。本局每指标独立保留最近两个符合前台区间的候选，不受首页 latest 的乱序拒收或八项历史截断影响；第二候选用于最新样本与排除的暂停边界同刻时的回退。完成时刻固定为时钟的有效训练截止时间，hide/interval 的先后和迟到 tick 不改变结束窗口。
3. 前台训练区间只在正式训练运行时开放；重连等待也属于暂停。暂停立即将已显示、未命中目标结算一次；恢复从下一个节拍继续，不补发后台节拍。检测器仅清空姿态基线并保留动作防抖时间，恢复首样本不增加动作或成绩。资源控制器订阅代际与页面运行代际共同拒绝旧回调、旧超时、旧计时器。

保持 60 秒呼吸、30 秒拳击、4.5 阈值、350ms 防抖、100/70/40 评分、心率节拍映射、男女拳手和首次选择。未处理提前出拳、最后一拍窗口、呼吸收尾、历史记录。未添加依赖。Release 继续禁用 `--optimize-css-attr`。

## 回归与验证步骤

- [x] 先扩展 `test/page-health.test.js`，执行真实 index.ux 脚本、system.sensor 适配器和资源控制器，仅替换系统提供者与时间；回调驱动训练、动作与计分。
- [x] 修复前页面回归 43 项中 23 项失败、20 项通过，日志 `output/training-integrity-20261024/regression-red.log`。
- [x] 连接前不耗时、不生成目标；同步连接/失败、无效首样本、超时、训练中失败、失败重试及旧回调隔离。
- [x] 两种训练的第 1 秒样本、窗口前/边界/内部/结束边界、迟到样本、后台样本、重连等待样本、单项缺失及独立比较。
- [x] 暂停前未来/未命中/已命中/已漏拍目标，重复隐藏/显示，恢复首姿态与防抖，后续合法计分，五次切换的时长与资源数量。
- [x] 独立审查发现的迟到前台测量被首页乱序策略丢弃、后台八项历史挤出结束样本、完成边界与隐藏竞态；补充 10 项失败回归（43 过、10 失败）后修复。再覆盖暂停边界回退（2 项先失败后通过）。审查的三个 Important 均已处理，无遗留 Minor。
- [x] 最终 `npm.cmd test`：156/156（21 逻辑 + 9 runtime + 7 lifecycle + 23 component + 8 release runner + 88 Node），其中页面流程 55 项、健康质量 10 项；相对基线新增 38 项。
- [x] Debug 和 Release 均退出 0，日志 `build-debug-final-2.log`、`build-release-final-2.log`；Release 不包含 `--optimize-css-attr`。PNG8 转换的 override 警告不影响产物生成。
- [x] 模拟器：官方 32.1.15 / 大赛镜像 vela-miwear-watch-5.0-beta / 466×466；安装收据核对最终 Release SHA-256 和 manifest 时间戳。正常包完成首次进入拳手流程、出拳输入、Home 后台暂停、后台不同姿态、前台重连首样本不加动作/分数、后续动作及完成页。隔离故障包（独立包名和“故障注入·模拟”标记）首订阅失败后验证失败页、全新重试、恢复无额外计分、退出。只有隔离包第一轮注入订阅错误，其余使用 system.sensor 与官方 RPC 输入，不写分数。
- [x] 最终代码审查、`git diff --check`、完整测试与两种构建核对。保留修复分支，不合并、推送或创建 PR。

## 修改文件

| 文件 | 作用 |
| --- | --- |
| src/pages/index/index.ux | 状态机、正式开练基线、失败/重试、前台区间、独立结束候选、目标结算、资源与代际隔离 |
| src/pages/index/boxing.js | 三轴校验复用；只清姿态基线并保留 350ms 防抖 |
| src/pages/index/motion.js | 空样本安全转交给三轴有效性判断 |
| src/pages/index/session-clock.js | 固定有效训练完成边界 |
| src/pages/index/health-quality.js | 10 秒结果窗口、本局候选、前台区间和独立缺端原因 |
| src/pages/index/components/boxing-failure.ux | 圆屏失败原因、重试与返回首页 |
| src/pages/index/components/boxing-result.ux | 心率和压力分别展示比较或缺端原因 |
| test/page-health.test.js | 实际页面、适配器与回调驱动回归，共 55 项 |
| test/health-quality.test.js | 独立窗口配置与原有效期回归，共 10 项 |
| test/component-contract.test.js | 新失败页事件与结果属性契约 |
| docs/training-integrity-20261024.md | 本记录 |

## 最终产物

稳定副本位于 `output/training-integrity-20261024/artifacts/`，与 dist 中本轮产物相同：

| 产物 | SHA-256 |
| --- | --- |
| com.openvela.wristrhythm.debug.1.0.0.rpk | `0f51b38588af1f68576f570e71238e963d663b00ef7aebc6761dc44407ff7bd5` |
| com.openvela.wristrhythm.release.1.0.0.rpk | `14d4d1d6f7e6944ea3eb11aabc61213ab5cdaaeef195aca8c5e26d17b6fb2d1f` |

故障包 `emulator-fixture.rpk` 是独立模拟验证产物，不是正常交付包；SHA-256 `471f70f544f585790e62934b7600fc91eb8265051422c32ce34fef6c489ecc44`。生成脚本和传感器输入验证脚本保留于本轮 output 目录。

## 证据与限制

最终日志和收据位于 `output/training-integrity-20261024/`：`npm-test-final-2.log`、两种 `build-*-final-2.log`、`artifacts/SHA256SUMS.txt`、`emulator-normal-final-3/verification.json` 和 `emulator-fixture-final-3/verification.json`，各自包含本次截图、设备日志及 RPC 输入/点击时间线。

首次选择的完成证据单列为 `first-choice-evidence.json`：同一最终隔离包 SHA-256 的首轮运行中，点击女拳手后，原生 system.storage 日志确认写入 `female`。该轮后续仅因失败审计日志丢失而停止。页面出现或点击请求本身不等于选择已完成；最终收据的输入标志因此命名为 `selectionClickRequested`，不作为完成证据。

验证过程的早期失败日志也保留：一轮完成页已出现但完成审计丢失、一轮系统 hide 已确认但页面 hide 审计丢失、一轮故障页已出现但失败审计丢失，严格脚本据此中止。最终收据明确保留缺失字段，未把组件 ready 日志伪装为计时日志。正常包最终完成审计仍缺失，完成页与相应数值有原生渲染证据；精确 30 秒边界及反复切换资源数由主机页面回归验证。截图等待新画面提交后再采集；模拟器系统加速度输入还可能旋转屏幕，不代表修改了页面视觉或 Release CSS 压缩兼容设置。

未做真机、真人动作准确率、健康效果验证；本轮未在模拟器额外跑完整 60 秒呼吸（其结束窗口、前后台与完成边界由页面回归覆盖）。不使用历史录像替代本轮证据。

结束值只能表达本局有测量依据的前后变化；缺失端明确标注“无法比较”及基线/结束样本缺失。主机与模拟器输入均不是人体动作准确率、真机可靠性或健康效果验证。
