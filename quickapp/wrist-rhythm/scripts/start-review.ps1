[CmdletBinding()]
param(
  [string]$SdkHome,
  [string]$VvdName,
  [string]$Serial,
  [string]$Rpk,
  [string]$OutputDirectory,
  [string]$AdbPath,
  [int]$GrpcPort = 8556,
  [int]$DebugPort = 10057,
  [switch]$CheckOnly
)
$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
if (-not $Rpk) { $Rpk = Join-Path $taskRoot 'dist/com.openvela.wristrhythm.release.1.0.0.rpk' }
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $taskRoot 'output/review-launch' }
if (-not $AdbPath) { $AdbPath = Join-Path $taskRoot 'node_modules/@miwt/adb/bin/win/adb.exe' }
Push-Location $taskRoot
try {
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node 未找到；安装 Node.js 22+ 或使用已有运行时路径。' }
  if (-not (Test-Path -LiteralPath $AdbPath)) { throw "ADB 不存在：$AdbPath；指定 -AdbPath。" }
  if (-not (Test-Path -LiteralPath $Rpk)) { throw "RPK 不存在：$Rpk；先 npm run build:release 或指定 -Rpk。" }
  $taskOut = [IO.Path]::GetFullPath($OutputDirectory)
  New-Item -ItemType Directory -Force -Path $taskOut | Out-Null
  & node --version
  & $AdbPath devices -l
  $runningJson = & node -e "console.log(JSON.stringify(require('@aiot-toolkit/emulator/lib/emulatorutil').getRunningAvdConfig()))"
  if ($LASTEXITCODE -ne 0) { throw '模拟器工具链不可用；在项目目录 npm install 后重试。' }
  $running = ConvertFrom-Json -InputObject ($runningJson -join "`n")
  $selected = @($running | Where-Object { if ($Serial) { ('emulator-' + $_.'port.serial') -eq $Serial } elseif ($VvdName) { $_.'avd.name' -eq $VvdName } else { $true } })
  if ($CheckOnly) { $selected | Format-List 'avd.name','port.serial','grpc.port'; return }
  if ($selected.Count -gt 1) { throw '发现多个实例；指定 -Serial 或 -VvdName。' }
  if ($selected.Count -eq 0) {
    if ($Serial) { throw "指定设备 $Serial 没有运行；检查 ADB 和 VVD，不能用另一实例替代。" }
    if (-not $SdkHome -or -not $VvdName) { throw '没有匹配的运行实例；指定已有 -SdkHome 和 -VvdName 启动。不自动下载。' }
    $startCmd = & node (Join-Path $PSScriptRoot 'review-vvd.js') --sdk $SdkHome --vvd $VvdName --grpc $GrpcPort --debug $DebugPort
    if ($LASTEXITCODE -ne 0) { throw 'VVD 配置失败；检查 SDK 路径、已有镜像和 VVD 名称。' }
    $startInfo = ($startCmd | Select-Object -Last 1) | ConvertFrom-Json
    Start-Process -FilePath $startInfo.executable -ArgumentList $startInfo.arguments -WorkingDirectory $SdkHome -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskOut 'emulator-stdout.log') -RedirectStandardError (Join-Path $taskOut 'emulator-stderr.log') | Out-Null
    $deadline = (Get-Date).AddSeconds(60)
    do {
      Start-Sleep -Milliseconds 500
      $runningJson = & node -e "console.log(JSON.stringify(require('@aiot-toolkit/emulator/lib/emulatorutil').getRunningAvdConfig()))"
      $startupConfigs = ConvertFrom-Json -InputObject ($runningJson -join "`n")
      $selected = @($startupConfigs | Where-Object { $_.'avd.name' -eq $VvdName })
    } until ($selected.Count -eq 1 -or (Get-Date) -ge $deadline)
    if ($selected.Count -ne 1) { throw 'VVD 60 秒内未注册；查看 emulator-stderr.log，核对镜像和端口占用。' }
  }
  $selectedSerial = 'emulator-' + $selected[0].'port.serial'
  & node (Join-Path $PSScriptRoot 'review-emulator.js') --serial $selectedSerial --adb $AdbPath --rpk $Rpk --output $taskOut
  if ($LASTEXITCODE -ne 0) { throw '安装或启动未通过；查看 device.log 的具体错误。休眠时按一次电源键唤醒，再核对 launched.png。' }
  Write-Output "本次安装完成日志与页面 show 已确认：$taskOut。请核对 screenshots/Launched.png；休眠画面可能滞留，按电源键唤醒。"
} finally { Pop-Location }
