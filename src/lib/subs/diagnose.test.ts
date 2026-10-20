import { describe, expect, it } from "vitest";
import { mergeFindings } from "../diagnose";
import { diagnoseSubs, type SubInput } from "./diagnose";

const subs: SubInput[] = [
  { key: "netflix", name: "넷플릭스", category: "video", monthly: 17000, used: true },
  { key: "youtube", name: "유튜브 프리미엄", category: "video", monthly: 14900, used: true },
  { key: "tving", name: "티빙", category: "video", monthly: 13900, used: true },
  { key: "chatgpt", name: "ChatGPT", category: "ai", monthly: 29000, used: true },
];

describe("구독 진단", () => {
  it("고른 것만 절감액에 (S1)", () => {
    const f = diagnoseSubs(subs.map((s) => (s.key === "chatgpt" ? { ...s, used: false } : s)));
    const s1 = f.find((x) => x.rule === "S1")!;
    expect(s1.yearlySaving).toBe(29000 * 12);
    expect(s1.kind).toBe("saving");
  });

  it("영상 3개면 확인 항목, 가장 비싼 하나 남기고 나머지 합 (S2)", () => {
    const s2 = diagnoseSubs(subs).find((x) => x.rule === "S2")!;
    expect(s2.title).toBe("영상 구독 3개");
    expect(s2.reason).toContain(`${((14900 + 13900) * 12).toLocaleString("ko-KR")}원`);
    expect(s2.yearlySaving).toBe(0);
  });

  it("안 쓴다고 고른 건 중복에서 빠짐", () => {
    const f = diagnoseSubs(subs.map((s) => (s.key === "tving" || s.key === "youtube" ? { ...s, used: false } : s)));
    expect(f.some((x) => x.rule === "S2")).toBe(false);
  });

  it("통신 고지서에 티빙이 있으면 겹침 (S3), 확인 항목 맨 앞", () => {
    const f = diagnoseSubs(subs, ["티빙 이용권"]);
    const merged = mergeFindings(f, [
      { rule: "R1", kind: "check", title: "x", reason: "x", yearlySaving: 0 },
    ]).findings;
    expect(merged[0].rule).toBe("S3");
    expect(merged[0].reason).toContain("166,800원");
  });
});
