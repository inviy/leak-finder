import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/reminder", () => {
  it("달력 형식으로 내려 주고 저장 안 함", async () => {
    const y = new Date().getUTCFullYear() + 1;
    const res = await GET(new Request(`https://leak-finder-five.vercel.app/api/reminder?d=${y}0201&e=3&y=${y}`));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
    expect(res.headers.get("content-disposition")).toContain("inline");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.text();
    expect(body).toContain(`DTSTART;VALUE=DATE:${y}0201`);
    expect(body.replace(/\r\n /g, "")).toContain("https://leak-finder-five.vercel.app");
    expect(body.replace(/\r\n /g, "")).toContain(`SUMMARY:${y}년 3월\\, 인터넷 약정 끝나요`);
  });
  it("예전 주소(m=1)도 열림", async () => {
    const y = new Date().getUTCFullYear() + 1;
    const res = await GET(new Request(`https://x/api/reminder?d=${y}1101&m=1&y=${y}`));
    expect(res.status).toBe(200);
    expect((await res.text()).replace(/\r\n /g, "")).toContain("SUMMARY:다음 달 인터넷 약정 끝나요");
  });

  it("잘못된 주소는 400", async () => {
    const res = await GET(new Request("https://x/api/reminder?d=abc&m=1&y=2027"));
    expect(res.status).toBe(400);
  });
});
