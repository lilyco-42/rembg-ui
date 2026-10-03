/* lain42 订阅/支付 · 共享脚本 */
var API='/studio/api';
function tok(){return localStorage.getItem('wb-token')||''}
function setTok(t,u){localStorage.setItem('wb-token',t);localStorage.setItem('wb-user',u||'')}
function clearTok(){localStorage.removeItem('wb-token');localStorage.removeItem('wb-user')}
function userName(){return localStorage.getItem('wb-user')||''}
function $(s,r){return (r||document).querySelector(s)}
function $all(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function api(path,opt){
  opt=opt||{};opt.headers=Object.assign({'Content-Type':'application/json'},opt.headers||{});
  if(tok())opt.headers.Authorization='Bearer '+tok();
  return fetch(API+path,opt).then(function(r){return r.json().catch(function(){return {}}).then(function(j){return {code:r.status,j:j}})});
}
function cp(text,tip,el){
  var s=String(text);
  function done(){if(el){var o=el.dataset.label||el.textContent;el.dataset.label=o;el.textContent='已复制';setTimeout(function(){el.textContent=o},1400)}}
  function fallback(){
    var ta=document.createElement('textarea');
    ta.value=s;ta.setAttribute('readonly','');
    ta.style.cssText='position:fixed;top:8px;left:8px;width:calc(100% - 16px);max-width:680px;min-height:48px;padding:10px;font:13px/1.5 ui-monospace,monospace;z-index:99999;background:#fff;color:#000;border:1px solid var(--brand,#4d6bfe);border-radius:8px;box-shadow:0 8px 30px rgba(0,0,0,.18)';
    document.body.appendChild(ta);
    try{window.focus()}catch(e){}
    ta.focus();ta.select();ta.setSelectionRange(0,s.length);
    var ok=false;try{ok=document.execCommand('copy')}catch(e){ok=false}
    if(ok){ta.remove();done();return}
    // 仍失败：保留已全选的浮层，用户直接 Ctrl+C / 点关闭
    var bar=document.createElement('div');
    bar.textContent='已选中，按 Ctrl+C 复制（点此关闭）';
    bar.style.cssText='position:fixed;top:8px;left:8px;z-index:100000;background:#0d0d0d;color:#fff;font:13px sans-serif;padding:8px 14px;border-radius:8px;cursor:pointer';
    ta.style.top='46px';document.body.appendChild(bar);
    function close(){ta.remove();bar.remove()}
    bar.onclick=close;
    ta.addEventListener('keydown',function(e){if(e.key==='Escape')close()});
    setTimeout(function(){try{ta.focus();ta.select()}catch(e){}},120);
    if(el)el.textContent='点上方文本复制';
  }
  if(navigator.clipboard&&window.isSecureContext){
    navigator.clipboard.writeText(s).then(done).catch(fallback);
  }else{fallback()}
}
function fmtDate(s){
  if(!s)return '—';
  var d=new Date(s);if(isNaN(d))return s;
  var p=function(n){return (n<10?'0':'')+n};
  return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes());
}
/* theme */
(function(){
  var KEY='lain-theme';
  function apply(t){document.documentElement.setAttribute('data-theme',t)}
  var saved=localStorage.getItem(KEY);
  if(saved)apply(saved);
  window.toggleTheme=function(){
    var cur=document.documentElement.getAttribute('data-theme')||
      (matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
    var nx=cur==='dark'?'light':'dark';localStorage.setItem(KEY,nx);apply(nx);return nx;
  };
  window.initThemeBtn=function(id){
    var b=document.getElementById(id);if(!b)return;
    b.addEventListener('click',function(){
      var nx=window.toggleTheme();
      b.innerHTML=nx==='dark'?ICON_SUN:ICON_MOON;
    });
    var cur=document.documentElement.getAttribute('data-theme')||
      (matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
    b.innerHTML=cur==='dark'?ICON_SUN:ICON_MOON;
  };
})();
var ICON_MOON='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>';
var ICON_SUN='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5 5l1.7 1.7M17.3 17.3 19 19M19 5l-1.7 1.7M6.7 17.3 5 19"/></svg>';
/* 通用登录卡 */
function mountLogin(opts){
  var box=document.getElementById(opts.id);if(!box)return;
  box.innerHTML='<div class="tabs"><button class="on" data-m="login">登录</button><button data-m="reg">注册</button></div>'+
    '<div class="field"><label>用户名（3-24 位字母 / 数字 / 下划线）</label><input class="inp" id="lg-user" autocomplete="username"></div>'+
    '<div class="field"><label>密码（至少 8 位）</label><input class="inp" id="lg-pass" type="password" autocomplete="current-password"></div>'+
    '<div class="field reg-only" style="display:none"><label>邮箱（选填，作为找回凭据）</label><input class="inp" id="lg-email" type="email"></div>'+
    '<button class="btn btn-solid btn-block" id="lg-go">登录</button><div class="msg" id="lg-msg"></div>';
  var mode='login';
  $all('.tabs button',box).forEach(function(b){b.onclick=function(){
    mode=b.dataset.m;$all('.tabs button',box).forEach(function(x){x.classList.toggle('on',x===b)});
    $('.reg-only',box).style.display=mode==='reg'?'':'none';
    $('#lg-go',box).textContent=mode==='reg'?'注册并领取':'登录';
  }});
  $('#lg-go',box).onclick=function(){
    var u=$('#lg-user',box).value.trim(),p=$('#lg-pass',box).value,e=$('#lg-email',box).value.trim();
    var m=$('#lg-msg',box);
    if(!u||!p){m.className='msg err';m.textContent='请输入用户名和密码';return}
    if(mode==='reg'&&p.length<8){m.className='msg err';m.textContent='密码至少 8 位';return}
    m.className='msg';m.textContent='提交中…';
    var body={username:u,password:p};if(mode==='reg')body.email=e;
    api('/'+(mode==='reg'?'register':'login'),{method:'POST',body:JSON.stringify(body)})
    .then(function(o){
      if(o.code!==200){m.className='msg err';m.textContent=(o.j&&o.j.detail)||'失败，请检查输入';return}
      setTok(o.j.token,o.j.username);m.className='msg ok';
      m.textContent=mode==='reg'?'注册成功，四重礼已到账':'登录成功';
      setTimeout(function(){opts.onDone&&opts.onDone()},500);
    }).catch(function(){m.className='msg err';m.textContent='网络错误，稍后再试'});
  };
  $('#lg-pass',box).addEventListener('keydown',function(e){if(e.key==='Enter')$('#lg-go',box).click()});
}
function navWho(id,logoutId,onChange){
  var w=document.getElementById(id);
  function render(){if(w)w.textContent=tok()?('账号：'+userName()):''}
  render();
  var lo=document.getElementById(logoutId);
  if(lo)lo.onclick=function(){clearTok();render();onChange&&onChange()};
  return render;
}
