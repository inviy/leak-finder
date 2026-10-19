import { buildIcs, contractReminder, parseReminderQuery } from "@/lib/reminder";

/**
 * 인터넷 약정 알림 달력 파일.
 * 아이폰 Safari 는 브라우저에서 만든 파일(blob)보다 서버가 text/calendar 로 내려 준 주소를 열 때
 * 바로 "캘린더에 추가"를 보여 줌. 날짜와 정해진 문장만 쓰고 아무것도 저장하지 않음.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const now = new Date();
  const q = parseReminderQuery(url.searchParams, {
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
    day: now.getUTCDate(),
  });
  if (!q) return new Response("잘못된 알림 주소예요.", { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });

  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const ics = buildIcs(contractReminder(q.date, q.monthKnown, q.endYear, url.origin), stamp);
  return new Response(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="internet-contract-reminder.ics"',
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
