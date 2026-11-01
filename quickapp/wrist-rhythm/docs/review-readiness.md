# 腕上节律本轮评审说明

最新增量版本为 2026-10-13 的节奏拳波纹放大，源码 `f009b23`，详见 [本次复验与新视频](boxing-wave-larger-20261013.md)。下文保留 2026-10-12 的 `753b744` / `final-v12` 验收记录；后台、三轮、十次退出和故障证据属于该版，本次没有重跑这些场景。

本轮继续原分支 codex/review-readiness，源码来源 753b744f757690d4eaffc5a7be0a86588c7fba72；最终目录 output/review-reliability-20261012/final-v12。历史20261011及final-v1至v11材料保留，不代替本次包证据。

产品仍是完整60秒呼吸与30秒节奏拳。心率/压力独立有效性、原60/300秒TTL、周期边界节奏切换、有效前后样本比较、后台暂停恢复及主动退出策略不变。提前结束直接回首页，不生成“完成全程”结果。得分按100/70/40窗口累计，命中数单独统计；原4.5阈值、350ms防抖及训练时长均未改变。

本轮修复首页缺失状态字样拥挤、拳击结果3000分换行裁切，以及本次用户指出的三处UI：轻轻停留使用独立静态圆圈、扩容绘制区让右手完整、五层同心环从中心按半径依次亮起和淡出。原scale、仅尺寸动画与位置动画在目标镜像仍漂移，失败探测保留；最终只用已实测的静态布局和透明度动画。动作提示预留固定空间，避免失败说明挤动退出按钮。保留只写日志的会话/动作/视图就绪诊断。可维护工具支持设备/路径/输出目录、明确安装完成、真实Home生命周期、传感器异步读回、实录、严格白名单打包与哈希/链接检查。修复了PS5.1多实例选择、日志丢行时的真实生命周期判断、主机/设备时钟偏差、完成诊断字段及自定义验收文件与ZIP不一致的问题。

正式Release已在466×466和480×480实际运行；正向动作命中在466完成，480单次完整局如动作不可用则明确按零分降级记录，不把传感器RPC回读等同应用动作。正向动作、前后台、三轮完整流程、十次退出、最终实录均留独立记录。无数据/部分数据/过期/没有新样本/动作失败在独立水印故障包上完成实际渲染。详细结果与边界见 [验证矩阵](verification-matrix.md)。本地测试实际统计来自日志：113通过、0失败；数量不作为产品可靠性的替代证据。

时间戳仅支持Unix秒/毫秒，不支持开机相对时间；量程、时间戳解释和推送周期仍需目标真机核对。旧官方接口链接返回概述页且ux-types缺少subscribeSample定义，不能据此宣称厂商接口已验证。

模拟器健康样本不是人体采集。模拟器传感器输入，不代表真人动作识别准确率。故障包不能证明正式包的系统服务强制故障；静态3000布局不能证明动作得分。结果中的单次数值变化不证明健康效果。两尺寸以外、目标真机和真人准确率均未验证。

构建来源的跟踪文件没有未提交改动；工作区dirty=true是保留历史未跟踪目录。构建回执记录输入哈希、命令、工具版本、包大小和SHA-256；交付摘要另外记录文档交付提交。Debug/Release串行隔离构建，禁用不兼容镜像的CSS属性压缩。正式包不携带可启用的故障健康源。ZIP只包含本次必需文件，排除故障RPK、原始视频帧、SDK、镜像、凭据与缓存。

现场从项目根目录使用已准备好的依赖和SDK；看 [现场操作](现场操作.md)、[故障应对](故障应对.md)。完整录像静音、未剪辑/未加速，保留模拟输入字幕。多次换包后错误24、描述符接近上限，以及冷启动扫描期安装超时的记录保留；必要时只重启本评审实例，待表盘/服务稳定后重试。正常演示先准备一次安装，避免现场反复替换故障包。

已实现并经正式模拟器验证：主流程、真实Home暂停恢复、动作正向边界、三轮/十退出、此次UI与完整实录；隔离水印测试验证了异常页面和布局，但正式系统服务强制故障尚未设备验证。依赖真机/真人：接口单位、准确率、误触发、健康效果和触控体验。

本地源码提交（2825fa5之后，按先后）：

- ed0edbd fix: keep unavailable health labels readable on round screens
- c27d4bc feat: add reproducible review tools and isolated fault evidence
- 2d48b21 fix: select review device reliably in Windows PowerShell
- 0db2299 fix: wait for actual review transitions and record sensor decisions
- dbd9f0f fix: recognize fresh onShow when emulator log buffer drops page marker
- 93eee40 fix: confirm real Home lifecycle despite emulator log loss
- 9667035 fix: schedule sensor sequences against observed emulator elapsed time
- 4c138d8 fix: report the active clock in completed session diagnostics
- 4244c4f fix: click the actual fault exit button on 480 pixel emulator
- 9be6620 fix: keep four digit boxing results on one line
- e1c7a11 fix: package the acceptance record actually validated
- b896b6a fix: target interior exit controls in emulator acceptance
- f3e4b91 fix: hold breathing still and keep boxing feedback centered
- b095eaa fix: isolate the static hold phase and center outward boxing waves
- 753b744 fix: emit centered boxing pulses without unreliable geometry tweens

本轮没有重生成旧Word/PDF，没有人工签字，没有推送、合并或发布。签名仅用于本地评审/开发，不等同正式分发授权。评审后任务按收益/成本见 [后续任务](后续任务.md)。

2026-10-13交付整理时重新检查：ADB没有连接设备，主机没有模拟器进程，但SDK仍列出旧VVD注册；最终首页恢复尝试因gRPC连接超时失败，未报告成功。12日验收证据保持原始日期，不能据此称13日设备仍运行。现场应先确认进程与ADB，再用已有VVD启动；若注册残留，核对指定实例进程已退出后归档该实例记录，不能清理无关实例。新版独立审阅因服务用量限制未完成；主代理已核对源码、最终回执与实际画面。
