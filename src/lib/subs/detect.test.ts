import { describe, expect, it } from "vitest";
import { detectSubscriptions, duplicateGroups, telecomOverlaps } from "./detect";

// 실제 명세서 모양을 흉내 낸 예시 (실제 캡처로 다시 맞출 예정)
const payments = [
  { merchant: "NETFLIX.COM", amount: 17000, date: "2026-09-03" },
  { merchant: "NETFLIX.COM", amount: 17000, date: "2026-10-03" },
  { merchant: "GOOGLE *YouTubePremium", amount: 14900, date: "2026-10-05" },
  { merchant: "티빙", amount: 13900, date: "2026-10-07" },
  { merchant: "쿠팡(와우멤버십)", amount: 7890, date: "2026-10-10" },
  { merchant: "OPENAI *CHATGPT SUBSCR", amount: 29000, date: "2026-10-12" },
  { merchant: "동네헬스장", amount: 55000, date: "2026-09-01" },
  { merchant: "동네헬스장", amount: 55000, date: "2026-10-01" },
  { merchant: "편의점", amount: 4300, date: "2026-10-02" },
  { merchant: "편의점", amount: 2100, date: "2026-10-09" },
];

describe("구독 찾기", () => {
  const found = detectSubscriptions(payments);

  it("목록에 있는 서비스는 이름으로, 최근 금액으로", () => {
    expect(found.find((f) => f.key === "netflix")).toMatchObject({ name: "넷플릭스", monthly: 17000, seen: 2, guessed: false });
    expect(found.map((f) => f.key)).toEqual(expect.arrayContaining(["youtube", "tving", "coupang", "chatgpt"]));
  });

  it("목록에 없어도 같은 곳 같은 금액 2번이면 정기결제로 보임, 금액이 다른 편의점은 아님", () => {
    expect(found.find((f) => f.key === "repeat:동네헬스장")).toMatchObject({ guessed: true, monthly: 55000 });
    expect(found.some((f) => f.name === "편의점")).toBe(false);
  });

  it("영상 구독 3개는 중복 묶음", () => {
    const g = duplicateGroups(found);
    expect(g).toHaveLength(1);
    expect(g[0].label).toBe("영상");
    expect(g[0].subs.map((s) => s.name).sort()).toEqual(["넷플릭스", "유튜브 프리미엄", "티빙"].sort());
  });

  it("통신 부가서비스에 티빙이 있는데 카드로도 결제하면 겹침", () => {
    expect(telecomOverlaps(found.map((f) => f.key), ["티빙 이용권(통신사 제휴)", "캐치콜서비스"])).toEqual(["tving"]);
    expect(telecomOverlaps(found.map((f) => f.key), ["캐치콜서비스"])).toEqual([]);
  });
});

describe("실제 카드 이용내역 (2026-10, 구독 없는 화면)", () => {
  // 사용자가 준 실제 캡처의 가맹점과 금액. 구독이 하나도 없어야 함
  const real = [
    { merchant: "건대365약국", amount: 5000, date: "2026-10-13" },
    { merchant: "주식회사 성동에너지", amount: 50000, date: "2026-10-13" },
    { merchant: "더에이스코리아(유)에이스5차점", amount: 7500, date: "2026-10-12" },
    { merchant: "악어떼 노래연습장", amount: 6000, date: "2026-10-11" },
    { merchant: "베트남쌍둥이커피", amount: 11800, date: "2026-10-11" },
    { merchant: "빵드램", amount: 16300, date: "2026-10-11" },
  ];
  it("구독으로 잘못 잡는 것이 없음", () => {
    expect(detectSubscriptions(real)).toEqual([]);
  });
});
