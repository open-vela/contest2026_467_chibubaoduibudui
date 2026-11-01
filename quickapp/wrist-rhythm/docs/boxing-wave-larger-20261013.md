# 节奏拳波纹放大复验（2026-10-13）

本次按用户要求对波纹做小幅放大。分支 codex/review-readiness，源码 f009b23ac05e2ed4cb400fbaf5705cb88a40ba5e，正式Release SHA-256 8e4e52bd2b4d46885b1b47c69411d76171fe415a9bfa33e053ddc196c35e518c。历史final-v12输出及失败记录保留。

普通圆屏五层直径由28/60/96/140/184调整为32/70/112/160/200。圆心、舞台、人物位置、55ms逐层延迟及180ms淡出不变；没有恢复不可靠的几何缩放。紧凑屏最大圈仍184，短视口保持14/30/50/78/104；现有布局契约检查边框也在舞台内部。其他游戏/健康/生命周期源码未改变。

| 场景 | 层级 | 实际结果 | 证据 | 边界 |
| --- | --- | --- | --- | --- |
| 测试与两个构建 | 主机本次串行执行 | 113通过、0失败；Debug/Release成功 | [构建回执](../output/review-reliability-20261013/boxing-wave-larger/final/build-receipt.json) | 测试数量不能代替实机效果 |
| 466完整流程 | 最终正常Release，真实466×466 | 完整60秒呼吸、完整30秒节奏拳、结果及首页；首次动作未连接，0分/0命中 | [完整实录](../output/review-reliability-20261013/boxing-wave-larger/final/emulator-video/emulator-sensor-input-full.mp4)、[记录](../output/review-reliability-20261013/boxing-wave-larger/final/emulator-video/review-summary.json) | RPC回读不代表应用接收 |
| 480完整流程 | 最终正常Release，真实480×480 | 同上；0分/0命中，底部操作可用 | [完整实录](../output/review-reliability-20261013/boxing-wave-larger/final/emulator-480/emulator-sensor-input-full.mp4)、[记录](../output/review-reliability-20261013/boxing-wave-larger/final/emulator-480/review-summary.json) | 480正向动作链未通过 |
| 466后续正向复验 | 最终正常Release，真实system.sensor | 六个0/0.1变化先提供连接样本，随后7个10单位变化；7动作/2命中/110分，最高连击1；完整30秒结果后返回首页 | [本次拳击实录](../output/review-reliability-20261013/boxing-wave-larger/final/emulator-positive/visual-video/emulator-sensor-input-full.mp4)、[输入时间线](../output/review-reliability-20261013/boxing-wave-larger/final/emulator-positive/visual-video/timeline.jsonl)、[结果](../output/review-reliability-20261013/boxing-wave-larger/final/emulator-positive/visual-video/review-summary.json) | 单独局，不能替换前两场0分记录；无点击加分 |
| 独立正向探测 | 最终正常Release，466系统传感器 | 7动作、7命中、430分、最高连击7；完整30秒结果后返回首页 | [独立结果](../output/review-reliability-20261013/boxing-wave-larger/final/emulator-positive/review-summary.json)、[时间线](../output/review-reliability-20261013/boxing-wave-larger/final/emulator-positive/timeline.jsonl) | 与110分录像是不同的一场，不互换结果 |
| 波纹与右手布局 | 两尺寸最终正式包实际画面，布局契约 | 波纹维持中心，人物/说明/按钮可读；右拳在正向输入画面完整可见 | [466波纹](../output/review-reliability-20261013/boxing-wave-larger/final/emulator-video/screenshots/pulse-large-1.png)、[480波纹](../output/review-reliability-20261013/boxing-wave-larger/final/emulator-480/screenshots/pulse-large-1.png)、[命中](../output/review-reliability-20261013/boxing-wave-larger/final/emulator-positive/visual-video/screenshots/boxing-after-hits.png) | 采样可漏过180ms淡出阶段，像素半径统计不等同全部隐藏圆环测量 |

完整流程录像未剪辑、未加速、静音；拳击专用实录覆盖完整30秒拳击而不是完整呼吸流程。所有录像均完成本地全文件解码；44.52秒拳击实录另经本地浏览器以1倍速自然播放至结束，error=null，见 [播放记录](../output/review-reliability-20261013/boxing-wave-larger/final/emulator-positive/visual-video/browser-playback.json)。模拟器传感器输入，不代表真人动作识别准确率或健康效果。首两场日志显示在首次大幅变化之前，等待首个动作样本已超时；后续独立场景在进入训练后先发送真实小幅变化，再观察到连接与动作。这里只记录本次现象，不推断镜像的一般推送规律，未修改产品超时、阈值或评分，也未将0分局冒充命中局。

本次没有重新执行此前753b744版的后台/三轮/十退出/七故障渲染，旧证据仍归原版，不给新包套用新执行日期。此次只复验本次CSS变化的两尺寸流程、波纹和正向渲染，业务逻辑仍由本次完整本地测试覆盖。目标真机、真人准确率、健康效果、长期资源与更小实际屏幕仍未验证。

构建时跟踪文件无改动；dirty=true来自保留历史未跟踪目录。交付摘要另记录文档提交，打包校验RPK/视频哈希及内部链接。未推送、合并或发布。
