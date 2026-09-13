const assert = require('assert');
const fs = require('fs');
const path = require('path');

const pageDirectory = path.join(__dirname, '..', 'src', 'pages', 'index');
const componentDirectory = path.join(pageDirectory, 'components');

const contracts = [
  {
    file: 'home.ux',
    tag: 'home-view',
    props: [
      'screenSize', 'screenViewport', 'suggest', 'vitalPulseClass', 'statusTitle',
      'statusSubtitle', 'heartRateText', 'stressText', 'healthMessage',
    ],
    events: { startTraining: 'startTraining', startBoxing: 'startBoxing' },
    parentEvents: { 'onstart-training': 'startTraining', 'onstart-boxing': 'startBoxing' },
  },
  {
    file: 'breathing.ux',
    tag: 'breathing-view',
    props: [
      'screenSize', 'screenViewport', 'remainingText',
      'breathPhase', 'breathRhythmClass', 'phaseLabel', 'patternLabel',
    ],
    events: { stopTraining: 'stopTraining' },
    parentEvents: { 'onstop-training': 'stopTraining' },
  },
  {
    file: 'steady-result.ux',
    tag: 'steady-result-view',
    props: [
      'screenSize', 'screenViewport', 'resultHeartRateDetail',
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
      'screenSize', 'screenViewport', 'boxingRemainingText',
      'boxingScoreText', 'boxingStreakText', 'boxingComboClass', 'boxingPrompt', 'boxingPaceLabel',
      'boxingTargetClass', 'boxingFallback', 'boxingMessage',
    ],
    events: { simulatePunch: 'simulatePunch', stopBoxing: 'stopBoxing' },
    parentEvents: { 'onsimulate-punch': 'simulatePunch', 'onstop-boxing': 'stopBoxing' },
  },
  {
    file: 'boxing-result.ux',
    tag: 'boxing-result-view',
    props: [
      'screenSize', 'screenViewport', 'boxingResultScore',
      'boxingResultHits', 'boxingResultStreak', 'boxingResultHeartRate',
    ],
    events: { returnHome: 'returnHome' },
    parentEvents: { 'onreturn-home': 'returnHome' },
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

function styleDeclarations(source, selector) {
  const style = source.match(/<style>([\s\S]*?)<\/style>/);
  assert(style, 'component style block is required');
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rule = style[1].match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`));
  assert(rule, `${selector} style rule is required`);
  return Object.fromEntries(
    rule[1]
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
  const style = source.match(/<style>([\s\S]*?)<\/style>/);
  if (!style) return [];
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
  const style = source.match(/<style>([\s\S]*?)<\/style>/);
  assert(style, 'component style block is required');
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

test('五个展示组件声明完整 props 并执行六类用户事件', () => {
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
      assert.strictEqual(attributes[kebabCase(prop)], `{{ ${prop} }}`, `${contract.tag}:${prop}`);
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
    "vital-orbit vital-orbit-{{ screenViewport }} {{ suggest ? 'orbit-alert' : 'orbit-steady' }}",
  );
});

test('首页生命仪表具有三层结构与可重触发数据脉冲', () => {
  const template = templateSource(componentSource('home.ux'));
  assert(template.includes('class="vital-orbit'));
  assert(template.includes('class="orbit-pulse orbit-pulse-{{ screenViewport }} {{ vitalPulseClass }}"'));
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

test('首页使用 B1 棱镜夜光画布、玻璃和双能量入口', () => {
  const parent = fs.readFileSync(path.join(pageDirectory, 'index.ux'), 'utf8');
  const home = componentSource('home.ux');

  assert.strictEqual(styleDeclarations(parent, '.app')['background-color'], '#080b1d');
  assert.strictEqual(styleDeclarations(home, '.vital-orbit')['background-color'], '#111534');
  assert.strictEqual(styleDeclarations(home, '.orbit-ring')['background-color'], '#171a40');
  assert.strictEqual(styleDeclarations(home, '.orbit-pulse')['border-color'], '#22d3ee');
  assert.strictEqual(styleDeclarations(home, '.steady-mode')['border-color'], '#247f96');
  assert.strictEqual(styleDeclarations(home, '.boxing-mode')['border-color'], '#9d415b');
  assert.strictEqual(styleDeclarations(home, '.status-dot-alert').color, '#fb7185');
  assert.strictEqual(styleDeclarations(home, '.health-message').color, '#a7a9c7');
  assert.strictEqual(styleDeclarations(home, '.disclaimer').color, '#8d91bd');
});

test('组件样式不使用 openvela 不支持的后代选择器', () => {
  for (const contract of contracts) {
    const source = componentSource(contract.file);
    const style = source.match(/<style>([\s\S]*?)<\/style>/)[1].replace(/\/\*[\s\S]*?\*\//g, '');
    const selectors = [...style.matchAll(/([^{}]+)\{/g)].map((match) => match[1].trim());
    assert(!selectors.some((selector) => selector.includes(' ') && !selector.startsWith('@keyframes')), contract.file);
  }
});

test('呼吸阶段同步驱动外环与呼吸核心', () => {
  const template = templateSource(componentSource('breathing.ux'));

  assert(attributesForClass(template, 'breath-halo').class.includes('{{ breathPhase }}'));
  assert(attributesForClass(template, 'breath-orb').class.includes('{{ breathPhase }}'));
});

test('呼吸球三层均由呼吸阶段驱动且文字不参与缩放', () => {
  const template = templateSource(componentSource('breathing.ux'));
  assert(attributesForClass(template, 'breath-halo').class.includes('{{ breathPhase }}'));
  assert(attributesForClass(template, 'breath-orb').class.includes('{{ breathPhase }}'));
  assert(attributesForClass(template, 'orb-core').class.includes('{{ breathPhase }}-core'));
  assert(!attributesForClass(template, 'phase-label').class.includes('breathPhase'));
});

test('呼吸球首次吸气即可播放且动画时长与 4-2-4 / 4-2-6 节奏一致', () => {
  const source = componentSource('breathing.ux');
  const template = templateSource(source);

  const halo = styleDeclarations(source, '.breath-halo');
  assert(attributesForClass(template, 'breath-halo').class.includes('{{ breathRhythmClass }}'));
  assert.strictEqual(halo['animation-name'], 'halo-breathe-standard');
  assert.strictEqual(halo['animation-duration'], '10000ms');
  assert.strictEqual(halo['animation-iteration-count'], 'infinite');
  assert.strictEqual(styleDeclarations(source, '.breath-halo.rhythm-calming')['animation-name'], 'halo-breathe-calming');
  assert.strictEqual(styleDeclarations(source, '.breath-halo.rhythm-calming')['animation-duration'], '12000ms');
  for (const phase of ['inhale', 'hold', 'exhale']) {
    assert.strictEqual(styleDeclarations(source, `.breath-halo.${phase}`)['animation-name'], undefined);
  }

  const orbAttributes = attributesForClass(template, 'breath-orb');
  assert(orbAttributes.class.includes('{{ breathRhythmClass }}'));
  for (const [phase, duration] of [['inhale', '4000ms'], ['hold', '2000ms'], ['exhale', '4000ms']]) {
    const declarations = styleDeclarations(source, `.breath-orb.${phase}`);
    assert.strictEqual(declarations['animation-duration'], duration);
    assert.strictEqual(declarations['animation-iteration-count'], '1');
  }
  const calmingExhale = styleDeclarations(source, '.breath-orb.rhythm-calming.exhale');
  assert.strictEqual(calmingExhale['animation-duration'], '6000ms');

  assert(!styleDeclarations(source, '.breath-halo')['transition-property']);
  assert(!styleDeclarations(source, '.breath-orb')['transition-property']);
  assert(attributesForClass(template, 'orb-core').class.includes('{{ breathRhythmClass }}'));
  for (const [phase, duration] of [['inhale-core', '4000ms'], ['hold-core', '2000ms'], ['exhale-core', '4000ms']]) {
    const declarations = styleDeclarations(source, `.${phase}`);
    assert.strictEqual(declarations['animation-duration'], duration);
    assert.strictEqual(declarations['animation-iteration-count'], '1');
  }
  const calmingCoreExhale = styleDeclarations(source, '.exhale-core.rhythm-calming');
  assert.strictEqual(calmingCoreExhale['animation-duration'], '6000ms');
  assert.strictEqual(calmingCoreExhale['animation-iteration-count'], undefined);
});

test('稳态 60 使用青蓝玻璃且动画不推动文字', () => {
  const source = componentSource('breathing.ux');
  const template = templateSource(source);

  assert.strictEqual(styleDeclarations(source, '.orb-shell')['background-color'], '#0d1630');
  assert.strictEqual(styleDeclarations(source, '.breath-halo')['border-color'], '#247f96');
  assert.strictEqual(styleDeclarations(source, '.breath-orb')['background-color'], undefined);
  assert.strictEqual(styleDeclarations(source, '.orb-core')['background-color'], '#a5f3fc');
  assert.strictEqual(styleDeclarations(source, '.phase-label').color, '#f8fafc');
  assert(!attributesForClass(template, 'phase-label').class.includes('breathPhase'));
  assert(!attributesForClass(template, 'remaining').class.includes('breathPhase'));
});

test('呼吸动画只缩放外层并始终围绕舞台中心运动', () => {
  const source = componentSource('breathing.ux');
  const shell = styleDeclarations(source, '.orb-shell');

  assert.strictEqual(shell['justify-content'], 'center');
  assert.strictEqual(shell['align-items'], 'center');
  assert.strictEqual(styleDeclarations(source, '.breath-halo')['transform-origin'], 'center center');
  assert(/\btransform\s*:/.test(keyframeSource(source, 'halo-breathe-standard')));
  assert(/\btransform\s*:/.test(keyframeSource(source, 'halo-breathe-calming')));

  for (const animationName of [
    'orb-inhale', 'orb-hold', 'orb-exhale',
    'core-breathe', 'core-hover', 'core-release',
  ]) {
    assert(!/\btransform\s*:/.test(keyframeSource(source, animationName)), `${animationName}:nested-scale`);
  }

  for (const phase of ['inhale', 'hold', 'exhale']) {
    assert.strictEqual(styleDeclarations(source, `.breath-orb.${phase}`)['background-color'], undefined);
  }
});

test('稳态呼吸在设备上具有清晰可见的收缩与明暗变化', () => {
  const source = componentSource('breathing.ux');

  for (const animationName of ['halo-breathe-standard', 'halo-breathe-calming']) {
    const frames = keyframeSource(source, animationName);
    const scales = [...frames.matchAll(/scale\((\d*\.?\d+)\)/g)].map((match) => Number(match[1]));
    const opacities = [...frames.matchAll(/opacity\s*:\s*(\d*\.?\d+)/g)].map((match) => Number(match[1]));

    assert(scales.length >= 2, `${animationName}:scale-frames`);
    assert(opacities.length >= 2, `${animationName}:opacity-frames`);
    assert(Math.max(...scales) - Math.min(...scales) >= 0.4, `${animationName}:visible-scale-range`);
    assert(Math.max(...opacities) - Math.min(...opacities) >= 0.45, `${animationName}:visible-opacity-range`);
  }
});

test('节奏拳使用可点击线框人物并绑定 B1 节拍状态', () => {
  const source = componentSource('boxing.ux');
  const template = templateSource(source);
  const parent = fs.readFileSync(path.join(pageDirectory, 'index.ux'), 'utf8');
  const stage = attributesForClass(template, 'fighter-stage');

  assert.strictEqual(stage.onclick, 'simulatePunch');
  assert(stage.class.includes('{{ boxingTargetClass }}'));
  for (const part of [
    'fighter-head', 'fighter-body', 'fighter-arm-left', 'fighter-arm-right',
    'fighter-fist-left', 'fighter-fist-right', 'fighter-leg-left', 'fighter-leg-right',
  ]) assert(template.includes(part), part);
  assert(template.includes('impact-wave-one'));
  assert(template.includes('impact-wave-two'));
  assert.strictEqual(styleDeclarations(source, '.fighter-body')['background-color'], '#fb7185');
  assert.strictEqual(styleDeclarations(source, '.target-active-fist-right')['background-color'], '#fbbf24');
  assert.strictEqual(styleDeclarations(source, '.target-hit-arm-right')['background-color'], '#fb7185');
  assert.strictEqual(styleDeclarations(source, '.combo-hot').color, '#fbbf24');
  assert(attributesForClass(template, 'boxing-streak-value').class.includes('{{ boxingComboClass }}'));
  assert(parent.includes("this.boxingComboClass = this.boxingStats.streak >= 5 ? 'combo-hot' : 'combo-calm'"));
});

test('节奏拳外壳与降级控件使用 B1 中性和玫红玻璃色', () => {
  const source = componentSource('boxing.ux');

  assert.strictEqual(styleDeclarations(source, '.boxing-remaining').color, '#f8fafc');
  assert.strictEqual(styleDeclarations(source, '.boxing-stat-label').color, '#8d91bd');
  assert.strictEqual(styleDeclarations(source, '.boxing-pace').color, '#8d91bd');
  assert.strictEqual(styleDeclarations(source, '.boxing-message').color, '#fda4af');
  assert.strictEqual(styleDeclarations(source, '.simulate-button')['border-color'], '#9d415b');
  assert.strictEqual(styleDeclarations(source, '.simulate-button')['background-color'], '#2a142b');
  assert.strictEqual(styleDeclarations(source, '.simulate-text').color, '#fda4af');
  assert.strictEqual(styleDeclarations(source, '.stop-button')['border-color'], '#49345f');
  assert.strictEqual(styleDeclarations(source, '.stop-button')['background-color'], '#18142f');
  assert.strictEqual(styleDeclarations(source, '.stop-text').color, '#a7a9c7');
});

test('节奏拳人物以舞台中心为锚点并使用完整的蓄力出拳回位节奏', () => {
  const source = componentSource('boxing.ux');
  const stage = styleDeclarations(source, '.fighter-stage');
  const arm = styleDeclarations(source, '.fighter-arm');
  const fist = styleDeclarations(source, '.fighter-fist');

  assert.strictEqual(stage['justify-content'], 'center');
  assert.strictEqual(stage['align-items'], 'center');
  assert.strictEqual(styleDeclarations(source, '.fighter')['transform-origin'], 'center center');
  assert.strictEqual(arm['transition-duration'], '280ms');
  assert.strictEqual(arm['transition-timing-function'], 'ease-in-out');
  assert.strictEqual(fist['transition-duration'], '280ms');
  assert.strictEqual(fist['transition-timing-function'], 'ease-in-out');
  assert.strictEqual(styleDeclarations(source, '.target-active-fighter')['animation-name'], 'fighter-ready');
  assert.strictEqual(styleDeclarations(source, '.target-hit-fighter')['animation-duration'], '460ms');
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
  assert.strictEqual(centerLayer.width, '100%');
  assert.strictEqual(centerLayer.height, '100%');
  assert.strictEqual(centerLayer['justify-content'], 'center');
  assert.strictEqual(centerLayer['align-items'], 'center');
  assert.strictEqual(styleDeclarations(source, '.fighter-stage')['margin-top'], '0');
});

test('节奏拳短视口使用实际像素尺寸并保持人物几何中心', () => {
  const source = componentSource('boxing.ux');
  const template = templateSource(source);
  const fighter = styleDeclarations(source, '.fighter');
  const shortFighter = styleDeclarations(source, '.fighter-short');
  const shortAnchor = styleDeclarations(source, '.fighter-anchor-short');
  const shortAnimations = [
    ['.fighter.fighter-short', 'fighter-enter-short'],
    ['.target-active-fighter.fighter-short', 'fighter-ready-short'],
    ['.target-hit-fighter.fighter-short', 'fighter-strike-short'],
    ['.target-missed-fighter.fighter-short', 'fighter-miss-short'],
  ];

  assert(template.includes('class="fighter-anchor fighter-anchor-{{ screenViewport }}"'));
  assert.strictEqual(fighter.position, 'absolute');
  assert.strictEqual(fighter.left, '0');
  assert.strictEqual(fighter.top, '0');
  assert.strictEqual(shortAnchor.width, '60px');
  assert.strictEqual(shortAnchor.height, '95px');
  assert.strictEqual(shortFighter.width, '60px');
  assert.strictEqual(shortFighter.height, '95px');
  assert.strictEqual(shortFighter.transform, 'scale(1)');
  assert.strictEqual(styleDeclarations(source, '.fighter-head-short').width, '20px');
  assert.strictEqual(styleDeclarations(source, '.fighter-body-short').height, '38px');

  for (const [selector, animationName] of shortAnimations) {
    const declarations = styleDeclarations(source, selector);
    assert.strictEqual(declarations['animation-name'], animationName);
    assert.strictEqual(declarations['animation-iteration-count'], '1');
    const frames = [...keyframeSource(source, animationName).matchAll(/\d+%\s*\{([^}]*)\}/g)];
    assert(frames.length > 0, `${animationName}:frames`);
    for (const frame of frames) {
      const properties = frame[1]
        .split(';')
        .map((declaration) => declaration.trim())
        .filter(Boolean)
        .map((declaration) => declaration.slice(0, declaration.indexOf(':')).trim());
      assert(properties.every((property) => ['transform', 'opacity'].includes(property)), `${animationName}:properties`);
      assert(/transform:[^;]*scale\(1\)/.test(frame[1]), `${animationName}:scale`);
    }
  }
});

test('节奏拳关键帧避开 AIoT 运行时不兼容的位移与旋转', () => {
  const source = componentSource('boxing.ux');
  const animationNames = [
    'fighter-enter', 'fighter-enter-short',
    'fighter-ready', 'fighter-ready-short',
    'fighter-strike', 'fighter-strike-short',
    'fighter-miss', 'fighter-miss-short',
    'impact-expand',
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
});

test('结果页共享单次完成光环并使用对应 B1 能量色', () => {
  const steady = componentSource('steady-result.ux');
  const boxingResult = componentSource('boxing-result.ux');

  for (const source of [steady, boxingResult]) {
    assert(templateSource(source).includes('completion-halo'));
    assert(source.includes('@keyframes completion-enter'));
    assert.strictEqual(styleDeclarations(source, '.completion-halo')['animation-iteration-count'], '1');
  }
  assert.strictEqual(styleDeclarations(steady, '.completion-halo')['border-color'], '#22d3ee');
  assert.strictEqual(styleDeclarations(steady, '.result-row')['background-color'], '#11152e');
  assert.strictEqual(styleDeclarations(boxingResult, '.completion-halo')['border-color'], '#fb7185');
  assert.strictEqual(styleDeclarations(boxingResult, '.boxing-result-cell')['background-color'], '#18142f');
  assert.strictEqual(styleDeclarations(boxingResult, '.coral').color, '#fda4af');
});

console.log(`\n${passed} component contract tests passed`);
