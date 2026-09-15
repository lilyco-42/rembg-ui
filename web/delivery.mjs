export function outputName(source, index, type) {
 const stem=source.replace(/\.[^.]+$/, '').replace(/[\x00-\x1f\\/:*?"<>|]/g,'_').slice(0,80)||'image';
 return `${type}_${stem}_${String(index+1).padStart(3,'0')}.png`;
}

export function deliveryManifest(items, size, reviewedOnly) {
 return {version:1,model:'u2netp',size,background:size?'white':'transparent',margin:size?10:0,
  reviewedOnly,items:items.map((item,index)=>({source:item.source,status:item.status,
   reviewed:item.reviewed,error:item.error||null,
   exported:item.status==='done'&&(!reviewedOnly||item.reviewed),
   product:outputName(item.source,index,'product'),cutout:outputName(item.source,index,'cutout')}))};
}
