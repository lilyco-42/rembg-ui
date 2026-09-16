// Existing schema-1 projects used only a boolean. Migrate that boolean only
// when neither revision field exists; partial revision data cannot grant review.
export function revisionState(item) {
 const legacy = item.imageRevision === undefined && item.reviewedRevision === undefined;
 const imageRevision = item.imageRevision === undefined ? (item.status === 'done' ? 1 : 0) : item.imageRevision;
 if (!Number.isSafeInteger(imageRevision) || imageRevision < 0 || (item.status === 'done' && imageRevision === 0)) throw new Error('项目数据无效：图片修订号无效');
 const reviewedRevision = item.reviewedRevision === undefined
  ? (legacy && item.status === 'done' && item.reviewed === true ? imageRevision : null)
  : item.reviewedRevision;
 if (reviewedRevision !== null && (!Number.isSafeInteger(reviewedRevision) || reviewedRevision < 1)) throw new Error('项目数据无效：确认修订号无效');
 return {imageRevision, reviewedRevision,
  reviewed: item.status === 'done' && item.reviewed === true && (legacy || item.imageRevision !== undefined) && imageRevision === reviewedRevision};
}

export function isReviewed(item) {
 try { return revisionState(item).reviewed; }
 catch { return false; }
}

export function replaceOutput(item, output) {
 if (!(output?.product instanceof Blob) || !(output?.transparent instanceof Blob)) throw new Error('新结果必须包含商品图和透明底稿');
 const {imageRevision} = revisionState(item);
 if (imageRevision === Number.MAX_SAFE_INTEGER) throw new Error('图片修订号超出范围');
 Object.assign(item, {output: {product: output.product, transparent: output.transparent}, status: 'done',
  imageRevision: imageRevision + 1, reviewedRevision: null, reviewed: false});
 delete item.error;
 return item;
}

export function setReviewed(item, reviewed) {
 if (typeof reviewed !== 'boolean') throw new Error('确认状态必须为布尔值');
 const {imageRevision} = revisionState(item);
 if (reviewed && item.status !== 'done') throw new Error('只能确认已完成的图片');
 Object.assign(item, {imageRevision, reviewedRevision: reviewed ? imageRevision : null, reviewed});
 return item;
}
