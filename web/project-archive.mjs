import {createZip} from './zip.mjs?v=editor-2';
import {validateProject} from './project-store.mjs?v=editor-2';

export const PROJECT_ARCHIVE_VERSION = 1;
export const MAX_PROJECT_ARCHIVE_BYTES = 64 * 1024 * 1024 + 512 * 1024;

function fail(message) { throw new Error(`项目备份无效：${message}`); }
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function utf8() { return new TextDecoder('utf-8', {fatal: true}); }

function crc32(bytes) {
 const table = crc32.table ??= (() => {
  const result = new Uint32Array(256);
  for(let n=0;n<256;n++){let value=n;for(let bit=0;bit<8;bit++)value=(value&1)?(0xedb88320^(value>>>1)):(value>>>1);result[n]=value>>>0;}
  return result;
 })();
 let value=0xffffffff;
 for(const byte of bytes)value=table[(value^byte)&255]^(value>>>8);
 return (value^0xffffffff)>>>0;
}

function safeName(name) {
 if(typeof name!=='string'||!name||name.startsWith('/')||name.includes('\\')||name.split('/').some(part=>part===''||part==='.'||part==='..'))fail('内部文件名不安全');
 return name;
}

function findEnd(bytes,view) {
 const start=Math.max(0,bytes.length-0xffff-22);
 for(let offset=bytes.length-22;offset>=start;offset--)if(view.getUint32(offset,true)===0x06054b50)return offset;
 fail('缺少 ZIP 结束记录');
}

function readEntries(buffer) {
 if(buffer.byteLength>MAX_PROJECT_ARCHIVE_BYTES)fail('项目备份超过 64 MiB');
 const bytes=new Uint8Array(buffer),view=new DataView(buffer),end=findEnd(bytes,view);
 if(view.getUint16(end+20,true)!==0)fail('不支持带注释的 ZIP');
 const count=view.getUint16(end+8,true),centralSize=view.getUint32(end+12,true),centralOffset=view.getUint32(end+16,true);
 if(count===0xffff||centralSize===0xffffffff||centralOffset===0xffffffff)fail('不支持 ZIP64');
 if(centralOffset+centralSize>end)fail('中央目录越界');
 const entries=new Map();let cursor=centralOffset;
 for(let index=0;index<count;index++){
  if(cursor+46>bytes.length||view.getUint32(cursor,true)!==0x02014b50)fail('中央目录损坏');
  const flags=view.getUint16(cursor+8,true),method=view.getUint16(cursor+10,true),compressed=view.getUint32(cursor+20,true),uncompressed=view.getUint32(cursor+24,true);
  const nameLength=view.getUint16(cursor+28,true),extraLength=view.getUint16(cursor+30,true),commentLength=view.getUint16(cursor+32,true),localOffset=view.getUint32(cursor+42,true);
  if((flags&1)!==0||method!==0||compressed!==uncompressed)fail('只支持未压缩且未加密的 ZIP');
  const nameEnd=cursor+46+nameLength+extraLength+commentLength;
  if(nameEnd>bytes.length)fail('中央目录条目越界');
  let name;try{name=(flags&0x800)?utf8().decode(bytes.subarray(cursor+46,cursor+46+nameLength)):new TextDecoder().decode(bytes.subarray(cursor+46,cursor+46+nameLength));}catch(error){fail('文件名不是有效 UTF-8');}
  safeName(name);if(entries.has(name))fail('ZIP 内部文件名重复');
  if(localOffset+30>bytes.length||view.getUint32(localOffset,true)!==0x04034b50)fail('本地文件头损坏');
  const localNameLength=view.getUint16(localOffset+26,true),localExtraLength=view.getUint16(localOffset+28,true),dataStart=localOffset+30+localNameLength+localExtraLength,dataEnd=dataStart+uncompressed;
  if(dataEnd>bytes.length)fail('文件数据越界');
  const data=bytes.subarray(dataStart,dataEnd),expectedCrc=view.getUint32(cursor+16,true);
  if(crc32(data)!==expectedCrc)fail(`文件校验失败：${name}`);
  entries.set(name,data);
  cursor=nameEnd;
 }
 if(cursor!==centralOffset+centralSize)fail('中央目录长度不匹配');
 return entries;
}

// zip.mjs intentionally sanitizes slash characters in user-facing names. Use
// a flat private namespace so the manifest references the exact stored names.
function internalPath(index,type) { return `items_${String(index).padStart(2,'0')}_${type}`; }

export async function exportProjectArchive(snapshot) {
 const project=validateProject(snapshot);
 const entries=[],items=[];
 for(const [index,item] of project.items.entries()){
  const source=internalPath(index,'source'),entry={id:item.id,source:item.source,status:item.status,reviewed:item.reviewed,imageRevision:item.imageRevision,reviewedRevision:item.reviewedRevision,error:item.error??null,sourceType:item.file.type||'application/octet-stream',sourceLastModified:item.file.lastModified||0,files:{source}};
  entries.push({name:source,bytes:new Uint8Array(await item.file.arrayBuffer())});
  if(item.status==='done'){
   const product=internalPath(index,'product'),transparent=internalPath(index,'transparent');
   entries.push({name:product,bytes:new Uint8Array(await item.output.product.arrayBuffer())},{name:transparent,bytes:new Uint8Array(await item.output.transparent.arrayBuffer())});
   entry.files.product=product;entry.files.transparent=transparent;entry.productType=item.output.product.type||'image/png';entry.transparentType=item.output.transparent.type||'image/png';
  }
  items.push(entry);
 }
 const manifest={archiveVersion:PROJECT_ARCHIVE_VERSION,createdAt:new Date().toISOString(),project:{schemaVersion:project.schemaVersion,size:project.size,reviewedOnly:project.reviewedOnly,items}};
 entries.push({name:'project-manifest.json',bytes:new TextEncoder().encode(JSON.stringify(manifest,null,2))});
 return createZip(entries);
}

export async function importProjectArchive(file) {
 if(!(file instanceof Blob)||file.size===0)fail('文件为空');
 if(file.size>MAX_PROJECT_ARCHIVE_BYTES)fail('项目备份超过 64 MiB');
 const entries=readEntries(await file.arrayBuffer()),manifestBytes=entries.get('project-manifest.json');
 if(!manifestBytes)fail('缺少项目清单');
 let manifest;try{manifest=JSON.parse(utf8().decode(manifestBytes));}catch(error){fail('项目清单不是有效 JSON');}
 if(!object(manifest)||manifest.archiveVersion!==PROJECT_ARCHIVE_VERSION||!object(manifest.project))fail('项目清单版本不支持');
 const raw=manifest.project;
 if(!Array.isArray(raw.items)||raw.items.length>10)fail('每批最多 10 张图片');
 const items=raw.items.map(item=>{
  if(!object(item)||typeof item.id!=='string'||typeof item.source!=='string'||!object(item.files))fail('图片清单字段缺失');
  const sourceName=safeName(item.files.source),sourceBytes=entries.get(sourceName);if(!sourceBytes)fail('缺少原图文件');
  const source=new File([sourceBytes],item.source,{type:typeof item.sourceType==='string'?item.sourceType:'application/octet-stream',lastModified:Number.isSafeInteger(item.sourceLastModified)?item.sourceLastModified:0});
  const result={id:item.id,source:item.source,file:source,status:item.status,reviewed:item.reviewed,imageRevision:item.imageRevision,reviewedRevision:item.reviewedRevision};
  if(item.error!==null&&item.error!==undefined)result.error=item.error;
  if(item.status==='done'){
   const productName=safeName(item.files.product),transparentName=safeName(item.files.transparent),productBytes=entries.get(productName),transparentBytes=entries.get(transparentName);
   if(!productBytes||!transparentBytes)fail('已完成图片缺少输出文件');
   result.output={product:new Blob([productBytes],{type:typeof item.productType==='string'?item.productType:'image/png'}),transparent:new Blob([transparentBytes],{type:typeof item.transparentType==='string'?item.transparentType:'image/png'})};
  }
  return result;
 });
 try{return validateProject({schemaVersion:raw.schemaVersion,size:raw.size,reviewedOnly:raw.reviewedOnly,items},{restore:true});}
 catch(error){fail(error.message.replace(/^项目数据无效：/,'')||'项目内容不符合规范');}
}
