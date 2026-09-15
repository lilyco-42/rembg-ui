const ID_MAX_LENGTH = 64;
const LABEL_MAX_LENGTH = 80;
const REQUIRED_FIELDS = [
  'id',
  'label',
  'width',
  'height',
  'background',
  'marginPercent',
  'format',
];

function validateString(value, field, maxLength) {
  if (typeof value !== 'string') {
    throw new TypeError(`${field} must be a string`);
  }
  if (value.length === 0 || value.length > maxLength) {
    throw new RangeError(`${field} must contain between 1 and ${maxLength} characters`);
  }
  return value;
}

function validateInteger(value, field, minimum, maximum) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${field} must be a finite number`);
  }
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${field} must be an integer from ${minimum} to ${maximum}`);
  }
  return value;
}

function validateChoice(value, field, choices) {
  if (typeof value !== 'string') {
    throw new TypeError(`${field} must be a string`);
  }
  if (!choices.includes(value)) {
    throw new RangeError(`${field} must be one of: ${choices.join(', ')}`);
  }
  return value;
}

export function validatePreset(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('preset must be an object');
  }
  for (const field of REQUIRED_FIELDS) {
    if (!Object.hasOwn(value, field)) {
      throw new TypeError(`preset is missing ${field}`);
    }
  }

  return {
    id: validateString(value.id, 'id', ID_MAX_LENGTH),
    label: validateString(value.label, 'label', LABEL_MAX_LENGTH),
    width: validateInteger(value.width, 'width', 800, 2000),
    height: validateInteger(value.height, 'height', 800, 2000),
    background: validateChoice(value.background, 'background', ['white', 'transparent']),
    marginPercent: validateInteger(value.marginPercent, 'marginPercent', 0, 30),
    format: validateChoice(value.format, 'format', ['png']),
  };
}

export const PRESETS = Object.freeze([
  Object.freeze(validatePreset({
    id: 'white-1200',
    label: '1200 方图白底',
    width: 1200,
    height: 1200,
    background: 'white',
    marginPercent: 10,
    format: 'png',
  })),
  Object.freeze(validatePreset({
    id: 'white-1600',
    label: '1600 方图白底',
    width: 1600,
    height: 1600,
    background: 'white',
    marginPercent: 10,
    format: 'png',
  })),
  Object.freeze(validatePreset({
    id: 'transparent-1200',
    label: '1200 方图透明',
    width: 1200,
    height: 1200,
    background: 'transparent',
    marginPercent: 10,
    format: 'png',
  })),
]);
