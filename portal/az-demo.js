/* ===========================================================================
   AudioAZ 데모 스토어 (프론트엔드 전용 · localStorage)
   ---------------------------------------------------------------------------
   목적: 백엔드 없이 로그인 → 구매/코드 → 라이선스 발급 → 다운로드 흐름을
        혼자 끝까지 테스트하기 위한 임시 계층.
   정식 전환: 아래 함수들을 서버 API(fetch) 호출로 바꾸면 됩니다.
     login/logout  → 세션 쿠키 / Supabase Auth
     grant         → POST /api/redeem, POST /webhook (결제)  → Ed25519 서명 발급
     download      → 서명된 실제 설치 파일 URL
   =========================================================================== */
(function () {
  var SKEY = 'az_session', LKEY = 'az_licenses';

  var PRODMETA = {
    KV:   { name: 'Klera Voice',      tag: 'KV',  ver: 'v0.4.3',  file: 'KleraVoice',      desc: '노이즈·잔향 제거 플러그인', price: 49000 },
    KI:  { name: 'Klera Instrument', tag: 'KI', ver: 'v0.1.0',  file: 'KleraInstrument', desc: '악기 트랙 클린업', price: 49000 },
    TALLY: { name: 'Flare Tally',  tag: 'FT',  ver: 'v1.14.0', file: 'FlareTally',desc: '스마트폰 카메라 탈리', price: 39000 },
    LMAZ:  { name: 'Latency Meter AZ',    tag: 'LMAZ', ver: 'v1.0.0',  file: 'LatencyMeterAZ',    desc: '왕복 레이턴시 측정', price: 0 }
  };
  var TYPELABEL = {
    FULL: '정식 · 영구', D7: '체험 · 7일', D14: '체험 · 14일', D30: '체험 · 30일', FREE: '무료 · 영구'
  };

  function read(k, dflt) { try { return JSON.parse(localStorage.getItem(k)) || dflt; } catch (e) { return dflt; } }
  function localToday() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function seg() { var s = '', A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; for (var i = 0; i < 4; i++) s += A[Math.floor(Math.random() * A.length)]; return s; }

  window.AZ = {
    PRODMETA: PRODMETA,
    TYPELABEL: TYPELABEL,

    /* --- 세션 --- */
    session: function () { return read(SKEY, null); },
    login: function (email, name) {
      write(SKEY, { email: email, name: name || (email.split('@')[0]), at: Date.now() });
      return this.session();
    },
    logout: function () { try { localStorage.removeItem(SKEY); } catch (e) {} },
    requireLogin: function () {
      if (!this.session()) { location.href = 'index.html'; return false; }
      return true;
    },

    /* --- 라이선스 --- */
    licenses: function () { return read(LKEY, []); },
    hasLicense: function (prod) {
      return this.licenses().some(function (l) { return l.product === prod || l.product === 'ALL'; });
    },
    licenseFor: function (prod) {
      var ls = this.licenses();
      for (var i = 0; i < ls.length; i++) if (ls[i].product === prod || ls[i].product === 'ALL') return ls[i];
      return null;
    },
    makeKey: function (prod) {
      var tag = ((PRODMETA[prod] && PRODMETA[prod].tag) || 'AZ').toUpperCase();
      return 'AZ' + tag.slice(0, 2) + '-' + seg() + '-' + seg() + '-' + seg() + '-' + seg();
    },
    grant: function (prod, type) {
      var list = this.licenses();
      var key = this.makeKey(prod);
      list.push({ product: prod, type: type || 'FULL', key: key, at: Date.now(), binding: null });
      write(LKEY, list);
      return key;
    },
    reset: function () { try { localStorage.removeItem(LKEY); localStorage.removeItem(SKEY); } catch (e) {} },

    /* --- 가격 · 세일 (코드 없이 정가에서 할인) --- */
    // 세일: { KV: { price: 39000, start: '2026-09-01', end: '2026-09-30', at: ... }, ... }
    // 정식 전환 시 products 테이블의 sale_price / sale_from / sale_to 컬럼으로 이동.
    basePrice: function (prod) { // 콘솔에서 편집한 가격(az_prices)이 있으면 우선
      var o = read('az_prices', {}); if (o[prod] != null) return o[prod];
      var m = PRODMETA[prod]; return m ? (m.price || 0) : 0;
    },
    setBasePrice: function (prod, price) { var o = read('az_prices', {}); o[prod] = price; write('az_prices', o); },
    // DB(products 테이블)의 정가·버전을 내려받아 로컬 캐시(az_prices/az_vers)에 반영 — 관리자 콘솔에서 정한 값이 고객 화면에 적용됨
    syncCatalog: function (cb) {
      var done = function () { try { cb && cb(); } catch (e) {} };
      try {
        fetch('https://lkbbenyvchddsjsihofv.supabase.co/rest/v1/products?select=id,price_krw,version,sale_price,sale_from,sale_to,max_devices&active=is.true',
          { headers: { apikey: 'sb_publishable_sMTkTGD-1CktZQqirrjk6Q_0mxgpRG_' } })
        .then(function (r) { return r.ok ? r.json() : []; })
        .then(function (rows) {
          var pr = read('az_prices', {}), vs = read('az_vers', {}), sl = {}, md = read('az_maxdev', {});
          (rows || []).forEach(function (row) {
            if (!PRODMETA[row.id]) return;
            if (row.price_krw != null) pr[row.id] = row.price_krw; else delete pr[row.id];
            if (row.version) vs[row.id] = row.version;
            if (row.sale_price != null) sl[row.id] = { price: row.sale_price, start: row.sale_from || null, end: row.sale_to || null };
            if (row.max_devices != null) md[row.id] = row.max_devices;
          });
          write('az_prices', pr); write('az_vers', vs); write('az_maxdev', md);
          if (rows && rows.length) write('az_sales', sl); // 세일은 DB가 단일 진실 — 로컬 잔재 제거
        })
        .catch(function () {})
        .then(done);
      } catch (e) { done(); }
    },
    maxDevices: function (prod) { var o = read('az_maxdev', {}); return o[prod] != null ? o[prod] : (prod === 'TALLY' ? 1 : 2); }, // 제품별 허용 기기 수 (DB products.max_devices)
    versionOf: function (prod) { var o = read('az_vers', {}); if (o[prod]) return o[prod]; var m = PRODMETA[prod]; return m ? m.ver : ''; },
    setVersion: function (prod, ver) { var o = read('az_vers', {}); o[prod] = ver; write('az_vers', o); },
    notices: function () { return read('az_notices', []); },
    saveNotices: function (list) { write('az_notices', list); },
    sales: function () { return read('az_sales', {}); },
    setSale: function (prod, price, start, end) {
      var s = this.sales();
      s[prod] = { price: price, start: start || null, end: end || null, at: Date.now() };
      write('az_sales', s);
    },
    clearSale: function (prod) { var s = this.sales(); delete s[prod]; write('az_sales', s); },
    today: localToday, // 로컬(한국) 기준 오늘 날짜 'YYYY-MM-DD'
    saleFor: function (prod) { // 오늘 기준 유효한 세일만 반환
      var s = this.sales()[prod]; if (!s) return null;
      var today = localToday();
      if (s.start && today < s.start) return null;
      if (s.end && today > s.end) return null;
      return s;
    },
    priceOf: function (prod) { // { base: 정가, sale: 세일가|null, now: 실제 판매가 }
      var base = this.basePrice(prod), sale = this.saleFor(prod);
      return { base: base, sale: sale ? sale.price : null, now: sale ? sale.price : base };
    },

    /* --- 프로모션/할인 코드 저장소 (관리자 콘솔에서 발행 → 결제에서 대조) --- */
    // 정식 전환 시 promo_codes 테이블 + Edge Function 검증으로 이동.
    promos: function () { return read('az_promos', []); },
    savePromos: function (list) { write('az_promos', list); },
    findPromo: function (code) {
      code = String(code || '').trim().toUpperCase();
      var L = this.promos();
      for (var i = 0; i < L.length; i++) if (L[i].code === code) return L[i];
      return null;
    },
    usePromo: function (code) { // 사용 횟수 +1
      var L = this.promos();
      for (var i = 0; i < L.length; i++) if (L[i].code === code) { L[i].used = (L[i].used || 0) + 1; break; }
      this.savePromos(L);
    },

    /* --- 활성화 바인딩: 컴퓨터(기기 UUID) 또는 USB(볼륨 ID) --- */
    // 데모용 식별자. 정식 전환 시 플러그인이 실제 하드웨어 UUID / USB 볼륨ID를 읽어 서버가 서명.
    _machineId: function () { var v = read('az_machine', null); if (!v) { v = 'MAC-' + seg() + '-' + seg(); write('az_machine', v); } return v; },
    bindingLabel: function (b) {
      if (!b) return null;
      return (b.type === 'usb')
        ? { name: 'USB 드라이브', id: b.id, hint: 'USB를 꽂은 어느 컴퓨터에서든 사용' }
        : { name: '이 컴퓨터', id: b.id, hint: '이 기기에서만 사용' };
    },
    setBinding: function (prod, type, idx) {
      var list = this.licenses(), id = (type === 'usb') ? ('USB-' + seg() + '-' + seg()) : this._machineId();
      var t = (typeof idx === 'number' && list[idx] && list[idx].product === prod) ? idx : -1;
      if (t < 0) { for (var i = 0; i < list.length; i++) if (list[i].product === prod) { t = i; break; } }
      if (t >= 0) list[t].binding = { type: type, id: id, at: Date.now() };
      write(LKEY, list);
    },
    licenseAt: function (idx) { var l = this.licenses(); return l[idx] || null; },
    setNote: function (idx, note) { // 라이선스별 사용자 메모 (정식 전환 시 licenses.user_note 컬럼)
      var list = this.licenses();
      if (list[idx]) { list[idx].note = String(note || '').slice(0, 60); write(LKEY, list); }
    },
    clearBinding: function (prod) {
      var list = this.licenses();
      for (var i = 0; i < list.length; i++) if (list[i].product === prod) { list[i].binding = null; break; }
      write(LKEY, list);
    },

    /* --- 데모 다운로드: 실제 바이너리 대신 안내 텍스트 파일 --- */
    download: function (prod) {
      var m = PRODMETA[prod] || { name: prod, file: prod, ver: '' };
      var txt = '[' + m.name + ' ' + m.ver + '] — AudioAZ 데모 다운로드\n\n' +
        '이 파일은 로그인 → 구매/코드 → 다운로드 흐름을 테스트하기 위한 자리표시 파일입니다.\n' +
        '정식 출시 시 이 버튼에서 Apple 공증된 실제 설치 파일이 제공됩니다.\n\n' +
        '© AudioAZ (오디오에이지) · audioazpro.com';
      var blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = m.file + '-' + (m.ver || 'demo') + '.txt';
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 100);
    }
  };
})();
