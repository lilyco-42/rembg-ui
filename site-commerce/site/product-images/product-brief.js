export function normalizeBrief(input) {
  const quantity = String(input.quantity ?? '');
  if (!/^\d{1,3}$/.test(quantity) || Number(quantity) < 1 || Number(quantity) > 100) {
    throw new Error('请填写 1 至 100 之间的整数张数。');
  }
  if (!['1200', '1600'].includes(String(input.size))) throw new Error('请选择页面提供的输出尺寸。');
  if (input.rights !== true) throw new Error('请先确认素材使用权。');
  const project = String(input.project ?? '').trim();
  const notes = String(input.notes ?? '').trim();
  if (project.length > 80 || notes.length > 500) throw new Error('名称或备注太长，请精简后重试。');
  return { quantity: Number(quantity), size: Number(input.size), project: project || '商品图整理咨询', notes, rights: true };
}

export function buildBrief(input) {
  const value = normalizeBrief(input);
  return [
    '【商品图整理需求单 · 尚未发送 / 非订单】',
    `名称：${value.project}`,
    `原图数量：${value.quantity} 张`,
    `输出尺寸：${value.size} × ${value.size} 像素`,
    '交付意向：白底 PNG、透明底 PNG、文件对应清单与 ZIP',
    '素材：我拥有或已获授权使用；将另附一张原图供评估。',
    `备注：${value.notes || '无；请先评估样图。'}`,
    '',
    '参考预算：99 元 / 10 张简单商品图；其他数量或复杂情况另议。',
    '请先确认样图、报价、交期与一次约定规格返修的边界。',
    '本需求单不代表已下单、已支付或服务已承诺。',
  ].join('\n');
}
