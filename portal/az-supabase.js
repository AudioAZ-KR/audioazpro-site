/* ============================================================================
 * az-supabase.js  —  AudioAZ 실인증 클라이언트 (Supabase)
 * 데모용 az-demo.js(localStorage) 대체. 페이지에서 <script src="az-demo.js"> 를
 * 이 파일로 교체하면 실제 인증/라이선스로 동작.
 *
 * ▶ 대표님 프로젝트 생성 후 아래 두 값만 채우면 됩니다 (anon 키는 공개돼도 안전):
 * ----------------------------------------------------------------------------*/
const SUPABASE_URL  = 'https://lkbbenyvchddsjsihofv.supabase.co';
const SUPABASE_ANON = 'sb_publishable_sMTkTGD-1CktZQqirrjk6Q_0mxgpRG_';  // publishable(공개) 키 · 브라우저 안전 · service_role 아님
/* ----------------------------------------------------------------------------
 * ※ service_role 키·Ed25519 개인키는 절대 여기 넣지 마세요 (프론트=공개).
 *   라이선스 발급·코드검증·서명은 서버(Edge Function)에서만. → Phase 2.
 * ==========================================================================*/

// Supabase JS v2 (CDN UMD → window.supabase). 각 HTML <head>에 아래 1줄 추가 필요:
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// 제품 메타 (UI 라벨) — DB products 테이블과 동일 id 사용
const PRODMETA = {
  KV:   { name: 'Klera Voice',      tag: 'KV'  },
  KI:   { name: 'Klera Instrument', tag: 'KI'  },
  TALLY:{ name: 'Flare Tally',      tag: 'FT'  },
  LMAZ: { name: 'Latency Meter AZ', tag: 'LM'  }
};
const TYPELABEL = { FULL:'정식', D7:'7일 체험', D14:'14일 체험', D30:'30일 체험', FREE:'무료', TEST:'테스트 (3일)' };

// ── 세션/인증 ────────────────────────────────────────────────────────────
async function session()   { const { data } = await sb.auth.getSession(); return data.session; }
async function currentUser(){ const { data } = await sb.auth.getUser();    return data.user; }

async function login(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}
async function signup(email, password, name) {
  const { data, error } = await sb.auth.signUp({
    email, password, options: {
      data: { name },                                          // name → profiles 트리거로 복사
      emailRedirectTo: location.origin + '/?welcome=1'  // 확인 링크 클릭 후 메인 홈으로 (환영 안내 + 로그인 상태)
    }
  });
  if (error) throw error;
  return data.user;                                 // 이메일 인증 필요 설정이면 확인메일 발송
}
async function logout() { await sb.auth.signOut(); }

async function resetPassword(email) {
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: location.origin + '/portal/reset-password.html'
  });
  if (error) throw error;
}
async function requireLogin(redirect = 'index.html') {
  if (!(await session())) { location.href = redirect; return false; }
  return true;
}

// ── 관리자(직원 포함) ────────────────────────────────────────────────────
// profiles.is_admin / role 로 권한 판정. RLS로 본인 프로필만 조회.
async function myProfile() {
  const u = await currentUser(); if (!u) return null;
  const { data, error } = await sb.from('profiles').select('*').eq('id', u.id).single();
  if (error) throw error;
  return data;                                      // { id,email,name,is_admin,role,... }
}
async function isAdmin() { const p = await myProfile(); return !!(p && p.is_admin); }

// ── 라이선스 조회 (본인 것만 · RLS) ──────────────────────────────────────
async function licenses() {
  const { data, error } = await sb
    .from('licenses')
    .select('*, activations(*)')
    .order('issued_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
async function licensesFor(productId) {
  return (await licenses()).filter(l => l.product_id === productId);
}
async function hasLicense(productId) {
  return (await licensesFor(productId)).some(l => l.status === 'active');
}

// 기기 활성화(바인딩) — 본인 라이선스에만 insert 허용(RLS)
async function activate(licenseId, bindingType, bindingId, label) {
  const { data, error } = await sb.from('activations')
    .insert({ license_id: licenseId, binding_type: bindingType, binding_id: bindingId, label })
    .select().single();
  if (error) throw error;
  return data;
}
async function deactivate(activationId) {
  const { error } = await sb.from('activations').delete().eq('id', activationId);
  if (error) throw error;
}

// TODO(Phase 2): redeemCode(code) → Edge Function 호출(프로모션 검증·라이선스 발급·Ed25519 서명)
// TODO(Phase 3): 결제(포트원/Paddle) → 웹훅(Edge Function) → orders/licenses 기록

window.AZ = {
  PRODMETA, TYPELABEL,
  session, currentUser, login, signup, logout, resetPassword, requireLogin,
  myProfile, isAdmin,
  licenses, licensesFor, hasLicense, activate, deactivate
};
