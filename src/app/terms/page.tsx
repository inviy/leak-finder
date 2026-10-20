import type { Metadata } from "next";
import Link from "next/link";
import { OPERATOR } from "@/lib/operator";

export const metadata: Metadata = { title: "이용약관 - 새는돈" };

export default function TermsPage() {
  return (
    <main className="screen doc">
      <Link href="/" className="brand">&lt; 새는돈</Link>
      <h1 className="title">이용약관</h1>
      <p className="sub">새는돈은 무료이고 가입이 없어요. 쓰기 전에 아래만 알아 두세요.</p>

      <section>
        <h2>1. 어떤 서비스인가요</h2>
        <p>
          통신 고지서와 카드·통장 결제 내역을 보고, 안 쓰는 부가서비스, 받을 수 있는 할인, 끝난 약정, 겹치는 구독처럼 새는
          돈을 찾아 알려 드려요.
        </p>
      </section>

      <section>
        <h2>2. 결과는 참고용이에요</h2>
        <ul>
          <li>절약 금액은 지금 금액이 그대로 이어진다고 가정한 예상치예요.</li>
          <li>AI가 캡처를 잘못 읽을 수 있어요. 결과를 보기 전에 읽은 금액을 꼭 확인해 주세요.</li>
          <li>요금제, 할인, 약정의 최종 내용은 통신사, 카드사, 각 서비스에 확인해 주세요.</li>
          <li>해지와 변경은 직접 하셔야 해요. 새는돈은 대신 해지하거나 계정에 로그인하지 않아요.</li>
        </ul>
      </section>

      <section>
        <h2>3. 제휴 관계</h2>
        <p>
          새는돈은 통신사, 카드사, 구독 서비스와 제휴 관계가 없어요. 화면에 나오는 회사·앱 이름은 찾아가는 길을 안내하려고
          적은 것이에요. 앞으로 제휴가 생기면 해당 화면에 표시할게요.
        </p>
      </section>

      <section>
        <h2>4. 하지 말아 주세요</h2>
        <ul>
          <li>프로그램으로 자동 읽기를 반복 호출하는 것</li>
          <li>다른 사람의 고지서나 결제 내역을 그 사람 동의 없이 올리는 것</li>
          <li>서비스 운영을 방해하는 것</li>
        </ul>
      </section>

      <section>
        <h2>5. 책임의 범위</h2>
        <p>
          운영자는 서비스를 정확하게 만들려고 노력하지만, 결과만 보고 내린 결정으로 생긴 손해는 운영자의 고의나 중대한
          과실이 없는 한 책임지지 않아요. 법이 이용자에게 보장하는 권리는 이 약관으로 줄어들지 않아요.
        </p>
      </section>

      <section>
        <h2>6. 바뀌거나 멈출 때</h2>
        <p>
          약관이 바뀌면 이 페이지에 바뀐 날짜와 내용을 적어요. 장애나 비용 문제로 자동 읽기를 잠시 멈출 수 있고, 그때도 직접
          입력은 쓸 수 있어요.
        </p>
      </section>

      <section>
        <h2>7. 문의</h2>
        <p>
          {OPERATOR.name} · <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>
        </p>
        <p>
          시행일: {OPERATOR.termsEffective} · <Link href="/privacy">개인정보 처리방침</Link>
        </p>
      </section>
    </main>
  );
}
