(function(){
  'use strict';
  var root=document.documentElement;
  var stored='';
  try{stored=localStorage.getItem('yz-theme')||''}catch(_){/* The public page also works when storage is disabled. */}
  if(stored==='dark'||stored==='light') root.setAttribute('data-theme',stored);
  function icon(path){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+path+'"/></svg>'}
  window.setStudioTheme=function(next){
    root.setAttribute('data-theme',next);
    try{localStorage.setItem('yz-theme',next)}catch(_){/* Keep the current page theme without storing it. */}
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
    var style=document.createElement('style');style.textContent='.site-nav{min-height:0;overflow-y:auto;flex:1;align-content:start;scrollbar-gutter:stable}.site-side-bottom{flex-shrink:0}.site-nav-group{display:grid;gap:4px;margin:0 0 12px}.site-nav-label{padding:6px 12px;color:var(--fg-mute);font-size:11px;letter-spacing:.04em}.site-nav a{min-height:44px}';document.head.appendChild(style);
    var side=document.createElement('aside');side.className='site-sidebar';side.id='site-sidebar';
    side.innerHTML='<a class="site-brand" href="/"><span class="site-mark">42</span><span>云枢智创 · lain42</span></a>'+
      '<nav class="site-nav" aria-label="主导航">'+
      '<div class="site-nav-group"><span class="site-nav-label">开始使用</span><a href="/">'+icon('M3 11 12 3l9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z')+'首页</a>'+
      '<a href="/product-images/index.html">'+icon('M4 4h16v16H4Z M8 8h8M8 12h8')+'商品图工作流</a>'+
      '<a href="/shop/">'+icon('M6 2h9l3 3v17H6Z M9 10h6M9 14h6')+'产品与价格</a>'+
      '<a href="/gpt-guide/">'+icon('M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6')+'ChatGPT 比价</a>'+
      '<a href="/gemini-student/">'+icon('M12 2l2.3 6.7L21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3Z')+'Gemini 学生认证指南</a>'+

      '</div><div class="site-nav-group"><span class="site-nav-label">服务与状态</span><a href="/compute/">'+icon('M4 5h16v11H4Z M8 20h8M12 16v4')+'算力市场</a>'+
      '<a href="/status/#aiGateway" data-service-status="maintenance">'+icon('M12 3v3M12 18v3M3 12h3M18 12h3M6.3 6.3l2.1 2.1M15.6 15.6l2.1 2.1M17.7 6.3l-2.1 2.1M8.4 15.6l-2.1 2.1')+'AI 网关 · 维护中</a>'+
      '<a href="/lytrade/panel">'+icon('M7 3v7M7 14v7M17 3v5M17 12v9M4 10h6v4H4ZM14 8h6v4h-6Z')+'交易面板</a>'+
      '</div><div class="site-nav-group"><span class="site-nav-label">创作工具</span><a href="/pet/">'+icon('M8 11c-2-3-6-1-5 2 1 3 4 6 9 7 5-1 8-4 9-7 1-3-3-5-5-2M9 8h.01M15 8h.01')+'丛雨萌宠</a>'+
      '<a href="/tool/">'+icon('M14.7 6.3a4 4 0 0 0-5 5L3 18l3 3 6.7-6.7a4 4 0 0 0 5-5l-3 3-3-3Z')+'WASM 工具</a>'+
      '<a href="/downloads/index.html">'+icon('M12 3v12M7 10l5 5 5-5M5 20h14')+'软件下载</a>'+
      '</div><div class="site-nav-group"><span class="site-nav-label">账户与帮助</span><a href="/account/">'+icon('M4 20h16M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z')+'我的账户</a>'+
      '<a href="/help.html">'+icon('M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4M12 17h.01 M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z')+'常见问题</a>'+
      '<a href="/cases.html">'+icon('M5 4h14v16H5Z M8 8h8M8 12h8M8 16h5')+'案例</a></div></nav>'+
      '<div class="site-side-bottom"><a class="button brand" href="/shop/">商城 / 充值积分</a><div class="site-side-note">本地工具、独立游戏与真实算力服务。<br>微信 Lilyco42 · QQ 1957374829</div></div>';
    var top=document.createElement('header');top.className='site-topbar';
    var title=body.dataset.pageTitle||document.title.split('·')[0].trim();
    top.innerHTML='<button class="site-icon-button site-menu-button" type="button" aria-controls="site-sidebar" aria-expanded="false" aria-label="打开导航">'+icon('M4 7h16M4 12h16M4 17h16')+'</button><div class="site-topbar-title">'+title+'</div><div class="site-topbar-actions"><span class="status-pill">独立工作室</span><button class="site-icon-button" data-studio-theme type="button" aria-label="切换深浅色">'+icon('M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z')+'</button><a class="button secondary" href="/shop/">查看价格</a></div>';
    body.insertBefore(side,body.firstChild);body.insertBefore(top,side.nextSibling);
    var menu=top.querySelector('.site-menu-button');
    function closeMenu(returnFocus){body.classList.remove('studio-nav-open');menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','打开导航');if(returnFocus)menu.focus()}
    menu.onclick=function(){var on=!body.classList.contains('studio-nav-open');body.classList.toggle('studio-nav-open',on);menu.setAttribute('aria-expanded',String(on));menu.setAttribute('aria-label',on?'关闭导航':'打开导航');if(on)side.querySelector('a').focus()};
    body.addEventListener('click',function(e){if(body.classList.contains('studio-nav-open')&&!side.contains(e.target)&&!menu.contains(e.target))closeMenu(false)});
    document.addEventListener('keydown',function(e){if(e.key==='Escape'&&body.classList.contains('studio-nav-open'))closeMenu(true)});
    side.querySelectorAll('.site-nav a').forEach(function(a){a.addEventListener('click',function(){if(window.matchMedia('(max-width: 860px)').matches)closeMenu(false)})});
    top.querySelector('[data-studio-theme]').onclick=function(){setStudioTheme(root.getAttribute('data-theme')==='dark'?'light':'dark')};
    var here=location.pathname,best=null,bestLength=-1;side.querySelectorAll('.site-nav a').forEach(function(a){var url=new URL(a.href,location.href),p=url.pathname;if(url.origin!==location.origin)return;var match=p==='/'?here==='/':here===p||here.indexOf(p)===0;if(match&&p.length>bestLength){best=a;bestLength=p.length}});if(best)best.setAttribute('aria-current','page');
  }
  function markMaintenanceLinks(){
    document.querySelectorAll('a[href]').forEach(function(a){
      var url;try{url=new URL(a.getAttribute('href'),location.href)}catch(_){return}
      var service=['api.lain42.top','ai.lain42.top'].includes(url.hostname)?'aiGateway':null;
      if(url.hostname===location.hostname){
        if(/^\/compute(?:\/|$)/.test(url.pathname))service='compute';
        if(/^\/g(?:\/|$)/.test(url.pathname))service='githubAccel';
        if(/^\/lytrade(?:\/|$)/.test(url.pathname))service='trading';
      }
      if(!service)return;
      a.href='/status/#'+service;a.dataset.serviceStatus='maintenance';
      a.title='服务维护中，查看说明';
      var heading=a.querySelector('h3');
      if(heading){heading.textContent=heading.textContent+' · 维护中';var p=a.querySelector('p');if(p)p.textContent='当前服务不可正常使用，点击查看维护说明。'}
      else{var label=document.createElement('span');label.className='status-pill';label.textContent='维护中';a.appendChild(label)}
    });
  }
  document.addEventListener('DOMContentLoaded',function(){document.querySelectorAll('body[data-studio-shell]').forEach(buildShell);markMaintenanceLinks()});
})();
