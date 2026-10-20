import { describe, expect, it } from "vitest";
import { isSameOrigin } from "./origin";

describe("isSameOrigin", () => {
  it("같은 호스트면 통과", () => {
    expect(isSameOrigin("https://leak-finder-five.vercel.app", ["leak-finder-five.vercel.app"])).toBe(true);
  });

  it("포트까지 맞아야 통과 (로컬 개발)", () => {
    expect(isSameOrigin("http://localhost:3100", ["localhost:3100"])).toBe(true);
    expect(isSameOrigin("http://localhost:3000", ["localhost:3100"])).toBe(false);
  });

  it("Origin 이 없으면 막음 (curl, 스크립트)", () => {
    expect(isSameOrigin(null, ["leak-finder-five.vercel.app"])).toBe(false);
  });

  it("다른 사이트면 막음", () => {
    expect(isSameOrigin("https://evil.example", ["leak-finder-five.vercel.app"])).toBe(false);
  });

  it("이상한 Origin 값이면 막음", () => {
    expect(isSameOrigin("null", ["leak-finder-five.vercel.app"])).toBe(false);
  });

  it("x-forwarded-host 의 첫 값과 대소문자 무시로 비교", () => {
    expect(isSameOrigin("https://Leak.Example", [null, "leak.example, proxy.internal"])).toBe(true);
  });
});
