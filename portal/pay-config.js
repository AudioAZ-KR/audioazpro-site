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
    paddle:  { clientToken: "", env: "sandbox", priceIds: { KV: "", KI: "", TALLY: "" } },
    functions: "https://lkbbenyvchddsjsihofv.supabase.co/functions/v1"
  };
})();
