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
    CAZ:   { name: 'Clear Audio AZ',      tag: 'CAZ',  ver: 'v0.4.3',  file: 'ClearAudioAZ',      desc: '노이즈·잔향 제거 플러그인' },
    CIAZ:  { name: 'Clear Instrument AZ', tag: 'CIAZ', ver: 'v0.1.0',  file: 'ClearInstrumentAZ', desc: '악기 트랙 클린업' },
    TALLY: { name: 'AudioAZ Tally Host',  tag: 'TLY',  ver: 'v1.14.0', file: 'AudioAZ-Tally-Host',desc: '스마트폰 카메라 탈리' },
    LMAZ:  { name: 'Latency Meter AZ',    tag: 'LMAZ', ver: 'v1.0.0',  file: 'LatencyMeterAZ',    desc: '왕복 레이턴시 측정' }
  };
  var TYPELABEL = {
    FULL: '정식 · 영구', D7: '데모 · 7일', D14: '데모 · 14일', D30: '데모 · 30일', FREE: '무료 · 영구'
  };

  function read(k, dflt) { try { return JSON.parse(localStorage.getItem(k)) || dflt; } catch (e) { return dflt; } }
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
      list.push({ product: prod, type: type || 'FULL', key: key, at: Date.now() });
      write(LKEY, list);
      return key;
    },
    reset: function () { try { localStorage.removeItem(LKEY); localStorage.removeItem(SKEY); } catch (e) {} },

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
