import { buildBrief } from './product-brief.js';

const form = document.getElementById('brief-form');
const result = document.getElementById('brief-result');
const text = document.getElementById('brief-text');
const status = document.getElementById('brief-status');
let currentBrief = '';

function report(element, message, error = false) {
  element.textContent = message;
  element.classList.toggle('error', error);
}

form.addEventListener('input', () => {
  const size = form.elements.size.value;
  document.getElementById('dimension-label').textContent = `${size} × ${size}`;
  if (currentBrief) {
    currentBrief = '';
    result.hidden = true;
    text.value = '';
    report(status, '内容已更改，请重新生成需求单。');
  }
});

form.addEventListener('submit', event => {
  event.preventDefault();
  try {
    currentBrief = buildBrief({
      project: form.elements.project.value,
      quantity: form.elements.quantity.value,
      size: form.elements.size.value,
      notes: form.elements.notes.value,
      rights: form.elements.rights.checked,
    });
    text.value = currentBrief;
    result.hidden = false;
    report(status, '需求单已生成，仅保留在本页；还未发送或下单。');
  } catch (error) {
    currentBrief = '';
    result.hidden = true;
    report(status, error.message, true);
  }
});

async function copy(value, element, fallback) {
  try {
    await navigator.clipboard.writeText(value);
    report(element, '已复制。请在聊天软件中粘贴；本页没有发送消息。');
  } catch {
    if (fallback) { fallback.focus(); fallback.select(); }
    report(element, fallback ? '自动复制不可用，已选中需求单；请用系统复制功能。' : `自动复制不可用，请手动复制：${value}`, true);
  }
}

document.getElementById('copy-brief').addEventListener('click', () => {
  if (currentBrief) copy(currentBrief, status, text);
});
document.getElementById('download-brief').addEventListener('click', () => {
  if (!currentBrief) return;
  const url = URL.createObjectURL(new Blob(['\uFEFF', currentBrief], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = '商品图需求单.txt';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  report(status, '已开始下载需求单；请另行发送给工作室，尚未创建订单。');
});
const contactStatus = document.getElementById('contact-status');
document.getElementById('copy-wechat').addEventListener('click', () => copy('Lilyco42', contactStatus));
document.getElementById('copy-qq').addEventListener('click', () => copy('1957374829', contactStatus));
