import type { Metadata } from "next";
import Link from "next/link";
import { OPERATOR } from "@/lib/operator";

export const metadata: Metadata = { title: "개인정보 처리방침 - 새는돈" };

const TRANSFERS = [
  {
    to: "Anthropic, PBC",
    country: "미국",
    what: "올린 캡처 이미지(그 안에 보이는 금액, 항목 이름, 결제처 등)",
    why: "캡처를 AI로 읽어 금액과 항목을 뽑기 위해",
    keep: "받은 날부터 30일 안에 자동 삭제. 안전 시스템이 정책 위반 의심으로 판정한 경우 최대 2년, 법령이 정한 경우 그 기간",
    contact: "trust.anthropic.com",
  },
  {
    to: "Vercel Inc.",
    country: "미국",
    what: "접속 기록(IP 주소, 접속 시각, 브라우저 정보)과 처리 중인 캡처 이미지",
    why: "웹사이트를 호스팅하고 요청을 처리하기 위해",
    keep: "캡처는 처리 중에만 메모리에 있고 저장하지 않음. 접속 기록은 Vercel의 로그 보관 정책에 따른 기간",
    contact: "vercel.com/legal/privacy-policy",
  },
];

export default function PrivacyPage() {
  return (
    <main className="screen doc">
      <Link href="/" className="brand">&lt; 새는돈</Link>
      <h1 className="title">개인정보 처리방침</h1>
      <p className="sub">
        새는돈은 캡처를 읽는 동안에만 쓰고 저장하지 않아요. 다만 읽기를 맡은 AI 회사와 호스팅 회사가 미국에 있어서, 그
        내용을 아래에 모두 적었어요.
      </p>

      <section>
        <h2>1. 무엇을, 왜 처리하나요</h2>
        <ul>
          <li>
            <b>자동으로 읽기를 누르면:</b> 올린 캡처 이미지. 통신비와 정기결제에서 새는 돈을 찾기 위해서만 써요.
          </li>
          <li>
            <b>직접 입력하면:</b> 입력한 금액은 휴대폰 화면 안에서만 계산하고 서버로 보내지 않아요.
          </li>
          <li>
            <b>접속할 때 자동으로:</b> IP 주소, 접속 시각, 브라우저 정보가 호스팅 회사 로그에 남아요.
          </li>
        </ul>
        <p>
          이름, 전화번호, 카드번호, 계좌번호는 결과에서 빼도록 만들었어요. 그래도 캡처에 보이면 AI에는 전달되니, 그런 곳은
          잘라서 올려 주세요. 회원가입, 쿠키, 광고·분석 도구는 쓰지 않아요.
        </p>
      </section>

      <section>
        <h2>2. 얼마나 보관하나요</h2>
        <p>
          새는돈 서버는 캡처와 읽은 결과를 저장하지 않아요. 처리가 끝나면 메모리에서 사라져요. 처리를 맡은 회사의 보관
          기간은 3번 표에 있어요.
        </p>
      </section>

      <section>
        <h2>3. 처리를 맡기는 곳과 국외 이전</h2>
        <p>
          서비스를 하려면 꼭 필요한 일이라 아래 회사에 처리를 맡기고, 그 과정에서 개인정보가 국외로 이전돼요(개인정보
          보호법 제28조의8 제1항 제3호). 이전 시기와 방법은 모두 같아요: 자동으로 읽기를 누르거나 접속할 때마다, 암호화된
          통신(HTTPS)으로 보내요.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>받는 곳 (국가)</th>
                <th>항목</th>
                <th>목적</th>
                <th>보관 기간</th>
                <th>연락처</th>
              </tr>
            </thead>
            <tbody>
              {TRANSFERS.map((t) => (
                <tr key={t.to}>
                  <td>
                    {t.to} ({t.country})
                  </td>
                  <td>{t.what}</td>
                  <td>{t.why}</td>
                  <td>{t.keep}</td>
                  <td>{t.contact}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          <b>거부하려면:</b> 자동으로 읽기 대신 직접 입력을 쓰면 Anthropic으로 보내지 않아요. 진단 결과는 같은 규칙으로
          나오고, 금액을 손으로 넣어야 하는 차이만 있어요. Anthropic은 받은 정보를 AI 학습에 쓰지 않아요.
        </p>
      </section>

      <section>
        <h2>4. 다른 곳에 주나요</h2>
        <p>3번의 처리 위탁 말고는 누구에게도 제공하거나 팔지 않아요.</p>
      </section>

      <section>
        <h2>5. 만 14세 미만</h2>
        <p>만 14세 미만이라면 자동으로 읽기 대신 직접 입력으로 이용해 주세요.</p>
      </section>

      <section>
        <h2>6. 안전하게 지키는 방법</h2>
        <ul>
          <li>모든 통신은 HTTPS로 암호화해요.</li>
          <li>캡처와 결과를 저장하지 않고, 로그에는 오류 종류만 남겨요.</li>
          <li>다른 사이트에서 오는 요청을 막고, 요청 횟수를 제한해요.</li>
          <li>AI 이용 키는 서버에만 두고 관리자만 접근해요.</li>
        </ul>
      </section>

      <section>
        <h2>7. 내 권리</h2>
        <p>
          개인정보 열람, 정정, 삭제, 처리 정지를 요청할 수 있어요. 새는돈은 저장하는 정보가 없어서 대부분 바로 답할 수 있고,
          처리를 맡긴 회사의 기록에 대한 요청은 그 회사에 전달해 도와드려요.
        </p>
      </section>

      <section>
        <h2>8. 개인정보 보호책임자와 문의</h2>
        <p>
          {OPERATOR.name} (운영자) · <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>
        </p>
        <p>
          도움이 더 필요하면: 개인정보침해신고센터 118, 개인정보분쟁조정위원회 1833-6972, 대검찰청 1301, 경찰청 182
        </p>
      </section>

      <section>
        <h2>9. 바뀐 내용</h2>
        <p>시행일: {OPERATOR.privacyEffective}. 바뀌면 이 페이지에 바뀐 날짜와 내용을 적어요.</p>
      </section>
    </main>
  );
}
