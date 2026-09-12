# 打包产物

- `com.openvela.wristrhythm.debug.1.0.0.rpk`：使用 AIoT Toolkit 2.0.5 的演示签名生成，用于评审和模拟器验证。
- `com.openvela.wristrhythm.release.1.0.0.rpk`：参赛提交使用的生产模式包，启用 JSC、CSS 属性优化、PNG8 和移除 console。

## Release 可核验信息

```text
文件：com.openvela.wristrhythm.release.1.0.0.rpk
大小：49,153 bytes
SHA-256：ADEA1DC175F9D076D2BA99BFCF793098F20FA3286B1440CFB0F6715D845B8B8A
工具链：AIoT Toolkit 2.0.5 / Node.js 24.19.0 / Windows x64
命令：npm run build:release
参数：production + JSC + optimize-css-attr + image-png8 + drop-console
```

该 release 包使用本机受控签名凭据生成，用于大赛评审和模拟器验证。仓库不包含私钥或分发凭据；面向应用商店或设备正式分发时，应由发布方重新使用其生产凭据签名。
