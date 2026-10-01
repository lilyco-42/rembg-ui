(function(){
  'use strict';
  var root=document.documentElement;
  var stored=localStorage.getItem('yz-theme');
  if(stored==='dark'||stored==='light') root.setAttribute('data-theme',stored);
  function icon(path){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+path+'"/></svg>'}
  window.setStudioTheme=function(next){
    root.setAttribute('data-theme',next);localStorage.setItem('yz-theme',next);
    document.querySelectorAll('[data-theme-label]').forEach(function(el){el.textContent=next==='dark'?'切换浅色':'切换深色'});
    var meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=next==='dark'?'#202123':'#ffffff';
  };
  window.initThemeBtn=function(id){
    var btn=document.getElementById(id);if(!btn)return;
    btn.innerHTML=icon('M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z');
    btn.setAttribute('aria-label','切换深浅色');btn.onclick=function(){setStudioTheme(root.getAttribute('data-theme')==='dark'?'light':'dark')};
  };
  function buildShell(body){
    if(body.dataset.shellReady==='true')return;body.dataset.shellReady='true';body.classList.add('studio-shell');
    var side=document.createElement('aside');side.className='site-sidebar';side.id='site-sidebar';
    side.innerHTML='<a class="site-brand" href="/"><span class="site-mark">42</span><span>云枢智创 · lain42</span></a>'+
      '<nav class="site-nav" aria-label="主导航">'+
      '<a href="/">'+icon('M3 11 12 3l9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z')+'首页</a>'+
      '<a href="/product-images/">'+icon('M4 4h16v16H4Z M8 8h8M8 12h8')+'商品图工作流</a>'+
      '<a href="/sub/buy.html">'+icon('M6 2h9l3 3v17H6Z M9 10h6M9 14h6')+'产品与价格</a>'+
      '<a href="/compute/">'+icon('M4 5h16v11H4Z M8 20h8M12 16v4')+'算力市场</a>'+
      '<a href="https://api.lain42.top/">'+icon('M12 3v3M12 18v3M3 12h3M18 12h3M6.3 6.3l2.1 2.1M15.6 15.6l2.1 2.1M17.7 6.3l-2.1 2.1M8.4 15.6l-2.1 2.1')+'AI 网关</a>'+
      '<a href="/lytrade/panel">'+icon('M7 3v7M7 14v7M17 3v5M17 12v9M4 10h6v4H4ZM14 8h6v4h-6Z')+'交易面板</a>'+
      '<a href="/pet/">'+icon('M8 11c-2-3-6-1-5 2 1 3 4 6 9 7 5-1 8-4 9-7 1-3-3-5-5-2M9 8h.01M15 8h.01')+'丛雨萌宠</a>'+
      '<a href="/tool/">'+icon('M14.7 6.3a4 4 0 0 0-5 5L3 18l3 3 6.7-6.7a4 4 0 0 0 5-5l-3 3-3-3Z')+'WASM 工具</a>'+
      '<a href="/downloads/index.html">'+icon('M12 3v12M7 10l5 5 5-5M5 20h14')+'软件下载</a>'+
      '<a href="/cases.html">'+icon('M5 4h14v16H5Z M8 8h8M8 12h8M8 16h5')+'案例</a></nav>'+
      '<div class="site-side-bottom"><a class="button brand" href="/sub/buy.html">购买 / 充值积分</a><div class="site-side-note">本地工具、独立游戏与真实算力服务。<br>微信 Lilyco42 · QQ 1957374829</div></div>';
    var top=document.createElement('header');top.className='site-topbar';
    var title=body.dataset.pageTitle||document.title.split('·')[0].trim();
    top.innerHTML='<button class="site-icon-button site-menu-button" type="button" aria-controls="site-sidebar" aria-expanded="false" aria-label="打开导航">'+icon('M4 7h16M4 12h16M4 17h16')+'</button><div class="site-topbar-title">'+title+'</div><div class="site-topbar-actions"><span class="status-pill">独立工作室</span><button class="site-icon-button" data-studio-theme type="button" aria-label="切换深浅色">'+icon('M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z')+'</button><a class="button secondary" href="/sub/buy.html">查看价格</a></div>';
    body.insertBefore(side,body.firstChild);body.insertBefore(top,side.nextSibling);
    var menu=top.querySelector('.site-menu-button');menu.onclick=function(){var on=!body.classList.contains('studio-nav-open');body.classList.toggle('studio-nav-open',on);menu.setAttribute('aria-expanded',String(on))};
    body.addEventListener('click',function(e){if(body.classList.contains('studio-nav-open')&&!side.contains(e.target)&&!menu.contains(e.target)){body.classList.remove('studio-nav-open');menu.setAttribute('aria-expanded','false')}});
    top.querySelector('[data-studio-theme]').onclick=function(){setStudioTheme(root.getAttribute('data-theme')==='dark'?'light':'dark')};
    var here=location.pathname;side.querySelectorAll('.site-nav a').forEach(function(a){var p=new URL(a.href,location.href).pathname;if((p==='/'&&here==='/')||(p!=='/'&&here.indexOf(p)===0))a.setAttribute('aria-current','page')});
  }
  document.addEventListener('DOMContentLoaded',function(){document.querySelectorAll('body[data-studio-shell]').forEach(buildShell)});
})();
