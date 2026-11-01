# 本轮验证矩阵（2026-10-12）

2026-10-13 波纹放大版本 `f009b23` 的两尺寸流程、正向输入及本次录像见 [增量复验矩阵](boxing-wave-larger-20261013.md)。本文件保留 `753b744` / `final-v12` 原始记录，不能作为新包已重跑全部场景的证据。

源码 753b744f757690d4eaffc5a7be0a86588c7fba72，分支 codex/review-readiness。正式 Release SHA-256：`8a9fd6bda202d96846d94269a39bc9be028ece5b173b8b0e4a4c039b3309bd8b`。执行者为代理，通过官方模拟器 RPC/ADB 自动执行并检查实际画面；未填写人工签字，也没有真机、真人或健康效果试验。

正式包、七项故障渲染和布局夹具均从本轮源码753b744f757690d4eaffc5a7be0a86588c7fba72重新构建并运行，旧版本证据仅作问题对照，未重写旧执行记录。正式画面的健康数值来自镜像样本。所有正向输入材料均为**模拟器传感器输入，不代表真人动作识别准确率**。故障和布局包有独立包名及常驻水印；静态布局分数不能作为动作或计分证据。

| 场景 | 验证层级 | 实际结果 | 证据 | 未覆盖边界 |
| --- | --- | --- | --- | --- |
| 静置 | 正式 Release，466 系统传感器接口 | 基线后静置约2.5秒，0动作、0命中、0分；三轮无输入完整拳击也是0分 | [静置截图](../output/review-reliability-20261012/final-v12/emulator-positive/screenshots/static-zero.png) | 真人自然摆臂与噪声 |
| 超阈值单次变化 | 正式 Release，setSensor → system.sensor → detector | 10/20单位变化经过系统订阅产生动作；没有调用加分函数 | [输入与实际时间线](../output/review-reliability-20261012/final-v12/emulator-positive/timeline.jsonl) | 精确4.5边界的接口单位/量化未验证 |
| 节拍窗口内 | 同上 | 5次命中，各次40/40/40/40/40分；人物出拳、冲击波、得分与连击更新 | [命中截图](../output/review-reliability-20261012/final-v12/emulator-positive/screenshots/hit-and-debounce.png) | 窗口边界另以本地逻辑测试覆盖，非真人准确率 |
| 窗口外 | 同上 | 有效动作距最近目标825/786ms，均0分 | [算术核对](../output/review-reliability-20261012/final-v12/emulator-positive/positive-summary.json) | 接口调度有时延，按实际回调时间判定 |
| 防抖 | 同上 | 234ms内连续变化被拒绝，不重复计分 | [决策日志](../output/review-reliability-20261012/final-v12/emulator-positive/device.log) | 镜像日志丢失部分决策，不能以决策行数冒充动作数 |
| 多次命中及汇总 | 同上 | 9写入含基线、8超阈值变化、7有效动作、5命中、200分、最高连击5、30目标 | [结果截图](../output/review-reliability-20261012/final-v12/emulator-positive/screenshots/positive-result.png) | 这组得分是本次实际值，其他运行因回调时机得分可不同 |
| 呼吸后台约10秒/恢复 | 正式 Release，真实KEY_HOME | Home至返回观测13804ms；相邻后台前/恢复样本墙钟经过13783ms，前台时钟只增加828ms（含隐藏前过渡）；恢复后健康时间戳更新、继续剩余训练 | [生命周期与资源汇总](../output/review-reliability-20261012/final-v12/emulator-rounds/acceptance-summary.json) | 呼吸hide诊断丢失，精确暂停瞬间未量化；真实onHide/表盘resume及截图另有证据，未用强停代替后台 |
| 拳击后台/恢复 | 同上 | Home至返回观测13768ms；hide→show前台时钟差3ms；动作重新连接、恢复后产生2动作，健康时间戳继续更新，可主动退出 | [实际时间线](../output/review-reliability-20261012/final-v12/emulator-background/timeline.jsonl) | 不承诺每毫秒采样精度 |
| 三轮完整60+30秒 | 正式 Release，466 | 三轮独立记录，均结果→首页；每轮自然完成，无提前完成或重复结算 | [六个会话时长](../output/review-reliability-20261012/final-v12/emulator-rounds/acceptance-summary.json) | 短轮观察不证明没有内存泄漏 |
| 十次主动退出 | 正式 Release，466 | 5次呼吸、5次拳击分别返回首页；未出现完成全程结果、残留训练动画或崩溃 | [十组时间线](../output/review-reliability-20261012/final-v12/emulator-exits/timeline.jsonl) | 实际设备的长期资源累积待测 |
| 心率不可用/压力可用 | 隔离故障包实际渲染，480 | 心率不支持，压力20保留；呼吸可进入/退出 | [水印截图](../output/review-reliability-20261012/final-v12/fault-evidence/hr-missing/screenshots/fault-home.png) | 正式系统服务强制故障未验证 |
| 压力不可用/心率可用 | 同上 | 压力不支持，心率80保留；无互相污染 | [水印截图](../output/review-reliability-20261012/final-v12/fault-evidence/stress-missing/screenshots/fault-home.png) | 同上 |
| 两项均不可用 | 同上 | 完整60秒呼吸；结果两项无法比较，返回首页 | [无数据结果](../output/review-reliability-20261012/final-v12/fault-evidence/both-missing/screenshots/fault-breathing-result.png) | 同上 |
| 有效后停止更新至过期 | 同上 | 初始55秒/295秒旧样本仍有效，超过实际60秒/300秒TTL后显示待更新；未更改正式TTL | [过期截图](../output/review-reliability-20261012/final-v12/fault-evidence/stale/screenshots/fault-stale-home.png) | 故障包控制样本时间，不是正式服务停止推送 |
| 训练没有更新样本 | 同上 | 有基线但没有训练中新样本，完整60秒后两项无法比较 | [结果](../output/review-reliability-20261012/final-v12/fault-evidence/no-update/screenshots/fault-breathing-result.png) | 同上 |
| 动作订阅失败 | 同上 | 完整30秒0动作/0命中/0分，清楚提示无法记录；再次进入可主动退出 | [失败提示](../output/review-reliability-20261012/final-v12/fault-evidence/motion-failure/screenshots/fault-motion-unavailable.png)、[0分结果](../output/review-reliability-20261012/final-v12/fault-evidence/motion-failure/screenshots/fault-zero-score-result.png) | 真机不支持/系统拒绝订阅未验证 |
| 四位得分、两行说明 | 隔离布局包，466/480 | 原3000换行裁切已复现并修复；修复后单行居中；两行说明可读 | [466布局](../output/review-reliability-20261012/final-v12/fault-evidence/layout/emulator-5556/max-score/screenshots/layout.png)、[480布局](../output/review-reliability-20261012/final-v12/fault-evidence/layout/emulator-5554/max-score/screenshots/layout.png) | 静态3000/30只是排版检查，紧凑/短视口有本地契约，未做其他尺寸运行验收 |
| 轻轻停留圆圈静止 | 正式Release，466；隔离4-2-6故障包，480 | 停留挂载无动画的独立圆圈；三张正式截图圆圈RGB逐像素相同；4-2-6也检查静止 | [正式像素核对](../output/review-reliability-20261012/final-v12/emulator-video/hold-pixel-verification.json)、[480故障画面](../output/review-reliability-20261012/final-v12/fault-evidence/large-values/hold-probe/screenshots/hold-1.png) | 只比较指定圆圈ROI，倒计时继续变化；其他尺寸仅契约检查 |
| 右手完整、中心向外扩散 | 正式Release，466正向输入；480目标动画与布局 | 扩大人物绘制区而不移动身体中心；节拍与命中用不同波纹动画；466实际输入命中时右拳完整，五层固定同心环依次亮起并向外淡出，避免镜像几何动画的圆心漂移 | [正式命中截图](../output/review-reliability-20261012/final-v12/emulator-video/screenshots/video-boxing-hits.png)、[圆心复核](../output/review-reliability-20261012/final-v12/emulator-video/radial-verification.json)、[完整录像](../output/review-reliability-20261012/final-v12/emulator-video/emulator-sensor-input-full.mp4) | 480应用未收到动作输入，未称480命中链路通过；short视口有几何契约，未作对应实际视口运行验收 |
| 退出提示不挤动按钮 | 正式Release和隔离动作失败包 | 动作提示预留18px，连接中/失败/无提示时按钮位置稳定；正常十次退出及故障退出实际成功 | [动作失败退出](../output/review-reliability-20261012/final-v12/fault-evidence/motion-failure/screenshots/fault-active-exit-home.png) | 真人触控体验待真机检查 |
| 最大合理指标/最长当前错误 | 隔离故障包，480 | 220/100、现有动作失败说明可读，没有NaN、undefined或空白结果 | [大数值](../output/review-reliability-20261012/final-v12/fault-evidence/large-values/screenshots/fault-home.png) | 真机字体/触控手感 |
| 另一尺寸完整运行 | 正式 Release，实际480×480 VVD | 完整60秒呼吸+30秒拳击和两种主动退出均成功；该完整拳击局实际得分0、命中0/30。动作接口状态另以截图/日志记录，不因RPC回读成功而宣称应用收到输入；这是实际运行而非截图缩放 | [设备](../output/review-reliability-20261012/final-v12/emulator-480/device.json)、[时间线](../output/review-reliability-20261012/final-v12/emulator-480/timeline.jsonl) | 仅466/480，其他范围不声称通过 |
| 最终录像 | 正式 Release，466 | 首页→完整60秒→结果→首页→完整30秒拳击→结果→首页；真实帧时间、未剪辑/加速、带模拟输入字幕 | [完整MP4](../output/review-reliability-20261012/final-v12/emulator-video/emulator-sensor-input-full.mp4)、[播放验证](../output/review-reliability-20261012/final-v12/emulator-video/player-verification.json) | 静音录屏；仅模拟器，非人体/健康效果证据 |
| 构建/来源/交付一致 | 主机工具+实际包安装 | 测试与两个构建命令成功；安装回执、ZIP内RPK哈希与最终验收包一致；内部Markdown链接通过 | [构建回执](../output/review-reliability-20261012/final-v12/build-receipt.json)、[交付摘要](../output/review-reliability-20261012/final-v12/evidence.json) | 本地评审签名，不等同正式分发授权 |

三轮分别测得：

| 轮次 | 呼吸有效时长 | 拳击有效时长 | 拳击目标 | 动作 / 命中 |
| --- | --- | --- | --- | --- |
| 1 | 60460 ms（到结果就绪，含渲染） | 30672 ms（到结果就绪，含渲染） | 30 | 完成计数日志缺失，末次观察0 / 0 |
| 2 | 60683 ms（到结果就绪，含渲染） | 30040 ms（前台时钟） | 30 | 0 / 0 |
| 3 | 60483 ms（到结果就绪，含渲染） | 30045 ms（前台时钟） | 28 | 0 / 0 |

到结果就绪的时长含渲染延迟，不能当成精确训练时钟。第一轮拳击完成诊断缺失，结果页实际0分/0命中、末次动作观察0；完整动作总数保留null，不补写0。第二、三轮完成诊断动作计数均为0。
资源是系统Umem和ps的前后快照：

| 场景 | 系统已用字节（前→后） | 差值 | 正式应用线程（前→后） |
| --- | --- | --- | --- |
| rounds | 17447452 → 17514108 | +66656 | 1 → 1 |
| exits | 17515428 → 17514148 | -1280 | 1 → 1 |

这些观察不能分离应用堆与镜像缓存，也不能证明无泄漏。本次两组前后应用线程都为1，不把线程计数等同应用堆分析。历史多次换包后出现文件错误24/描述符接近上限；[失败与重启恢复记录](../output/review-reliability-20261012/final-v12/emulator-positive/failures/repeated-install/device.log)已保存。冷启动扫描期间曾安装超时，未报告成功；等服务/表盘稳定后重试。480布局包有一次uv_loop_init失败并超时，重启本评审实例后复验，原因尚未定位到具体模块。本轮最终候选连续换包后也复现错误24/uv_loop_init失败；保留旧失败日志，只重启本任务466实例。SDK残留已退出进程的注册记录使首次重试gRPC超时，核对进程已退出后仅归档该实例注册文件；重启后的序列号由5560变为5556。冷启动扫描期安装超时，等待表盘后工具重试成功。一次训练的onReady日志丢失造成自动验收超时，保留原记录；复验改用新会话诊断与真实截图核对UI。结算诊断早于结果实际渲染，400ms等待导致点到旧训练画面；[提前点击失败记录](../output/review-reliability-20261012/final-v12/emulator-rounds/failures/early-result-click/timeline.jsonl)保留，改为3000ms渲染等待后重新执行三轮并逐张检查结果/首页。再次启动已在前台的应用没有onShow，[前台启动等待失败](../output/review-reliability-20261012/final-v12/emulator-exits/failures/foreground-no-show/run.json)保留；十退出直接继续现有首页而不重新启动，逐次记录新训练与退出。未放宽训练时长、计分或后台暂停判断，最终成功不覆盖这些限制。

完整录像是另一次独立运行：拳击7动作、7命中、400分；它与正向边界序列的200分不是同一场。录像已完成全文件离线解码，并在本地浏览器点击播放后自然到达109.36秒ended状态，无播放错误；没有seek或加速。[播放结束截图](../output/review-reliability-20261012/final-v12/emulator-video/player-ended.png)与播放器状态独立保存。

未覆盖：目标真机、真人动作识别/误触发、健康效果、正式系统接口强制故障、精确4.5的模拟器系统接口边界、466/480以外的实际运行、长期内存/描述符寿命、系统断网切换、现场人员手动彩排。震动/历史记录/真人采样只列入后续任务。

2026-10-13交付整理时重新检查：ADB没有连接设备，主机没有模拟器进程，但SDK仍列出旧VVD注册；最终首页恢复尝试因gRPC连接超时失败，未报告成功。12日验收证据保持原始日期，不能据此称13日设备仍运行。现场应先确认进程与ADB，再用已有VVD启动；若注册残留，核对指定实例进程已退出后归档该实例记录，不能清理无关实例。新版独立审阅因服务用量限制未完成；主代理已核对源码、最终回执与实际画面。
