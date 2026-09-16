import test from 'node:test';
import assert from 'node:assert/strict';
import {isReviewed, replaceOutput, revisionState, setReviewed} from '../revisions.mjs';

const output = () => ({product: new Blob(['product']), transparent: new Blob(['transparent'])});

test('legacy done review migrates to revision 1 while pending review is invalid', () => {
 assert.deepEqual(revisionState({status: 'done', reviewed: true}), {imageRevision: 1, reviewedRevision: 1, reviewed: true});
 assert.deepEqual(revisionState({status: 'pending', reviewed: true}), {imageRevision: 0, reviewedRevision: null, reviewed: false});
});

test('new result advances its revision and cannot reuse a previous review', () => {
 const item = {status: 'pending', reviewed: false, error: 'old failure'};
 assert.equal(replaceOutput(item, output()), item);
 assert.equal(item.imageRevision, 1);
 assert.equal(item.error, undefined);
 setReviewed(item, true);
 assert.equal(isReviewed(item), true);
 replaceOutput(item, output());
 assert.equal(item.imageRevision, 2);
 assert.equal(item.reviewedRevision, null);
 assert.equal(isReviewed(item), false);
 setReviewed(item, true);
 assert.equal(item.reviewedRevision, 2);
 setReviewed(item, false);
 assert.equal(item.reviewedRevision, null);
 assert.equal(isReviewed(item), false);
});

test('explicit mismatches, missing confirmation revisions and malformed revisions never grant review', () => {
 for (const revisions of [
  {imageRevision: 2, reviewedRevision: 1},
  {imageRevision: 2},
  {reviewedRevision: 1},
  {imageRevision: 2, reviewedRevision: null},
  {imageRevision: 0, reviewedRevision: 0},
  {imageRevision: NaN, reviewedRevision: NaN},
  {imageRevision: '2', reviewedRevision: '2'},
 ]) assert.equal(isReviewed({status: 'done', reviewed: true, ...revisions}), false);
 assert.equal(isReviewed({status: 'done', reviewed: false, imageRevision: 2, reviewedRevision: 2}), false);
});

test('invalid output and overflow fail before changing the existing result', () => {
 const item = {status: 'done', reviewed: true, imageRevision: 2, reviewedRevision: 2, output: output()};
 const original = {...item};
 assert.throws(() => replaceOutput(item, {product: new Blob()}), /新结果/);
 assert.deepEqual(item, original);
 item.imageRevision = Number.MAX_SAFE_INTEGER;
 assert.throws(() => replaceOutput(item, output()), /超出范围/);
 assert.throws(() => setReviewed({status: 'processing'}, true), /只能确认已完成/);
});
