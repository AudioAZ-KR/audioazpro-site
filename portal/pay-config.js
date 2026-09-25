// 결제 공개 설정 — 비밀키 없음 (비밀키는 Supabase Edge Function secrets에만)
// 실도메인(audioazpro.com)은 KG이니시스 실연동 채널, 스테이징·로컬은 토스페이먼츠 테스트 채널을 자동 선택
(function(){
  var LIVE = /^(www\.)?audioazpro\.com$/.test(location.hostname);
  window.AZ_PAY = {
    portone: {
      storeId: "store-6ca62eca-c701-4afc-9a20-bfb1740ebc72",
      channelKey: LIVE ? "channel-key-325b4931-df5f-45a8-bb9c-4ffb0fe327d6"   // KG이니시스 실연동 (MID MOI2215687, 바로오픈)
                       : "channel-key-7ed3eb02-87a3-46db-9c61-a79d7109251f",   // 토스페이먼츠 V2 테스트 채널 (스테이징 전용)
      live: LIVE
    },
    // 해외(달러) 결제 = 레몬스퀴지(Lemon Squeezy, Merchant of Record). 2026-09-25 스토어 승인·라이브.
    // 결제창은 서버(checkout-create)가 만들어 URL 을 돌려준다 — 브라우저에는 키가 없다.
    lemon:   { enabled: true, usd: { KV: 199, KI: null, TALLY: 99, LMAZ: null } },
    intl: true,    // 2026-09-25 해외 결제(레몬스퀴지) 라이브 오픈 — 서버 LEMON_LIVE=1·라이브 키와 함께
    functions: "https://lkbbenyvchddsjsihofv.supabase.co/functions/v1"
  };
})();
