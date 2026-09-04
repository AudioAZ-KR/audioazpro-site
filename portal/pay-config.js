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
    paddle:  { clientToken: LIVE ? "" : "test_5509b9b264cb4dfca7510fdf707", env: "sandbox", priceIds: { KV: "pri_01m1p7nqc1ktc8w5tqsm95hg33", KI: "", TALLY: "pri_01m1p7tnqhs25nr9r1422kn7es" }, usd: { KV: 199, KI: null, TALLY: 99 } },   // Paddle 샌드박스 · clientToken(공개) 입력 시 해외 결제 버튼 활성
    functions: "https://lkbbenyvchddsjsihofv.supabase.co/functions/v1"
  };
})();
