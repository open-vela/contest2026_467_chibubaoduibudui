# 女拳手与性别匹配

实现分支：`codex/boxing-gender`，基线：`46d3cd1`。功能与录像完成于 2026-10-14，合并前复验于 2026-10-15。

## 行为

节奏拳增加高马尾、紫蓝背心的女拳手，包括 8 张待机帧、12 张出拳帧。两套拳手共用原有有效训练时钟、出拳回防、动作阈值、计分与 30 秒时长。没有新增动画计时器，手表端仍显示本地 PNG，不依赖 Canvas。

从首页进入节奏拳时，优先使用可读取的表主性别，其次使用 `system.storage` 保存的选择。两者都不可用时显示男女拳手卡片；保存成功后开始训练，保存失败提示重试。返回或离开应用会取消等待，迟到回调不能启动训练，保存过程中重复点击也不能覆盖当前选择。

读取与保存均有超时降级。仅识别明确的字符串 `male/female/男/女`，不推断不同厂商含义不一致的数字枚举。

## 自动读取的边界

当前 SDK 和比赛镜像没有确认可用的公开表主资料接口。`profile.js` 仅在可选厂商扩展 `health.getUserInfo` 是函数时调用它，并兼容回调、Promise 和直接返回资料的形式。接口缺失、拒绝、失败、超时或资料无法识别时，使用已保存选择或首次选择。

主机测试验证了该适配的优先级和降级逻辑；这不代表已经在比赛镜像、目标真机或绑定手机上成功取得表主性别。

## 资源与复现

女拳手源码为 `scripts/female-fighter-drawing.js`，生成入口为 `scripts/generate-female-fighter.js`。20 张 PNG 共 81,185 字节，位于 `src/common/fighter-female-3283c8a4601e/`。资源标识覆盖绘图、原有动画曲线、压缩程序和生成器源码，避免改采样参数后继续命中原生旧图缓存。

```powershell
node scripts/generate-female-fighter.js --playwright <已有Playwright模块路径> --python <已有且带Pillow的Python路径>
npm test
npm run build
npm run build:release
```

正常构建使用已纳入源码的 PNG，无需再次生成。临时存储排查日志已在合并前移除，恢复为录像使用的系统适配。

## 已有证据

以下路径是保留在本地的验证产物，不随源码提交。

- 主机测试曾通过 118 项，覆盖性别优先级、存储恢复、失败重试、取消与迟到回调、女性动画完整性及图像边缘；记录为 `output/boxing-gender-20261014/tests-final.txt`。
- 466×466 官方模拟器通过男拳手首次选择、完整 30 秒训练、结束进程后恢复已保存选择及退出；记录为 `output/boxing-gender-20261014/final-466/summary.json`。
- 480×480 官方模拟器确认选择页、女拳手训练和结果页正常。冷启动恢复的采集曾超时，完整失败记录保留于 `output/boxing-gender-20261014/final-480-selected/`。后续录像从已保存的女拳手直接开始，但没有重新完成该冷启动验收用例，不能将它标成通过。
- 女拳手视频为 `output/female-boxer-video-20261014/female-boxer-demo.mp4`，40.28 秒，包含完整训练与结果页，未剪辑、未加速、静音。通过系统传感器输入演示，原生结果页显示 2220 分、24/30 命中、最高连击 24。该场数据不与其他场次混用。
- 视频全量解码通过，浏览器以 1 倍速自然播放到结束，`ended=true`、`error=null`、`readyState=4`。原始采集器因缺少完成诊断而失败的回执仍保留；最终核验依据原生结果组件、实际结果画面与会话时间，见 `output/female-boxer-video-20261014/video-acceptance.json` 和 `playback.json`。

录像所用 Release 为 1,043,310 字节，SHA-256：`fdc4d5eee32f9b0eab99b3cbba3686c12608b2654c9dcd65da5516d04239ca44`。这是 2026-10-14 的录像包，不用它冒充后续重新构建的包。

2026-10-15 合并前复验日志保存在 `output/boxing-gender-merge-20261015/`。首次复验有 5 项交付工具测试因本机缺失锁文件已声明的模拟器依赖而失败，原始输出保留为 `feature-tests.txt`。按原锁文件恢复依赖后，完整主机测试 118 项通过、0 失败，记录为 `feature-tests-restored.txt`，未覆盖失败记录。

同日 Debug 和 Release 均重新构建成功，包大小与 SHA-256 见 `build-evidence.json`；它们没有重新进行模拟器验收。重建前的旧包另存于 `output/boxing-gender-merge-20261015/previous-rpk/`，原有录像和全部失败记录保持保留。

以上是主机和官方模拟器证据，不代表目标真机的长期性能、真人动作准确率或健康效果。
