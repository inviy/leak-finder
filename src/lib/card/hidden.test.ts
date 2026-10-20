import { describe, expect, it } from "vitest";
import type { Extracted } from "../extract/schema";
import { detectSubscriptions } from "../subs/detect";
import { diagnoseHidden } from "./hidden";

const pay = (merchant: string, amount: number, date: string | null = "2026-10-05") => ({ merchant, amount, date });
const x = (payments: Extracted["payments"], statements: Extracted["statements"] = []): Extracted => ({ statements, payments });

describe("숨은 비용 찾기", () => {
  it("H1 리볼빙: 명세서의 여러 이름(이월약정, 리볼빙 수수료)을 알아봄", () => {
    for (const m of ["일부결제금액이월약정 수수료", "리볼빙수수료", "결제금액이월 이자", "이월약정"]) {
      expect(diagnoseHidden(x([pay(m, 12345)])).map((f) => f.rule), m).toEqual(["H1"]);
    }
    const f = diagnoseHidden(x([pay("일부결제금액이월약정 수수료", 12345)]))[0];
    expect(f.kind).toBe("check");
    expect(f.reason).toContain("12,345원");
  });

  it("H3 채무면제·유예 수수료, 1년 금액까지", () => {
    const f = diagnoseHidden(x([pay("채무면제유예 수수료", 3300)]));
    expect(f.map((r) => r.rule)).toEqual(["H3"]);
    expect(f[0].reason).toContain("39,600원");
  });

  it("H2 원화결제 수수료가 찍혔으면 charged, 해외 결제만 있으면 막아 두기(prevent)", () => {
    expect(diagnoseHidden(x([pay("해외원화결제 수수료", 4200)]))[0]).toMatchObject({ rule: "H2", variant: "charged" });
    expect(diagnoseHidden(x([pay("ANTHROPIC* CLAUDE SUB(해외)", 149380)]))[0]).toMatchObject({ rule: "H2", variant: "prevent" });
  });

  it("H4 할부금 고지서의 할부수수료", () => {
    const statements: Extracted["statements"] = [
      {
        kind: "device",
        items: [
          { section: "단말기", name: "단말기 할부금", amount: 41250, discount: 0 },
          { section: "단말기", name: "단말기 할부수수료", amount: 3210, discount: 0 },
        ],
        total: 44460,
        pastTotals: [],
      },
    ];
    const f = diagnoseHidden(x([], statements));
    expect(f.map((r) => r.rule)).toEqual(["H4"]);
    expect(f[0].reason).toContain("3,210원");
  });

  it("평범한 결제만 있으면 아무것도 안 나옴 (실제 캡처 가맹점)", () => {
    expect(diagnoseHidden(x([pay("쿠팡와우월회비", 7890), pay("동일석유(주)마석동일주유소", 50000), pay("건대365약국", 5000)]))).toEqual([]);
  });

  it("수수료, 이자 줄은 매달 같은 금액이어도 구독으로 잡지 않음", () => {
    const subs = detectSubscriptions([
      pay("채무면제유예 수수료", 3300, "2026-09-05"),
      pay("채무면제유예 수수료", 3300, "2026-10-05"),
      pay("리볼빙수수료", 12000, "2026-09-05"),
      pay("리볼빙수수료", 12000, "2026-10-05"),
    ]);
    expect(subs).toEqual([]);
  });

  it("이름에 '이자', '이월'이 들어간 가게는 그대로 구독 후보 (이자카야, 이월드)", () => {
    const subs = detectSubscriptions([
      pay("동네이자카야", 30000, "2026-09-05"),
      pay("동네이자카야", 30000, "2026-10-05"),
      pay("이월드 연간회원", 9900, "2026-09-05"),
      pay("이월드 연간회원", 9900, "2026-10-05"),
    ]);
    expect(subs.map((s) => s.name).sort()).toEqual(["동네이자카야", "이월드 연간회원"]);
    expect(diagnoseHidden(x([pay("이월드 연간회원", 9900)]))).toEqual([]);
  });
});
