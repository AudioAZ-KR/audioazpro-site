// 결제 공개 설정 — 비밀키 없음 (비밀키는 Supabase Edge Function secrets에만)
window.AZ_PAY = {
  portone: { storeId: "store-6ca62eca-c701-4afc-9a20-bfb1740ebc72", channelKey: "channel-key-7ed3eb02-87a3-46db-9c61-a79d7109251f" },  // 테스트 채널(토스페이먼츠 V2) — 실계약 후 실연동 채널 키로 교체          // 포트원 콘솔 → 결제 연동 → 스토어 ID / 채널 키 (테스트 채널부터)
  paddle:  { clientToken: "", env: "sandbox", priceIds: { KV: "", KI: "", TALLY: "" } },
  functions: "https://lkbbenyvchddsjsihofv.supabase.co/functions/v1"
};
