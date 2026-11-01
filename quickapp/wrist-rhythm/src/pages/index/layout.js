// 屏幕形态纯逻辑层。系统设备信息由适配器提供。

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function resolveLayout(info) {
  const source = info || {};
  const width = finite(source.windowWidth)
    ? source.windowWidth
    : finite(source.screenWidth) ? source.screenWidth : 480;
  const height = finite(source.windowHeight)
    ? source.windowHeight
    : finite(source.screenHeight) ? source.screenHeight : 480;
  const shortestSide = finite(width) && finite(height)
    ? Math.min(width, height)
    : 480;
  const size = shortestSide < 400
    ? 'compact'
    : shortestSide >= 560
      ? 'spacious'
      : 'regular';
  const viewport = height / width < 0.82 ? 'short' : 'normal';

  return {
    size,
    viewport,
    designHeight: Math.round(480 * height / width),
    className: `screen-round size-${size} viewport-${viewport}`,
  };
}

module.exports = { resolveLayout };
