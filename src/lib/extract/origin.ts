/**
 * 우리 화면에서 온 요청인지 확인.
 *
 * 브라우저는 POST fetch 에 Origin 헤더를 항상 붙인다. Origin 이 없거나 다른 사이트면
 * 스크립트나 남의 사이트가 유료 AI 호출을 대신 쓰려는 것으로 보고 막는다.
 * 완전한 방어는 아니고(헤더는 스크립트로 꾸밀 수 있음) 손쉬운 도용을 막는 첫 단계.
 */
export function isSameOrigin(origin: string | null, hosts: (string | null)[]): boolean {
  if (!origin) return false;
  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return false;
  }
  return hosts.some((h) => !!h && h.split(",")[0].trim().toLowerCase() === originHost);
}
