// AudioAZ 공통 계정 메뉴 — 모든 공개 페이지 상단 "로그인" 버튼을 로그인 상태에 맞게 바꿈
// 로그인 전: 로그인 버튼 그대로 / 로그인 후: [아바타 이름 ▾] → 내 라이선스 · 로그아웃 메뉴
(function(){
  if(!window.supabase) return;
  var sbNav = window.supabase.createClient('https://lkbbenyvchddsjsihofv.supabase.co','sb_publishable_sMTkTGD-1CktZQqirrjk6Q_0mxgpRG_');
  window.sbNav = sbNav;

  var CSS = '.acct{position:relative;display:inline-block}'
    + '.acctbtn{display:flex;align-items:center;gap:8px;border:1px solid var(--line,#243350);background:transparent;border-radius:999px;padding:5px 12px 5px 5px;font-family:inherit;font-size:13.5px;font-weight:700;color:var(--text,#E9EEF7);cursor:pointer;transition:.15s;white-space:nowrap}'
    + '.acctbtn:hover{border-color:#4D96F5;background:rgba(24,119,242,.12)}'
    + '.acctbtn .av{width:26px;height:26px;border-radius:50%;background:#1877F2;color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex:none}'
    + '.acctbtn .car{font-size:10px;opacity:.7;margin-left:2px}'
    + '.acctmenu{display:none;position:absolute;right:0;top:calc(100% + 8px);min-width:210px;background:#121D33;border:1px solid #243350;border-radius:14px;box-shadow:0 16px 44px rgba(0,0,0,.5);padding:8px;z-index:400;text-align:left}'
    + '.acct.open .acctmenu{display:block}'
    + '.acctmenu .am-h{padding:8px 10px 10px;border-bottom:1px solid #243350;margin-bottom:6px}'
    + '.acctmenu .am-h b{display:block;color:#E9EEF7;font-size:14px}'
    + '.acctmenu .am-h span{display:block;color:#96A6BF;font-size:12px;margin-top:2px;word-break:break-all}'
    + '.acctmenu a,.acctmenu button{display:flex;align-items:center;gap:9px;width:100%;border:0;background:none;text-align:left;padding:10px 10px;border-radius:9px;font-family:inherit;font-size:14px;font-weight:600;color:#E9EEF7;cursor:pointer;text-decoration:none}'
    + '.acctmenu a:hover,.acctmenu button:hover{background:#17273F;color:#fff}'
    + '.acctmenu .mi{width:18px;text-align:center;color:#96A6BF;font-size:13px}'
    + '.acctmenu .out{color:#ff9ea3}'
    + '@media(max-width:760px){.nav-in .menu .acct{display:block;margin-top:10px}.acctbtn{width:100%;justify-content:center;border-radius:10px;padding:11px}.acctmenu{position:static;box-shadow:none;margin-top:6px;min-width:0}}';

  function esc(s){ return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }

  // 로그인 상태 렌더 (테스트용으로 window.azNavRender 노출)
  function render(user){
    var a=document.querySelector('.nav-in .menu .login, .menu .login, a.login');
    if(!a) return false;
    if(!document.getElementById('azNavCss')){ var st=document.createElement('style'); st.id='azNavCss'; st.textContent=CSS; document.head.appendChild(st); }
    var name=user.name||String(user.email||'').split('@')[0]||'회원';
    var wrap=document.createElement('div'); wrap.className='acct';
    wrap.innerHTML='<button type="button" class="acctbtn" aria-haspopup="true" aria-expanded="false"><span class="av">'+esc(name[0]||'·')+'</span><span class="nm">'+esc(name)+'</span><span class="car">▼</span></button>'
      +'<div class="acctmenu" role="menu">'
      +'<div class="am-h"><b>'+esc(name)+'님</b><span>'+esc(user.email||'')+'</span></div>'
      +'<a href="/portal/account.html" role="menuitem"><span class="mi">▤</span>내 라이선스 (마이페이지)</a>'
      +'<a href="/downloads.html" role="menuitem"><span class="mi">↓</span>다운로드</a>'
      +'<a href="/contact.html" role="menuitem"><span class="mi">?</span>문의하기</a>'
      +'<button type="button" class="out" role="menuitem" id="azNavLogout"><span class="mi">⎋</span>로그아웃</button>'
      +'</div>';
    a.replaceWith(wrap);
    var btn=wrap.querySelector('.acctbtn');
    btn.addEventListener('click',function(e){ e.stopPropagation(); var o=wrap.classList.toggle('open'); btn.setAttribute('aria-expanded',o?'true':'false'); });
    document.addEventListener('click',function(){ wrap.classList.remove('open'); btn.setAttribute('aria-expanded','false'); });
    document.addEventListener('keydown',function(e){ if(e.key==='Escape'){ wrap.classList.remove('open'); } });
    wrap.querySelector('#azNavLogout').addEventListener('click',async function(){
      try{ await sbNav.auth.signOut(); }catch(_){}
      try{ localStorage.removeItem('az_session'); }catch(_){}
      location.href='/';
    });
    return true;
  }
  window.azNavRender=render;

  (async function(){
    try{
      var s=(await sbNav.auth.getSession()).data.session;
      if(!s){ // 인증 링크 직후엔 토큰 처리에 잠깐 걸릴 수 있음
        if(location.hash.indexOf('access_token')>=0 || location.search.indexOf('welcome=1')>=0){ await new Promise(function(r){setTimeout(r,900);}); s=(await sbNav.auth.getSession()).data.session; }
      }
      if(!s) return;
      var u=s.user||{};
      render({name:(u.user_metadata&&u.user_metadata.name)||'', email:u.email||''});
    }catch(_){}
  })();
})();
