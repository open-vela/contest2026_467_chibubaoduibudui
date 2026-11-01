# 可维护的评审工具

从已安装依赖的项目根目录执行；工具不下载 SDK，不修改全局环境变量，不关闭无关实例。PowerShell 文件带 UTF-8 BOM，兼容 Windows PowerShell 5.1。

```powershell
# 检查已有实例与工具，尚不安装
.\scripts\start-review.ps1 -CheckOnly -VvdName WristRhythm_Review_20261012

# 安装指定包、等本次真正安装成功、核对构建时间戳、启动并导出日志
.\scripts\start-review.ps1 -VvdName WristRhythm_Review_20261012 -Rpk .\dist\com.openvela.wristrhythm.release.1.0.0.rpk -OutputDirectory .\output\现场启动

# 无现有实例时，启动已有 VVD。SDK、镜像和 VVD 必须已经准备好
.\scripts\start-review.ps1 -SdkHome F:\tmp\wristrhythm-review-sdk-20261012 -VvdName WristRhythm_Review_20261012 -OutputDirectory .\output\现场启动

# 生成并执行传感器正向序列；不能与其他控制同一设备的脚本同时执行
node scripts/review-plans.js positive output/positive-plan.json
node scripts/review-emulator.js --vvd WristRhythm_Review_20261012 --rpk dist/com.openvela.wristrhythm.release.1.0.0.rpk --plan output/positive-plan.json --output output/positive

# 锁定当前来源，串行运行全部测试、Debug、Release，并拷贝产物
node scripts/review-delivery.js --action build --output output/final-review
# 实际验收后准备 acceptance.json、文档和白名单证据，再打包
node scripts/review-delivery.js --action pack --output output/final-review
```

`review-plans.js` 支持 positive / background / exits / rounds / video。默认坐标针对 466×466；其他尺寸需按实际画面确认按钮坐标。计划记录预定时间，`timeline.jsonl` 记录实际执行时间；截图只是采样，不代表每毫秒的状态。

`capture-review.js --serial … --rpk … --plan … --output … --ffmpeg <本地编码器>` 录制完整计划。帧持续时间来自实际采集时间，保存原始帧、编码日志、视频元数据和离线完整解码日志；不加速。视频附模拟器与传感器输入标记。

故障渲染使用 `build-fault-review.js --scenario hr-missing|stress-missing|both-missing|stale|no-update|motion-failure|large-values --output <故障目录>`，由 `accept-fault-review.js --serial … --artifacts <故障目录> --output <故障目录>` 执行。这些包固定使用独立 `.fault` 包名，画面标注“故障注入·模拟”。正式构建没有开关可启用该源；故障 RPK 不进入正式交付 ZIP。

打包只收录正式回执中的两个 RPK、指定文档与工具、指定验收目录的证据；拒绝额外 RPK、越界路径、私有设置、原始帧和故障包。校验 ZIP 内 RPK 哈希、构建和测试输入集合、实际测试统计与 Markdown 链接。评审记录提交可晚于构建源码提交；只在构建及测试输入完全一致时允许打包，分别记录二者 SHA。

模拟器休眠时截图可能滞留在最后一帧。启动日志只确认安装和页面 show，现场还需核对可见画面；按一次模拟器电源键可唤醒。安装前替换旧二进制可以停止本应用，后台测试必须用 Home 键，不能用 `am stop`。

本轮目标镜像的日志缓冲可能丢失组件 onReady。工具默认等待真实就绪日志；缺失时保留失败，不把等待时间当作通过。最终三轮/十退出另以新会话诊断、3000ms渲染等待、实际截图及后续页面转换复核；相关计划和时间线随交付保存。已在前台的应用再次 am start 可能没有 onShow，连续场景直接继续现有首页。

SDK实例注册可能在进程退出后保留；CheckOnly的注册列表不是存活证明。检查ADB与模拟器进程；连接失败时保存日志，核对确为本评审已退出实例后只归档它的注册记录，再启动已有VVD。本次13日恢复尝试超时，未标成功。

13日后续波纹放大复验中，确认原PID 18636、62760均不存在且两条注册属于本评审VVD后，将对应 `pid_*.ini` 归档到 `output/review-reliability-20261013/boxing-wave-larger/`。随后成功启动已有466和480实例，本次序列号分别为 `emulator-5554`、`emulator-5556`；不能沿用旧版的序列号映射。此前恢复超时记录继续保留，未处理其他实例。新包与证据见 [增量复验](boxing-wave-larger-20261013.md)。
