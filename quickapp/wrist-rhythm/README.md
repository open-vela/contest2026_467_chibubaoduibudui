# 腕上节律

| 健康首页 | 稳态呼吸训练 |
| --- | --- |
| ![健康首页](docs/images/home-preview.png) | ![稳态呼吸训练](docs/images/steady-training.png) |

| 节奏拳训练 | 稳态训练结果 |
| --- | --- |
| ![节奏拳训练](docs/images/boxing-training.png) | ![稳态训练结果](docs/images/steady-result.png) |

面向 openvela 手表的身心训练快应用。当前版本包含“稳态 60”和“节奏拳”两个模式：前者用心率与压力驱动 60 秒呼吸训练，后者用单腕加速度动作完成 30 秒节拍挑战。

## 已完成功能

- 心率与压力最近值读取及实时订阅
- 高值与上升趋势的本地判定
- 主动开始或根据状态提示开始训练
- 标准节奏（4-2-4）与舒缓节奏（4-2-6）
- 依据训练期间压力和心率变化，在完整呼吸周期边界调整节奏
- 基于真实经过时间的 60 秒倒计时
- 训练前后心率、压力及差值结果
- 健康数据不可用时的离线训练降级
- 加速度突变识别与 350ms 动作防抖
- 精准、良好、命中三级节拍评分与连击统计
- 根据实时心率降低出拳节拍速度
- 加速度计不可用时显式进入点击模拟模式
- 480×480 圆形表盘安全区布局，并保留紧凑圆屏与短视口保护
- B1 棱镜夜光毛玻璃视觉：稳态 60 使用青蓝静息能量，节奏拳使用玫红爆发与少量琥珀高光
- 随健康数据脉冲的首页生命仪表和随阶段变化的呼吸球
- 会待机、蓄力、出拳和反馈命中的霓虹线框拳击手

本应用只提供放松训练，不用于疾病诊断或治疗。

## 环境

- Node.js 22 或更高版本
- AIoT IDE
- `aiot-core` 与 `aiot-emulator` 1.7.22 或更高版本
- 模拟器镜像：`vela-miwear-watch-5.0(开发者大赛)`

## 安装、测试与构建

```bash
npm install
npm test
npm run build
npm run build:release
```

`npm test` 运行训练算法与纯逻辑辅助测试、可执行的页面生命周期/系统适配集成测试、组件契约测试，以及带可注入工具链夹具的实际 `runRelease()` 编排测试。openvela `.ux` 无法在 Node.js 中直接挂载，因此组件测试会执行组件事件方法并检查语义化的 props、父页面事件和布局绑定，最终由开发构建验证 `.ux` 编译集成。

`npm run build` 生成调试包；`npm run build:release` 使用 JSC、CSS 属性优化、PNG8 和移除 console 的生产参数生成发布包。仓库路径含非 ASCII 字符时，发布构建会在临时 ASCII 目录完成，并通过临时目标原子发布结果。

本地构建可使用工具链或受控环境提供的演示签名，仅用于开发验证，并不等同于可分发签名。正式分发必须使用由发布方管理的凭据；仓库不提供分发凭据。

构建产物位于：

```text
dist/com.openvela.wristrhythm.debug.1.0.0.rpk
dist/com.openvela.wristrhythm.release.1.0.0.rpk
```

## 图标量化

图标优化脚本支持并固定 `Pillow==12.3.0`。在 PowerShell 中使用以下确切命令生成待检查的临时图标：

```powershell
python -m pip install -r requirements-icon.txt
python scripts/optimize-icon.py src/common/app-icon-512.png "$env:TEMP\wristrhythm-app-icon-512.png"
```

确认临时文件仍为 512×512、索引色且透明边缘和主体视觉无误后，再替换项目图标。

## 模拟器验收

1. 使用 AIoT IDE 打开本目录。
2. 新建并启动 `vela-miwear-watch-5.0(开发者大赛)` 模拟器。
3. 编译并推送应用。
4. 验证冷启动后心率和压力开始刷新。
5. 验证样本不足时不出现主动提示，高值或上升趋势时出现“建议缓一缓”。
6. 点击“开始 60 秒”，验证吸气、停留、呼气和倒计时。
7. 验证呼吸球随吸气扩大、停留悬浮、呼气收缩，阶段文字和底部操作不发生位移。
8. 验证 B1 调色板：静息与呼吸状态以青蓝为主，拳击反馈以玫红为主，琥珀仅用于目标和高连击时刻，玻璃边框保持低对比度。
9. 完整运行 60 秒，验证结果页前后值、差值和只播放一次的完成光环。
10. 训练或节奏拳进行时切换到后台，确认会话和视觉反馈暂停，健康订阅、加速度计、连接超时计时器和训练计时器均被释放；返回应用后，倒计时从剩余时间继续，并重新建立需要的订阅。
11. 在健康接口不可用场景下验证降级文案，确认呼吸训练仍可开始。
12. 进入“节奏拳”，验证线框人物待机弹跳、目标出现时蓄力、命中时出拳并扩散冲击波，同时得分和连击更新。
13. 改变 Mock 心率，验证节拍从活力、平衡切换为舒缓速度。
14. 在不支持加速度计的设备上验证 1.6 秒后进入模拟模式，并可点击线框人物或模拟按钮完成整局。
15. 检查首页、两种训练和两个结果页，确认标题、指标、人物、提示和按钮均未被圆形边缘裁切，紧凑圆屏不发生裁切。

## 工程结构

```text
src/
  manifest.json                  手表、权限、后台订阅和路由
  common/app-icon-512.png        应用图标
  pages/index/index.ux           页面编排和会话/资源生命周期
  pages/index/components/        首页、呼吸、拳击和两个结果视图
  pages/index/steady.js          稳态判定和呼吸算法
  pages/index/health-core.js     健康数据纯规范化逻辑
  pages/index/health-adapter.js  可测试的健康系统调用与异常适配
  pages/index/health.js          service.health 系统适配
  pages/index/boxing.js          动作识别、评分和连击逻辑
  pages/index/motion.js          system.sensor 系统适配
  pages/index/session-clock.js   可暂停、可恢复的前台会话时钟
  pages/index/subscription-lifecycle.js 健康订阅所有权状态机
  pages/index/reactive.js        避免重复响应式写入
  pages/index/page-lifecycle.js  前台代际、资源清理与恢复边界控制器
test/steady.test.js              训练与拳击逻辑测试
test/runtime.test.js             时钟、订阅及响应式运行时测试
test/page-lifecycle.test.js      延迟回调、同步失败、清理和恢复集成测试
test/component-contract.test.js  组件 props、事件和布局装配契约测试
test/release-runner.test.js      发布构建和产物防陈旧测试
```

应用处于后台或被隐藏时会暂停当前会话，并释放健康、动作和计时器资源；再次显示时只恢复仍在进行的会话及其剩余时间。

## 加速度计兼容性

应用使用官方 `@system.sensor.subscribeAccelerometer({ interval: 'game' })`，不使用未公开的陀螺仪接口。官方支持列表显示该接口目前支持小米手环 9 / 9 Pro、小米手环 10和 Xiaomi Watch S5，其他设备可能不支持；应用会明确切换到点击模拟模式，稳态训练不受影响。

接口文档：[Xiaomi Vela 传感器 sensor](https://iot.mi.com/vela/quickapp/zh/features/system/sensor.html)
