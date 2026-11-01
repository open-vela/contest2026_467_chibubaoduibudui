const assert = require('assert');
const fs = require('fs');
const path = require('path');
const sass = require('module').createRequire(require.resolve('@aiot-toolkit/parser/package.json'))('sass');

const pageDirectory = path.join(__dirname, '..', 'src', 'pages', 'index');
const componentDirectory = path.join(pageDirectory, 'components');


const contracts = [
  {
    file: 'home.ux',
    tag: 'home-view',
    props: [
      'motionClass', 'screenSize', 'screenViewport', 'suggest', 'vitalPulseClass', 'statusTitle',
      'statusSubtitle', 'heartRateText', 'stressText', 'healthMessage',
    ],
    events: { startTraining: 'startTraining', startBoxing: 'startBoxing' },
    parentEvents: { 'onstart-training': 'startTraining', 'onstart-boxing': 'requestBoxing' },
  },
  {
    file: 'fighter-choice.ux',
    tag: 'fighter-choice-view',
    props: ['screenSize', 'screenViewport', 'fighterChoiceBusy', 'fighterChoiceMessage', 'malePreviewSrc', 'femalePreviewSrc'],
    events: { chooseMale: 'chooseMale', chooseFemale: 'chooseFemale', cancelFighterChoice: 'cancelFighterChoice' },
    parentEvents: { 'onchoose-male': 'chooseMale', 'onchoose-female': 'chooseFemale', 'oncancel-fighter-choice': 'cancelFighterChoice' },
  },
  {
    file: 'breathing.ux',
    tag: 'breathing-view',
    props: [
      'motionClass', 'screenSize', 'screenViewport', 'remainingText',
      'breathPhase', 'breathRhythmClass', 'breathFrameSrc', 'phaseLabel', 'patternLabel', 'patternReason',
    ],
    events: { stopTraining: 'stopTraining' },
    parentEvents: { 'onstop-training': 'stopTraining' },
  },
  {
    file: 'steady-result.ux',
    tag: 'steady-result-view',
    props: [
      'motionClass', 'screenSize', 'screenViewport', 'resultHeartRateDetail',
      'resultHeartRateDelta', 'resultStressDetail', 'resultStressDelta',
      'heartRateImproved', 'stressImproved',
    ],
    events: { returnHome: 'returnHome' },
    parentEvents: { 'onreturn-home': 'returnHome' },
  },
  {
    file: 'boxing.ux',
    tag: 'boxing-view',
    props: [
      'screenCanvasHeight', 'motionClass', 'screenSize', 'screenViewport', 'boxingRemainingText',
      'boxingScoreText', 'boxingStreakText', 'boxingComboClass', 'boxingPrompt', 'boxingPaceLabel',
      'boxingTargetClass', 'fighterFrameSrc', 'boxingMessage',
    ],
    events: { stopBoxing: 'stopBoxing' },
    parentEvents: { 'onstop-boxing': 'stopBoxing' },
  },
  {
    file: 'boxing-result.ux',
    tag: 'boxing-result-view',
    props: [
      'motionClass', 'screenSize', 'screenViewport', 'boxingResultScore',
      'boxingResultHits', 'boxingResultStreak', 'boxingResultHeartRate',
      'boxingResultStress',
    ],
    events: { returnHome: 'returnHome' },
    parentEvents: { 'onreturn-home': 'returnHome' },
  },
  {
    file: 'boxing-failure.ux',
    tag: 'boxing-failure-view',
    props: ['screenSize', 'screenViewport', 'boxingFailureReason'],
    events: { retryBoxing: 'retryBoxing', returnHome: 'returnHome' },
    parentEvents: { 'onretry-boxing': 'retryBoxing', 'onreturn-home': 'returnHome' },
  },
];

function componentSource(file) {
  return fs.readFileSync(path.join(componentDirectory, file), 'utf8');
}

function componentDefinition(source) {
  const match = source.match(/<script>([\s\S]*?)<\/script>/);
  assert(match, 'component script block is required');
  const executable = match[1].replace(/export\s+default\s+/, 'return ');
  return Function(executable)();
}

function templateSource(source) {
  const match = source.match(/<template>([\s\S]*?)<\/template>/);
  assert(match, 'component template block is required');
  return match[1];
}

function attributesForTag(template, tag) {
  const match = template.match(new RegExp(`<${tag}\\s+([\\s\\S]*?)>`));
  assert(match, `${tag} mount is required`);
  const attributes = {};
  const pattern = /([\w-]+)\s*=\s*"([^"]*)"/g;
  let attribute;
  while ((attribute = pattern.exec(match[1])) !== null) {
    attributes[attribute[1]] = attribute[2];
  }
  return attributes;
}

function attributesForClass(template, className) {
  const tags = template.match(/<[\w-]+\s+[\s\S]*?>/g) || [];
  const tag = tags.find((candidate) => new RegExp(`class="[^"]*\\b${className}\\b`).test(candidate));
  assert(tag, `${className} element is required`);
  return attributesForTag(tag, tag.match(/^<([\w-]+)/)[1]);
}

function kebabCase(value) {
  return value.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`);
}

function templateBindings(template) {
  const bindings = new Set();
  const tagPattern = /<[\w-]+\s+([^>]+)>/g;
  let tag;
  while ((tag = tagPattern.exec(template)) !== null) {
    const attributePattern = /[\w-]+\s*=\s*"([^"]*)"/g;
    let attribute;
    while ((attribute = attributePattern.exec(tag[1])) !== null) {
      const bindingPattern = /\{\{\s*([A-Za-z_$][\w$]*)\s*\}\}/g;
      let binding;
      while ((binding = bindingPattern.exec(attribute[1])) !== null) bindings.add(binding[1]);
    }
  }
  return bindings;
}

const compiledStyles = new Map();
function compiledStyle(source) {
  if (!compiledStyles.has(source)) {
    const style = source.match(/<style(?: lang="(scss)")?>([\s\S]*?)<\/style>/);
    assert(style, 'component style block is required');
    compiledStyles.set(source, style[1] === 'scss'
      ? sass.compileString(style[2], { loadPaths: [componentDirectory, pageDirectory], charset: false }).css
      : style[2]);
  }
  return compiledStyles.get(source);
}

function styleDeclarations(source, selector) {
  const rules = [...compiledStyle(source).replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(rule => rule[1].split(',').some(s => s.trim() === selector));
  assert(rules.length, `${selector} style rule is required`);
  return Object.fromEntries(
    rules.map(rule => rule[2]).join(';')
      .split(';')
      .map((declaration) => declaration.trim())
      .filter(Boolean)
      .map((declaration) => {
        const separator = declaration.indexOf(':');
        return [declaration.slice(0, separator).trim(), declaration.slice(separator + 1).trim()];
      }),
  );
}

function styleSelectorsUsingColor(source, color) {
  if (!/<style(?:\s|>)/.test(source)) return [];
  const style = [null, compiledStyle(source)];
  const stylesheet = style[1].replace(/\/\*[\s\S]*?\*\//g, '');
  const normalizedColor = color.toLowerCase();
  const selectors = [];
  for (const rule of stylesheet.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const declarations = rule[2]
      .split(';')
      .map((declaration) => declaration.trim())
      .filter(Boolean)
      .map((declaration) => declaration.slice(declaration.indexOf(':') + 1).trim().toLowerCase());
    if (!declarations.some((value) => value.includes(normalizedColor))) continue;
    selectors.push(...rule[1].split(',').map((selector) => selector.trim()));
  }
  return selectors;
}

function uxFilesUnder(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return uxFilesUnder(fullPath);
    return entry.isFile() && entry.name.endsWith('.ux') ? [fullPath] : [];
  });
}

function keyframeSource(source, name) {
  const style = [null, compiledStyle(source)];
  const marker = `@keyframes ${name}`;
  const markerAt = style[1].indexOf(marker);
  assert.notStrictEqual(markerAt, -1, `${name} keyframes are required`);
  const openingBrace = style[1].indexOf('{', markerAt + marker.length);
  let depth = 0;
  for (let index = openingBrace; index < style[1].length; index += 1) {
    if (style[1][index] === '{') depth += 1;
    if (style[1][index] === '}') depth -= 1;
    if (depth === 0) return style[1].slice(openingBrace + 1, index);
  }
  assert.fail(`${name} keyframes must be closed`);
}

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

test('unavailable metric labels fit independently while numeric typography stays unchanged', () => {
  const source = componentSource('home.ux');
  const textTags = [...source.matchAll(/<text class="metric-value ([^"]+)">\{\{ (heartRateText|stressText) \}\}/g)];
  assert.equal(textTags.length, 2);
  for (const [, classBinding, property] of textTags) {
    const expression = [...classBinding.matchAll(/\{\{ ([\s\S]+?) \}\}/g)].map(m => m[1]).find(e => e.includes(property));
    for (const value of ['待更新', '不支持', '不可用']) {
      assert.equal(Function(property, `return ${expression}`)(value), 'metric-status');
    }
    assert.equal(Function(property, `return ${expression}`)('220'), '');
  }
  assert.equal(styleDeclarations(source, '.metric-status')['font-size'], '18px');
  assert.equal(styleDeclarations(source, '.metric-value')['font-size'], '28px');
});

test('展示组件声明完整 props 并执行用户事件', () => {
  for (const contract of contracts) {
    const definition = componentDefinition(componentSource(contract.file));
    assert.deepStrictEqual(Object.keys(definition.props).sort(), contract.props.slice().sort());
    for (const [method, event] of Object.entries(contract.events)) {
      const emitted = [];
      definition[method].call({ $emit: (name) => emitted.push(name) });
      assert.deepStrictEqual(emitted, [event], `${contract.file}:${method}`);
    }
  }
});

test('父页面向每个组件传递圆屏尺寸、短视口及展示 props', () => {
  const parentTemplate = templateSource(fs.readFileSync(path.join(pageDirectory, 'index.ux'), 'utf8'));
  for (const contract of contracts) {
    const attributes = attributesForTag(parentTemplate, contract.tag);
    for (const prop of contract.props) {
      assert.strictEqual(attributes[kebabCase(prop)], prop === 'motionClass' ? 'motion-full' : `{{ ${prop} }}`, `${contract.tag}:${prop}`);
    }
    assert.strictEqual(attributes['screen-size'], '{{ screenSize }}');
    assert.strictEqual(attributes['screen-viewport'], '{{ screenViewport }}');
  }
});

test('父页面事件绑定匹配组件真实发出的事件', () => {
  const parentTemplate = templateSource(fs.readFileSync(path.join(pageDirectory, 'index.ux'), 'utf8'));
  for (const contract of contracts) {
    const attributes = attributesForTag(parentTemplate, contract.tag);
    for (const [eventAttribute, handler] of Object.entries(contract.parentEvents)) {
      assert.strictEqual(attributes[eventAttribute], handler, `${contract.tag}:${eventAttribute}`);
    }
  }
});

test('组件模板实际消费圆屏尺寸与短视口输入', () => {
  for (const contract of contracts) {
    const template = templateSource(componentSource(contract.file));
    const bindings = templateBindings(template);
    assert(bindings.has('screenSize'), `${contract.file}:screenSize`);
    assert(bindings.has('screenViewport'), `${contract.file}:screenViewport`);
  }
});

test('展示组件只保留圆屏、尺寸和短视口契约', () => {
  for (const contract of contracts) {
    const source = componentSource(contract.file);
    const definition = componentDefinition(source);
    assert(!Object.hasOwn(definition.props, 'screenShape'));
    assert(!source.includes('-square'));
    assert(!source.includes('{{ screenShape }}'));
  }
});

test('首页健康状态驱动中心生命圆环', () => {
  const template = templateSource(componentSource('home.ux'));
  const orbit = attributesForClass(template, 'vital-orbit');

  assert.strictEqual(
    orbit.class,
    "vital-orbit vital-orbit-{{ screenViewport === 'short' ? 'short' : screenSize }} {{ suggest ? 'orbit-alert' : 'orbit-steady' }}",
  );
});

test('首页生命仪表具有三层结构与可重触发数据脉冲', () => {
  const template = templateSource(componentSource('home.ux'));
  assert(template.includes('class="vital-orbit'));
  assert(attributesForClass(template, 'orbit-pulse').class.includes('vitalPulseClass'));
  assert(attributesForClass(template, 'orbit-pulse').class.includes('still-pulse'));
  assert(template.includes('class="orbit-ring'));
  assert(template.includes("suggest ? 'orbit-alert' : 'orbit-steady'"));
});

test('琥珀高光只用于节奏拳当前目标与高连击作用域', () => {
  const amberUsages = uxFilesUnder(path.join(__dirname, '..', 'src')).flatMap((file) =>
    styleSelectorsUsingColor(fs.readFileSync(file, 'utf8'), '#fbbf24')
      .map((selector) => ({ file: path.relative(path.join(__dirname, '..'), file), selector })),
  );

  assert(amberUsages.length > 0, 'boxing amber highlight usages are required');
  for (const usage of amberUsages) {
    assert.strictEqual(usage.file, path.join('src', 'pages', 'index', 'components', 'boxing.ux'));
    assert(
      usage.selector.includes('.target-active-') || usage.selector.includes('.combo-hot'),
      `${usage.file}:${usage.selector}`,
    );
  }
});

test('首页使用 棱镜夜光画布、玻璃和双能量入口', () => {
  const parent = fs.readFileSync(path.join(pageDirectory, 'index.ux'), 'utf8');
  const home = componentSource('home.ux');

  assert.strictEqual(styleDeclarations(parent, '.app')['background-color'], '#080b10');
  assert.strictEqual(styleDeclarations(home, '.vital-orbit')['background-color'], '#1a2430');
  assert.strictEqual(styleDeclarations(home, '.orbit-ring')['background-color'], '#121922');
  assert.strictEqual(styleDeclarations(home, '.orbit-pulse')['border-color'], '#9bdcfa');
  assert.strictEqual(styleDeclarations(componentSource('action-button.ux'), '.action-ice')['border-color'], '#6594aa');
  assert.strictEqual(styleDeclarations(componentSource('action-button.ux'), '.action-violet')['border-color'], '#8a79b1');
  assert.strictEqual(styleDeclarations(home, '.status-dot-alert').color, '#ac96ed');
  assert.strictEqual(styleDeclarations(home, '.health-message').color, '#a3b1c4');
  assert.strictEqual(styleDeclarations(home, '.disclaimer').color, '#a3b1c4');
});

test('组件样式不使用 openvela 不支持的后代选择器', () => {
  for (const contract of contracts) {
    const source = componentSource(contract.file);
    const style = compiledStyle(source).replace(/\/\*[\s\S]*?\*\//g, '');
    const selectors = [...style.matchAll(/([^{}]+)\{/g)].flatMap((match) =>
      match[1].trim().startsWith('@keyframes') ? [] : match[1].split(',').map(s => s.trim()));
    assert(!selectors.some((selector) => /\s/.test(selector)), contract.file);
  }
});

test('节奏拳波纹从舞台中心向外扩散并逐渐消失', () => {
  const source = componentSource('boxing.ux');
  const layer = styleDeclarations(source, '.impact-layer');
  assert.equal(layer.position, 'absolute');
  assert.equal(layer.left, '0'); assert.equal(layer.top, '0');
  assert.equal(layer.width, '100%'); assert.equal(layer.height, '100%');
  assert.equal(layer['justify-content'], 'center'); assert.equal(layer['align-items'], 'center');
  const base = styleDeclarations(source, '.impact-wave');
  assert.equal(base.position, undefined, 'each fixed ring is centered by its own flex layer');
  const names = ['one', 'two', 'three', 'four', 'five'];
  assert.equal((templateSource(source).match(/class="impact-layer"/g) || []).length, names.length);
  for (const viewport of ['regular', 'compact', 'short']) {
    const short = viewport === 'short';
    const stageSize = viewport === 'regular' ? 210 : short ? 110 : 190;
    let previousSize = 0, previousDelay = -1;
    for (const name of names) {
      const style = {...base, ...(name === 'one' ? {} : styleDeclarations(source, '.impact-wave-' + name)),
        ...(viewport === 'compact' && name === 'five' ? styleDeclarations(source, '.impact-wave-five.impact-wave-compact') : {}),
        ...(short ? styleDeclarations(source, '.impact-wave-short') : {}),
        ...(short && name !== 'one' ? styleDeclarations(source, '.impact-wave-' + name + '.impact-wave-short') : {})};
      const size = parseFloat(style.width), delay = parseFloat(style['animation-delay'] || '0');
      assert.equal(style.width, style.height, 'all rings are circular');
      assert(size > previousSize && size + 2 * parseFloat(style['border-width']) <= stageSize - 2, 'fixed rings plus their borders stay inside each stage');
      assert(delay > previousDelay, 'rings light up in radius order');
      assert.equal(style.transform, undefined, 'mirror transform origin is unreliable');
      previousSize = size; previousDelay = delay;
    }
  }
  for (const name of ['impact-expand', 'beat-expand']) {
    const frames = keyframeSource(source, name);
    assert(!/\b(?:transform|width|height|left|top)\s*:/.test(frames), 'mirror geometry tweens drift; animate only opacity');
    assert(/100%\s*\{[^}]*opacity:\s*0\b/.test(frames), 'rings fade after the radial pulse');
  }
  assert.notEqual(styleDeclarations(source, '.target-hit-wave')['animation-name'], styleDeclarations(source, '.target-active-wave')['animation-name'], 'hit restarts a distinct pulse');
});

test('节奏拳只接受动作传感器出拳并绑定 B1 节拍状态', () => {
  const source = componentSource('boxing.ux');
  const template = templateSource(source);
  const parent = fs.readFileSync(path.join(pageDirectory, 'index.ux'), 'utf8');
  const stage = attributesForClass(template, 'fighter-stage');

  assert.strictEqual(stage.onclick, undefined);
  assert(!template.includes('simulate-button'));
  assert(!Object.hasOwn(componentDefinition(source), 'simulatePunch'));
  assert(!attributesForTag(templateSource(parent), 'boxing-view')['onsimulate-punch']);
  assert(stage.class.includes('{{ boxingTargetClass }}'));
  assert.equal(attributesForTag(template, 'image').src, '{{ fighterFrameSrc }}');
  assert(template.includes('impact-wave-one'));
  assert(template.includes('impact-wave-two'));
  assert.strictEqual(styleDeclarations(source, '.target-active-wave')['border-color'], '#fbbf24');
  assert.strictEqual(styleDeclarations(source, '.combo-hot').color, '#fbbf24');
  assert(attributesForClass(template, 'boxing-streak-value').class.includes('{{ boxingComboClass }}'));
  assert(parent.includes("this.boxingComboClass = this.boxingStats.streak >= 5 ? 'combo-hot' : 'combo-calm'"));
});

test('节奏拳外壳使用 棱镜夜光石墨和紫罗兰色', () => {
  const source = componentSource('boxing.ux');

  assert.strictEqual(styleDeclarations(source, '.boxing-remaining').color, '#f4f7fb');
  assert.strictEqual(styleDeclarations(source, '.boxing-stat-label').color, '#a3b1c4');
  assert.strictEqual(styleDeclarations(source, '.boxing-pace').color, '#a3b1c4');
  assert.strictEqual(styleDeclarations(source, '.boxing-message').color, '#c4b5fd');
  assert.strictEqual(styleDeclarations(componentSource('action-button.ux'), '.action')['border-color'], '#3b4959');
  assert.strictEqual(styleDeclarations(componentSource('action-button.ux'), '.action')['background-color'], '#121922');
  assert.strictEqual(styleDeclarations(componentSource('action-button.ux'), '.action-label').color, '#f4f7fb');
});

test('动作提示预留固定高度避免退出按钮在连接失败后跳动', () => {
  const source = componentSource('boxing.ux');
  const message = attributesForClass(templateSource(source), 'boxing-message');
  assert.equal(message.if, undefined, 'message space stays mounted when empty');
  assert.equal(styleDeclarations(source, '.boxing-message').height, '18px');
});

test('节奏拳人物层以整个圆屏为参照固定在屏幕中央', () => {
  const source = componentSource('boxing.ux');
  const template = templateSource(source);
  const page = styleDeclarations(source, '.boxing-page');
  const centerLayer = styleDeclarations(source, '.fighter-center-layer');

  assert(template.includes('class="fighter-center-layer'));
  assert.strictEqual(page.position, 'relative');
  assert.strictEqual(centerLayer.position, 'absolute');
  assert.strictEqual(centerLayer.left, '0');
  assert.strictEqual(centerLayer.top, '0');
  // Percent-sized absolute children use the physical viewport on the 360 image.
  // Keep the layer in the same design coordinate space as the application.
  assert.strictEqual(centerLayer.width, '480px');
  assert.strictEqual(centerLayer.height, '480px');
  assert.strictEqual(attributesForClass(template, 'fighter-center-layer').style, 'height: {{ screenCanvasHeight }}px;');
  const parent = fs.readFileSync(path.join(pageDirectory, 'index.ux'), 'utf8');
  assert.strictEqual(attributesForTag(templateSource(parent), 'boxing-view')['screen-canvas-height'], '{{ screenCanvasHeight }}');
  assert.strictEqual(centerLayer['justify-content'], 'center');
  assert.strictEqual(centerLayer['align-items'], 'center');
  assert.strictEqual(styleDeclarations(source, '.fighter-stage')['margin-top'], '0');
});

test('节奏拳关键帧避开 AIoT 运行时不兼容的位移与旋转', () => {
  const source = componentSource('boxing.ux');
  const animationNames = [
    'impact-expand',
    'beat-expand',
  ];

  for (const animationName of animationNames) {
    const frames = keyframeSource(source, animationName);
    assert(!/\b(?:translate(?:X|Y)?|rotate)\s*\(/.test(frames), `${animationName}:unsupported-transform`);
  }
});

test('节奏拳人物与冲击波动画不得无限循环', () => {
  assert(!componentSource('boxing.ux').includes('animation-iteration-count: infinite'));
});

test('首页中心舞台在圆屏短视口压缩到安全尺寸', () => {
  const source = componentSource('home.ux');
  const orbit = styleDeclarations(source, '.vital-orbit-short');
  const inner = styleDeclarations(source, '.orbit-ring-short');

  assert.strictEqual(orbit.width, '150px');
  assert.strictEqual(orbit.height, '150px');
  assert.strictEqual(inner.width, '132px');
  assert.strictEqual(inner.height, '132px');
  const classes = attributesForClass(templateSource(source), 'vital-orbit').class;
  const expression = classes.match(/\{\{ ([\s\S]+?) \}\}/)[1];
  const choose = Function('screenViewport', 'screenSize', `return ${expression}`);
  assert.equal(choose('normal', 'compact'), 'compact');
  assert.equal(choose('short', 'compact'), 'short');
  assert.equal(choose('normal', 'regular'), 'regular');
  assert(!compiledStyle(source).includes('.vital-orbit-compact.vital-orbit-short'));
});

test('结果页共享单次完成光环并使用对应 棱镜夜光能量色', () => {
  const steady = componentSource('steady-result.ux');
  const boxingResult = componentSource('boxing-result.ux');

  for (const source of [steady, boxingResult]) {
    assert(templateSource(source).includes('completion-halo'));
    assert(source.includes('@keyframes completion-enter'));
    assert.strictEqual(styleDeclarations(source, '.completion-halo')['animation-iteration-count'], '1');
  }
  assert.strictEqual(styleDeclarations(steady, '.completion-halo')['border-color'], '#9bdcfa');
  assert.strictEqual(styleDeclarations(steady, '.result-row')['background-color'], '#121922');
  assert.strictEqual(styleDeclarations(boxingResult, '.completion-halo')['border-color'], '#ac96ed');
  assert.strictEqual(styleDeclarations(boxingResult, '.boxing-result-cell')['background-color'], '#121922');
  assert.strictEqual(styleDeclarations(boxingResult, '.coral').color, '#c4b5fd');
});

test('four digit boxing scores reserve a single line in normal and short viewports', () => {
  const source = componentSource('boxing-result.ux');
  const stage = styleDeclarations(source, '.completion-stage');
  const score = styleDeclarations(source, '.boxing-result-score');
  // 3000 wrapped and was clipped in the actual layout fixture. Reserve four
  // full glyph widths; actual font shaping is additionally checked on-device.
  for (const viewport of ['normal', 'short']) {
    const font = viewport === 'short'
      ? styleDeclarations(source, '.boxing-result-score-short')['font-size']
      : score['font-size'];
    assert(parseFloat(stage.width) >= 4 * parseFloat(font), `${viewport}: four digits fit`);
  }
  assert.equal(score.width, '100%');
  assert.equal(score['text-align'], 'center');
});

test('native training images stay inside all three stage sizes without moving their labels', () => {
  for (const [file, image, stage] of [['breathing.ux','.breath-art','.orb-shell'],['boxing.ux','.fighter','.fighter-stage']]) {
    const source=componentSource(file);
    for(const suffix of ['', '-compact', '-short']) {
      const graphic={...styleDeclarations(source,image),...(suffix?styleDeclarations(source,image+suffix):{})};
      const bounds={...styleDeclarations(source,stage),...(suffix?styleDeclarations(source,stage+suffix):{})};
      assert(parseFloat(graphic.width)<=parseFloat(bounds.width),file+suffix+': image width');
      assert(parseFloat(graphic.height)<=parseFloat(bounds.height),file+suffix+': image height');
    }
    assert(!templateSource(source).includes('<canvas'), 'unsupported runtime canvas must not reach the package');
  }
});

test('all clock-selected images exist and punch artwork has transparent unclipped margins', () => {
  const {PNG}=require('pngjs');
  const visuals=require('../src/pages/index/training-visuals');
  const steady=require('../src/pages/index/steady');
  const files=new Set();
  for(const pattern of Object.values(steady.PATTERNS)) {
    const duration=pattern.inhaleMs+pattern.holdMs+pattern.exhaleMs;
    for(let at=0;at<duration;at+=25)files.add(visuals.breathFrame(at,pattern));
  }
  for(const gender of ['male', 'female'])for(let at=0;at<1600;at+=50){files.add(visuals.fighterFrame(at,null,gender));files.add(visuals.fighterFrame(at,0,gender));}
  for(const name of files) {
    const image=PNG.sync.read(fs.readFileSync(path.join(__dirname,'../src',name)));
    if(name.includes('/breath-')){assert.equal(image.width,250);assert.equal(image.height,250);continue;}
    assert.equal(image.width,210);assert.equal(image.height,180);
    for(let x=0;x<image.width;x++)for(const y of [0,image.height-1])assert.equal(image.data[(y*image.width+x)*4+3],0,name+': vertical clipping');
    for(let y=0;y<image.height;y++)for(const x of [0,image.width-1])assert.equal(image.data[(y*image.width+x)*4+3],0,name+': horizontal clipping');
  }
});

test('共享按钮在按下和取消时反馈，禁用及加载时不触发操作', () => {
  const definition = componentDefinition(componentSource('action-button.ux'));
  for (const disabled of [false, true]) for (const busy of [false, true]) {
    const emitted = [];
    const instance = { disabled, busy, pressed: false, $emit: e => emitted.push(e) };
    definition.press.call(instance);
    assert.equal(instance.pressed, !disabled && !busy);
    definition.release.call(instance);
    assert.equal(instance.pressed, false);
    definition.press.call(instance);
    definition.activate.call(instance);
    assert.equal(instance.pressed, false);
    assert.deepEqual(emitted, !disabled && !busy ? ['activate'] : []);
  }
  const template = templateSource(componentSource('action-button.ux'));
  assert.equal(attributesForClass(template, 'action').ontouchcancel, 'release');
  assert(template.includes("busy ? '处理中…' : label"));
});

test('共享控件和装饰的静态显示保留训练状态', () => {
  for (const [file, selector, visible] of [
    ['home.ux', '.still-pulse', false],
    ['boxing.ux', '.still-wave', false], ['steady-result.ux', '.still-completion', false],
    ['boxing-result.ux', '.still-completion', false],
  ]) {
    const source = componentSource(file);
    const rule = styleDeclarations(source, selector);
    assert.equal(rule['animation-duration'], '1ms');
    const frames = keyframeSource(source, rule['animation-name']);
    assert(!/\b(transform|width|height|left|top)\s*:/.test(frames));
    const opacity = [...frames.matchAll(/opacity:\s*(\d+)/g)].map(m => +m[1]);
    assert.deepEqual(opacity, visible ? [1, 1] : [0, 0]);
    assert(templateSource(source).includes('{{ motionClass }}'));
  }
  assert(templateSource(componentSource('breathing.ux')).includes('{{ phaseLabel }}'));
  assert(templateSource(componentSource('boxing.ux')).includes('{{ boxingPrompt }}'));
  assert.equal(styleDeclarations(componentSource('action-button.ux'), '.action-still')['transition-duration'], '0ms');
});

test('圆屏操作区至少48设计像素，异步健康提示预留空间', () => {
  const home = componentSource('home.ux');
  assert.equal(attributesForClass(templateSource(home), 'health-message').if, undefined);
  for (const [source, selectors] of [
    [home, ['.mode-button', '.mode-button-short']],
    [componentSource('breathing.ux'), ['.stop-button', '.stop-button-short']],
    [componentSource('boxing.ux'), ['.boxing-stop', '.boxing-stop-short']],
    [componentSource('steady-result.ux'), ['.primary-button', '.result-button-short']],
    [componentSource('boxing-result.ux'), ['.primary-button', '.result-button-short']],
  ]) for (const selector of selectors) assert(parseFloat(styleDeclarations(source, selector).height) >= 48, selector);
  const orbit = styleDeclarations(home, '.vital-orbit-compact');
  const pulse = styleDeclarations(home, '.orbit-pulse-compact');
  assert(parseFloat(pulse.left) + parseFloat(pulse.width) + 2 * parseFloat(styleDeclarations(home, '.orbit-pulse')['border-width']) <= parseFloat(orbit.width));
});

test('所有正文色在石墨、模式和按下表面满足4.5比1对比度', () => {
  const action = componentSource('action-button.ux');
  const parent = fs.readFileSync(path.join(pageDirectory, 'index.ux'), 'utf8');
  function luminance(hex) {
    const rgb = hex.slice(1).match(/../g).map(v => parseInt(v, 16) / 255)
      .map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  }
  const text = [styleDeclarations(action, '.action-label').color,
    styleDeclarations(action, '.action-detail').color,
    styleDeclarations(action, '.label-ice').color,
    styleDeclarations(action, '.label-violet').color];
  const backgrounds = [styleDeclarations(parent, '.app')['background-color'],
    ...['.action', '.action-ice', '.action-violet', '.action-pressed'].map(s => styleDeclarations(action, s)['background-color'])];
  for (const foreground of text) for (const background of backgrounds) {
    const a = luminance(foreground), b = luminance(background);
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    assert(ratio >= 4.5, `${foreground} on ${background}: ${ratio.toFixed(2)}`);
  }
});

test('Prism boxing result retains independent heart rate and stress rows', () => {
  const template = templateSource(componentSource('boxing-result.ux'));
  assert(template.includes('{{ boxingResultHeartRate }}'));
  assert(template.includes('{{ boxingResultStress }}'));
  assert.equal((template.match(/class="boxing-hr-result /g) || []).length, 2);
});

test('boxing missing-data explanations fit beside each health label', () => {
  const source = componentSource('boxing-result.ux');
  const quality = require('../src/pages/index/health-quality');
  const text = '无法比较：' + quality.comparisonReason(null, null, 'heartRate', 0, 30000);
  const row = styleDeclarations(source, '.boxing-hr-result');
  const label = styleDeclarations(source, '.boxing-hr-label');
  const value = styleDeclarations(source, '.boxing-hr-value');
  const labels = [...templateSource(source).matchAll(/class="boxing-hr-label">([^<]+)<\/text>/g)].map(match => match[1]);
  const innerWidth = parseFloat(row.width) - 2 * parseFloat(row.padding.split(' ')[1]) - 2;
  for (const name of labels) {
    const requiredWidth = name.length * parseFloat(label['font-size']) + text.length * parseFloat(value['font-size']);
    assert(requiredWidth <= innerWidth, `${name}: missing-data explanation needs ${requiredWidth}px, only ${innerWidth}px available`);
  }
});

console.log(`\n${passed} component contract tests passed`);
