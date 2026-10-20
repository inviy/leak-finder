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

describe("실제 캡처에서 나온 함정 (2026-10-20 카드, 통장)", () => {
  it("실제 카드: Claude 해외 결제를 구독으로 알아봄, 주유소들은 아님", () => {
    const card = [
      { merchant: "ANTHROPIC* CLAUDE SUB(해외)", amount: 149380, date: "2026-10-06" },
      { merchant: "동일석유(주)마석동일주유소", amount: 50000, date: "2026-10-05" },
      { merchant: "(주)에이치씨씨에너지 언양(서울)", amount: 50000, date: "2026-10-03" },
      { merchant: "신창에너지(주)여주(강릉)주유소", amount: 50000, date: "2026-10-02" },
      { merchant: "천호 현대주유소", amount: 50000, date: "2026-09-20" },
    ];
    expect(detectSubscriptions(card).map((f) => f.name)).toEqual(["Claude"]);
  });

  it("실제 통장: 쿠팡와우월회비는 쿠팡 와우, ATM 출금 15만 원 두 번은 구독 아님", () => {
    const bank = [
      { merchant: "ATM출금", amount: 150000, date: "2026-10-07" },
      { merchant: "쿠팡와우월회비", amount: 7890, date: "2026-10-03" },
      { merchant: "ATM출금", amount: 150000, date: "2026-09-02" },
    ];
    expect(detectSubscriptions(bank).map((f) => f.name)).toEqual(["쿠팡 와우"]);
  });

  it("같은 주유소에 같은 금액을 한 달 안에 두 번 넣은 건 구독 아님, 한 달 간격이면 매달 같은 금액", () => {
    const sameWeek = [
      { merchant: "성수주유소", amount: 50000, date: "2026-10-02" },
      { merchant: "성수주유소", amount: 50000, date: "2026-10-09" },
    ];
    expect(detectSubscriptions(sameWeek)).toEqual([]);
    const monthly = [
      { merchant: "필라테스스튜디오", amount: 99000, date: "2026-08-25" },
      { merchant: "필라테스스튜디오", amount: 99000, date: "2026-09-25" },
    ];
    expect(detectSubscriptions(monthly)[0]).toMatchObject({ guessed: true, monthly: 99000 });
  });

  it("'자동이체'가 붙어도 알려진 구독이면 잡음", () => {
    expect(detectSubscriptions([{ merchant: "자동이체 넷플릭스", amount: 17000, date: "2026-10-03" }]).map((f) => f.name)).toEqual(["넷플릭스"]);
  });

  it("날짜가 없으면 매달인지 알 수 없어 추측하지 않음", () => {
    expect(detectSubscriptions([
      { merchant: "어딘가", amount: 10000, date: null },
      { merchant: "어딘가", amount: 10000, date: null },
    ])).toEqual([]);
  });
});
