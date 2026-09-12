/* AudioAZ — 제품 공개 범위 스위치
 * Klera Voice는 아직 정식 판매 전이라 라이브(audioazpro.com)에서는 '출시 준비 중'으로 보이고,
 * 테스트 사이트(스테이징)·로컬에서만 실제 제품 페이지와 구매 동선이 열린다.
 * 정식 출시 때 KV_PUBLIC 을 true 로 바꾸면 라이브에도 그대로 열린다. (이 한 줄만 고치면 됨)
 * head 에서 동기 로드해야 화면 깜빡임 없이 클래스가 먼저 붙는다.
 */
(function(){
  var KV_PUBLIC = false;
  var LIVE = /^(www\.)?audioazpro\.com$/.test(location.hostname);
  var open = KV_PUBLIC || !LIVE;
  window.AZ_KV_OPEN = open;
  document.documentElement.classList.add(open ? 'kv-open' : 'kv-closed');
})();
