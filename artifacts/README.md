# 打包产物（2026-11-01）

两个安装包均由本次同步的 `quickapp/wrist-rhythm/` 源码重新构建，仅供开发与评审验证。

| 模式 | 文件 | 大小（bytes） | SHA-256 |
| --- | --- | ---: | --- |
| Debug | `com.openvela.wristrhythm.debug.1.0.0.rpk` | 1,216,198 | `d69a1feac589138b2c151be039386c6826266464c34b67b857eb3c53a82fd44f` |
| Release | `com.openvela.wristrhythm.release.1.0.0.rpk` | 1,050,915 | `b15be81fd35b40190275a7fb8e78e23fdb1131631d128bf3cae9e7f164db8e1e` |

- 工具链：AIoT Toolkit 2.0.5 / Node.js 24.19.0 / Windows x64。
- 构建命令：应用目录执行 `npm run build`、`npm run build:release`。
- Release 参数：`release --enable-jsc --enable-image-png8 --drop-console false`。保留诊断日志，禁用 CSS 属性名压缩以兼容比赛镜像。
- Debug 使用工具链默认演示签名；Release 将同一工具链公开提供的演示证书与配套密钥临时配置在本地 `sign/release/` 后进行生产模式构建。该目录和 PEM 文件均不提交。干净 checkout 需要先在本地配置签名文件才能执行 Release 打包。
- 两个 RPK 均检查包含 `manifest.json`、`META-INF/CERT`，Release 包含 2 个 `.jsc` 文件；未包含 PEM、PPT 或视频文件。
- 本次应用 198 项测试及赛事契约 5 项测试通过；未重新执行模拟器、真机或真人验收。

Release 表示工具链生产编译模式，并不代表具备正式分发签名。面向应用商店或设备正式分发时，应由发布方使用其生产凭据重新签名；仓库不包含任何私钥或分发凭据。
