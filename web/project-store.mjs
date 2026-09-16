import {revisionState} from './revisions.mjs?v=editor-2';

export const PROJECT_SCHEMA_VERSION = 1;
const STORE = 'projects';
const KEY = 'active';

export class ConflictError extends Error {
 constructor() {
  super('另一页面已保存了更新的项目，请刷新本页后继续。');
  this.name = 'ConflictError';
 }
}

function invalid(message) { throw new Error(`项目数据无效：${message}`); }
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }

// Copy only durable fields at call time. Blob/File objects are immutable; their
// original names and bytes survive IndexedDB's structured clone.
export function validateProject(snapshot, {restore = false} = {}) {
 if (!object(snapshot) || snapshot.schemaVersion !== PROJECT_SCHEMA_VERSION) invalid('不支持的存储版本');
 if (![0, 1200, 1600].includes(snapshot.size)) invalid('输出规格不受支持');
 if (typeof snapshot.reviewedOnly !== 'boolean') invalid('确认筛选必须为布尔值');
 if (!Array.isArray(snapshot.items) || snapshot.items.length > 10) invalid('每批最多 10 张图片');
 const ids = new Set();
 const items = snapshot.items.map(item => {
  if (!object(item) || typeof item.id !== 'string' || !item.id.trim() || ids.has(item.id)) invalid('图片 ID 缺失或重复');
  ids.add(item.id);
  if (typeof item.source !== 'string' || !item.source.trim() || !(item.file instanceof Blob)) invalid('缺少原图或文件名');
  if (!['pending', 'processing', 'done', 'error'].includes(item.status)) invalid('图片状态不受支持');
  if (typeof item.reviewed !== 'boolean') invalid('图片确认必须为布尔值');
  if (item.error !== undefined && typeof item.error !== 'string') invalid('错误信息必须为文本');
  const status = restore && item.status === 'processing' ? 'pending' : item.status;
  const revisions = revisionState(item);
  const result = {id: item.id, source: item.source, file: item.file, status, ...revisions};
  if (status !== 'done') { result.reviewed = false; result.reviewedRevision = null; }
  if (status === 'done') {
   if (!object(item.output) || !(item.output.product instanceof Blob) || !(item.output.transparent instanceof Blob)) invalid('已完成图片缺少商品图或透明底稿');
   result.output = {product: item.output.product, transparent: item.output.transparent};
  }
  if (status === 'error' && item.error !== undefined) result.error = item.error;
  return result;
 });
 return {schemaVersion: PROJECT_SCHEMA_VERSION, size: snapshot.size, reviewedOnly: snapshot.reviewedOnly, items};
}

function revision(record) {
 if (record === undefined) return 0;
 if (!object(record) || !Number.isSafeInteger(record.revision) || record.revision < 1) invalid('存储修订号损坏');
 return record.revision;
}

function storageError(error) {
 if (error instanceof ConflictError) return error;
 const hint = error?.name === 'QuotaExceededError' ? '浏览器存储空间不足' : '浏览器项目存储失败';
 return new Error(`${hint}：${error?.message || '请检查浏览器存储权限'}`, {cause: error});
}

class ProjectStore {
 #db;
 #revision;
 #queue = Promise.resolve();
 constructor(db) { this.#db = db; }

 #enqueue(operation) {
  const task = this.#queue.then(operation);
  // Each caller receives its own rejection, while later calls can still run.
  this.#queue = task.catch(() => {});
  return task;
 }

 #transaction(mode, operation) {
  return new Promise((resolve, reject) => {
   let transaction, result, failure;
   try {
    transaction = this.#db.transaction(STORE, mode);
    transaction.oncomplete = () => resolve(result);
    transaction.onabort = () => reject(storageError(failure || transaction.error));
    const request = transaction.objectStore(STORE).get(KEY);
    request.onsuccess = () => {
     try { result = operation(request.result, transaction.objectStore(STORE)); }
     catch (error) { failure = error; transaction.abort(); }
    };
   } catch (error) {
    if (transaction) {
     failure = error;
     try { transaction.abort(); } catch { reject(storageError(error)); }
    } else reject(storageError(error));
   }
  });
 }

 load() {
  return this.#enqueue(async () => {
   const loaded = await this.#transaction('readonly', record => ({
    revision: revision(record),
    snapshot: record === undefined ? null : validateProject(record.snapshot, {restore: true}),
   }));
   this.#revision = loaded.revision;
   return loaded.snapshot;
  });
 }

 save(snapshot) {
  let captured;
  try { captured = validateProject(snapshot); }
  catch (error) { return Promise.reject(error); }
  return this.#enqueue(async () => {
   if (this.#revision === undefined) throw new Error('保存前必须先加载当前项目，避免覆盖已有图片。');
   const nextRevision = await this.#transaction('readwrite', (record, store) => {
    const currentRevision = revision(record);
    if (currentRevision !== this.#revision) throw new ConflictError();
    if (currentRevision === Number.MAX_SAFE_INTEGER) invalid('存储修订号超出范围');
    store.put({revision: currentRevision + 1, snapshot: captured}, KEY);
    return currentRevision + 1;
   });
   // Never advance the expected revision before the transaction commits.
   this.#revision = nextRevision;
  });
 }
}

export async function openProjectStore({indexedDB = globalThis.indexedDB, name = 'rembg-studio-project'} = {}) {
 if (!indexedDB) throw new Error('此浏览器无法使用 IndexedDB，项目不能自动保存。');
 const db = await new Promise((resolve, reject) => {
  let request, settled = false;
  try { request = indexedDB.open(name, 1); }
  catch (error) { reject(storageError(error)); return; }
  request.onupgradeneeded = () => {
   if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
  };
  request.onerror = () => { settled = true; reject(storageError(request.error)); };
  request.onblocked = () => { settled = true; reject(new Error('项目存储升级被其他页面阻塞，请关闭其他页面后刷新。')); };
  request.onsuccess = () => {
   if (settled) { request.result.close(); return; }
   const connection = request.result;
   connection.onversionchange = () => connection.close();
   resolve(connection);
  };
 });
 return new ProjectStore(db);
}
