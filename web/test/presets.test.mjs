import test from 'node:test';
import assert from 'node:assert/strict';
import {PRESETS, validatePreset} from '../presets.mjs';

const EXPECTED_PRESETS = [
  {
    id: 'white-1200',
    label: '1200 方图白底',
    width: 1200,
    height: 1200,
    background: 'white',
    marginPercent: 10,
    format: 'png',
  },
  {
    id: 'white-1600',
    label: '1600 方图白底',
    width: 1600,
    height: 1600,
    background: 'white',
    marginPercent: 10,
    format: 'png',
  },
  {
    id: 'transparent-1200',
    label: '1200 方图透明',
    width: 1200,
    height: 1200,
    background: 'transparent',
    marginPercent: 10,
    format: 'png',
  },
];

function validPreset(overrides = {}) {
  return {...EXPECTED_PRESETS[0], ...overrides};
}

test('exports the three specified presets', () => {
  assert.deepEqual(PRESETS, EXPECTED_PRESETS);
});

test('freezes the preset collection and every preset', () => {
  assert.equal(Object.isFrozen(PRESETS), true);
  for (const preset of PRESETS) {
    assert.equal(Object.isFrozen(preset), true);
  }
});

test('accepts inclusive numeric and string-length boundaries', () => {
  const minimum = validPreset({
    id: 'x',
    label: 'y',
    width: 800,
    height: 800,
    marginPercent: 0,
  });
  const maximum = validPreset({
    id: 'i'.repeat(64),
    label: 'l'.repeat(80),
    width: 2000,
    height: 2000,
    marginPercent: 30,
  });

  assert.deepEqual(validatePreset(minimum), minimum);
  assert.deepEqual(validatePreset(maximum), maximum);
});

test('rejects non-object, array, missing, and incorrectly typed values', () => {
  for (const value of [null, [], 'preset', 1]) {
    assert.throws(() => validatePreset(value), TypeError);
  }

  for (const value of [
    {},
    Object.create(validPreset()),
    validPreset({id: 1}),
    validPreset({label: null}),
    validPreset({width: '1200'}),
    validPreset({height: Number.NaN}),
    validPreset({marginPercent: Number.POSITIVE_INFINITY}),
    validPreset({background: null}),
    validPreset({format: false}),
  ]) {
    assert.throws(() => validatePreset(value), TypeError);
  }
});

test('rejects values outside the allowed ranges and choices', () => {
  for (const value of [
    validPreset({id: ''}),
    validPreset({id: 'i'.repeat(65)}),
    validPreset({label: ''}),
    validPreset({label: 'l'.repeat(81)}),
    validPreset({width: 799}),
    validPreset({width: 2001}),
    validPreset({height: 799}),
    validPreset({height: 2001}),
    validPreset({width: 1200.5}),
    validPreset({marginPercent: -1}),
    validPreset({marginPercent: 31}),
    validPreset({marginPercent: 10.5}),
    validPreset({background: 'black'}),
    validPreset({format: 'jpeg'}),
  ]) {
    assert.throws(() => validatePreset(value), RangeError);
  }
});

test('returns a new seven-field object, ignores extras, and does not mutate input', () => {
  const input = validPreset({extra: {kept: true}});
  const before = structuredClone(input);
  const result = validatePreset(input);

  assert.notEqual(result, input);
  assert.deepEqual(input, before);
  assert.deepEqual(result, EXPECTED_PRESETS[0]);
  assert.deepEqual(Object.keys(result), [
    'id',
    'label',
    'width',
    'height',
    'background',
    'marginPercent',
    'format',
  ]);
  assert.equal('extra' in result, false);
});
