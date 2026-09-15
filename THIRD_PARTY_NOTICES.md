# Third-party notices

“腕上节律”的应用源码以 Apache License 2.0 发布。

生产 RPK 只包含项目源码编译结果和仓库内应用图标，不打包 Node.js 开发依赖。构建和测试阶段直接使用以下依赖：

| 依赖 | 固定版本 | 许可证 | 用途 |
| --- | --- | --- | --- |
| `aiot-toolkit` | 2.0.5 | ISC | 快应用开发与发布构建 |
| `@aiot-toolkit/jsc` | 1.0.8 | ISC | JSC 字节码生成 |
| `@aiot-toolkit/velasim` | 0.1.26 | ISC | openvela 模拟器集成 |
| `ux-types` | 1.7.0 | MIT | `.ux` 开发类型支持 |

完整的传递依赖、版本和完整性摘要见 `quickapp/wrist-rhythm/package-lock.json`。各依赖仍受其各自许可证约束。

`quickapp/wrist-rhythm/docs/images/` 中的画面由仓库内应用在 AIoT 模拟器中运行后截取；线框拳击手和呼吸球由 `.ux` 基础图形与样式绘制，不包含外部人物图片或动画素材。
