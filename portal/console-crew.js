/* ============================================================================
 * console-crew.js — 관리자 콘솔 [AudioAZ] 사업부 탭 (2026-09-23)
 *   audioaz.co.kr/crew/ 에서 프리랜서 감독이 참여 신청 → 여기서 확정·페이·견적·정산 관리.
 *   콘솔 본체(console-8kq3f7.html)의 sb·esc·azShow·fmtDate 를 호출 시점에 쓴다(본체보다 먼저 로드됨).
 *   DB: crew_members / crew_member_admin / crew_projects / crew_project_admin /
 *       crew_applications / crew_pay  (25_백엔드/2026-09-23_crew_schedule.sql)
 *   관리자 전용 표는 is_admin_uid() = 패스키 세션에서만 읽힌다.
 * ==========================================================================*/
(function(){
'use strict';

var C = { members:[], madmin:{}, projects:[], padmin:{}, apps:[], pay:{}, invites:[], presets:[], priv:null, loaded:false, busy:false,
          openProject:null, openMember:null, editProject:null };

var ST_PROJ = { draft:'작성 중', open:'모집 중', closed:'모집 마감', done:'완료', cancelled:'취소' };
var ST_APP  = { applied:'신청', confirmed:'확정', declined:'거절', cancelled:'본인 취소' };
var ST_MEM  = { pending:'승인 대기', active:'활동', inactive:'비활성', deleted:'탈퇴' };
var ST_BILL = { none:'—', quoted:'견적 발송', invoiced:'계산서 발행', paid:'입금 완료' };
var TAX     = { withholding:'3.3% 원천징수', invoice:'세금계산서', none:'공제 없음' };

/* ── 스타일 ─────────────────────────────────────────────────────────────── */
var css = ''
 + '.bizsw{display:flex;margin:12px 12px 0;border:1px solid rgba(255,255,255,.14);border-radius:6px;overflow:hidden}'
 + '.bizsw button{flex:1;height:34px;border:0;background:transparent;color:#9db3cf;font-family:inherit;font-size:13px;font-weight:800;cursor:pointer;letter-spacing:.02em}'
 + '.bizsw button+button{border-left:1px solid rgba(255,255,255,.14)}'
 + '.bizsw button.on{background:#E9EEF7;color:#081729}'
 + '.bizsw button:not(.on):hover{color:#fff;background:rgba(255,255,255,.06)}'
 + '.cr-st{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;white-space:nowrap}'
 + '.cr-st i{width:7px;height:7px;border-radius:1px;background:#6B7C96;flex:none}'
 + '.cr-st.g i{background:#3DD68C}.cr-st.a i{background:#E7B252}.cr-st.b i{background:#4D96F5}.cr-st.r i{background:#FF5A5F}.cr-st.d{color:var(--dim)}'
 + '.cr-num{font-family:ui-monospace,Menlo,monospace;font-size:12.5px;text-align:right;white-space:nowrap}'
 + '.cr-neg{color:#FF9EA3}.cr-pos{color:#3DD68C}'
 + '.cr-date{font-family:ui-monospace,Menlo,monospace;font-size:12px;white-space:nowrap;color:var(--dim)}'
 + '.cr-t td,.cr-t th{vertical-align:middle}.cr-t tr.sel td{background:#16233C}.cr-t th{white-space:nowrap}.cr-t td b{white-space:nowrap}.cr-t.wide{min-width:1040px}'
 + '.cr-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}'
 + '.cr-in{width:100%;min-width:84px;border:1px solid var(--line);border-radius:5px;padding:6px 8px;background:#0E1A2E;color:#E9EEF7;font-family:ui-monospace,Menlo,monospace;font-size:12.5px}'
 + 'select.cr-in{font-family:inherit}'
 + '.cr-sum{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1px;background:var(--line);border:1px solid var(--line);border-radius:6px;overflow:hidden;margin:6px 0 16px}'
 + '.cr-sum>div{padding:12px 14px;background:var(--card)}'
 + '.cr-sum .l{font-size:11.5px;color:var(--dim);font-weight:700}.cr-sum .v{font-family:ui-monospace,Menlo,monospace;font-size:16px;font-weight:700;margin-top:4px}'
 + '.cr-meta{font-family:ui-monospace,Menlo,monospace;font-size:11.5px;color:var(--dim)}'
 + '.cr-kv{display:grid;grid-template-columns:120px 1fr;gap:6px 14px;font-size:13.5px}.cr-kv dt{color:var(--dim);font-size:12.5px}'
 + '.cr-sec{font-size:12px;font-weight:800;color:var(--dim);letter-spacing:.06em;margin:18px 0 8px;padding-top:14px;border-top:1px solid var(--line)}'
 + '.cr-seg{display:flex;border:1px solid var(--line);border-radius:5px;overflow:hidden;max-width:360px}.cr-seg label{flex:1;display:flex;align-items:center;justify-content:center;height:40px;cursor:pointer;font-size:13.5px;font-weight:700;color:var(--dim);background:#0E1A2E}.cr-seg label+label{border-left:1px solid var(--line)}.cr-seg input{display:none}.cr-seg label:has(input:checked){background:#E9EEF7;color:#081729}'
 + '.cr-check{display:flex;align-items:center;gap:8px;font-size:13.5px;cursor:pointer}'
 + '.cr-grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}@media(max-width:760px){.cr-grid3{grid-template-columns:1fr}}'
 + '.cr-empty{padding:26px 8px;text-align:center;color:var(--dim);font-size:13.5px}'
 + '.cr-actions{display:flex;gap:6px;flex-wrap:nowrap}'
 + '.cr-note{font-size:12.5px;color:var(--dim);max-width:260px;white-space:pre-wrap}'
 + '@media(max-width:640px){.cr-kv{grid-template-columns:1fr}}';
var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

/* ── 사이드바: Pro / AudioAZ 전환 ──────────────────────────────────────── */
var nav = document.querySelector('.side nav');
var navPro = document.createElement('div'); navPro.id = 'navPro';
while (nav.firstChild) navPro.appendChild(nav.firstChild);
var navAz = document.createElement('div'); navAz.id = 'navAz'; navAz.style.display = 'none';
navAz.innerHTML =
    '<div class="grp">렌탈·프로덕션 · audioaz.co.kr</div>'
  + '<a data-p="crew-dash">크루 현황 <span id="crewBadge" style="display:none;background:#E7B252;color:#2E2410;border-radius:3px;padding:1px 7px;font-size:11px;font-weight:800;margin-left:6px"></span></a>'
  + '<a data-p="crew-proj">프로젝트 · 견적</a>'
  + '<a data-p="crew-members">감독</a>'
  + '<a data-p="crew-settle">페이 정산</a>'
  + '<div class="grp">바로가기</div>'
  + '<a href="https://audioaz.co.kr/crew/" target="_blank" rel="noopener" style="cursor:pointer">감독 페이지 열기 ↗</a>';
nav.appendChild(navPro); nav.appendChild(navAz);
var sw = document.createElement('div'); sw.className = 'bizsw';
sw.innerHTML = '<button type="button" data-biz="pro">Pro</button><button type="button" data-biz="az">AudioAZ</button>';
nav.parentNode.insertBefore(sw, nav);
// 탭 링크 클릭은 콘솔 본체가 .side a[data-p] 전체에 붙인다 (이 파일이 본체보다 먼저 로드됨)
sw.addEventListener('click', function(e){
  var b = e.target.closest('button[data-biz]'); if (!b) return;
  var biz = b.dataset.biz; if (biz === curBiz()) return;
  try { localStorage.setItem('az_console_biz', biz); } catch(_){}
  azShow(biz === 'az' ? 'crew-dash' : 'dash', true);
});
function curBiz(){ return navAz.style.display === 'none' ? 'pro' : 'az'; }
function setBiz(biz){
  navPro.style.display = biz === 'az' ? 'none' : '';
  navAz.style.display  = biz === 'az' ? '' : 'none';
  sw.querySelectorAll('button').forEach(function(b){ b.classList.toggle('on', b.dataset.biz === biz); });
}
(function(){ var h=(location.hash||'').replace('#',''); var b='pro';
  if (h.indexOf('crew-')===0) b='az'; else if(!h){ try{ b=localStorage.getItem('az_console_biz')||'pro'; }catch(_){} }
  setBiz(b);
})();

/* ── 페이지 섹션 ─────────────────────────────────────────────────────── */
var TITLES = { 'crew-dash':'크루 현황', 'crew-proj':'프로젝트 · 견적', 'crew-members':'감독', 'crew-settle':'페이 정산' };
var content = document.querySelector('.main .content');
function addSection(id, html){ var s=document.createElement('section'); s.id='p-'+id; s.className='page'; s.innerHTML=html; content.appendChild(s); }

addSection('crew-dash',
   '<div class="kpis">'
 +   kpi('crew-proj','모집 중 프로젝트','crKOpen','지금 신청 받는 중')
 +   kpi('crew-proj','확인할 신청','crKApplied','확정·거절 대기')
 +   kpi('crew-members','참여 요청','crKPending','Pro 회원 · 승인 필요')
 +   kpi('crew-proj','이번 달 견적','crKQuote','공급가 합계')
 +   kpi('crew-settle','이번 달 인건비','crKPay','페이+실비, 확정 기준')
 +   kpi('crew-settle','미지급 페이','crKUnpaid','지급액 합계')
 + '</div>'
 + '<div class="card"><h2>다가오는 일정 <button class="tbtn" style="margin-left:10px" onclick="crewReload()">새로고침</button></h2><div class="sub">오늘부터 45일 · 확정된 감독 포함</div><div class="cr-wrap" id="crDashUp"></div></div>'
 + '<div class="card"><h2>내 캘린더 연동</h2><div class="sub">모든 프로젝트(비공개·예정·작성 중 포함, 취소 제외)가 사장님 캘린더에 들어갑니다. 확정 감독 이름·신청 수도 메모에 표시 — 견적·페이 금액은 넣지 않습니다(주소만 알면 열리므로). 1시간마다 갱신.</div><div id="crFeed" class="rowflex"></div></div>'
 + '<div class="card"><h2>새 참여 신청</h2><div class="sub">감독이 audioaz.co.kr 에서 남긴 신청 — 바로 확정·거절</div><div class="cr-wrap" id="crDashApps"></div></div>'
 + '<div class="card"><h2>참여 요청 (승인 대기)</h2><div class="sub">초대 코드 없이 들어온 AudioAZ(Pro) 회원의 요청입니다. 승인해야 프로젝트를 볼 수 있고, 승인하면 본인에게 메일이 갑니다</div><div class="cr-wrap" id="crDashPend"></div></div>');

addSection('crew-proj',
   '<div class="toolbar"><button class="btn btn-pri" onclick="crewEditProject()">새 프로젝트</button>'
 + '<input class="cr-in search" id="crPQ" placeholder="프로젝트·장소·클라이언트 검색" oninput="crewRenderProjects()" style="max-width:320px;font-family:inherit">'
 + '<select class="cr-in" id="crPF" onchange="crewRenderProjects()" style="width:auto"><option value="active">진행 중 (작성·모집·마감)</option><option value="all">전체</option><option value="done">완료</option><option value="cancelled">취소</option></select>'
 + '<button class="tbtn" onclick="crewReload()">새로고침</button></div>'
 + '<div class="card" id="crPEdit" style="display:none"></div>'
 + '<div class="card" style="margin-top:0"><div class="cr-wrap"><table class="cr-t wide"><thead><tr><th>날짜</th><th>프로젝트</th><th>장소</th><th>상태</th><th style="text-align:right">신청/확정</th><th style="text-align:right">견적</th><th style="text-align:right">인건비</th><th style="text-align:right">남는 금액</th><th>청구</th><th></th></tr></thead><tbody id="crPRows"></tbody></table></div></div>'
 + '<div class="card" id="crPDetail" style="display:none"></div>');

addSection('crew-members',
   '<div class="card" style="margin-top:0"><h2>초대 코드</h2><div class="sub">감독은 초대 코드가 있어야 가입할 수 있습니다(웹 audioaz.co.kr/crew/). 코드 문구·사용 횟수·만료일을 직접 정하고 언제든 바꿀 수 있습니다. 여러 번 쓰는 코드는 아는 사람 누구나 가입하니, 퍼졌다 싶으면 바꾸거나 중지하세요.</div>'
 + '<div class="rowflex" style="align-items:flex-end;gap:10px">'
 +   '<div class="field" style="margin:0"><label>코드 (영문·숫자·-, 32자까지 · 짧은 코드는 횟수·기한을 걸어 두세요)</label><input class="cr-in" id="crIvCode" placeholder="비우면 자동 생성" style="width:220px;text-transform:uppercase;letter-spacing:.08em"></div>'
 +   '<div class="field" style="margin:0"><label>메모</label><input class="cr-in" id="crIvLabel" placeholder="예: 2026 가을 크루 공용" style="width:220px;font-family:inherit"></div>'
 +   '<div class="field" style="margin:0"><label>사용 횟수</label><input class="cr-in" id="crIvMax" type="number" min="1" placeholder="빈칸 = 무제한" style="width:120px"></div>'
 +   '<div class="field" style="margin:0"><label>만료일</label><input class="cr-in" id="crIvExp" type="date" style="width:150px"></div>'
 +   '<button class="btn btn-pri" onclick="crewNewInvite()">코드 만들기</button></div>'
 + '<label class="cr-check" style="margin-top:12px"><input type="checkbox" id="crIvAll"> 중지·만료·다 쓴 코드도 보기</label>'
 + '<div class="cr-wrap" id="crIvList" style="margin-top:10px"></div></div>'
 + '<div class="toolbar" style="margin-top:18px"><input class="cr-in search" id="crMQ" placeholder="이름·분야·연락처 검색" oninput="crewRenderMembers()" style="max-width:320px;font-family:inherit">'
 + '<select class="cr-in" id="crMF" onchange="crewRenderMembers()" style="width:auto"><option value="">전체</option><option value="pending">승인 대기</option><option value="active">활동</option><option value="inactive">비활성</option><option value="deleted">탈퇴</option></select>'
 + '<button class="tbtn" onclick="crewReload()">새로고침</button>'
 + '<span class="cr-meta" style="margin-left:auto">가입 = 초대 코드 필수</span></div>'
 + '<div class="card" style="margin-top:0"><div class="cr-wrap"><table class="cr-t wide"><thead><tr><th>이름</th><th>분야</th><th>연락처</th><th>사업자</th><th style="text-align:right">기본 일당</th><th>등급</th><th style="text-align:right">확정 참여</th><th>서류</th><th>상태</th><th></th></tr></thead><tbody id="crMRows"></tbody></table></div></div>'
 + '<div class="card" id="crMDetail" style="display:none"></div>');

addSection('crew-settle',
   '<div class="toolbar"><select class="cr-in" id="crSM" onchange="crewRenderSettle()" style="width:auto"></select>'
 + '<select class="cr-in" id="crSF" onchange="crewRenderSettle()" style="width:auto"><option value="">전체</option><option value="unpaid">미지급만</option><option value="paid">지급 완료만</option></select>'
 + '<button class="tbtn" onclick="crewSettleCsv()">CSV 내려받기</button><button class="tbtn" onclick="crewReload()">새로고침</button></div>'
 + '<div class="cr-sum" id="crSSum"></div>'
 + '<div class="card" style="margin-top:0"><div class="sub">확정된 참여만 표시. 금액 단위 만원(CSV 는 이체용으로 원 단위). 원천징수 = 소득세 3% + 지방소득세 0.3%(10원 미만 절사). 세금계산서는 페이에 부가세 10%를 더해 지급.</div>'
 + '<div class="cr-wrap"><table class="cr-t wide"><thead><tr><th>날짜</th><th>프로젝트</th><th>감독</th><th>구분</th><th style="text-align:right">페이(세전)</th><th style="text-align:right">실비</th><th style="text-align:right">공제 / VAT</th><th style="text-align:right">지급액</th><th>계좌</th><th>지급</th></tr></thead><tbody id="crSRows"></tbody></table></div></div>');

function kpi(go, l, id, d){
  return '<div class="kpi go" role="link" tabindex="0" onclick="azGo(\''+go+'\')" onkeydown="if(event.key===\'Enter\')azGo(\''+go+'\')"><div class="l">'+l+' <span class="gochev">›</span></div><div class="v" id="'+id+'" style="font-size:21px">—</div><div class="d flat" id="'+id+'D">'+d+'</div></div>';
}

/* ── 계산 ──────────────────────────────────────────────────────────────── */
function n(v){ v = Number(v); return isFinite(v) ? v : 0; }
/* 금액은 만원 단위로 보여 준다(사장님 지시 2026-09-24). DB 는 원 그대로. 원천세 등으로 끝자리가 생기면 소수 4자리까지 정확히(69.69만). */
function won(v){ return (v===null||v===undefined||v==='') ? '—' : manStr(n(v))+'만'; }
function manStr(w){ return (Math.round(w)/10000).toLocaleString('ko-KR',{maximumFractionDigits:4}); }
function toMan(w){ return (w===null||w===undefined||w==='') ? '' : String(Math.round(n(w))/10000); }
function manToWon(s){ s=String(s===null||s===undefined?'':s).replace(/[^\d.\-]/g,''); if(s===''||s==='-'||s==='.') return null; var f=parseFloat(s); return isFinite(f)?Math.round(f*10000):null; }
function trunc10(v){ return Math.floor(v/10)*10; }
function calcPay(p){
  var pay=n(p&&p.pay_krw), extra=n(p&&p.extra_krw), t=(p&&p.tax_type)||'withholding', tax=0, vat=0;
  if (t==='withholding'){ var it=trunc10(pay*0.03), lt=trunc10(it*0.1); tax=it+lt; }
  else if (t==='invoice'){ vat=Math.round(pay*0.1); }
  return { pay:pay, extra:extra, tax:tax, vat:vat, net: pay - tax + vat + extra, cost: pay + extra };
}
function days(p){
  if (!p.date_start) return 1;
  if (!p.date_end || p.date_end < p.date_start) return 1;
  return Math.round((new Date(p.date_end) - new Date(p.date_start)) / 864e5) + 1;
}
function dRange(p){
  var s=p.date_start||''; if(!p.date_end||p.date_end===s) return s;
  return s+' ~ '+(p.date_end.slice(0,4)===s.slice(0,4)?p.date_end.slice(5):p.date_end);
}
function mem(uid){ for (var i=0;i<C.members.length;i++) if (C.members[i].user_id===uid) return C.members[i]; return null; }
function proj(id){ for (var i=0;i<C.projects.length;i++) if (C.projects[i].id===id) return C.projects[i]; return null; }
function appsOf(pid){ return C.apps.filter(function(a){ return a.project_id===pid; }); }
function projCost(pid){
  var s=0; appsOf(pid).forEach(function(a){ if(a.status==='confirmed' && !ghost(a.user_id)) s+=calcPay(C.pay[a.id]).cost; }); return s;
}
function projMargin(p){
  var pa=C.padmin[p.id]||{}; if (pa.quote_krw===null||pa.quote_krw===undefined) return null;
  return n(pa.quote_krw) - projCost(p.id) - n(pa.other_cost_krw);
}
function travelTag(p){ return p ? (p.depart_day_before?' <span class="cr-meta" style="margin-left:6px">전날 출발</span>':'')+(p.return_day_after?' <span class="cr-meta" style="margin-left:6px">다음날 복귀</span>':'') : ''; }
function tentTag(p){ return travelTag(p)+(p && p.is_private ? ' <span class="cr-st r" style="margin-left:6px;vertical-align:middle" title="감독에게 보이지 않음"><i></i>비공개</span>' : '') + (p && p.is_tentative ? ' <span class="cr-st a" style="margin-left:6px;vertical-align:middle" title="임시 픽스 — 변동·취소 가능"><i></i>예정</span>' : ''); }
function stP(s, p){ var c={open:'g',draft:'d',closed:'a',done:'b',cancelled:'d'}[s]||'d'; var t=(s==='closed'&&p&&p.auto_closed)?'정원 마감':(ST_PROJ[s]||s); return '<span class="cr-st '+c+'"><i></i>'+t+'</span>'; }
function stA(s){ var c={applied:'a',confirmed:'g',declined:'r',cancelled:'d'}[s]||'d'; return '<span class="cr-st '+c+'"><i></i>'+(ST_APP[s]||s)+'</span>'; }
function stM(s){ var c={pending:'a',active:'g',inactive:'d',deleted:'r'}[s]||'d'; return '<span class="cr-st '+c+'"><i></i>'+(ST_MEM[s]||s)+'</span>'; }
/* 전화번호 자동 하이픈 (01035470502 → 010-3547-0502, 02·지역번호·1588 대표번호 포함) */
function fmtPhone(v){
  var d=String(v||'').replace(/\D/g,'').slice(0,12); if(!d) return '';
  if (/^02/.test(d)){ if(d.length<=2) return d; if(d.length<=5) return d.slice(0,2)+'-'+d.slice(2); if(d.length<=9) return d.slice(0,2)+'-'+d.slice(2,5)+'-'+d.slice(5); return d.slice(0,2)+'-'+d.slice(2,6)+'-'+d.slice(6,10); }
  if (/^1[5689]/.test(d)){ return d.length<=4 ? d : d.slice(0,4)+'-'+d.slice(4,8); }
  if (/^050/.test(d) && d.length>11) return d.slice(0,4)+'-'+d.slice(4,8)+'-'+d.slice(8,12);
  if (d.length<=3) return d; if (d.length<=6) return d.slice(0,3)+'-'+d.slice(3);
  if (d.length<=10) return d.slice(0,3)+'-'+d.slice(3,6)+'-'+d.slice(6);
  return d.slice(0,3)+'-'+d.slice(3,7)+'-'+d.slice(7,11);
}
document.addEventListener('input', function(ev){
  var t=ev.target; if (!t || !t.matches || !t.matches('input[type=tel],input[data-phone]')) return;
  var f=fmtPhone(t.value); if (f!==t.value){ t.value=f; try{ t.setSelectionRange(f.length,f.length); }catch(_){} }
});
window.fmtPhone=fmtPhone;
/* 사업자등록번호 자동 하이픈 (1234567890 → 123-45-67890) */
function fmtBizNo(v){ var d=String(v||'').replace(/\D/g,'').slice(0,10); if(d.length<=3) return d; if(d.length<=5) return d.slice(0,3)+'-'+d.slice(3); return d.slice(0,3)+'-'+d.slice(3,5)+'-'+d.slice(5); }
document.addEventListener('input', function(ev){
  var t=ev.target; if (!t || !t.matches || !t.matches('input[data-bizno]')) return;
  var f=fmtBizNo(t.value); if (f!==t.value){ t.value=f; try{ t.setSelectionRange(f.length,f.length); }catch(_){} }
});
window.fmtBizNo=fmtBizNo;
/* ── 감독 제출 서류 (안전교육 이수증·신분증·통장 사본·기타) ── */
var DOC_KIND={ safety:'안전교육', id:'신분증', bank:'통장', other:'기타' };
function docsOf(uid){ return (C.docs||[]).filter(function(d){ return d.user_id===uid; }); }
function docBadges(uid){
  var ds=docsOf(uid);
  return ['safety','id','bank'].map(function(k){ var ok=ds.some(function(d){ return d.kind===k; });
    return '<span class="cr-st '+(ok?'g':'d')+'" style="margin-right:6px" title="'+DOC_KIND[k]+(ok?' 제출':' 미제출')+'"><i></i>'+DOC_KIND[k]+'</span>'; }).join('');
}
function docList(uid){
  var ds=docsOf(uid);
  if (!ds.length) return '<div class="cr-empty" style="text-align:left;padding:4px 0">아직 제출한 서류가 없습니다.</div>';
  return '<table class="cr-t"><tbody>'+ds.map(function(d){
    return '<tr><td style="width:90px"><span class="cr-st b"><i></i>'+(DOC_KIND[d.kind]||d.kind)+'</span></td><td><b>'+e(d.title)+'</b><div class="cr-meta">'+(d.size_bytes?(d.size_bytes>=1048576?(d.size_bytes/1048576).toFixed(1)+'MB':Math.max(1,Math.round(d.size_bytes/1024))+'KB'):'')+' · '+e(fmtDateTime(d.created_at))+'</div></td>'
      +'<td style="width:90px"><button class="tbtn" onclick="crewOpenDoc(\''+d.id+'\')">열기</button></td></tr>'; }).join('')+'</tbody></table>';
}
window.crewOpenDoc = async function(id){
  var d=(C.docs||[]).filter(function(x){ return x.id===id; })[0]; if(!d) return;
  var w=window.open('', '_blank');
  var r=await sb.storage.from('crew-docs').createSignedUrl(d.storage_path, 120);
  if (r.error){ if(w) w.close(); return dbErr(r.error); }
  if (w) w.location=r.data.signedUrl; else window.open(r.data.signedUrl,'_blank','noopener');
};
function bizLabel(m){ return m ? ((m.is_business ? '사업자' : '개인')+(m.is_ghost?' · <span class="cr-st a"><i></i>확인용</span>':'')) : '—'; }
function ghost(uid){ var m=mem(uid); return !!(m && m.is_ghost); }   // 확인용(고스트) 계정: 합계·정산에서 뺀다
function e(v){ return esc(v===null||v===undefined?'':v); }
function today(){ var d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function ym(s){ return (s||'').slice(0,7); }
function flash(msg, bad){
  var t=document.getElementById('crToast'); if(!t){ t=document.createElement('div'); t.id='crToast';
    t.style.cssText='position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:600;background:#081729;border:1px solid #2A3B5A;color:#E9EEF7;padding:11px 18px;border-radius:6px;font-size:13.5px;font-weight:700;max-width:90vw'; document.body.appendChild(t); }
  t.textContent=msg; t.style.borderColor=bad?'#FF5A5F':'#2A3B5A'; t.style.display='block';
  clearTimeout(t._h); t._h=setTimeout(function(){ t.style.display='none'; }, bad?6000:2400);
}
function dbErr(err){
  var m=(err&&err.message)||String(err);
  if (/permission|policy|42501/i.test(m)) m='권한이 없습니다 — 패스키로 로그인한 관리자 세션인지 확인하세요. ('+m+')';
  flash(m, true);
}

/* ── 로드 ──────────────────────────────────────────────────────────────── */
async function load(){
  if (C.busy) return; C.busy = true;
  try{
    var r = await Promise.all([
      sb.from('crew_members').select('*').order('created_at',{ascending:false}),
      sb.from('crew_member_admin').select('*'),
      sb.from('crew_projects').select('*').order('date_start',{ascending:false}),
      sb.from('crew_project_admin').select('*'),
      sb.from('crew_applications').select('*').order('created_at',{ascending:true}),
      sb.from('crew_pay').select('*'),
      sb.from('crew_invites').select('*').order('created_at',{ascending:false}).limit(200),
      sb.from('crew_text_presets').select('*').order('title'),
      sb.from('crew_admin_feed').select('token').eq('id',1).maybeSingle(),
      sb.from('crew_invite_uses').select('invite_id,user_id,used_at').order('used_at',{ascending:false}).limit(1000),
      sb.from('crew_contact_presets').select('*').order('name'),
      sb.from('crew_member_docs').select('id,user_id,kind,title,storage_path,size_bytes,created_at').order('created_at',{ascending:false})
    ]);
    for (var i=0;i<r.length;i++) if (r[i].error) throw r[i].error;
    C.members=r[0].data||[]; C.projects=r[2].data||[]; C.apps=r[4].data||[];
    C.madmin={}; (r[1].data||[]).forEach(function(x){ C.madmin[x.user_id]=x; });
    C.padmin={}; (r[3].data||[]).forEach(function(x){ C.padmin[x.project_id]=x; });
    C.pay={};    (r[5].data||[]).forEach(function(x){ C.pay[x.application_id]=x; });
    C.invites=r[6].data||[];
    C.presets=r[7].data||[];
    C.feed=(r[8].data&&r[8].data.token)||null;
    C.inviteUses=r[9].data||[];
    C.contacts=r[10].data||[];
    C.docs=r[11].data||[];
    C.loaded = true;
  }catch(err){ dbErr(err); }
  C.busy = false;
  badge();
}
function badge(){
  var k = C.apps.filter(function(a){ var p=proj(a.project_id); return a.status==='applied' && p && p.status!=='cancelled'; }).length
        + C.members.filter(function(m){ return m.status==='pending'; }).length;
  var b=document.getElementById('crewBadge'); if(b){ b.textContent=k; b.style.display=k?'':'none'; }
}
window.crewReload = async function(){ await load(); render(curPage()); };
function curPage(){ var s=document.querySelector('.page.on'); return s ? s.id.replace(/^p-/,'') : ''; }
function render(p){
  if (p==='crew-dash') renderDash();
  else if (p==='crew-proj') { crewRenderProjects(); if (C.openProject) renderProjectDetail(); }
  else if (p==='crew-members') { renderInvites(); crewRenderMembers(); if (C.openMember) renderMemberDetail(); }
  else if (p==='crew-settle') crewRenderSettle();
}

/* 콘솔 azShow 가 매 탭 전환마다 부른다 */
window.crewEnter = async function(p){
  setBiz(p.indexOf('crew-')===0 ? 'az' : 'pro');
  if (p.indexOf('crew-')!==0) return;
  document.getElementById('ptitle').textContent = TITLES[p];
  // 로그인 전(게이트 뒤)에 불리면 빈 결과가 캐시되므로 세션이 있을 때만, 탭을 열 때마다 새로 읽는다
  var ses = await sb.auth.getSession(); if (!ses.data || !ses.data.session) return;
  await load();
  render(p);
};

/* ── 크루 현황 ─────────────────────────────────────────────────────────── */
function renderDash(){
  renderFeed();
  var t=today(), m=ym(t);
  var applied = C.apps.filter(function(a){ var p=proj(a.project_id); return a.status==='applied' && p && p.status!=='cancelled'; });
  var pend = C.members.filter(function(x){ return x.status==='pending'; });
  var mq=0, mp=0, unpaid=0, unpaidN=0;
  C.projects.forEach(function(p){ if (ym(p.date_start)===m && p.status!=='cancelled'){ mq+=n((C.padmin[p.id]||{}).quote_krw); mp+=projCost(p.id); } });
  C.apps.forEach(function(a){ if(a.status!=='confirmed' || ghost(a.user_id)) return; var p=proj(a.project_id); if(!p||p.status==='cancelled') return;
    var py=C.pay[a.id]; if(!py||!py.paid){ unpaid+=calcPay(py).net; unpaidN++; } });
  set('crKOpen', C.projects.filter(function(p){ return p.status==='open'; }).length);
  set('crKApplied', applied.length); set('crKPending', pend.length);
  set('crKQuote', won(mq)+'원'); set('crKPay', won(mp)+'원'); set('crKUnpaid', won(unpaid)+'원'); set('crKUnpaidD', unpaidN+'건 · 지급액 합계');

  var ld = new Date(); ld.setDate(ld.getDate()+45); var lim = ld.getFullYear()+'-'+String(ld.getMonth()+1).padStart(2,'0')+'-'+String(ld.getDate()).padStart(2,'0');
  var up = C.projects.filter(function(p){ return (p.date_end||p.date_start)>=t && p.date_start<=lim && p.status!=='cancelled' && p.status!=='draft'; })
                     .sort(function(a,b){ return a.date_start<b.date_start?-1:1; });
  document.getElementById('crDashUp').innerHTML = up.length ? '<table class="cr-t"><thead><tr><th>날짜</th><th>프로젝트</th><th>장소</th><th>상태</th><th>확정 감독</th><th>신청</th></tr></thead><tbody>'
    + up.map(function(p){ var as=appsOf(p.id), cf=as.filter(function(a){return a.status==='confirmed';}), ap=as.filter(function(a){return a.status==='applied';});
        return '<tr style="cursor:pointer" onclick="crewOpenProject(\''+p.id+'\')"><td class="cr-date">'+e(dRange(p))+'</td><td><b>'+e(p.title)+'</b>'+tentTag(p)+(p.call_time?'<div class="cr-meta">콜 '+e(p.call_time)+'</div>':'')+'</td><td>'+e(p.venue||'—')+'</td><td>'+stP(p.status,p)+'</td>'
          +'<td>'+(cf.length?cf.map(function(a){ var x=mem(a.user_id); return e(x?x.name:'?'); }).join(', '):'<span class="cr-meta">없음</span>')+(p.headcount?' <span class="cr-meta">/ '+p.headcount+'명</span>':'')+'</td>'
          +'<td class="cr-num">'+ap.length+'</td></tr>'; }).join('') + '</tbody></table>'
    : '<div class="cr-empty">예정된 일정이 없습니다.</div>';

  document.getElementById('crDashApps').innerHTML = applied.length ? '<table class="cr-t"><thead><tr><th>신청 시각</th><th>프로젝트</th><th>감독</th><th>희망 포지션</th><th>남긴 말</th><th></th></tr></thead><tbody>'
    + applied.slice().reverse().map(function(a){ var p=proj(a.project_id)||{}, x=mem(a.user_id)||{};
        return '<tr><td class="cr-date">'+e(fmtDateTime(a.created_at))+'</td><td><a style="cursor:pointer;text-decoration:underline" onclick="crewOpenProject(\''+p.id+'\')">'+e(p.title)+'</a><div class="cr-meta">'+e(dRange(p))+'</div></td>'
          +'<td>'+e(x.name)+' <span class="cr-meta">'+bizLabel(x)+'</span></td><td>'+e(a.role||'—')+'</td><td class="cr-note">'+e(a.note||'')+'</td>'
          +'<td><div class="cr-actions"><button class="tbtn" onclick="crewSetApp(\''+a.id+'\',\'confirmed\')">확정</button><button class="tbtn danger" onclick="crewSetApp(\''+a.id+'\',\'declined\')">거절</button></div></td></tr>'; }).join('') + '</tbody></table>'
    : '<div class="cr-empty">새 신청이 없습니다.</div>';

  document.getElementById('crDashPend').innerHTML = pend.length ? '<table class="cr-t"><thead><tr><th>요청</th><th>이름</th><th>남긴 말</th><th>연락처</th><th>사업자</th><th></th></tr></thead><tbody>'
    + pend.map(function(x){ return '<tr><td class="cr-date">'+e(fmtDate(x.created_at))+'</td><td><b>'+e(x.name)+'</b><div class="cr-meta">'+e(x.email||'')+'</div></td><td class="cr-note">'+e(x.career||x.specialty||'—')+'</td><td class="mono">'+e(fmtPhone(x.phone)||x.phone||'—')+'</td><td>'+bizLabel(x)+'</td>'
        +'<td><div class="cr-actions"><button class="tbtn" onclick="crewSetMember(\''+x.user_id+'\',\'active\')">승인</button><button class="tbtn danger" onclick="crewSetMember(\''+x.user_id+'\',\'inactive\')">거절</button><button class="tbtn" onclick="crewOpenMember(\''+x.user_id+'\')">상세</button></div></td></tr>'; }).join('') + '</tbody></table>'
    : '<div class="cr-empty">대기 중인 참여 요청이 없습니다.</div>';
}
var ICAL='https://lkbbenyvchddsjsihofv.supabase.co/functions/v1/crew-ical';
function renderFeed(){
  var box=document.getElementById('crFeed'); if(!box) return;
  if (!C.feed){ box.innerHTML='<span class="cr-meta">연동 주소를 불러오지 못했습니다.</span>'; return; }
  var https=ICAL+'?a='+C.feed, webcal=https.replace(/^https:/,'webcal:');
  box.innerHTML='<a class="btn btn-pri" style="text-decoration:none" href="'+e(webcal)+'">아이폰·맥 캘린더에 연동</a>'
    +'<a class="btn btn-out" style="text-decoration:none" target="_blank" rel="noopener" href="'+e('https://calendar.google.com/calendar/r?cid='+encodeURIComponent(webcal))+'">구글 캘린더에 연동</a>'
    +'<button class="tbtn" onclick="crewFeedCopy()">주소 복사</button><button class="tbtn danger" onclick="crewFeedReset()">주소 새로 만들기</button>';
}
window.crewFeedCopy = function(){ var t=ICAL+'?a='+C.feed; (navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(function(){ flash('캘린더 주소를 복사했습니다. 남에게 보내지 마세요.'); },function(){ prompt('캘린더 주소', t); }); };
window.crewFeedReset = async function(){
  if (!confirm('캘린더 주소를 새로 만듭니다. 지금 연동된 캘린더는 더 이상 갱신되지 않으니 새 주소로 다시 연동해야 합니다.')) return;
  var nt=crypto.randomUUID?crypto.randomUUID():null; if(!nt){ flash('이 브라우저에서는 새 주소를 만들 수 없습니다.', true); return; }
  var r=await sb.from('crew_admin_feed').update({ token:nt, updated_at:new Date().toISOString() }).eq('id',1); if (r.error) return dbErr(r.error);
  C.feed=nt; renderFeed(); flash('새 주소를 만들었습니다. 캘린더에 다시 연동해 주세요.');
};
function set(id,v){ var el=document.getElementById(id); if(el) el.textContent=v; }

/* ── 프로젝트 목록 ─────────────────────────────────────────────────────── */
window.crewRenderProjects = function(){
  var q=(document.getElementById('crPQ').value||'').trim().toLowerCase(), f=document.getElementById('crPF').value;
  var rows = C.projects.filter(function(p){
    if (f==='active' && !(p.status==='draft'||p.status==='open'||p.status==='closed')) return false;
    if (f==='done' && p.status!=='done') return false;
    if (f==='cancelled' && p.status!=='cancelled') return false;
    if (q){ var pa=C.padmin[p.id]||{}; if ((p.title+' '+(p.venue||'')+' '+(pa.client_name||'')).toLowerCase().indexOf(q)<0) return false; }
    return true;
  });
  if (f==='active') rows.sort(function(a,b){ return a.date_start<b.date_start?-1:1; });
  document.getElementById('crPRows').innerHTML = rows.length ? rows.map(function(p){
    var as=appsOf(p.id), ap=as.filter(function(a){return a.status==='applied'||a.status==='confirmed';}).length, cf=as.filter(function(a){return a.status==='confirmed';}).length;
    var pa=C.padmin[p.id]||{}, cost=projCost(p.id), mg=projMargin(p);
    return '<tr class="'+(C.openProject===p.id?'sel':'')+'"><td class="cr-date">'+e(dRange(p))+'</td><td><b>'+e(p.title)+'</b>'+tentTag(p)+(pa.client_name?'<div class="cr-meta">'+e(pa.client_name)+'</div>':'')+'</td><td>'+e(p.venue||'—')+'</td><td>'+stP(p.status,p)+'</td>'
      +'<td class="cr-num">'+ap+' / '+cf+(p.headcount?' <span class="cr-meta">('+p.headcount+')</span>':'')+'</td>'
      +'<td class="cr-num">'+won(pa.quote_krw)+'</td><td class="cr-num">'+won(cost)+'</td>'
      +'<td class="cr-num '+(mg===null?'':(mg<0?'cr-neg':''))+'">'+(mg===null?'—':won(mg))+'</td><td style="font-size:12.5px">'+(ST_BILL[pa.bill_status||'none'])+'</td>'
      +'<td><div class="cr-actions"><button class="tbtn" onclick="crewOpenProject(\''+p.id+'\')">관리</button><button class="tbtn" onclick="crewEditProject(\''+p.id+'\')">수정</button></div></td></tr>';
  }).join('') : '<tr><td colspan="10" class="cr-empty">프로젝트가 없습니다. [새 프로젝트]로 올리면 승인된 감독들에게 바로 보입니다.</td></tr>';
};

/* ── 프로젝트 등록·수정 ────────────────────────────────────────────────── */
window.crewEditProject = function(id){
  var p = id ? proj(id) : null, pa = (p && C.padmin[p.id]) || {};
  C.editProject = id || null;
  if (curPage()!=='crew-proj') azShow('crew-proj', true);
  var box = document.getElementById('crPEdit');
  function fld(k,l,v,type,ph){ return '<div class="field"><label>'+l+'</label><input id="crE_'+k+'" type="'+(type||'text')+'"'+(type==='number'?' step="any"':'')+' value="'+e(v)+'" placeholder="'+e(ph||'')+'"></div>'; }
  box.innerHTML = '<h2>'+(p?'프로젝트 수정':'새 프로젝트')+'</h2><div class="sub">위 칸은 감독에게 보이는 정보, 아래 [관리자 전용]은 사장님만 봅니다.</div>'
    + '<div class="grid2">'+fld('title','프로젝트명 *',p&&p.title,'text','예: ○○ 콘서트 SR')+fld('venue','장소',p&&p.venue,'text','예: 세종문화회관 대극장')+'</div>'
    + '<div class="cr-grid3">'+fld('date_start','시작일 *',p&&p.date_start,'date')+fld('date_end','종료일 (하루면 비움)',p&&p.date_end,'date')+fld('call_time','콜타임',p&&p.call_time,'text','예: 08:00 로드인')+'</div>'
    + '<div class="rowflex" style="margin:-2px 0 14px;gap:18px"><label class="cr-check"><input type="checkbox" id="crE_depart"'+(p&&p.depart_day_before?' checked':'')+'> 전날 출발 (지방)</label>'
    + '<label class="cr-check"><input type="checkbox" id="crE_return"'+(p&&p.return_day_after?' checked':'')+'> 다음날 복귀</label>'
    + '<span class="cr-meta">감독 화면·캘린더에 이동일까지 표시 (기본 일당 자동 계산은 공연일 기준)</span></div>'
    + '<div class="grid2">'+fld('roles','모집 포지션',p&&p.roles,'text','예: FOH 1, 모니터 1, 시스템 1')+fld('headcount','모집 인원',p&&p.headcount,'number')+'</div>'
    + '<div class="cr-meta" style="margin:-4px 0 10px">확정 인원이 모집 인원에 차면 자동으로 \'정원 마감\'되어 새 신청이 막힙니다. 확정이 취소되면 다시 모집 중으로 열립니다. 더 받으려면 모집 인원을 늘리세요.</div>'
    + '<div class="field"><label>상세 내용 (모집 중이면 모든 감독에게 보임)</label><textarea id="crE_description" rows="5" placeholder="장비 구성, 복장, 식사, 리허설 일정 등">'+e(p&&p.description)+'</textarea></div>'
    + presetBar('description')
    + '<div class="grid2"><div class="field"><label>모집 상태</label><select id="crE_status">'+['draft','open','closed','done','cancelled'].map(function(s){ return '<option value="'+s+'"'+(((p&&p.status)||'open')===s?' selected':'')+'>'+ST_PROJ[s]+(s==='draft'?' (감독에게 안 보임)':'')+'</option>'; }).join('')+'</select></div>'
    + '<div class="field"><label>일정 상태</label><div class="cr-seg">'
    +   '<label><input type="radio" name="crE_tent" value="0"'+(p&&p.is_tentative?'':' checked')+'><span>확정</span></label>'
    +   '<label><input type="radio" name="crE_tent" value="1"'+(p&&p.is_tentative?' checked':'')+'><span>예정 (임시 픽스)</span></label></div>'
    +   '<div class="cr-meta" style="margin-top:6px">예정이면 감독 화면에 "일정이 바뀌거나 취소될 수 있음"이 표시됩니다. 예정→확정·취소 시 참여 감독에게 메일</div></div></div>'
    + '<div class="field"><label>공개 범위</label><div class="cr-seg">'
    +   '<label><input type="radio" name="crE_priv" value="0"'+(p&&p.is_private?'':' checked')+'><span>공개</span></label>'
    +   '<label><input type="radio" name="crE_priv" value="1"'+(p&&p.is_private?' checked':'')+'><span>비공개 (나만 보기)</span></label></div>'
    +   '<div class="cr-meta" style="margin-top:6px">비공개면 신청·확정된 감독도 이 프로젝트와 자료를 볼 수 없고, 알림 메일도 나가지 않습니다</div></div>'
    + '<div class="cr-sec">확정자 전용 — 이 프로젝트에 확정된 감독만 봄 (현장 담당자·큐시트·링크·스탭 전달사항)</div>'
    + '<div class="cr-grid3"><div class="field"><label>현장 담당자</label><input id="crE_cname" placeholder="예: 김형준"></div>'
    + '<div class="field"><label>직급</label><input id="crE_ctitle" placeholder="예: 대표 · 팀장"></div>'
    + '<div class="field"><label>담당자 연락처</label><input id="crE_cphone" type="tel" placeholder="010-0000-0000"></div></div>'
    + contactBar()
    + '<div class="field"><label>스탭 전달사항</label><textarea id="crE_privnotes" rows="5" placeholder="집합 장소 상세, 주차, 연락처, 동선, 무전 채널 등">'+(p?'':'')+'</textarea></div>'
    + presetBar('privnotes')
    + (p ? '<div id="crPFiles" class="cr-empty" style="text-align:left;padding:4px 0">자료 불러오는 중…</div>'
         : '<p class="note" style="margin-top:0">파일·링크는 프로젝트를 먼저 등록한 뒤 [수정]에서 올릴 수 있습니다. 전달사항은 지금 적어도 함께 저장됩니다.</p>')
    + '<div class="cr-sec">관리자 전용 — 감독에게 보이지 않음</div>'
    + '<div class="grid2">'+fld('client_name','클라이언트',pa.client_name)+fld('client_contact','클라이언트 연락처',pa.client_contact)+'</div>'
    + '<div class="cr-grid3">'+fld('quote_krw','견적 금액 (공급가, 만원)',toMan(pa.quote_krw),'number','예: 800')+fld('other_cost_krw','기타 비용 (장비·운송·숙박, 만원)',toMan(pa.other_cost_krw),'number','예: 250')
    + '<div class="field"><label>청구 상태</label><select id="crE_bill_status">'+Object.keys(ST_BILL).map(function(s){ return '<option value="'+s+'"'+((pa.bill_status||'none')===s?' selected':'')+'>'+(s==='none'?'미청구':ST_BILL[s])+'</option>'; }).join('')+'</select></div></div>'
    + '<label class="cr-check" style="margin-bottom:12px"><input type="checkbox" id="crE_quote_vat"'+(pa.quote_vat===false?'':' checked')+'> 부가세 별도 청구 (견적 금액 + 10%)</label>'
    + '<div class="field"><label>관리 메모</label><textarea id="crE_memo" rows="2">'+e(pa.memo)+'</textarea></div>'
    + '<div class="rowflex"><button class="btn btn-pri" onclick="crewSaveProject()">'+(p?'저장':'등록')+'</button><button class="btn btn-out" onclick="crewCloseEdit()">닫기</button>'
    + (p?'<button class="tbtn danger" style="margin-left:auto" onclick="crewDeleteProject(\''+p.id+'\')">프로젝트 삭제</button>':'')+'</div>';
  box.style.display='block'; box.scrollIntoView({behavior:'smooth',block:'start'});
  document.getElementById('crE_title').focus();
  C.priv = p ? null : { notes:'', files:[] };
  if (p) loadPrivate(p.id); else prefillContact();
};

/* ── 확정자 전용 자료 (관리자) ──────────────────────────────────────────── */
/* ── 현장 담당자 프리셋 (관리자 전용) ── */
function contactOpts(){ return '<option value="">담당자 불러오기…</option>'+(C.contacts||[]).map(function(x){ return '<option value="'+x.id+'">'+e(x.name)+(x.title?' · '+e(x.title):'')+(x.phone?' · '+e(fmtPhone(x.phone)||x.phone):'')+'</option>'; }).join(''); }
function contactBar(){
  return '<div class="rowflex" style="margin:-4px 0 14px"><select class="cr-in" id="crCP" style="width:auto;max-width:300px;font-family:inherit" onchange="crewContactUse()">'+contactOpts()+'</select>'
    + '<button class="tbtn" type="button" onclick="crewContactSave()">지금 담당자를 프리셋으로 저장</button>'
    + '<button class="tbtn" type="button" onclick="crewContactManage()">담당자 관리</button></div>'
    + '<div id="crCPM" style="display:none;margin:-6px 0 14px"></div>';
}
function contactVals(){ return { name:(document.getElementById('crE_cname').value||'').trim(), title:(document.getElementById('crE_ctitle').value||'').trim(), phone:(document.getElementById('crE_cphone').value||'').trim() }; }
async function reloadContacts(){ var r=await sb.from('crew_contact_presets').select('*').order('name'); if(!r.error) C.contacts=r.data||[]; var sel=document.getElementById('crCP'); if(sel) sel.innerHTML=contactOpts(); var m=document.getElementById('crCPM'); if(m && m.style.display!=='none') crewContactManage(true); }
window.crewContactUse = function(){
  var id=document.getElementById('crCP').value; if(!id) return;
  var c=(C.contacts||[]).filter(function(x){ return x.id===id; })[0]; if(!c) return;
  document.getElementById('crE_cname').value=c.name||''; document.getElementById('crE_ctitle').value=c.title||''; document.getElementById('crE_cphone').value=fmtPhone(c.phone)||c.phone||'';
  document.getElementById('crCP').value=''; flash(c.name+' 담당자를 넣었습니다.');
};
window.crewContactSave = async function(){
  var v=contactVals(); if(!v.name){ flash('담당자 이름을 먼저 적어 주세요.', true); return; }
  var same=(C.contacts||[]).filter(function(x){ return x.name===v.name && (x.title||'')===v.title; })[0], r;
  if (same){ if(!confirm(v.name+(v.title?' '+v.title:'')+' 프리셋이 이미 있습니다. 연락처를 지금 값으로 바꿀까요?')) return;
    r=await sb.from('crew_contact_presets').update({ phone:v.phone||null, updated_at:new Date().toISOString() }).eq('id', same.id); }
  else r=await sb.from('crew_contact_presets').insert({ name:v.name, title:v.title||null, phone:v.phone||null });
  if (r.error) return dbErr(r.error);
  flash('담당자 프리셋을 저장했습니다.'); reloadContacts();
};
window.crewContactManage = function(keep){
  var box=document.getElementById('crCPM'); if(!box) return;
  if (!keep && box.style.display!=='none'){ box.style.display='none'; return; }
  box.style.display='block';
  box.innerHTML=(C.contacts||[]).length ? '<table class="cr-t"><tbody>'+C.contacts.map(function(x){
      return '<tr><td><b>'+e(x.name)+'</b> <span class="cr-meta">'+e(x.title||'')+'</span></td><td class="mono">'+e(fmtPhone(x.phone)||x.phone||'—')+'</td>'
        +'<td style="width:80px"><button class="tbtn danger" type="button" onclick="crewContactDel(\''+x.id+'\')">삭제</button></td></tr>'; }).join('')+'</tbody></table>'
      +'<p class="note" style="margin-top:6px">연락처를 고치려면: 불러와서 번호를 고친 뒤 [지금 담당자를 프리셋으로 저장].</p>'
    : '<p class="note" style="margin:0">저장된 담당자가 없습니다. 담당자를 적고 [지금 담당자를 프리셋으로 저장]을 누르세요.</p>';
};
window.crewContactDel = async function(id){
  var c=(C.contacts||[]).filter(function(x){ return x.id===id; })[0]; if(!c) return;
  if (!confirm('담당자 프리셋 "'+c.name+'" 을(를) 삭제합니다. 이미 저장된 프로젝트의 담당자는 그대로 남습니다.')) return;
  var r=await sb.from('crew_contact_presets').delete().eq('id', id); if (r.error) return dbErr(r.error);
  reloadContacts();
};
async function prefillContact(){   // 새 프로젝트·담당자 빈 프로젝트: 가장 최근에 쓴 담당자를 미리 채운다
  var r=await sb.from('crew_project_private').select('contact_name,contact_title,contact_phone').not('contact_name','is',null).order('updated_at',{ascending:false}).limit(1);
  var d=(r.data||[])[0]; if(!d) return;
  [['crE_cname',d.contact_name],['crE_ctitle',d.contact_title],['crE_cphone',d.contact_phone]].forEach(function(x){ var el=document.getElementById(x[0]); if (el && !el.value) el.value=x[1]||''; });
}
async function loadPrivate(pid){
  var r = await Promise.all([
    sb.from('crew_project_private').select('notes,contact_name,contact_title,contact_phone').eq('project_id', pid).maybeSingle(),
    sb.from('crew_project_files').select('*').eq('project_id', pid).order('sort').order('created_at')
  ]);
  if (C.editProject !== pid) return;
  if (r[0].error || r[1].error) { var b=document.getElementById('crPFiles'); if(b) b.textContent='자료를 불러오지 못했습니다: '+((r[0].error||r[1].error).message); return; }
  var d0=r[0].data||{};
  C.priv = { notes:d0.notes||'', contact:[d0.contact_name||'', d0.contact_title||'', d0.contact_phone||''], files:r[1].data||[] };
  var ta=document.getElementById('crE_privnotes'); if (ta && !ta.value) ta.value=C.priv.notes;
  if (!d0.contact_name && !d0.contact_phone) prefillContact();
  else [['crE_cname',0],['crE_ctitle',1],['crE_cphone',2]].forEach(function(x){ var el=document.getElementById(x[0]); if (el && !el.value) el.value=C.priv.contact[x[1]]; });
  renderPrivFiles(pid);
}
function fmtSize(b){ if(!b) return ''; return b>=1048576 ? (b/1048576).toFixed(1)+'MB' : Math.max(1,Math.round(b/1024))+'KB'; }
function renderPrivFiles(pid){
  var box=document.getElementById('crPFiles'); if(!box || !C.priv) return;
  var fs=C.priv.files;
  box.className=''; box.style.cssText='';
  box.innerHTML = '<div class="field" style="margin-bottom:6px"><label>자료 (파일·링크)</label></div>'
    + (fs.length ? '<table class="cr-t" style="margin-bottom:10px"><tbody>' + fs.map(function(f){
        return '<tr><td style="width:56px"><span class="cr-st '+(f.kind==='file'?'b':'g')+'"><i></i>'+(f.kind==='file'?'파일':'링크')+'</span></td>'
          +'<td><b>'+e(f.title)+'</b>'+(f.kind==='link'?'<div class="cr-meta" style="word-break:break-all">'+e(f.url)+'</div>':'<div class="cr-meta">'+fmtSize(f.size_bytes)+'</div>')+'</td>'
          +'<td style="width:150px"><div class="cr-actions"><button class="tbtn" onclick="crewOpenFile(\''+f.id+'\')">열기</button><button class="tbtn danger" onclick="crewDelFile(\''+f.id+'\')">삭제</button></div></td></tr>';
      }).join('') + '</tbody></table>' : '<p class="note" style="margin:0 0 10px">아직 올린 자료가 없습니다.</p>')
    + '<div class="rowflex" style="margin-bottom:8px"><label class="tbtn" style="display:inline-flex;align-items:center;cursor:pointer">파일 올리기<input type="file" multiple style="display:none" onchange="crewUpload(this)"></label>'
    + '<span class="cr-meta">PDF·엑셀·이미지·오디오 등, 파일당 50MB까지</span></div>'
    + '<div class="rowflex"><input class="cr-in" id="crLinkT" placeholder="링크 이름 (예: 큐시트 구글시트)" style="max-width:220px;font-family:inherit"><input class="cr-in" id="crLinkU" placeholder="https://…" style="max-width:320px"><button class="tbtn" onclick="crewAddLink()">링크 추가</button></div>';
}
function privFile(id){ return (C.priv&&C.priv.files||[]).filter(function(f){ return f.id===id; })[0]; }
window.crewUpload = async function(input){
  var pid=C.editProject; if(!pid || !input.files.length) return;
  var files=Array.prototype.slice.call(input.files); input.value='';
  for (var i=0;i<files.length;i++){
    var f=files[i];
    if (f.size > 52428800){ flash(f.name+' — 50MB 를 넘어 올릴 수 없습니다.', true); continue; }
    var ext=(f.name.match(/\.([A-Za-z0-9]{1,8})$/)||['',''])[1].toLowerCase();
    // 저장 경로는 영문·숫자만(한글 파일명은 스토리지 키로 못 씀). 원래 이름은 title 로 보관 → 받을 때 그 이름으로 저장됨
    var path=pid+'/'+Date.now()+'-'+Math.random().toString(36).slice(2,8)+(ext?'.'+ext:'');
    flash(f.name+' 올리는 중…');
    var up=await sb.storage.from('crew-files').upload(path, f, { contentType:f.type||'application/octet-stream', upsert:false });
    if (up.error){ dbErr(up.error); continue; }
    var r=await sb.from('crew_project_files').insert({ project_id:pid, kind:'file', title:f.name, storage_path:path, size_bytes:f.size, sort:(C.priv.files.length) });
    if (r.error){ await sb.storage.from('crew-files').remove([path]); dbErr(r.error); continue; }
  }
  flash('올렸습니다. 확정된 감독에게만 보입니다.');
  loadPrivate(pid);
};
window.crewAddLink = async function(){
  var pid=C.editProject, t=(document.getElementById('crLinkT').value||'').trim(), u=(document.getElementById('crLinkU').value||'').trim();
  if (!/^https?:\/\//i.test(u)){ flash('링크는 http:// 또는 https:// 로 시작해야 합니다.', true); return; }
  var r=await sb.from('crew_project_files').insert({ project_id:pid, kind:'link', title:t||u, url:u, sort:(C.priv.files.length) });
  if (r.error) return dbErr(r.error);
  loadPrivate(pid);
};
window.crewOpenFile = async function(id){
  var f=privFile(id); if(!f) return;
  if (f.kind==='link'){ window.open(f.url,'_blank','noopener'); return; }
  var r=await sb.storage.from('crew-files').createSignedUrl(f.storage_path, 120, { download:f.title });
  if (r.error) return dbErr(r.error);
  window.open(r.data.signedUrl,'_blank','noopener');
};
window.crewDelFile = async function(id){
  var f=privFile(id); if(!f) return;
  if (!confirm('"'+f.title+'" 을(를) 삭제합니다.')) return;
  if (f.kind==='file'){ var d=await sb.storage.from('crew-files').remove([f.storage_path]); if (d.error) return dbErr(d.error); }
  var r=await sb.from('crew_project_files').delete().eq('id', id); if (r.error) return dbErr(r.error);
  loadPrivate(C.editProject);
};

/* ── 텍스트 프리셋 (상세 내용·스탭 전달사항에 자주 쓰는 문구) ───────────── */
function presetBar(target){
  return '<div class="rowflex" style="margin:-4px 0 14px"><select class="cr-in" id="crPS_'+target+'" style="width:auto;max-width:260px;font-family:inherit">'
    + '<option value="">프리셋 불러오기…</option>'+C.presets.map(function(x){ return '<option value="'+x.id+'">'+e(x.title)+'</option>'; }).join('')+'</select>'
    + '<button class="tbtn" type="button" onclick="crewPresetInsert(\''+target+'\')">넣기</button>'
    + '<button class="tbtn" type="button" onclick="crewPresetSave(\''+target+'\')">지금 내용을 프리셋으로 저장</button>'
    + '<button class="tbtn" type="button" onclick="crewPresetManage(\''+target+'\')">프리셋 관리</button></div>'
    + '<div id="crPM_'+target+'" style="display:none;margin:-6px 0 14px"></div>';
}
function refreshPresetBars(){
  ['description','privnotes'].forEach(function(t){
    var sel=document.getElementById('crPS_'+t); if(!sel) return;
    sel.innerHTML='<option value="">프리셋 불러오기…</option>'+C.presets.map(function(x){ return '<option value="'+x.id+'">'+e(x.title)+'</option>'; }).join('');
    var pm=document.getElementById('crPM_'+t); if (pm && pm.style.display!=='none') crewPresetManage(t, true);
  });
}
async function reloadPresets(){ var r=await sb.from('crew_text_presets').select('*').order('title'); if(!r.error) C.presets=r.data||[]; refreshPresetBars(); }
window.crewPresetInsert = function(target){
  var id=document.getElementById('crPS_'+target).value; if(!id){ flash('불러올 프리셋을 고르세요.', true); return; }
  var pr=C.presets.filter(function(x){ return x.id===id; })[0]; if(!pr) return;
  var ta=document.getElementById('crE_'+target);
  ta.value = ta.value.trim() ? ta.value.replace(/\s+$/,'')+'\n\n'+pr.body : pr.body;
  ta.focus(); flash('"'+pr.title+'" 을(를) 넣었습니다. 필요한 부분만 고쳐 쓰세요.');
};
window.crewPresetSave = async function(target){
  var body=(document.getElementById('crE_'+target).value||'').trim();
  if (!body){ flash('저장할 내용이 비어 있습니다.', true); return; }
  var title=prompt('프리셋 이름 (예: 야외 공연 준비물, 복장 안내)'); if(!title) return; title=title.trim(); if(!title) return;
  var same=C.presets.filter(function(x){ return x.title===title; })[0], r;
  if (same){ if(!confirm('"'+title+'" 프리셋이 이미 있습니다. 지금 내용으로 바꿀까요?')) return;
    r=await sb.from('crew_text_presets').update({ body:body, updated_at:new Date().toISOString() }).eq('id', same.id); }
  else r=await sb.from('crew_text_presets').insert({ title:title, body:body });
  if (r.error) return dbErr(r.error);
  flash('프리셋 "'+title+'" 을(를) 저장했습니다.'); reloadPresets();
};
window.crewPresetManage = function(target, keep){
  var box=document.getElementById('crPM_'+target); if(!box) return;
  if (!keep && box.style.display!=='none'){ box.style.display='none'; return; }
  box.style.display='block';
  box.innerHTML = C.presets.length ? '<table class="cr-t"><tbody>'+C.presets.map(function(x){
      return '<tr><td style="width:200px"><b>'+e(x.title)+'</b></td><td class="cr-note" style="max-width:none">'+e(x.body.length>120?x.body.slice(0,120)+'…':x.body)+'</td>'
        +'<td style="width:80px"><button class="tbtn danger" type="button" onclick="crewPresetDel(\''+x.id+'\',\''+target+'\')">삭제</button></td></tr>'; }).join('')+'</tbody></table>'
      +'<p class="note" style="margin-top:6px">고치려면: 불러와서 내용을 고친 뒤 같은 이름으로 [지금 내용을 프리셋으로 저장].</p>'
    : '<p class="note" style="margin:0">저장된 프리셋이 없습니다. 내용을 적고 [지금 내용을 프리셋으로 저장]을 누르세요.</p>';
};
window.crewPresetDel = async function(id, target){
  var pr=C.presets.filter(function(x){ return x.id===id; })[0]; if(!pr) return;
  if (!confirm('프리셋 "'+pr.title+'" 을(를) 삭제합니다.')) return;
  var r=await sb.from('crew_text_presets').delete().eq('id', id); if (r.error) return dbErr(r.error);
  await reloadPresets(); crewPresetManage(target, true);
};
window.crewCloseEdit = function(){ document.getElementById('crPEdit').style.display='none'; C.editProject=null; };
function v(k){ var el=document.getElementById('crE_'+k); return el ? el.value.trim() : ''; }
function numOrNull(s){ s=String(s).replace(/[^\d-]/g,''); return s===''?null:Number(s); }
window.crewSaveProject = async function(){
  var row = { title:v('title'), venue:v('venue')||null, date_start:v('date_start'), date_end:v('date_end')||null, call_time:v('call_time')||null,
              roles:v('roles')||null, headcount:numOrNull(v('headcount')), description:v('description')||null, status:v('status'), is_tentative:(document.querySelector('input[name=crE_tent]:checked')||{}).value==='1', is_private:(document.querySelector('input[name=crE_priv]:checked')||{}).value==='1',
              depart_day_before:document.getElementById('crE_depart').checked, return_day_after:document.getElementById('crE_return').checked };
  if (!row.title || !row.date_start){ flash('프로젝트명과 시작일은 필수입니다.', true); return; }
  if (row.date_end && row.date_end < row.date_start){ flash('종료일이 시작일보다 빠릅니다.', true); return; }
  row.updated_at = new Date().toISOString();
  var adm = { client_name:v('client_name')||null, client_contact:v('client_contact')||null, quote_krw:manToWon(v('quote_krw')),
              other_cost_krw:manToWon(v('other_cost_krw')), bill_status:v('bill_status'), quote_vat:document.getElementById('crE_quote_vat').checked,
              memo:v('memo')||null, updated_at:new Date().toISOString() };
  try{
    var id = C.editProject, r;
    if (id){ r = await sb.from('crew_projects').update(row).eq('id', id); if (r.error) throw r.error; }
    else { r = await sb.from('crew_projects').insert(row).select('id').single(); if (r.error) throw r.error; id = r.data.id; }
    adm.project_id = id;
    r = await sb.from('crew_project_admin').upsert(adm); if (r.error) throw r.error;
    if (C.priv) {   // 불러오기 끝난 뒤(또는 새 프로젝트)만 저장 — 아직 못 읽었는데 빈 칸으로 덮어쓰지 않게
      var pn=(document.getElementById('crE_privnotes').value||'').trim();
      var cn=(document.getElementById('crE_cname').value||'').trim(), ct=(document.getElementById('crE_ctitle').value||'').trim(), cp=(document.getElementById('crE_cphone').value||'').trim();
      var had = C.priv.notes || (C.priv.contact && C.priv.contact.join(''));
      if (pn || cn || ct || cp || had){ r = await sb.from('crew_project_private').upsert({ project_id:id, notes:pn||null, contact_name:cn||null, contact_title:ct||null, contact_phone:cp||null, updated_at:new Date().toISOString() }); if (r.error) throw r.error; }
    }
    flash(C.editProject ? '저장했습니다.' : '등록했습니다.'+(row.status==='open'?' 감독 페이지에 바로 보입니다.':''));
    crewCloseEdit(); await load(); C.openProject = id; render('crew-proj');
  }catch(err){ dbErr(err); }
};
window.crewDeleteProject = async function(id){
  var p=proj(id); if(!p) return;
  var n1=appsOf(id).length;
  if (!confirm('"'+p.title+'" 프로젝트를 삭제합니다.'+(n1?'\n참여 신청 '+n1+'건과 페이 기록도 함께 지워집니다.':'')+'\n\n보통은 삭제 대신 상태를 [취소]로 바꾸는 편이 안전합니다. 계속할까요?')) return;
  var r = await sb.from('crew_projects').delete().eq('id', id);
  if (r.error) return dbErr(r.error);
  flash('삭제했습니다.'); crewCloseEdit(); if (C.openProject===id) C.openProject=null;
  document.getElementById('crPDetail').style.display='none'; await load(); render('crew-proj');
};

/* ── 프로젝트 상세: 신청자·페이·견적 요약 ─────────────────────────────── */
window.crewOpenProject = async function(id){
  C.openProject = id;
  if (curPage()!=='crew-proj') await azShow('crew-proj', true); else { crewRenderProjects(); renderProjectDetail(); }
  var d=document.getElementById('crPDetail'); if (d) d.scrollIntoView({behavior:'smooth',block:'start'});
};
function renderProjectDetail(){
  var box=document.getElementById('crPDetail'), p=proj(C.openProject);
  if (!p){ box.style.display='none'; return; }
  var pa=C.padmin[p.id]||{}, as=appsOf(p.id), cost=projCost(p.id), other=n(pa.other_cost_krw), q=pa.quote_krw, mg=projMargin(p);
  var vatQ = (q!==null&&q!==undefined&&pa.quote_vat!==false) ? Math.round(n(q)*0.1) : 0;
  var order={confirmed:0,applied:1,declined:2,cancelled:3};
  as.sort(function(a,b){ return (order[a.status]-order[b.status]) || (a.created_at<b.created_at?-1:1); });
  var assigned = {}; as.forEach(function(a){ assigned[a.user_id]=1; });
  var addable = C.members.filter(function(m){ return m.status==='active' && !assigned[m.user_id]; });
 box.innerHTML = '<h2>'+e(p.title)+tentTag(p)+' <span class="cr-meta" style="font-weight:400;margin-left:8px">'+e(dRange(p))+' · '+days(p)+'일'+(p.venue?' · '+e(p.venue):'')+'</span>'
    + '<button class="tbtn" style="float:right" onclick="crewEditProject(\''+p.id+'\')">프로젝트 수정</button></h2>'
    + '<div class="sub">'+stP(p.status,p)+(p.roles?' &nbsp; 모집: '+e(p.roles):'')+(p.call_time?' &nbsp; 콜: '+e(p.call_time):'')+(pa.client_name?' &nbsp; 클라이언트: '+e(pa.client_name)+(pa.client_contact?' ('+e(pa.client_contact)+')':''):'')+'</div>'
    + '<div class="cr-sum">'
    +   '<div><div class="l">견적 (공급가)</div><div class="v">'+won(q)+'</div></div>'
    +   '<div><div class="l">청구 총액'+(pa.quote_vat===false?'':' (VAT 포함)')+'</div><div class="v">'+(q===null||q===undefined?'—':won(n(q)+vatQ))+'</div></div>'
    +   '<div><div class="l">인건비 (페이+실비)</div><div class="v">'+won(cost)+'</div></div>'
    +   '<div><div class="l">기타 비용</div><div class="v">'+won(other)+'</div></div>'
    +   '<div><div class="l">남는 금액</div><div class="v '+(mg!==null&&mg<0?'cr-neg':'')+'">'+(mg===null?'—':won(mg))+(mg!==null&&n(q)>0?' <span class="cr-meta">'+Math.round(mg/n(q)*100)+'%</span>':'')+'</div></div>'
    +   '<div><div class="l">청구 상태</div><div class="v" style="font-family:inherit;font-size:14px">'+(pa.bill_status&&pa.bill_status!=='none'?ST_BILL[pa.bill_status]:'미청구')+'</div></div>'
    + '</div>'
    + (pa.memo?'<div class="note" style="margin:-6px 0 12px">메모: '+e(pa.memo)+'</div>':'')
    + '<div class="cr-wrap"><table class="cr-t wide"><thead><tr><th>감독</th><th>희망 포지션 · 남긴 말</th><th>상태</th><th style="min-width:110px">페이 (세전, 만원)</th><th style="min-width:96px">실비 (만원)</th><th>구분</th><th style="text-align:right">지급액</th><th>지급</th><th></th></tr></thead><tbody>'
    + (as.length ? as.map(function(a){
        var x=mem(a.user_id)||{}, py=C.pay[a.id]||{}, ma=C.madmin[a.user_id]||{}, conf=a.status==='confirmed';
        var defPay = (py.pay_krw===null||py.pay_krw===undefined) && ma.day_rate ? n(ma.day_rate)*days(p) : py.pay_krw;
        var tt = py.tax_type || (x.is_business ? 'invoice' : 'withholding');
        var c = calcPay({pay_krw:defPay, extra_krw:py.extra_krw, tax_type:tt});
        return '<tr data-app="'+a.id+'"><td><a style="cursor:pointer;text-decoration:underline" onclick="crewOpenMember(\''+a.user_id+'\')"><b>'+e(x.name||'?')+'</b></a><div class="cr-meta">'+e(x.specialty||'')+' · '+bizLabel(x)+(ma.day_rate?' · 일당 '+won(ma.day_rate):'')+'</div></td>'
          +'<td class="cr-note">'+(a.role?'<b>'+e(a.role)+'</b>\n':'')+e(a.note||'')+'</td><td>'+stA(a.status)+'</td>'
          +(conf
            ? '<td><input class="cr-in" inputmode="decimal" data-k="pay_krw" placeholder="예: 35" value="'+e(toMan(defPay))+'" oninput="crewRowCalc(this)"></td>'
             +'<td><input class="cr-in" inputmode="decimal" data-k="extra_krw" placeholder="예: 3" value="'+e(toMan(py.extra_krw))+'" oninput="crewRowCalc(this)"></td>'
             +'<td><select class="cr-in" data-k="tax_type" onchange="crewRowCalc(this)">'+Object.keys(TAX).map(function(k){ return '<option value="'+k+'"'+(tt===k?' selected':'')+'>'+TAX[k]+'</option>'; }).join('')+'</select></td>'
             +'<td class="cr-num" data-net>'+won(c.net)+'</td>'
             +'<td><label class="cr-check"><input type="checkbox" data-k="paid"'+(py.paid?' checked':'')+'> <span class="cr-meta">'+e(py.paid_at||'')+'</span></label></td>'
            : '<td colspan="5" class="cr-meta">확정하면 페이를 입력할 수 있습니다</td>')
          +'<td><div class="cr-actions">'
          + (conf ? '<button class="tbtn" onclick="crewSavePay(\''+a.id+'\')">저장</button>' : '')
          + (a.status!=='confirmed' ? '<button class="tbtn" onclick="crewSetApp(\''+a.id+'\',\'confirmed\')">확정</button>' : '')
          + (a.status==='applied'||a.status==='confirmed' ? '<button class="tbtn danger" onclick="crewSetApp(\''+a.id+'\',\'declined\')">'+(conf?'확정 취소':'거절')+'</button>' : '')
          +'</div></td></tr>';
      }).join('') : '<tr><td colspan="9" class="cr-empty">아직 신청한 감독이 없습니다.</td></tr>')
    + '</tbody></table></div>'
    + '<div class="rowflex" style="margin-top:14px"><select class="cr-in" id="crAddM" style="width:auto;max-width:260px"><option value="">감독 직접 배정…</option>'
    + addable.map(function(m){ return '<option value="'+m.user_id+'">'+e(m.name)+(m.specialty?' · '+e(m.specialty):'')+'</option>'; }).join('')
    + '</select><button class="tbtn" onclick="crewAssign(\''+p.id+'\')">확정으로 배정</button>'
    + '<span class="cr-meta">신청 없이 전화로 섭외한 경우. 감독 화면의 내 일정에 바로 뜹니다.</span></div>';
  box.style.display='block';
}
window.crewRowCalc = function(el){
  var tr=el.closest('tr'); var g=function(k){ var x=tr.querySelector('[data-k="'+k+'"]'); return x?x.value:''; };
  var c=calcPay({pay_krw:manToWon(g('pay_krw')), extra_krw:manToWon(g('extra_krw')), tax_type:g('tax_type')});
  tr.querySelector('[data-net]').textContent=won(c.net);
};
window.crewSavePay = async function(appId){
  var tr=document.querySelector('tr[data-app="'+appId+'"]'); if(!tr) return;
  var g=function(k){ var x=tr.querySelector('[data-k="'+k+'"]'); return x?x.value:''; };
  var paid=tr.querySelector('[data-k="paid"]').checked, old=C.pay[appId]||{};
  var row={ application_id:appId, pay_krw:manToWon(g('pay_krw')), extra_krw:manToWon(g('extra_krw')), tax_type:g('tax_type'),
            paid:paid, paid_at: paid ? (old.paid_at||today()) : null, updated_at:new Date().toISOString() };
  var r=await sb.from('crew_pay').upsert(row); if (r.error) return dbErr(r.error);
  flash('페이를 저장했습니다.'); await load(); render(curPage());
};
window.crewSetApp = async function(appId, status){
  var a=C.apps.filter(function(x){return x.id===appId;})[0]; if(!a) return;
  var x=mem(a.user_id)||{}, p=proj(a.project_id)||{};
  if (status==='declined' && !confirm((a.status==='confirmed'?'확정을 취소하고 거절로 바꿉니다':'신청을 거절합니다')+'\n'+(x.name||'')+' · '+(p.title||''))) return;
  var r=await sb.from('crew_applications').update({status:status}).eq('id', appId); if (r.error) return dbErr(r.error);
  if (status==='confirmed' && !C.pay[appId]){
    var ma=C.madmin[a.user_id]||{};
    await sb.from('crew_pay').upsert({ application_id:appId, pay_krw: ma.day_rate ? n(ma.day_rate)*days(p) : null,
      tax_type: x.is_business ? 'invoice' : 'withholding' });
  }
  flash(status==='confirmed' ? (x.name||'')+' 확정' : '처리했습니다.'); await load(); render(curPage());
};
window.crewAssign = async function(pid){
  var uid=document.getElementById('crAddM').value; if(!uid){ flash('배정할 감독을 고르세요.', true); return; }
  var r=await sb.from('crew_applications').insert({ project_id:pid, user_id:uid, status:'confirmed', note:'관리자 배정' }).select('id').single();
  if (r.error) return dbErr(r.error);
  var x=mem(uid)||{}, ma=C.madmin[uid]||{}, p=proj(pid)||{};
  await sb.from('crew_pay').upsert({ application_id:r.data.id, pay_krw: ma.day_rate ? n(ma.day_rate)*days(p) : null, tax_type: x.is_business?'invoice':'withholding' });
  flash((x.name||'')+' 배정 완료'); await load(); render('crew-proj');
};

/* ── 감독 ──────────────────────────────────────────────────────────────── */
/* ── 초대 코드 (사장님이 문구·횟수·만료를 정하고 바꿀 수 있음, 2026-09-24) ──────────── */
var IV_RE=/^[A-Z0-9-]{1,32}$/;
function ivExpired(v){ return v.expires_at && new Date(v.expires_at) < new Date(); }
function ivFull(v){ return v.max_uses!=null && v.use_count>=v.max_uses; }
function ivLive(v){ return !v.revoked && !ivExpired(v) && !ivFull(v); }
function ivState(v){
  if (v.revoked) return '<span class="cr-st d"><i></i>중지</span>';
  if (ivExpired(v)) return '<span class="cr-st d"><i></i>만료</span>';
  if (ivFull(v)) return '<span class="cr-st b"><i></i>다 씀</span>';
  return '<span class="cr-st g"><i></i>사용 가능</span>';
}
function ivUsers(v){ return (C.inviteUses||[]).filter(function(u){ return u.invite_id===v.id; }); }
function ivDate(ts){ return ts ? fmtDate(ts) : '무기한'; }
var IV_EDIT=null, IV_OPEN={};
function renderInvites(){
  var box=document.getElementById('crIvList'); if(!box) return;
  var all=document.getElementById('crIvAll').checked;
  var rows=C.invites.filter(function(v){ return all || ivLive(v); });
  box.innerHTML = rows.length ? '<table class="cr-t"><thead><tr><th>코드</th><th>메모</th><th>사용</th><th>만료</th><th>상태</th><th></th></tr></thead><tbody>'
    + rows.map(function(v){
        var us=ivUsers(v);
        if (IV_EDIT===v.id) return '<tr class="sel"><td><input class="cr-in" id="ivE_code" value="'+e(v.code)+'" style="width:170px;text-transform:uppercase;letter-spacing:.08em"></td>'
          +'<td><input class="cr-in" id="ivE_label" value="'+e(v.label||'')+'" style="font-family:inherit;min-width:160px"></td>'
          +'<td><input class="cr-in" id="ivE_max" type="number" min="1" value="'+(v.max_uses==null?'':v.max_uses)+'" placeholder="무제한" style="width:90px"><div class="cr-meta">지금까지 '+v.use_count+'명</div></td>'
          +'<td><input class="cr-in" id="ivE_exp" type="date" value="'+(v.expires_at?String(v.expires_at).slice(0,10):'')+'" style="width:140px"></td>'
          +'<td>'+ivState(v)+'</td>'
          +'<td><div class="cr-actions"><button class="tbtn" onclick="crewSaveInvite(\''+v.id+'\')">저장</button><button class="tbtn" onclick="crewEditInvite(null)">취소</button></div></td></tr>';
        return '<tr><td class="mono" style="font-size:14.5px;letter-spacing:.08em"><b>'+e(v.code)+'</b></td><td>'+e(v.label||'—')+'</td>'
          +'<td class="cr-num" style="text-align:left">'+(us.length?'<a style="cursor:pointer;text-decoration:underline" onclick="crewIvUsers(\''+v.id+'\')">'+v.use_count+'명</a>':v.use_count+'명')+' / '+(v.max_uses==null?'무제한':v.max_uses+'명')+'</td>'
          +'<td class="cr-date">'+e(ivDate(v.expires_at))+'</td><td>'+ivState(v)+'</td>'
          +'<td><div class="cr-actions"><button class="tbtn" onclick="crewCopyInvite(\''+v.id+'\')">안내문 복사</button><button class="tbtn" onclick="crewEditInvite(\''+v.id+'\')">수정</button>'
          +(v.revoked?'<button class="tbtn" onclick="crewToggleInvite(\''+v.id+'\',false)">다시 켜기</button>':'<button class="tbtn danger" onclick="crewToggleInvite(\''+v.id+'\',true)">중지</button>')+'</div></td></tr>'
          +(IV_OPEN[v.id]&&us.length?'<tr><td colspan="6" class="cr-note" style="max-width:none;padding-top:0">이 코드로 들어온 감독: '+us.map(function(u){ var m=mem(u.user_id); return e(m?m.name:'(탈퇴)')+' <span class="cr-meta">'+e(fmtDate(u.used_at))+'</span>'; }).join(' · ')+'</td></tr>':'');
      }).join('')
    + '</tbody></table>' : '<div class="cr-empty">'+(all?'만든 코드가 없습니다.':'쓸 수 있는 코드가 없습니다. 위에서 [코드 만들기]로 만드세요.')+'</div>';
}
function ivCode(){
  var A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789', out='', b=new Uint8Array(8); crypto.getRandomValues(b);
  for (var i=0;i<8;i++) out+=A[b[i]%A.length]; return out;
}
function ivNorm(s){ return String(s||'').trim().toUpperCase().replace(/\s+/g,'-'); }
function ivExpTs(d){ return d ? new Date(d+'T23:59:59+09:00').toISOString() : null; }   // 그날 밤 12시(한국 시간)까지
function ivErr(err){ if (/duplicate|23505|crew_invites_code_key/i.test(err.message||'')) return flash('이미 있는 코드입니다. 다른 문구로 정해 주세요.', true); if (/crew_invites_code_check/i.test(err.message||'')) return flash('코드는 영문·숫자·하이픈(-)으로 32자 안에서 정해 주세요. (예: 4827, AZ-2026)', true); dbErr(err); }
window.crewNewInvite = async function(){
  var code=ivNorm(document.getElementById('crIvCode').value), label=(document.getElementById('crIvLabel').value||'').trim()||null;
  var max=document.getElementById('crIvMax').value, exp=document.getElementById('crIvExp').value;
  if (code && !IV_RE.test(code)) return flash('코드는 영문·숫자·하이픈(-)으로 32자 안에서 정해 주세요. (예: 4827, AZ-2026)', true);
  var row={ label:label, max_uses:max?Math.max(1,parseInt(max,10)):null, expires_at:ivExpTs(exp) }, r, tries=0;
  if (code){ row.code=code; r=await sb.from('crew_invites').insert(row); }
  else do { row.code=ivCode(); r=await sb.from('crew_invites').insert(row); tries++; } while (r.error && /duplicate|23505/.test(r.error.message) && tries<5);
  if (r.error) return ivErr(r.error);
  ['crIvCode','crIvLabel','crIvMax','crIvExp'].forEach(function(id){ document.getElementById(id).value=''; });
  await load(); render('crew-members');
  var nv=C.invites.filter(function(v){ return v.code===row.code; })[0]; if (nv) crewCopyInvite(nv.id);
};
window.crewEditInvite = function(id){ IV_EDIT=id; renderInvites(); var el=document.getElementById('ivE_code'); if(el) el.focus(); };
window.crewSaveInvite = async function(id){
  var v=C.invites.filter(function(x){ return x.id===id; })[0]; if(!v) return;
  var code=ivNorm(document.getElementById('ivE_code').value), max=document.getElementById('ivE_max').value, exp=document.getElementById('ivE_exp').value;
  if (!IV_RE.test(code) && code!==v.code) return flash('코드는 영문·숫자·하이픈(-)으로 32자 안에서 정해 주세요. (예: 4827, AZ-2026)', true);
  var mx=max?Math.max(1,parseInt(max,10)):null;
  if (mx!=null && mx<v.use_count) return flash('이미 '+v.use_count+'명이 썼습니다. 사용 횟수는 '+v.use_count+' 이상으로 정해 주세요.', true);
  if (code!==v.code && !confirm('코드를 '+v.code+' → '+code+' 로 바꿉니다. 옛 코드는 바로 쓸 수 없게 됩니다.')) return;
  var r=await sb.from('crew_invites').update({ code:code, label:(document.getElementById('ivE_label').value||'').trim()||null, max_uses:mx, expires_at:ivExpTs(exp), updated_at:new Date().toISOString() }).eq('id', id);
  if (r.error) return ivErr(r.error);
  IV_EDIT=null; flash('저장했습니다.'); await load(); render('crew-members');
};
window.crewToggleInvite = async function(id, stop){
  var v=C.invites.filter(function(x){ return x.id===id; })[0]; if(!v) return;
  if (stop && !confirm('코드 '+v.code+' 를 중지합니다. 다시 켤 때까지 가입에 쓸 수 없습니다.')) return;
  var r=await sb.from('crew_invites').update({ revoked:!!stop, updated_at:new Date().toISOString() }).eq('id', id); if (r.error) return dbErr(r.error);
  await load(); render('crew-members');
};
window.crewIvUsers = function(id){ IV_OPEN[id]=!IV_OPEN[id]; renderInvites(); };
window.crewCopyInvite = function(id){
  var v=C.invites.filter(function(x){ return x.id===id; })[0]; if(!v) return;
  var lim=[v.max_uses==null?'':'선착순 '+v.max_uses+'명', v.expires_at?fmtDate(v.expires_at)+'까지':''].filter(Boolean).join(' · ');
  var t='[오디오에이지 크루 초대]\n초대 코드: '+v.code+'\n\nAudioAZ Crew 앱(App Store) 또는 https://audioaz.co.kr/crew/ 에서 회원가입하고 초대 코드 칸에 위 코드를 넣으면 바로 크루로 합류됩니다.'+(lim?'\n('+lim+')':'');
  (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function(){ flash('코드 '+v.code+' — 안내문을 복사했습니다. 문자·카톡에 붙여 넣으세요.'); }, function(){ prompt('아래 안내문을 복사하세요', t); });
};
document.addEventListener('change', function(ev){ if (ev.target && ev.target.id==='crIvAll') renderInvites(); });

window.crewRenderMembers = function(){
  var q=(document.getElementById('crMQ').value||'').trim().toLowerCase(), f=document.getElementById('crMF').value;
  var rows=C.members.filter(function(m){
    if (f && m.status!==f) return false;
    if (q && ((m.name||'')+' '+(m.specialty||'')+' '+(m.phone||'')+' '+(m.email||'')).toLowerCase().indexOf(q)<0) return false;
    return true;
  });
  document.getElementById('crMRows').innerHTML = rows.length ? rows.map(function(m){
    var ma=C.madmin[m.user_id]||{}, cnt=C.apps.filter(function(a){ return a.user_id===m.user_id && a.status==='confirmed'; }).length;
    return '<tr class="'+(C.openMember===m.user_id?'sel':'')+'"><td><b>'+e(m.name)+'</b><div class="cr-meta">'+e(m.email||'')+'</div></td><td>'+e(m.specialty||'—')+'</td><td class="mono">'+e(fmtPhone(m.phone)||m.phone||'—')+'</td>'
      +'<td>'+bizLabel(m)+(m.is_business&&m.biz_no?'<div class="cr-meta">'+e(fmtBizNo(m.biz_no)||m.biz_no)+'</div>':'')+'</td><td class="cr-num">'+won(ma.day_rate)+'</td><td>'+e(ma.grade||'—')+'</td><td class="cr-num">'+cnt+'</td><td>'+docBadges(m.user_id)+'</td><td>'+stM(m.status)+'</td>'
      +'<td><div class="cr-actions">'+(m.status==='pending'?'<button class="tbtn" onclick="crewSetMember(\''+m.user_id+'\',\'active\')">승인</button>':'')+'<button class="tbtn" onclick="crewOpenMember(\''+m.user_id+'\')">상세</button></div></td></tr>';
  }).join('') : '<tr><td colspan="10" class="cr-empty">등록된 감독이 없습니다. 위에서 초대 코드를 발급해 감독에게 보내세요.</td></tr>';
};
window.crewOpenMember = async function(uid){
  C.openMember = uid;
  if (curPage()!=='crew-members') await azShow('crew-members', true); else { crewRenderMembers(); renderMemberDetail(); }
  var d=document.getElementById('crMDetail'); if (d) d.scrollIntoView({behavior:'smooth',block:'start'});
};
function renderMemberDetail(){
  var box=document.getElementById('crMDetail'), m=mem(C.openMember);
  if (!m){ box.style.display='none'; return; }
  var ma=C.madmin[m.user_id]||{};
  var hist=C.apps.filter(function(a){ return a.user_id===m.user_id; }).map(function(a){ return {a:a,p:proj(a.project_id)||{}}; })
                 .sort(function(x,y){ return (x.p.date_start||'')<(y.p.date_start||'')?1:-1; });
  var sumNet=0, sumUnpaid=0; hist.forEach(function(h){ if(h.a.status!=='confirmed') return; var c=calcPay(C.pay[h.a.id]); sumNet+=c.net; if(!(C.pay[h.a.id]||{}).paid) sumUnpaid+=c.net; });
  function f(k,l,val,type){ return '<div class="field"><label>'+l+'</label><input id="crM_'+k+'"'+(k==='biz_no'?' data-bizno':'')+' type="'+(type||'text')+'"'+(type==='number'?' step="any"':'')+' value="'+e(val)+'"></div>'; }
  box.innerHTML = '<h2>'+e(m.name)+' <span class="cr-meta" style="font-weight:400;margin-left:8px">'+e(m.email||'')+' · 가입 '+e(fmtDate(m.created_at))+'</span></h2>'
    + '<div class="sub">'+stM(m.status)+'</div>'
    + '<div class="rowflex" style="margin-bottom:6px">'
    + (m.status!=='active'?'<button class="btn btn-pri" onclick="crewSetMember(\''+m.user_id+'\',\'active\')">승인 (활동)</button>':'')
    + (m.status==='active'?'<button class="btn btn-out" onclick="crewSetMember(\''+m.user_id+'\',\'inactive\')">비활성으로</button>':'')
    + (m.status==='inactive'?'':'')+'</div>'
    + '<div class="cr-sec">감독이 입력한 정보 (필요하면 사장님이 고칠 수 있음)</div>'
    + '<div class="grid2">'+f('name','이름',m.name)+f('phone','연락처',fmtPhone(m.phone)||m.phone,'tel')+'</div>'
    + '<div class="grid2">'+f('specialty','주 분야',m.specialty)+'<div class="field"><label>구분</label><select id="crM_is_business"><option value="0"'+(m.is_business?'':' selected')+'>개인 (3.3% 원천징수)</option><option value="1"'+(m.is_business?' selected':'')+'>사업자 (세금계산서)</option></select></div></div>'
    + '<div class="grid2">'+f('biz_name','상호',m.biz_name)+f('biz_no','사업자등록번호',fmtBizNo(m.biz_no)||m.biz_no)+'</div>'
    + '<div class="cr-grid3">'+f('bank_name','은행',m.bank_name)+f('bank_account','계좌번호',m.bank_account)+f('bank_holder','예금주',m.bank_holder)+'</div>'
    + '<div class="field"><label>경력 소개</label><textarea id="crM_career" rows="3">'+e(m.career)+'</textarea></div>'
    + '<div class="cr-sec">관리자 전용 — 감독에게 보이지 않음</div>'
    + '<div class="grid2">'+f('day_rate','기본 일당 (만원) — 확정 시 페이 자동 입력',toMan(ma.day_rate),'number')+f('grade','등급 / 포지션',ma.grade)+'</div>'
    + '<div class="field"><label>관리 메모</label><textarea id="crM_memo" rows="2">'+e(ma.memo)+'</textarea></div>'
    + '<div class="rowflex"><button class="btn btn-pri" onclick="crewSaveMember(\''+m.user_id+'\')">저장</button><button class="btn btn-out" onclick="crewCloseMember()">닫기</button></div>'
    + '<div class="cr-sec">제출 서류 (본인·관리자만 볼 수 있음)</div>'+docList(m.user_id)
    + '<div class="cr-sec">참여 기록 · 지급액 합계 '+won(sumNet)+'원 · 미지급 '+won(sumUnpaid)+'원</div>'
    + (hist.length ? '<div class="cr-wrap"><table class="cr-t"><thead><tr><th>날짜</th><th>프로젝트</th><th>상태</th><th style="text-align:right">페이</th><th style="text-align:right">지급액</th><th>지급</th></tr></thead><tbody>'
      + hist.map(function(h){ var py=C.pay[h.a.id]||{}, c=calcPay(py), conf=h.a.status==='confirmed';
          return '<tr><td class="cr-date">'+e(dRange(h.p))+'</td><td><a style="cursor:pointer;text-decoration:underline" onclick="crewOpenProject(\''+h.p.id+'\')">'+e(h.p.title)+'</a></td><td>'+stA(h.a.status)+'</td>'
            +'<td class="cr-num">'+(conf?won(py.pay_krw):'—')+'</td><td class="cr-num">'+(conf?won(c.net):'—')+'</td><td>'+(conf?(py.paid?'<span class="cr-st g"><i></i>'+e(py.paid_at||'완료')+'</span>':'<span class="cr-st a"><i></i>미지급</span>'):'')+'</td></tr>'; }).join('')
      + '</tbody></table></div>' : '<div class="cr-empty">참여 기록이 없습니다.</div>');
  box.style.display='block';
}
window.crewCloseMember = function(){ C.openMember=null; document.getElementById('crMDetail').style.display='none'; crewRenderMembers(); };
window.crewSaveMember = async function(uid){
  var g=function(k){ var el=document.getElementById('crM_'+k); return el?el.value.trim():''; };
  var row={ name:g('name'), phone:g('phone')||null, specialty:g('specialty')||null, is_business:g('is_business')==='1',
            biz_name:g('biz_name')||null, biz_no:g('biz_no')||null, bank_name:g('bank_name')||null, bank_account:g('bank_account')||null,
            bank_holder:g('bank_holder')||null, career:g('career')||null };
  if (!row.name){ flash('이름은 비울 수 없습니다.', true); return; }
  var r=await sb.from('crew_members').update(row).eq('user_id', uid); if (r.error) return dbErr(r.error);
  r=await sb.from('crew_member_admin').upsert({ user_id:uid, day_rate:manToWon(g('day_rate')), grade:g('grade')||null, memo:g('memo')||null, updated_at:new Date().toISOString() });
  if (r.error) return dbErr(r.error);
  flash('저장했습니다.'); await load(); render('crew-members');
};
window.crewSetMember = async function(uid, status){
  var m=mem(uid)||{};
  if (status==='inactive' && !confirm(m.name+' 님을 비활성으로 바꿉니다. 프로젝트 목록을 볼 수 없게 됩니다.')) return;
  var r=await sb.from('crew_members').update({status:status}).eq('user_id', uid); if (r.error) return dbErr(r.error);
  flash(status==='active' ? (m.name||'')+' 님 승인 완료' : '처리했습니다.'); await load(); render(curPage());
};

/* ── 페이 정산 ─────────────────────────────────────────────────────────── */
function settleRows(){
  var mSel=document.getElementById('crSM').value, f=document.getElementById('crSF').value;
  return C.apps.filter(function(a){ return a.status==='confirmed' && !ghost(a.user_id); }).map(function(a){ return {a:a, p:proj(a.project_id)||{}, m:mem(a.user_id)||{}, py:C.pay[a.id]||{}}; })
    .filter(function(r){ if (r.p.status==='cancelled') return false; if (mSel && ym(r.p.date_start)!==mSel) return false;
      if (f==='unpaid' && r.py.paid) return false; if (f==='paid' && !r.py.paid) return false; return true; })
    .sort(function(x,y){ return (x.p.date_start||'')<(y.p.date_start||'')?-1:1; });
}
window.crewRenderSettle = function(){
  var sel=document.getElementById('crSM'), cur=sel.value, months={};
  C.projects.forEach(function(p){ if (p.date_start) months[ym(p.date_start)]=1; }); months[ym(today())]=1;
  var ms=Object.keys(months).sort().reverse();
  if (!sel.options.length || sel.options.length !== ms.length+1){
    sel.innerHTML='<option value="">전체 기간</option>'+ms.map(function(m){ return '<option value="'+m+'">'+m.replace('-','년 ')+'월</option>'; }).join('');
    sel.value = cur || ym(today());
  }
  var rows=settleRows(), s={pay:0,extra:0,tax:0,vat:0,net:0,unpaid:0};
  rows.forEach(function(r){ var c=calcPay(r.py); s.pay+=c.pay; s.extra+=c.extra; s.tax+=c.tax; s.vat+=c.vat; s.net+=c.net; if(!r.py.paid) s.unpaid+=c.net; });
  document.getElementById('crSSum').innerHTML =
      '<div><div class="l">페이 합계 (세전)</div><div class="v">'+won(s.pay)+'</div></div>'
    + '<div><div class="l">실비</div><div class="v">'+won(s.extra)+'</div></div>'
    + '<div><div class="l">원천세 (신고·납부분)</div><div class="v">'+won(s.tax)+'</div></div>'
    + '<div><div class="l">세금계산서 VAT</div><div class="v">'+won(s.vat)+'</div></div>'
    + '<div><div class="l">실지급 합계</div><div class="v">'+won(s.net)+'</div></div>'
    + '<div><div class="l">미지급</div><div class="v '+(s.unpaid?'cr-neg':'')+'">'+won(s.unpaid)+'</div></div>';
  document.getElementById('crSRows').innerHTML = rows.length ? rows.map(function(r){
    var c=calcPay(r.py), tt=r.py.tax_type||'withholding';
    return '<tr><td class="cr-date">'+e(dRange(r.p))+'</td><td><a style="cursor:pointer;text-decoration:underline" onclick="crewOpenProject(\''+r.p.id+'\')">'+e(r.p.title)+'</a></td>'
      +'<td><b>'+e(r.m.name)+'</b></td><td style="font-size:12.5px">'+TAX[tt]+(r.m.is_business&&r.m.biz_no?'<div class="cr-meta">'+e(fmtBizNo(r.m.biz_no)||r.m.biz_no)+'</div>':'')+'</td>'
      +'<td class="cr-num">'+won(r.py.pay_krw)+'</td><td class="cr-num">'+(c.extra?won(c.extra):'—')+'</td>'
      +'<td class="cr-num">'+(c.tax?'−'+won(c.tax):(c.vat?'+'+won(c.vat):'—'))+'</td><td class="cr-num"><b>'+won(c.net)+'</b></td>'
      +'<td style="font-size:12.5px">'+(r.m.bank_account?e(r.m.bank_name||'')+' <span class="mono">'+e(r.m.bank_account)+'</span>'+(r.m.bank_holder&&r.m.bank_holder!==r.m.name?' <span class="cr-meta">('+e(r.m.bank_holder)+')</span>':''):'<span class="cr-meta">미등록</span>')+'</td>'
      +'<td><label class="cr-check"><input type="checkbox"'+(r.py.paid?' checked':'')+' onchange="crewTogglePaid(\''+r.a.id+'\',this.checked)"> <span class="cr-meta">'+e(r.py.paid_at||'')+'</span></label></td></tr>';
  }).join('') : '<tr><td colspan="10" class="cr-empty">해당 기간에 확정된 참여가 없습니다.</td></tr>';
};
window.crewTogglePaid = async function(appId, on){
  var old=C.pay[appId]||{};
  var r=await sb.from('crew_pay').upsert({ application_id:appId, pay_krw:old.pay_krw===undefined?null:old.pay_krw, extra_krw:old.extra_krw===undefined?null:old.extra_krw,
    tax_type:old.tax_type||'withholding', memo:old.memo||null, paid:on, paid_at:on?today():null, updated_at:new Date().toISOString() });
  if (r.error) return dbErr(r.error);
  flash(on?'지급 완료로 표시했습니다.':'미지급으로 되돌렸습니다.'); await load(); render('crew-settle');
};
window.crewSettleCsv = function(){
  var rows=settleRows();
  var head=['날짜','프로젝트','감독','구분','사업자등록번호','페이(세전,원)','실비(원)','원천세(원)','VAT(원)','지급액(원)','은행','계좌번호','예금주','지급','지급일'];
  var lines=[head].concat(rows.map(function(r){ var c=calcPay(r.py), tt=r.py.tax_type||'withholding';
    return [dRange(r.p), r.p.title, r.m.name, TAX[tt], fmtBizNo(r.m.biz_no)||r.m.biz_no||'', c.pay, c.extra, c.tax, c.vat, c.net, r.m.bank_name||'', r.m.bank_account||'', r.m.bank_holder||'', r.py.paid?'Y':'N', r.py.paid_at||'']; }));
  var csv='﻿'+lines.map(function(l){ return l.map(function(x){ x=String(x===null||x===undefined?'':x); if (typeof x==='string' && /^[=+\-@\t\r]/.test(x) && isNaN(Number(x))) x="'"+x; return /[",\n]/.test(x)?'"'+x.replace(/"/g,'""')+'"':x; }).join(','); }).join('\r\n');
  var a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  a.download='audioaz-crew-pay-'+(document.getElementById('crSM').value||'all')+'.csv'; document.body.appendChild(a); a.click(); a.remove();
};

})();
