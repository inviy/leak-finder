import { describe, expect, it } from "vitest";
import { diagnoseAll } from "./diagnose";
import { formatWon, newAddon, newStatement, parseWon, parseWonList, toBillInput } from "./draft";

describe("formatWon (입력칸 표시)", () => {
  it("천 단위 쉼표", () => {
    expect(formatWon("62728")).toBe("62,728");
    expect(formatWon("1000000")).toBe("1,000,000");
    expect(formatWon("430")).toBe("430");
  });
  it("숫자 아닌 글자와 앞자리 0은 버리고, 빈 값은 빈 값", () => {
    expect(formatWon("6,2a728원")).toBe("62,728");
    expect(formatWon("007")).toBe("7");
    expect(formatWon("0")).toBe("0");
    expect(formatWon("")).toBe("");
  });
  it("표시값을 다시 읽으면 원래 숫자", () => {
    expect(parseWon(formatWon("104640"))).toBe(104640);
  });
});

describe("parseWon", () => {
  it("쉼표, 원, 공백을 지움", () => {
    expect(parseWon("62,728원")).toBe(62728);
    expect(parseWon(" 1 090 ")).toBe(1090);
    expect(parseWon("")).toBeUndefined();
    expect(parseWon("원")).toBeUndefined();
  });

  it("목록: 쉼표가 천 단위와 구분자로 섞여도 읽음", () => {
    expect(parseWonList("44,220 / 104,640, 44220")).toEqual([44220, 104640, 44220]);
    expect(parseWonList("44,220, 44,220")).toEqual([44220, 44220]);
    expect(parseWonList("44220,44220")).toEqual([44220, 44220]);
    expect(parseWonList("")).toEqual([]);
  });
});

describe("toBillInput 인터넷 약정", () => {
  it("인터넷·TV 고지서만 약정 상태를 넘기고, 안 물은 값은 비움", () => {
    const h = newStatement("home");
    expect(toBillInput(h, "KT").contract).toBeUndefined();
    h.contract = "ended";
    expect(toBillInput(h, "KT").contract).toBe("ended");
    const m = newStatement("mobile");
    m.contract = "ended";
    expect(toBillInput(m, "KT").contract).toBeUndefined();
  });
});

describe("toBillInput", () => {
  it("이름이나 금액이 빈 부가서비스는 버림", () => {
    const d = newStatement("mobile");
    d.planMonthlyFee = "62,728";
    d.addons = [
      { ...newAddon(), name: "캐치콜", fee: "1,000", used: false },
      { ...newAddon(), name: "", fee: "500" },
      { ...newAddon(), name: "이름만", fee: "" },
    ];
    const b = toBillInput(d, "KT");
    expect(b.addons).toEqual([{ name: "캐치콜", monthlyFee: 1000, discount: 0, used: false }]);
    expect(b.hasSelectiveDiscount).toBeNull();
  });

  it("인터넷·TV 는 월정액을 넣어도 R1 판단 안 함", () => {
    const d = newStatement("home");
    d.planMonthlyFee = "50000";
    d.selective = "no";
    expect(diagnoseAll([toBillInput(d, "KT")]).findings).toHaveLength(0);
  });

  it("화면 입력으로 실제 고지서와 같은 결과", () => {
    const m = newStatement("mobile");
    m.planMonthlyFee = "62,728";
    m.lateFees = "1,520";
    m.addons = [
      { ...newAddon(), name: "듀얼번호", fee: "3,000", discount: "3,000", used: false },
      { ...newAddon(), name: "캐치콜", fee: "1,000", used: false },
      { ...newAddon(), name: "폰케어 파손", fee: "2,100", used: false },
      { ...newAddon(), name: "폰케어 플러스", fee: "3,455", used: false },
    ];
    const h = newStatement("home");
    h.totalAmount = "104,640";
    h.pastTotals = "44,220, 44,220";
    const r = diagnoseAll([toBillInput(m, "KT"), toBillInput(h, "KT")]);
    expect(r.yearlyTotal).toBe(78660 + 1520);
    expect(r.findings.map((f) => f.rule)).toEqual(["R2", "R5", "R1", "R6"]);
  });
});
