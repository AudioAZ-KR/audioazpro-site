/* az-i18n.js — AudioAZ 사이트 언어 전환 (KR/EN)
 * 페이지를 복제하지 않고, /i18n/en.json 사전으로 한글 텍스트 노드·속성을 영문으로 치환한다.
 * 언어 선택: localStorage az_lang → 없으면 브라우저 언어(ko면 kr, 아니면 en).
 * EN이면 결제 모드도 해외(달러·Paddle)로, KR이면 국내(원화)로 맞춘다 (checkout.html의 az_pay_mode).
 */
(function(){
  var KO=/[가-힣]/;
  function lang(){ try{ var l=localStorage.getItem('az_lang'); if(l==='kr'||l==='en') return l; }catch(_){}
    return ((navigator.language||'').toLowerCase().indexOf('ko')===0) ? 'kr' : 'en'; }
  function setLang(l){ try{ localStorage.setItem('az_lang',l); localStorage.setItem('az_pay_mode', l==='en'?'intl':'kr'); }catch(_){} location.reload(); }
  window.azLang=lang; window.azSetLang=setLang;
  try{ if(!localStorage.getItem('az_pay_mode')) localStorage.setItem('az_pay_mode', lang()==='en'?'intl':'kr'); }catch(_){}

  var DICT=null;
  var KEYS=null;
  function tr(s){ if(!DICT) return null; var t=s.replace(/\s+/g,' ').trim(); if(!t||!KO.test(t)) return null;
    var lead=s.match(/^\s*/)[0], tail=s.match(/\s*$/)[0];
    var v=DICT[t]; if(v!=null) return lead+v+tail;
    // 부분 일치: 긴 키부터 치환 (동적으로 조립된 문구용)
    if(!KEYS) KEYS=Object.keys(DICT).filter(function(k){return k.length>=2 && KO.test(k);}).sort(function(a,b){return b.length-a.length;});
    var out=t, hit=false;
    for(var i=0;i<KEYS.length;i++){ var k=KEYS[i]; if(out.indexOf(k)>=0){ out=out.split(k).join(DICT[k]); hit=true; if(!KO.test(out)) break; } }
    // 조사·단위 조각: '3개' → '3', '이름님' → '이름'
    var out2=out.replace(/(\d+)\s*개/g,'$1').replace(/님\s*$/,'');
    if(out2!==out){ out=out2; hit=true; }
    return hit ? lead+out+tail : null; }
  var ATTRS=['placeholder','title','alt','aria-label'];
  function walk(root){
    if(!DICT||!root) return;
    var w=document.createTreeWalker(root, NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT, { acceptNode:function(n){
      if(n.nodeType===1){ var tg=n.tagName; if(tg==='SCRIPT'||tg==='STYLE'||tg==='NOSCRIPT') return NodeFilter.FILTER_REJECT; return NodeFilter.FILTER_ACCEPT; }
      return NodeFilter.FILTER_ACCEPT; } });
    var n; var texts=[];
    while((n=w.nextNode())){
      if(n.nodeType===3){ if(KO.test(n.nodeValue)) texts.push(n); }
      else { for(var i=0;i<ATTRS.length;i++){ var a=ATTRS[i]; if(n.hasAttribute&&n.hasAttribute(a)){ var v=tr(n.getAttribute(a)); if(v!=null) n.setAttribute(a,v); } } }
    }
    texts.forEach(function(t){ var v=tr(t.nodeValue); if(v!=null) t.nodeValue=v; });
    var m=document.querySelector('meta[name="description"]'); if(m){ var mv=tr(m.getAttribute('content')||''); if(mv!=null) m.setAttribute('content',mv); }
    if(document.title){ var tv=tr(document.title); if(tv!=null) document.title=tv; }
  }
  // JS가 나중에 넣는 문자열(alert 등)도 사전으로 치환
  function patchAlerts(){ var oa=window.alert, oc=window.confirm;
    window.alert=function(s){ return oa.call(window, DICT? String(s).split('\n').map(function(line){ var v=tr(line); return v!=null?v:line; }).join('\n') : s); };
    window.confirm=function(s){ return oc.call(window, DICT? String(s).split('\n').map(function(line){ var v=tr(line); return v!=null?v:line; }).join('\n') : s); }; }

  // 상단 메뉴 스위치 (KR · EN) — nav 우측, 이모지 없음
  function mountSwitch(){
    if(document.getElementById('az-lang-switch')) return;
    var host=null; ['nav .menu','nav .nav-in','nav .wrap','header nav','nav'].some(function(q){ host=document.querySelector(q); return !!host; }); if(!host) return;
    var box=document.createElement('div'); box.id='az-lang-switch'; box.setAttribute('aria-label','Language');
    box.style.cssText='display:inline-flex;align-items:center;gap:6px;margin-left:14px;font:600 11.5px ui-monospace,Menlo,monospace;letter-spacing:.08em;color:var(--dim,#96A6BF);white-space:nowrap;vertical-align:middle';
    var cur=lang();
    function b(code,label){ var a=document.createElement('a'); a.href='#'; a.textContent=label; a.setAttribute('role','button');
      a.style.cssText='color:'+(cur===code?'var(--text,#E9EEF7)':'inherit')+';text-decoration:none;padding:3px 6px;border:1px solid '+(cur===code?'var(--blue,#1877F2)':'transparent')+';border-radius:2px';
      a.onclick=function(e){ e.preventDefault(); if(cur!==code) setLang(code); }; return a; }
    box.appendChild(b('kr','KR')); var sep=document.createElement('span'); sep.textContent='·'; sep.style.opacity='.5'; box.appendChild(sep); box.appendChild(b('en','EN'));
    // 메뉴 맨 앞(제품 왼쪽)에 배치
    if(host.classList&&host.classList.contains('menu')&&host.firstElementChild){ box.style.marginLeft='0'; box.style.marginRight='14px'; host.insertBefore(box, host.firstElementChild); }
    else host.appendChild(box);
  }
  // 법적 문서 EN 안내
  function legalNote(){
    if(!/(terms|privacy|refund)\.html$/.test(location.pathname)) return;
    var main=document.querySelector('main, .wrap, body'); if(!main||document.getElementById('az-legal-note')) return;
    var d=document.createElement('div'); d.id='az-legal-note';
    d.style.cssText='max-width:920px;margin:16px auto 0;padding:10px 14px;border:1px solid var(--line,#243350);font-size:12.5px;color:var(--dim,#96A6BF);line-height:1.6';
    d.textContent='This English version is provided for reference. In case of any discrepancy, the Korean original prevails.';
    main.insertBefore(d, main.firstChild);
  }
  function apply(){
    if(lang()!=='en'){ mountSwitch(); return; }
    document.documentElement.setAttribute('lang','en');
    fetch('/i18n/en.json',{cache:'no-cache'}).then(function(r){return r.json();}).then(function(d){
      DICT=d; patchAlerts(); walk(document.body); mountSwitch(); legalNote();
      new MutationObserver(function(ms){ ms.forEach(function(m){ m.addedNodes.forEach(function(n){ if(n.nodeType===1) walk(n); else if(n.nodeType===3&&KO.test(n.nodeValue)){ var v=tr(n.nodeValue); if(v!=null) n.nodeValue=v; } }); }); }).observe(document.body,{childList:true,subtree:true});
    }).catch(function(){ mountSwitch(); });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply); else apply();
})();
