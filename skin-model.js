const rect = (x1, y1, x2, y2) => Object.freeze([x1, y1, x2, y2]);

const freezeFaces = (faces) => Object.freeze(faces);

const CLASSIC = Object.freeze({
  head: freezeFaces({ top: rect(8, 0, 16, 8), bottom: rect(16, 0, 24, 8), right: rect(16, 8, 24, 16), front: rect(8, 8, 16, 16), left: rect(0, 8, 8, 16), back: rect(24, 8, 32, 16) }),
  body: freezeFaces({ top: rect(20, 16, 28, 20), bottom: rect(28, 16, 36, 20), right: rect(16, 20, 20, 32), front: rect(20, 20, 28, 32), left: rect(28, 20, 32, 32), back: rect(32, 20, 40, 32) }),
  rightArm: freezeFaces({ top: rect(44, 16, 48, 20), bottom: rect(48, 16, 52, 20), right: rect(40, 20, 44, 32), front: rect(44, 20, 48, 32), left: rect(48, 20, 52, 32), back: rect(52, 20, 56, 32) }),
  rightLeg: freezeFaces({ top: rect(4, 16, 8, 20), bottom: rect(8, 16, 12, 20), right: rect(0, 20, 4, 32), front: rect(4, 20, 8, 32), left: rect(8, 20, 12, 32), back: rect(12, 20, 16, 32) }),
  leftArm: freezeFaces({ top: rect(36, 48, 40, 52), bottom: rect(40, 48, 44, 52), right: rect(32, 52, 36, 64), front: rect(36, 52, 40, 64), left: rect(40, 52, 44, 64), back: rect(44, 52, 48, 64) }),
  leftLeg: freezeFaces({ top: rect(20, 48, 24, 52), bottom: rect(24, 48, 28, 52), right: rect(16, 52, 20, 64), front: rect(20, 52, 24, 64), left: rect(24, 52, 28, 64), back: rect(28, 52, 32, 64) }),
  headOuter: freezeFaces({ top: rect(40, 0, 48, 8), bottom: rect(48, 0, 56, 8), right: rect(48, 8, 56, 16), front: rect(40, 8, 48, 16), left: rect(32, 8, 40, 16), back: rect(56, 8, 64, 16) }),
  bodyOuter: freezeFaces({ top: rect(20, 32, 28, 36), bottom: rect(28, 32, 36, 36), right: rect(16, 36, 20, 48), front: rect(20, 36, 28, 48), left: rect(28, 36, 32, 48), back: rect(32, 36, 40, 48) }),
  rightArmOuter: freezeFaces({ top: rect(44, 32, 48, 36), bottom: rect(48, 32, 52, 36), right: rect(40, 36, 44, 48), front: rect(44, 36, 48, 48), left: rect(48, 36, 52, 48), back: rect(52, 36, 56, 48) }),
  rightLegOuter: freezeFaces({ top: rect(4, 32, 8, 36), bottom: rect(8, 32, 12, 36), right: rect(0, 36, 4, 48), front: rect(4, 36, 8, 48), left: rect(8, 36, 12, 48), back: rect(12, 36, 16, 48) }),
  leftArmOuter: freezeFaces({ top: rect(52, 48, 56, 52), bottom: rect(56, 48, 60, 52), right: rect(48, 52, 52, 64), front: rect(52, 52, 56, 64), left: rect(56, 52, 60, 64), back: rect(60, 52, 64, 64) }),
  leftLegOuter: freezeFaces({ top: rect(4, 48, 8, 52), bottom: rect(8, 48, 12, 52), right: rect(0, 52, 4, 64), front: rect(4, 52, 8, 64), left: rect(8, 52, 12, 64), back: rect(12, 52, 16, 64) })
});

const SLIM = Object.freeze({
  ...CLASSIC,
  rightArm: freezeFaces({ top: rect(44, 16, 47, 20), bottom: rect(47, 16, 50, 20), right: rect(40, 20, 44, 32), front: rect(44, 20, 47, 32), left: rect(47, 20, 51, 32), back: rect(51, 20, 54, 32) }),
  leftArm: freezeFaces({ top: rect(36, 48, 39, 52), bottom: rect(39, 48, 42, 52), right: rect(32, 52, 36, 64), front: rect(36, 52, 39, 64), left: rect(39, 52, 43, 64), back: rect(43, 52, 46, 64) }),
  rightArmOuter: freezeFaces({ top: rect(44, 32, 47, 36), bottom: rect(47, 32, 50, 36), right: rect(40, 36, 44, 48), front: rect(44, 36, 47, 48), left: rect(47, 36, 51, 48), back: rect(51, 36, 54, 48) }),
  leftArmOuter: freezeFaces({ top: rect(52, 48, 55, 52), bottom: rect(55, 48, 58, 52), right: rect(48, 52, 52, 64), front: rect(52, 52, 55, 64), left: rect(55, 52, 59, 64), back: rect(59, 52, 62, 64) })
});

const box = (bounds, faces, layer) => Object.freeze({ bounds: Object.freeze(bounds), faces, layer });

export function getModelDefinition(model = 'classic') {
  if (model !== 'classic' && model !== 'slim') throw new TypeError(`Unknown model: ${model}`);
  const faces = model === 'slim' ? SLIM : CLASSIC;
  const armMin = model === 'slim' ? -7 : -8;
  const armMax = model === 'slim' ? 7 : 8;
  const outerArmMin = model === 'slim' ? -7.25 : -8.25;
  const outerArmMax = model === 'slim' ? 7.25 : 8.25;

  return Object.freeze([
    box([-4, 24, -4, 4, 32, 4], faces.head, 'base'),
    box([-4, 12, -2, 4, 24, 2], faces.body, 'base'),
    box([armMin, 12, -2, -4, 24, 2], faces.rightArm, 'base'),
    box([4, 12, -2, armMax, 24, 2], faces.leftArm, 'base'),
    box([-4, 0, -2, 0, 12, 2], faces.rightLeg, 'base'),
    box([0, 0, -2, 4, 12, 2], faces.leftLeg, 'base'),
    box([-4.5, 23.5, -4.5, 4.5, 32.5, 4.5], faces.headOuter, 'outer'),
    box([-4.25, 11.75, -2.25, 4.25, 24.25, 2.25], faces.bodyOuter, 'outer'),
    box([outerArmMin, 11.75, -2.25, -3.75, 24.25, 2.25], faces.rightArmOuter, 'outer'),
    box([3.75, 11.75, -2.25, outerArmMax, 24.25, 2.25], faces.leftArmOuter, 'outer'),
    box([-4.25, -0.25, -2.25, 0.25, 12.25, 2.25], faces.rightLegOuter, 'outer'),
    box([-0.25, -0.25, -2.25, 4.25, 12.25, 2.25], faces.leftLegOuter, 'outer')
  ]);
}

export function detectModel(pixelData) {
  if (!(pixelData instanceof Uint8ClampedArray) || pixelData.length !== 64 * 64 * 4) {
    throw new TypeError('Expected 64x64 RGBA pixel data');
  }
  const transparent = (x, y) => pixelData[(y * 64 + x) * 4 + 3] === 0;
  const slimOnlyGaps = [
    [54, 20], [55, 20], [54, 31], [55, 31],
    [46, 52], [47, 52], [46, 63], [47, 63]
  ];
  return slimOnlyGaps.every(([x, y]) => transparent(x, y)) ? 'slim' : 'classic';
}

export function triangleRangeForLayer(layer, triangleCount) {
  if (layer !== 'base' && layer !== 'outer') throw new TypeError(`Unknown layer: ${layer}`);
  const half = triangleCount / 2;
  return layer === 'base' ? [0, half] : [half, triangleCount];
}
