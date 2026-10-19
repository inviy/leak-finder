/**
 * 간단한 IP 별 요청 제한 (서버 인스턴스 메모리 기준).
 * 서버리스에서는 인스턴스마다 따로 세므로 완전하지 않음. 트래픽이 생기면 외부 저장소 기반으로 교체.
 */
export const WINDOW_MS = 10 * 60 * 1000;
export const MAX_PER_WINDOW = 10;

const hits = new Map<string, number[]>();

export function allowRequest(key: string, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  // 오래된 키가 쌓이지 않게 가끔 정리
  if (hits.size > 5000) {
    for (const [k, ts] of hits) if (ts.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
  }
  return true;
}

/** 테스트용 */
export function _resetRateLimit() {
  hits.clear();
}
