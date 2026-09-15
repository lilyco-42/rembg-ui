import test from 'node:test';
import assert from 'node:assert/strict';
import {ConflictError, openProjectStore, validateProject} from '../project-store.mjs';

function project(status = 'done') {
 return {schemaVersion: 1, size: 1200, reviewedOnly: true, items: [{
  id: 'image-1', source: '原图.png', file: new File(['original'], '原图.png', {type: 'image/png', lastModified: 123}),
  status, reviewed: true, output: {product: new Blob(['product']), transparent: new Blob(['transparent'])},
 }]};
}

// A minimal transaction scheduler: commits are atomic, aborted writes are
// discarded, and transactions from separate connections share a serial queue.
// Browser integration still exercises the real IndexedDB structured clone.
function memoryIndexedDB() {
 const state = {record: undefined, tail: Promise.resolve(), nextWriteError: null};
 const factory = {open() {
  const request = {};
  queueMicrotask(() => {
   request.result = {close() {}, transaction() {
    let finish, staged, aborted = false, read;
    const finished = new Promise(resolve => { finish = resolve; });
    const store = {
     get() { read = {}; return read; },
     put(value) {
      if (state.nextWriteError) {
       const error = state.nextWriteError; state.nextWriteError = null;
       throw error;
      }
      staged = value;
     },
    };
    const transaction = {objectStore: () => store, abort() {
     aborted = true;
     queueMicrotask(() => { transaction.onabort?.(); finish(); });
    }};
    const previous = state.tail;
    state.tail = finished;
    previous.then(() => {
     read.result = state.record;
     read.onsuccess();
     queueMicrotask(() => {
      if (aborted) return;
      if (staged) state.record = staged;
      transaction.oncomplete?.(); finish();
     });
    });
    return transaction;
   }};
   request.onsuccess();
  });
  return request;
 }};
 return {factory, state};
}

test('restores original File, both outputs, settings and reviewed result; excludes transient fields', async () => {
 const input = project();
 input.url = 'blob:temporary';
 input.items[0].preview = 'blob:preview';
 input.items[0].output.id = 7;
 const saved = validateProject(input);
 assert.equal(saved.items[0].file.name, '原图.png');
 assert.equal(saved.items[0].file.lastModified, 123);
 assert.equal(await saved.items[0].file.text(), 'original');
 assert.equal(await saved.items[0].output.product.text(), 'product');
 assert.equal(await saved.items[0].output.transparent.text(), 'transparent');
 assert.equal(saved.items[0].reviewed, true);
 assert.equal(saved.size, 1200);
 assert.equal(saved.reviewedOnly, true);
 assert.equal('url' in saved, false);
 assert.equal('preview' in saved.items[0], false);
 assert.deepEqual(Object.keys(saved.items[0].output), ['product', 'transparent']);
});

test('interrupted and pending items restore pending, unreviewed and without stale outputs', () => {
 for (const status of ['processing', 'pending']) {
  const input = project(status);
  const result = validateProject(input, {restore: true});
  assert.equal(result.items[0].status, 'pending');
  assert.equal(result.items[0].reviewed, false);
  assert.equal('output' in result.items[0], false);
 }
 const failed = project('error'); failed.items[0].error = '图片损坏';
 assert.equal(validateProject(failed, {restore: true}).items[0].error, '图片损坏');
});

test('rejects unsupported schemas, corrupt settings, missing blobs and duplicate IDs', () => {
 const mutations = [
  x => { x.schemaVersion = 2; }, x => { x.size = 999; },
  x => { x.reviewedOnly = 'true'; }, x => { x.items[0].file = 'blob:old'; },
  x => { x.items[0].output.product = null; }, x => { x.items[0].status = 'unknown'; },
  x => { x.items.push({...x.items[0]}); }, x => { x.items[0].reviewed = 1; },
 ];
 for (const mutate of mutations) { const input = project(); mutate(input); assert.throws(() => validateProject(input), /项目数据无效/); }
 assert.deepEqual(validateProject({...project(), items: []}).items, []);
});

test('serial saves capture nested mutable state immediately and advance only after commits', async () => {
 const {factory, state} = memoryIndexedDB();
 const store = await openProjectStore({indexedDB: factory});
 assert.equal(await store.load(), null);
 const input = project();
 const first = store.save(input);
 input.items[0].reviewed = false;
 input.items.length = 0;
 await first;
 assert.equal(state.record.snapshot.items[0].reviewed, true);
 const second = store.save({...project(), size: 1600});
 const third = store.save({...project(), items: []});
 await Promise.all([second, third]);
 assert.equal(state.record.revision, 3);
 assert.deepEqual((await store.load()).items, []);
});

test('a stale tab cannot overwrite a newer project or cleared project', async () => {
 const {factory, state} = memoryIndexedDB();
 const first = await openProjectStore({indexedDB: factory});
 const second = await openProjectStore({indexedDB: factory});
 await Promise.all([first.load(), second.load()]);
 await first.save(project());
 await assert.rejects(second.save(project()), ConflictError);
 assert.equal(state.record.revision, 1);
 await second.load();
 await second.save({...project(), items: []});
 await assert.rejects(first.save(project()), ConflictError);
 assert.deepEqual(state.record.snapshot.items, []);
});

test('quota failure is visible, leaves revision and previous data intact, and permits retry', async () => {
 const {factory, state} = memoryIndexedDB();
 const store = await openProjectStore({indexedDB: factory});
 await store.load();
 await store.save(project());
 state.nextWriteError = new DOMException('Quota exceeded', 'QuotaExceededError');
 await assert.rejects(store.save({...project(), items: []}), /存储空间不足/);
 assert.equal(state.record.revision, 1);
 assert.equal(state.record.snapshot.items.length, 1);
 await store.save({...project(), items: []});
 assert.equal(state.record.revision, 2);
});

test('load normalizes interrupted work and refuses malformed stored data', async () => {
 const {factory, state} = memoryIndexedDB();
 const store = await openProjectStore({indexedDB: factory});
 await store.load();
 await store.save(project('processing'));
 assert.equal((await store.load()).items[0].status, 'pending');
 state.record.snapshot.schemaVersion = 99;
 await assert.rejects(store.load(), /不支持的存储版本/);
});

test('save before load and unavailable browser storage fail explicitly', async () => {
 const {factory} = memoryIndexedDB();
 const store = await openProjectStore({indexedDB: factory});
 await assert.rejects(store.save(project()), /保存前必须先加载/);
 await store.load();
 await store.save(project());
 await assert.rejects(openProjectStore({indexedDB: null}), /无法使用 IndexedDB/);
});
