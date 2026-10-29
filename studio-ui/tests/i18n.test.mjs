import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const base=new URL("../locales/",import.meta.url);
const zh=JSON.parse(readFileSync(new URL("zh-CN.json",base),"utf8"));
const en=JSON.parse(readFileSync(new URL("en.json",base),"utf8"));
test("English and Chinese keys match",()=>assert.deepEqual(Object.keys(zh).sort(),Object.keys(en).sort()));
test("all translated values are nonempty",()=>assert.ok(Object.values({...zh,...en}).every(v=>typeof v==="string"&&v.length)));
test("all variables match",()=>{
 const tokens=s=>[...s.matchAll(/\{(\w+)\}/g)].map(x=>x[1]).sort();
 for(const k of Object.keys(zh))assert.deepEqual(tokens(zh[k]),tokens(en[k]),k);
});
test("no mojibake",()=>assert.doesNotMatch(JSON.stringify(zh),/鍩轰簬|鏅鸿兘|鎶犲浘/));
