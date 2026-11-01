# 呼吸柔光与运动拳手落地（2026-10-14）

分支：`codex/breath-athlete-polish`；基线：`6d1391436055cba7534a344f265c87b3890fa02a`。

已按用户确认的“柔光同心环 + 精修运动拳手”修改两个训练页面。呼吸使用同心细环、柔光和明亮核心；运动拳手保留护脸站姿、厚拳套、腕带、背心、屈膝与出拳后回防。其他页面和动作阈值、评分、训练时长没有改变。

## 手表实现

工具链的 Canvas 声明标注 Vela 不支持，因此把批准的绘图函数保留在 `scripts/training-drawing.js`，生成 41 张呼吸帧、8 张待机帧和 12 张出拳帧，用原有训练时钟选择本地图片。没有新增动画计时器，也没有引入网页预览的命中按钮。呼吸时钟刷新间隔为 50ms，显示值相同不重复写入；背景暂停依然由原有有效训练时钟负责。

吸气与呼气使用余弦缓动，4-2-4 和 4-2-6 均保持阶段连续。命中不重置正在伸出的手，出拳结束会回到防守。固定同心波纹仍只改变透明度，延迟 120ms 后依次释放，避免运行时几何插值造成圆心漂移。

呼吸图先合成到训练页的固定背景，再做 RGB 调色板压缩，避免低透明度柔光被 RGBA 八叉树量化成明显色阶；拳手保持透明边距。资源约 1.00 MiB。普通呼吸舞台缩为 230px，保证退出按钮完整可见。帧资源路径带渲染器与压缩程序的内容版本 `training-8a8ab3423b8f`，防止更新安装后继续显示原生图片缓存中的旧资源。

```powershell
# 两个依赖路径指向已有 Playwright 和带 Pillow 的 Python，不自动安装或下载。
node scripts/generate-training-assets.js --playwright <已有Playwright模块路径> --python <已有Python可执行文件>
npm test
npm run build
npm run build:release
```

生成后的图片已纳入源码；正常构建不需要重新生成。绘图程序是可维护的代码来源，无需依赖聊天预览文件。`extract-training-drawing.js` 仅用于导入已批准的绘图函数。

## 本次证据

| 检查 | 实际结果 | 记录 |
| --- | --- | --- |
| 全套主机测试 | 107 通过，0 失败；新增真实页面时钟与动作回防回归；旧 CSS 零件契约替换为帧绑定、资源存在和像素边界检查 | [测试日志](../output/training-polish-20261014/tests-delivery.txt) |
| Debug / Release | 均构建成功；两个包各包含 61 张训练图片 | [构建回执](../output/training-polish-20261014/build-evidence.json) |
| 466 完整呼吸 | 60 秒训练、结果页、返回首页；柔光与底部按钮已检查 | [保持阶段](../output/training-polish-20261014/delivery-466/screenshots/breathing-hold.png)、[结果](../output/training-polish-20261014/delivery-466/screenshots/breathing-result.png) |
| 480 完整呼吸 | 同上，实际 480×480 窗口 | [保持阶段](../output/training-polish-20261014/delivery-480/screenshots/breathing-hold.png)、[结果](../output/training-polish-20261014/delivery-480/screenshots/breathing-result.png) |
| 466 独立拳击复验 | 完整 30 秒，系统传感器输入；结果组件为 640 分、10/30 命中、最高连击 3 | [记录](../output/training-polish-20261014/positive-final-466/summary.json)、[结果画面](../output/training-polish-20261014/positive-final-466/screenshots/result.png) |
| 480 独立拳击复验 | 完整 30 秒；完成诊断为 33 动作、590 分、11/30 命中、最高连击 3 | [记录](../output/training-polish-20261014/positive-final-480/summary.json)、[结果画面](../output/training-polish-20261014/positive-final-480/screenshots/result.png) |
| 前后台日志复核 | 实际 Home 隐藏后，设备时间经过 5970ms，有效训练时间只增加 141ms；恢复后继续进度更新 | [日志复核](../output/training-polish-20261014/background-final-466/log-recheck.json) |

Release 为 `956922` 字节，SHA-256：`1eafabb66e890c4de7ea6d58b996b784456671658a7cdbf673fca7f205a086ba`。Debug 为 `1120634` 字节，SHA-256：`cb9df0b401d4503bc8c549dac91ecdf6cbfbcd0af7850d84b868b12b358998d6`。

## 证据边界与保留的失败

两尺寸独立拳击不是前面的连续训练场景，不互换结果。首次最终包连续场景在动作连接等待处超时，自动脚本退出；不能宣称整套连续场景通过。后续独立场景覆盖真实系统传感器输入、完整拳击计时与结果画面，没有直接写分数。

前后台自动采集脚本因前台 show 日志缺失或截断而超时，整个自动场景没有记为 PASS。保存的应用 hide 与随后 progress 诊断证明有效时钟暂停与恢复；这是日志复核，不能替代完整自动场景成功。重试的原始记录继续保留。模拟器首次启动时安装超时、前期帧边缘和渐变调整、旧图缓存、采集器过早截图或将组件就绪误判为缺少完成诊断的记录也未删除。

上述是官方模拟器及主机证据；未验证目标真机上的长期帧率、功耗、真人动作准确率或健康效果。没有推送、合并或发布。
