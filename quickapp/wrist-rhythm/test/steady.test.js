const assert = require('assert');
const steady = require('../src/pages/index/steady.js');
const healthCore = require('../src/pages/index/health-core.js');
const boxing = require('../src/pages/index/boxing.js');
const layout = require('../src/pages/index/layout.js');

let passed = 0;

function test(name, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

test('pushWindow 保留指定数量的最新有效样本', () => {
  assert.deepStrictEqual(steady.pushWindow([1, 2, 3], 4, 3), [2, 3, 4]);
  assert.deepStrictEqual(steady.pushWindow([1, 2], null, 3), [1, 2]);
  assert.deepStrictEqual(steady.pushWindow([], 72, 8), [72]);
});

test('样本不足时不主动建议训练', () => {
  assert.deepStrictEqual(steady.shouldSuggest([90, 92, 94], [35, 38, 42]), {
    suggest: false,
    reason: 'stable',
  });
});

test('持续偏高的压力优先触发建议', () => {
  assert.deepStrictEqual(steady.shouldSuggest([75, 76, 78, 80], [40, 41, 42, 43]), {
    suggest: true,
    reason: 'stress_high',
  });
});

test('持续偏高的心率触发建议', () => {
  assert.deepStrictEqual(steady.shouldSuggest([110, 112, 115, 118], [20, 22, 21, 23]), {
    suggest: true,
    reason: 'heart_rate_high',
  });
});

test('压力或心率明显上升触发趋势建议', () => {
  assert.deepStrictEqual(
    steady.shouldSuggest([75, 76, 74, 75, 76, 75, 76, 77], [20, 20, 21, 19, 26, 27, 26, 27]),
    { suggest: true, reason: 'stress_rising' },
  );
  assert.deepStrictEqual(
    steady.shouldSuggest([70, 72, 71, 71, 82, 83, 82, 84], [20, 20, 20, 20, 20, 20, 20, 20]),
    { suggest: true, reason: 'heart_rate_rising' },
  );
});

test('压力或心率未下降时选择舒缓节奏', () => {
  assert.strictEqual(steady.selectPattern(40, 80, 80).name, 'calming');
  assert.strictEqual(steady.selectPattern(20, 86, 80).name, 'calming');
  assert.strictEqual(steady.selectPattern(20, 82, 80).name, 'standard');
});

test('标准呼吸周期的阶段边界准确', () => {
  const pattern = steady.PATTERNS.standard;
  assert.deepStrictEqual(steady.phaseAt(0, pattern), {
    phase: 'inhale',
    label: '慢慢吸气',
    progress: 0,
    complete: false,
  });
  assert.strictEqual(steady.phaseAt(4000, pattern).phase, 'hold');
  assert.strictEqual(steady.phaseAt(6000, pattern).phase, 'exhale');
  assert.strictEqual(steady.phaseAt(10000, pattern).phase, 'inhale');
});

test('60 秒到达完成态且不会继续循环', () => {
  assert.deepStrictEqual(steady.phaseAt(60000, steady.PATTERNS.calming), {
    phase: 'complete',
    label: '完成',
    progress: 1,
    complete: true,
  });
});

test('训练结果保留前后值并计算有符号差值', () => {
  assert.deepStrictEqual(
    steady.buildResult({ heartRate: 96, stress: 43 }, { heartRate: 84, stress: 35 }),
    {
      beforeHeartRate: 96,
      afterHeartRate: 84,
      heartRateDelta: -12,
      beforeStress: 43,
      afterStress: 35,
      stressDelta: -8,
    },
  );
  assert.strictEqual(
    steady.buildResult({ heartRate: null, stress: null }, { heartRate: 84, stress: null })
      .heartRateDelta,
    null,
  );
});

test('最近健康数据被规范化并跳过无效项', () => {
  assert.deepStrictEqual(
    healthCore.normalizeRecent([
      { dataType: 0, data: { value: 76, timeStamp: 1000 } },
      { dataType: 9, data: null },
    ]),
    [{ ok: true, dataType: 0, value: 76, timeStamp: 1000 }],
  );
  assert.deepStrictEqual(healthCore.normalizeRecent(null), []);
});

test('订阅样本与错误码被规范化', () => {
  assert.deepStrictEqual(healthCore.normalizeSample(9, { value: 38, timeStamp: 2000 }), {
    ok: true,
    dataType: 9,
    value: 38,
    timeStamp: 2000,
  });
  assert.deepStrictEqual(healthCore.normalizeError(203), {
    ok: false,
    code: 203,
    unsupported: true,
  });
});

test('动作检测器忽略基线，识别突变并执行冷却', () => {
  const detector = boxing.createPunchDetector({ threshold: 4, cooldownMs: 350 });
  assert.strictEqual(detector.push({ x: 0, y: 0, z: 9.8 }, 0), false);
  assert.strictEqual(detector.push({ x: 5, y: 0, z: 9.8 }, 100), true);
  assert.strictEqual(detector.push({ x: 0, y: 0, z: 9.8 }, 200), false);
  assert.strictEqual(detector.push({ x: 5, y: 0, z: 9.8 }, 500), true);
});

test('无效加速度样本不会产生出拳', () => {
  const detector = boxing.createPunchDetector({ threshold: 4, cooldownMs: 350 });
  assert.strictEqual(detector.push({ x: null, y: 0, z: 0 }, 0), false);
  assert.strictEqual(detector.push(null, 100), false);
});

test('出拳按与节拍的时间差评分', () => {
  assert.deepStrictEqual(boxing.scorePunch(1120, 1000), { points: 100, grade: 'perfect' });
  assert.deepStrictEqual(boxing.scorePunch(1250, 1000), { points: 70, grade: 'good' });
  assert.deepStrictEqual(boxing.scorePunch(1350, 1000), { points: 40, grade: 'hit' });
  assert.deepStrictEqual(boxing.scorePunch(1351, 1000), { points: 0, grade: 'miss' });
});

test('心率升高时降低节拍速度', () => {
  assert.strictEqual(boxing.beatIntervalForHeartRate(null), 1000);
  assert.strictEqual(boxing.beatIntervalForHeartRate(119), 1000);
  assert.strictEqual(boxing.beatIntervalForHeartRate(120), 1200);
  assert.strictEqual(boxing.beatIntervalForHeartRate(150), 1400);
});

test('命中与漏拍更新分数和最高连击', () => {
  let stats = boxing.createStats();
  stats = boxing.recordHit(stats, 100);
  stats = boxing.recordHit(stats, 70);
  stats = boxing.recordMiss(stats);
  stats = boxing.recordHit(stats, 40);
  assert.deepStrictEqual(stats, {
    score: 210,
    hits: 3,
    targets: 4,
    streak: 1,
    maxStreak: 2,
  });
});

test('所有设备形态统一使用圆屏安全布局', () => {
  assert.deepStrictEqual(layout.resolveLayout({
    screenWidth: 480,
    screenHeight: 480,
    screenShape: 'circle',
  }), {
    size: 'regular',
    viewport: 'normal',
    className: 'screen-round size-regular viewport-normal',
  });
  assert.deepStrictEqual(layout.resolveLayout({
    screenWidth: 480,
    screenHeight: 480,
    screenShape: 'rect',
  }), {
    size: 'regular',
    viewport: 'normal',
    className: 'screen-round size-regular viewport-normal',
  });
});

test('不同屏幕尺寸选择紧凑、常规或宽裕布局', () => {
  assert.strictEqual(layout.resolveLayout({
    screenWidth: 360,
    screenHeight: 360,
    screenShape: 'circle',
  }).size, 'compact');
  assert.strictEqual(layout.resolveLayout({
    screenWidth: 480,
    screenHeight: 520,
    screenShape: 'rect',
  }).size, 'regular');
  assert.strictEqual(layout.resolveLayout({
    screenWidth: 600,
    screenHeight: 600,
    screenShape: 'rect',
  }).size, 'spacious');
});

test('设备信息缺失时回退到最安全的圆屏常规布局', () => {
  assert.deepStrictEqual(layout.resolveLayout(null), {
    size: 'regular',
    viewport: 'normal',
    className: 'screen-round size-regular viewport-normal',
  });
});

test('圆屏短视口压缩纵向布局并优先使用可用窗口尺寸', () => {
  assert.deepStrictEqual(layout.resolveLayout({
    screenWidth: 480,
    screenHeight: 480,
    windowWidth: 480,
    windowHeight: 320,
    screenShape: 'rect',
  }), {
    size: 'compact',
    viewport: 'short',
    className: 'screen-round size-compact viewport-short',
  });
});

console.log(`\n${passed} tests passed`);
