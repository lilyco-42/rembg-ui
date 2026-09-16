// Exercise the actual inline workflow without model/network dependencies.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync('frontend/index.html', 'utf8');
for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
const elements = new Map();
const element = id => {
    if (!elements.has(id)) elements.set(id, {value: '', checked: false, disabled: false, style: {}, addEventListener() {}});
    return elements.get(id);
};
let zip;
const ctx = vm.createContext({console, TextEncoder, Uint8Array, Blob, atob, FormData,
    URL: {createObjectURL(blob) { zip = blob; return 'blob:test'; }, revokeObjectURL() {}},
    setTimeout() {}, originalFileName: null, triggerDownload() {},
    document: {getElementById: element, querySelector() {return null;}}
});
const zipSource = html.slice(html.indexOf('        function saveImageZip('), html.indexOf('        function zoomResultEdges'));
vm.runInContext(zipSource, ctx);
const batchSource = html.slice(html.indexOf('        let batchQueue = []'), html.indexOf('        // ─── Mode switching'));
vm.runInContext(batchSource.replace('        restoreBatch();', ''), ctx);
(async () => {
    await vm.runInContext(`(async () => {
        batchRestoring = false;
        batchSettings = {sku:'夏季/商品', product_format:'jpeg'};
        const a = batchOutputName({name:'same.png',id:1});
        const b = batchOutputName({name:'same.png',id:2});
        if (a === b || a.includes('/') || !a.endsWith('.jpg')) throw Error('unsafe or duplicate names');
        saveImageZip([{name:a,image:'data:image/png;base64,aGVsbG8='}, {name:b,image:'data:image/png;base64,d29ybGQ='}, {name:'delivery-manifest.json',bytes:new TextEncoder().encode(JSON.stringify({source:'夏季商品'}))}], 'test.zip');
        selectBatchItem = () => {};
        renderBatchQueue = () => {};
        batchQueue = [{id:1,status:'pending',name:'a.png'}, {id:2,status:'pending',name:'b.png'}];
        processBatchItem = async () => {batchPauseRequested = true; return 'data:image/png;base64,aA==';};
        await runBatch();
        if (batchQueue[0].status !== 'done' || batchQueue[1].status !== 'pending' || batchRunning) throw Error('pause lost work');
        processBatchItem = async () => {throw Error('inference failed');};
        await runBatch();
        if (batchQueue[1].status !== 'error' || batchQueue[0].status !== 'done') throw Error('failure lost successful item');
        processBatchItem = async () => 'data:image/png;base64,aA==';
        await runBatch();
        if (batchQueue.some(i => i.status !== 'done')) throw Error('retry failed');
        batchQueue[0].reviewed = true;
        document.getElementById('batchReviewedOnly').checked = true;
        if (batchDeliverableItems().length !== 1) throw Error('review filter failed');
        const manifest = batchDeliveryManifest(batchDeliverableItems());
        if (!manifest.items[0].exported || manifest.items[1].exported) throw Error('manifest export flags wrong');
        if (!manifest.items[0].reviewed || manifest.items[1].reviewed) throw Error('manifest review flags wrong');
        document.getElementById('batchReviewedOnly').checked = false;
        if (batchDeliverableItems().length !== 2) throw Error('default export should include all successes');
        batchQueue[0].thumb = 'blob:transient';
        const snapshot = batchSnapshot();
        if ('thumb' in snapshot.items[0] || !snapshot.items[0].reviewed) throw Error('snapshot must preserve review without transient URLs');
    })()`, ctx);
    assert(zip instanceof Blob);
    if (process.argv[2]) fs.writeFileSync(process.argv[2], Buffer.from(await zip.arrayBuffer()));
    console.log('PASS: inline syntax, safe unique names, pause/resume, error/retry, ZIP generation');
})().catch(error => { console.error(error); process.exitCode = 1; });
