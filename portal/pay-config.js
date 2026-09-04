// 결제 공개 설정 — 비밀키 없음 (비밀키는 Supabase Edge Function secrets에만)
window.AZ_PAY = {
  portone: { storeId: "", channelKey: "" },          // 포트원 콘솔 → 결제 연동 → 스토어 ID / 채널 키 (테스트 채널부터)
  paddle:  { clientToken: "", env: "sandbox", priceIds: { KV: "", KI: "", TALLY: "" } },
  functions: "https://lkbbenyvchddsjsihofv.supabase.co/functions/v1"
};
