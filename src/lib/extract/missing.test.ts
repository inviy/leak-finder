import { describe, expect, it } from "vitest";
import { newStatement } from "../draft";
import { findMissing } from "./missing";

describe("빠진 캡처 알려 주기", () => {
  it("휴대폰인데 기본 요금이 없으면 요금 상세 화면을 꼭 요청", () => {
    const m = newStatement("mobile");
    m.pastTotals = "44,220, 44,220";
    const h = findMissing([m]);
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ required: true });
    expect(h[0].text).toContain("요금 상세");
  });

  it("다 있으면 아무것도 요청 안 함", () => {
    const m = newStatement("mobile");
    m.planMonthlyFee = "62728";
    m.pastTotals = "60000, 61000";
    expect(findMissing([m])).toEqual([]);
  });

  it("휴대폰 화면이 없거나 지난 달이 없으면 있으면 좋아요로", () => {
    const h = newStatement("home");
    h.totalAmount = "44220";
    const hints = findMissing([h]);
    expect(hints.map((x) => x.required)).toEqual([false, false]);
  });

  it("실제 KT 캡처 3장 결과: 기본 요금 있음, 지난 달 없음 → 있으면 좋아요 1개", () => {
    const m = newStatement("mobile");
    m.planMonthlyFee = "62728";
    const d = newStatement("device");
    const h = newStatement("home");
    expect(findMissing([m, d, h])).toEqual([{ text: expect.stringContaining("최근 몇 달"), required: false }]);
  });
});

describe("카드 이용내역 기간", () => {
  it("한 달치만 있으면 기간을 늘려 달라고 (있으면 좋아요)", () => {
    expect(findMissing([], { count: 22, spanDays: 30 })).toEqual([{ text: expect.stringContaining("2~3개월"), required: false }]);
  });
  it("두 달 넘게 있으면 요청 안 함", () => {
    expect(findMissing([], { count: 40, spanDays: 70 })).toEqual([]);
  });
});
