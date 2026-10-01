import assert from 'node:assert/strict';
import test from 'node:test';
import { buildBrief, normalizeBrief } from '../site/product-images/product-brief.js';
const valid = { quantity: '10', size: '1200', rights: true, project: '', notes: '' };

test('requires a bounded whole-number quantity, selected size and explicit rights', () => {
  for (const quantity of ['0', '101', '-1', '1.5', '1e1', '', 'Infinity', '10张']) {
    assert.throws(() => normalizeBrief({ ...valid, quantity }));
  }
  assert.equal(normalizeBrief({ ...valid, quantity: '100', size: '1600' }).quantity, 100);
  for (const size of ['0', '8192', null]) assert.throws(() => normalizeBrief({ ...valid, size }));
  for (const rights of [false, undefined, 'true', 1]) assert.throws(() => normalizeBrief({ ...valid, rights }));
});

test('brief describes a consultation, retains supplied requirements and never claims payment', () => {
  const text = buildBrief({ ...valid, project: '上新', notes: '按 SKU 命名' });
  assert.match(text, /尚未发送 \/ 非订单/);
  assert.match(text, /名称：上新/);
  assert.match(text, /按 SKU 命名/);
  assert.match(text, /1200 × 1200/);
  assert.match(text, /不代表已下单、已支付/);
});

test('bounds free text and retains markup only as literal text', () => {
  assert.throws(() => buildBrief({ ...valid, project: 'x'.repeat(81) }));
  assert.throws(() => buildBrief({ ...valid, notes: 'x'.repeat(501) }));
  assert.match(buildBrief({ ...valid, notes: '<script>bad()</script>' }), /<script>bad\(\)<\/script>/);
});
