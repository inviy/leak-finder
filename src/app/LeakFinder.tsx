"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { diagnoseAll, SELECTIVE_DISCOUNT_RATE, type Carrier, type ContractState, type Network, type Diagnosis, type Finding } from "@/lib/diagnose";
import { guideFor } from "@/lib/guides";
import type { Extracted } from "@/lib/extract/schema";
import { reconcile, type ReconcileWarning } from "@/lib/extract/reconcile";
import { MAX_IMAGES } from "@/lib/extract/limits";
import { contractReminder, contractReminderPath, googleCalendarUrl, planContractReminder } from "@/lib/reminder";
import {
  KIND_LABEL,
  newAddon,
  newId,
  newStatement,
  estimateContract,
  USUAL_CONTRACT_YEARS,
  formatWon,
  parseWon,
  parseWonList,
  toBillInput,
  type AddonDraft,
  type Selective,
  type StatementDraft,
  type StatementKind,
} from "@/lib/draft";

type Step = "upload" | "confirm" | "result" | "action";
/** 확인 단계는 한 화면에 질문 하나: 읽은 금액 → 안 쓰는 서비스 → 선택약정. 고치기는 따로 */
type ConfirmView =
  | { kind: "summary" }
  | { kind: "addons" }
  | { kind: "selective"; id: string }
  | { kind: "contract"; id: string }
  | { kind: "edit"; id: string };

const CARRIERS: { id: Carrier; name: string }[] = [
  { id: "SKT", name: "SKT" },
  { id: "KT", name: "KT" },
  { id: "LGU", name: "LG U+" },
  { id: "MVNO", name: "알뜰폰" },
];

interface Shot {
  id: string;
  url: string;
  name: string;
  file: File;
}

type ReadState = { status: "idle" } | { status: "reading" } | { status: "error"; message: string };

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

/** 선택약정 질문 화면의 한두 줄 설명. 결과 화면의 긴 설명(selectiveCheckReason)을 줄인 것 */
function selectiveHint(fee: number, discount?: number): string {
  const expected = Math.round(fee * SELECTIVE_DISCOUNT_RATE);
  if (!discount) return "고지서 할인 내역에 '선택약정'이 있으면 받고 있는 거예요.";
  if (Math.abs(discount - expected) <= Math.max(10, expected * 0.02))
    return `할인 ${won(discount)}이 기본 요금의 25%와 같아서, 받고 있을 가능성이 높아요.`;
  return `지금 할인 ${won(discount)}은 25%${discount < expected ? "보다 적어요" : "와 달라요"}.`;
}

export default function LeakFinder() {
  const [step, setStep] = useState<Step>("upload");
  const [carrier, setCarrier] = useState<Carrier>("KT");
  /** 알뜰폰일 때 쓰는 망. "" 은 아직 안 고름 */
  const [network, setNetwork] = useState<Network | "unknown" | "">("");
  const [shots, setShots] = useState<Shot[]>([]);
  const [statements, setStatements] = useState<StatementDraft[]>([newStatement("mobile")]);
  const [warnings, setWarnings] = useState<ReconcileWarning[]>([]);
  const [view, setView] = useState<ConfirmView>({ kind: "summary" });
  /** 선택약정을 이미 물어본 명세서 ("잘 모르겠어요"도 답으로 봄) */
  const [asked, setAsked] = useState<Set<string>>(new Set());
  const [read, setRead] = useState<ReadState>({ status: "idle" });
  const [guideKey, setGuideKey] = useState("");
  /** 이번에 "나중에 할게요"로 넘긴 것. 결과에서 다시 시작하면 비움 */
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [done, setDone] = useState<Set<string>>(new Set());
  const toggleDone = (k: string) =>
    setDone((d) => {
      const n = new Set(d);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  const autoRead = async () => {
    setRead({ status: "reading" });
    try {
      const body = new FormData();
      shots.forEach((s) => body.append("images", s.file));
      const res = await fetch("/api/extract", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) {
        setRead({ status: "error", message: data?.message ?? "읽지 못했어요. 직접 입력해 주세요." });
        return;
      }
      const r = reconcile(data as Extracted);
      setStatements(r.drafts);
      setWarnings(r.warnings);
      setAsked(new Set());
      setView({ kind: "summary" });
      setRead({ status: "idle" });
      setStep("confirm");
    } catch {
      setRead({ status: "error", message: "연결이 불안정해요. 잠시 후 다시 시도하거나 직접 입력해 주세요." });
    }
  };

  // 브라우저 안에서만 미리보기, 페이지를 떠날 때 한 번에 지움
  const shotsRef = useRef<Shot[]>([]);
  useEffect(() => {
    shotsRef.current = shots;
  }, [shots]);
  useEffect(() => () => shotsRef.current.forEach((s) => URL.revokeObjectURL(s.url)), []);

  const result: Diagnosis = useMemo(
    () =>
      diagnoseAll(statements.map((s) => toBillInput(s, carrier, network === "unknown" || network === "" ? undefined : network))),
    [statements, carrier, network],
  );

  const updateStatement = (id: string, patch: Partial<StatementDraft>) =>
    setStatements((ss) => ss.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const removeStatement = (id: string) => setStatements((ss) => ss.filter((s) => s.id !== id));

  if (step === "upload") {
    return (
      <UploadScreen
        carrier={carrier}
        onCarrier={setCarrier}
        network={network}
        onNetwork={setNetwork}
        shots={shots}
        onAddShots={(files) =>
          setShots((s) => [
            ...s,
            ...files.map((f) => ({ id: newId(), url: URL.createObjectURL(f), name: f.name, file: f })),
          ])
        }
        onRemoveShot={(id) =>
          setShots((s) => {
            const gone = s.find((x) => x.id === id);
            if (gone) URL.revokeObjectURL(gone.url);
            return s.filter((x) => x.id !== id);
          })
        }
        onNext={() => {
          // 직접 입력은 바로 입력 화면으로
          setWarnings([]);
          setView({ kind: "edit", id: statements[0].id });
          setStep("confirm");
        }}
        onAutoRead={autoRead}
        read={read}
      />
    );
  }

  if (step === "confirm") {
    const paidAddons = (d: StatementDraft) =>
      d.addons.filter((a) => (parseWon(a.fee) ?? 0) - (parseWon(a.discount) ?? 0) > 0 && a.name.trim() !== "");
    const hasPaidAddons = statements.some((d) => paidAddons(d).length > 0);
    const nextSelective = (doneIds: Set<string>) =>
      carrier === "MVNO"
        ? undefined
        : statements.find((d) => d.kind === "mobile" && d.selective === "unknown" && !doneIds.has(d.id) && (parseWon(d.planMonthlyFee) ?? 0) > 0);
    // 진행 표시: 읽은 금액(1) + 안 쓰는 서비스(있으면) + 선택약정 질문(필요한 휴대폰마다)
    const selectiveIds =
      carrier === "MVNO"
        ? []
        : statements
            .filter((d) => d.kind === "mobile" && (parseWon(d.planMonthlyFee) ?? 0) > 0 && (d.selective === "unknown" || asked.has(d.id)))
            .map((d) => d.id);
    // 인터넷·TV 약정은 인터넷·TV 고지서마다 한 번 물음
    const contractIds = statements.filter((d) => d.kind === "home" && (d.contract === "" || asked.has(d.id))).map((d) => d.id);
    const nextContract = (doneIds: Set<string>) =>
      statements.find((d) => d.kind === "home" && d.contract === "" && !doneIds.has(d.id));
    const totalSteps = 1 + (hasPaidAddons ? 1 : 0) + selectiveIds.length + contractIds.length;
    const afterAddons = (doneIds = asked) => {
      const n = nextSelective(doneIds);
      const c = nextContract(doneIds);
      if (n) setView({ kind: "selective", id: n.id });
      else if (c) setView({ kind: "contract", id: c.id });
      else setStep("result");
    };
    const answered = (id: string) => {
      const doneIds = new Set(asked).add(id);
      setAsked(doneIds);
      afterAddons(doneIds);
    };

    if (view.kind === "edit") {
      const d = statements.find((x) => x.id === view.id) ?? statements[0];
      const w = warnings.filter((x) => x.label === d.label);
      return (
        <main className="screen">
          <button className="link-btn" onClick={() => setView({ kind: "summary" })}>&lt; 읽은 금액</button>
          <h1 className="title">{d.label} 고치기</h1>
          {w.map((x, i) => (
            <div key={i} className="warn" role="status">{x.message}</div>
          ))}
          <StatementForm
            key={d.id}
            draft={d}
            onChange={(p) => updateStatement(d.id, p)}
            onRemove={
              statements.length > 1
                ? () => {
                    removeStatement(d.id);
                    setView({ kind: "summary" });
                  }
                : undefined
            }
          />
          <div className="spacer" />
          <div className="cta-bar">
            <button className="btn" onClick={() => setView({ kind: "summary" })}>다 고쳤어요</button>
          </div>
        </main>
      );
    }

    if (view.kind === "addons") {
      const rows = statements.flatMap((d) => paidAddons(d).map((a) => ({ d, a })));
      const picked = rows.filter((r) => !r.a.used);
      const monthly = picked.reduce((s, r) => s + (parseWon(r.a.fee) ?? 0) - (parseWon(r.a.discount) ?? 0), 0);
      const hidden = statements.reduce((s, d) => s + d.addons.length - paidAddons(d).length, 0);
      return (
        <main className="screen">
          <TopBar backLabel="이전" onBack={() => setView({ kind: "summary" })} at={2} total={totalSteps} />
          <div>
            <h1 className="title">안 쓰는 서비스를<br />골라 주세요</h1>
            <p className="sub">돈이 나가는 부가서비스만 모았어요.</p>
          </div>
          <ul className="pick-list">
            {rows.map(({ d, a }) => {
              const net = (parseWon(a.fee) ?? 0) - (parseWon(a.discount) ?? 0);
              const on = !a.used;
              return (
                <li key={a.id}>
                  <button
                    className="pick"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() =>
                      updateStatement(d.id, { addons: d.addons.map((x) => (x.id === a.id ? { ...x, used: !x.used } : x)) })
                    }
                  >
                    <span className="pick-mark" aria-hidden />
                    <span className="pick-name">{a.name}</span>
                    <span className="pick-amt">월 {won(net)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {hidden > 0 && <p className="note">할인으로 0원인 서비스 {hidden}개는 뺐어요.</p>}
          <div className="spacer" />
          <div className="cta-bar">
            <p className={monthly > 0 ? "live on" : "live"} aria-live="polite">
              {monthly > 0 ? <>끄면 1년에 <b>{won(monthly * 12)}</b> 아껴요</> : "고른 서비스가 없어요"}
            </p>
            <button className="btn" onClick={() => afterAddons()}>{picked.length > 0 ? "다음" : "다 쓰고 있어요"}</button>
          </div>
        </main>
      );
    }

    if (view.kind === "selective") {
      const d = statements.find((x) => x.id === view.id);
      if (!d) return null;
      const answer = (v: Selective) => {
        updateStatement(d.id, { selective: v });
        answered(d.id);
      };
      return (
        <main className="screen">
          <TopBar
            backLabel="이전"
            onBack={() => setView(hasPaidAddons ? { kind: "addons" } : { kind: "summary" })}
            at={1 + (hasPaidAddons ? 1 : 0) + selectiveIds.indexOf(d.id) + 1}
            total={totalSteps}
          />
          <div>
            <h1 className="title">요금 25% 할인을<br />받고 있나요?</h1>
            <p className="sub">통신사에서는 &apos;선택약정&apos;이라고 불러요.<br />{selectiveHint(parseWon(d.planMonthlyFee) ?? 0, parseWon(d.planDiscount))}</p>
          </div>
          <div className="choice-list">
            <button className="choice" onClick={() => answer("yes")}>받고 있어요</button>
            <button className="choice" onClick={() => answer("no")}>
              안 받아요
              <span>신청하면 1년에 약 {won(Math.round((parseWon(d.planMonthlyFee) ?? 0) * SELECTIVE_DISCOUNT_RATE) * 12)}을 아낄 수 있어요</span>
            </button>
            <button className="choice" onClick={() => answer("unknown")}>잘 모르겠어요<span>결과에서 확인하는 방법을 알려 드려요</span></button>
          </div>
        </main>
      );
    }

    if (view.kind === "contract") {
      const d = statements.find((x) => x.id === view.id);
      if (!d) return null;
      const thisYear = new Date().getFullYear();
      const pickYear = (y: number) => {
        updateStatement(d.id, { installYear: y, contract: estimateContract(y, thisYear) });
        answered(d.id);
      };
      const dontKnow = () => {
        updateStatement(d.id, { installYear: undefined, contract: "unknown" });
        answered(d.id);
      };
      // 고르기 전에 무슨 뜻인지 바로 보이게 (보통 3년 약정 기준)
      const meaning = (y: number) => {
        const e = estimateContract(y, thisYear);
        return e === "ended" ? "약정이 끝났을 가능성이 높아요" : e === "soon" ? "올해 약정이 끝나요" : `${y + USUAL_CONTRACT_YEARS}년에 끝나요`;
      };
      const years = [thisYear - 4, thisYear - 3, thisYear - 2, thisYear - 1, thisYear];
      const prev = selectiveIds.at(-1);
      return (
        <main className="screen">
          <TopBar
            backLabel="이전"
            onBack={() =>
              setView(prev ? { kind: "selective", id: prev } : hasPaidAddons ? { kind: "addons" } : { kind: "summary" })
            }
            at={1 + (hasPaidAddons ? 1 : 0) + selectiveIds.length + contractIds.indexOf(d.id) + 1}
            total={totalSteps}
          />
          <div>
            <h1 className="title">인터넷,<br />언제 설치했어요?</h1>
            <p className="sub">대략 연도만 골라 주세요. 약정이 끝났는지 알려 드려요.</p>
          </div>
          <div className="choice-list compact">
            {years.map((y, i) => (
              <button key={y} className="choice" onClick={() => pickYear(y)}>
                {i === 0 ? `${y}년이나 그 전` : `${y}년`}
                <span>{meaning(y)}</span>
              </button>
            ))}
            <button className="choice" onClick={dontKnow}>잘 모르겠어요</button>
          </div>
        </main>
      );
    }

    // summary: 읽은 금액이 맞는지만 묻는 첫 화면
    const total = statements.reduce((s, d) => s + (parseWon(d.totalAmount) ?? 0), 0);
    const describe = (d: StatementDraft) => {
      const parts: string[] = [];
      if (d.addons.length) parts.push(`부가서비스 ${d.addons.length}개`);
      if (parseWon(d.lateFees)) parts.push(`연체료 ${won(parseWon(d.lateFees) ?? 0)}`);
      if (parseWonList(d.pastTotals).length) parts.push(`지난 달 ${parseWonList(d.pastTotals).length}개월`);
      return parts.join(", ");
    };
    return (
      <main className="screen">
        <TopBar backLabel="처음으로" onBack={() => setStep("upload")} at={1} total={totalSteps} />
        <div>
          <h1 className="title">이번 달 {total > 0 ? won(total) : "통신비"},<br />이렇게 읽었어요</h1>
          <p className="sub">고지서와 다르면 눌러서 고쳐 주세요.</p>
        </div>
        <ul className="sum-list">
          {statements.map((d) => {
            const w = warnings.find((x) => x.label === d.label);
            return (
              <li key={d.id}>
                <button className="sum-row" onClick={() => setView({ kind: "edit", id: d.id })}>
                  <span className="sum-main">
                    <span className="sum-label">{d.label}</span>
                    <span className="sum-amt">{d.totalAmount ? won(parseWon(d.totalAmount) ?? 0) : "금액 없음"}</span>
                  </span>
                  {describe(d) && <span className="sum-desc">{describe(d)}</span>}
                  {w && <span className="sum-warn">{w.short}</span>}
                </button>
              </li>
            );
          })}
        </ul>
        <details className="more">
          <summary>고지서 더 넣기</summary>
          <div className="chips">
            {(Object.keys(KIND_LABEL) as StatementKind[]).map((k) => (
              <button
                key={k}
                className="chip"
                onClick={() => {
                  const s2 = newStatement(k);
                  setStatements((ss) => [...ss, s2]);
                  setView({ kind: "edit", id: s2.id });
                }}
              >
                + {KIND_LABEL[k]}
              </button>
            ))}
          </div>
        </details>
        <div className="spacer" />
        <div className="cta-bar">
          <button className="btn" onClick={() => (hasPaidAddons ? setView({ kind: "addons" }) : afterAddons())}>맞아요</button>
        </div>
      </main>
    );
  }

  if (step === "action") {
    const keys = result.findings.map(findingKey);
    // 다음 할 일: 지금 것 뒤에서 아직 안 한 것, 없으면 결과로
    const goNext = (from: string, doneNow: Set<string>) => {
      const i = keys.indexOf(from);
      const next = [...keys.slice(i + 1), ...keys.slice(0, i)].find((k) => !doneNow.has(k) && !skipped.has(k));
      if (next) setGuideKey(next);
      else setStep("result");
    };
    return (
      <ActionScreen
        carrier={carrier}
        result={result}
        activeKey={guideKey}
        done={done}
        onDone={(k) => {
          const n = new Set(done).add(k);
          setDone(n);
          goNext(k, n);
        }}
        onUndo={toggleDone}
        onLater={(k) => {
          setSkipped((x) => new Set(x).add(k));
          goNext(k, new Set([...done, k]));
        }}
        onBack={() => setStep("result")}
      />
    );
  }

  return (
    <ResultScreen
      result={result}
      done={done}
      onBack={() => {
        setView({ kind: "summary" });
        setStep("confirm");
      }}
      onOpenGuide={(k) => {
        setSkipped(new Set());
        setGuideKey(k);
        setStep("action");
      }}
    />
  );
}

/** 뒤로 가기 + 몇 번째 질문인지. 질문이 하나뿐이면 진행 표시는 숨김 */
function TopBar(props: { backLabel: string; onBack: () => void; at: number; total: number }) {
  const { backLabel, onBack, at, total } = props;
  return (
    <div className="top-row">
      <button className="link-btn" onClick={onBack}>&lt; {backLabel}</button>
      {total > 1 && (
        <div className="top-row" aria-label={`${total}단계 중 ${at}단계`}>
          <span className="step-count" aria-hidden>{at}/{total}</span>
          <div className="progress" aria-hidden>
            {Array.from({ length: total }, (_, i) => (
              <span key={i} className={i < at ? "on" : undefined} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function UploadScreen(props: {
  carrier: Carrier;
  onCarrier: (c: Carrier) => void;
  network: Network | "unknown" | "";
  onNetwork: (n: Network | "unknown") => void;
  shots: Shot[];
  onAddShots: (files: File[]) => void;
  onRemoveShot: (id: string) => void;
  onNext: () => void;
  onAutoRead: () => void;
  read: ReadState;
}) {
  const { carrier, onCarrier, network, onNetwork, shots, onAddShots, onRemoveShot, onNext, onAutoRead, read } = props;
  const reading = read.status === "reading";
  return (
    <main className="screen">
      <div className="brand">새는돈</div>
      <div>
        <h1 className="title">통신비,<br />1년에 얼마나 새고 있을까요?</h1>
        <p className="sub">고지서 화면 캡처로 알려드려요. 가입은 필요 없어요.</p>
      </div>

      <div className="field">
        <span className="label">내 통신사</span>
        <div className="chips">
          {CARRIERS.map((c) => (
            <button key={c.id} className="chip" aria-pressed={carrier === c.id} onClick={() => onCarrier(c.id)}>
              {c.name}
            </button>
          ))}
        </div>
        {carrier === "MVNO" && (
          <div className="field sub-field">
            <span className="label">어느 통신사 망을 쓰나요?</span>
            <div className="chips">
              {(
                [
                  ["SKT", "SKT망"],
                  ["KT", "KT망"],
                  ["LGU", "LG U+망"],
                  ["unknown", "모르겠어요"],
                ] as [Network | "unknown", string][]
              ).map(([v, t]) => (
                <button key={v} className="chip" aria-pressed={network === v} onClick={() => onNetwork(v)}>
                  {t}
                </button>
              ))}
            </div>
            <p className="note">가입한 알뜰폰 요금제 정보에 적혀 있어요.</p>
          </div>
        )}
        <div className="guide">
          통신사 앱이나 홈페이지의 <b>요금 조회</b>에서 이 화면들을 캡처해 주세요.
          <ol>
            <li>요금 상세 내역 (휴대폰, 인터넷·TV 각각)</li>
            <li>할인 내역</li>
            <li>최근 12개월 요금 조회 (월별 청구 합계, 있으면)</li>
          </ol>
        </div>
      </div>

      <label className="drop">
        <strong>캡처 올리기 (여러 장 가능)</strong>
        <span>PNG, JPG 캡처를 {MAX_IMAGES}장까지 올릴 수 있어요.</span>
        <input
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            // 입력칸을 비우면 FileList 도 비워지므로, 상태에 넣기 전에 배열로 복사해 둠.
            // (복사 없이 넘기면 화면이 한 번 다시 그려진 뒤에는 빈 목록이 들어감: 통신사를 바꾼 뒤 업로드 실패)
            const picked = Array.from(e.target.files ?? []);
            if (picked.length) onAddShots(picked);
            e.target.value = "";
          }}
        />
      </label>

      {shots.length > 0 && (
        <div className="thumbs">
          {shots.map((s) => (
            <div key={s.id} className="thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.url} alt={s.name} />
              <button aria-label={`${s.name} 빼기`} onClick={() => onRemoveShot(s.id)}>✕</button>
            </div>
          ))}
        </div>
      )}

      {read.status === "error" && (
        <div className="warn" role="alert">{read.message}</div>
      )}

      <p className="note">
        자동으로 읽기를 누르면 캡처를 분석 서버로 보내 금액만 읽고, 읽은 뒤 바로 지워요. 저장하지 않아요.
        이름, 전화번호는 읽지 않아요.
      </p>

      <div className="spacer" />
      {shots.length > 0 ? (
        <>
          <button className="btn" onClick={onAutoRead} disabled={reading || shots.length > MAX_IMAGES}>
            {reading ? "읽는 중..." : shots.length > MAX_IMAGES ? `${MAX_IMAGES}장까지만 올려 주세요` : "자동으로 읽기"}
          </button>
          {reading && (
            <p className="note center" role="status">
              캡처 장수에 따라 10~30초 걸려요. 이 화면을 닫지 말고 기다려 주세요.
            </p>
          )}
          <button className="btn secondary" onClick={onNext} disabled={reading}>직접 입력하기</button>
        </>
      ) : (
        <button className="btn secondary" onClick={onNext}>캡처 없이 직접 입력</button>
      )}
    </main>
  );
}

function WonInput(props: { value: string; onChange: (v: string) => void; label: string; placeholder?: string }) {
  return (
    <div className="won">
      <input
        className="input"
        inputMode="numeric"
        aria-label={props.label}
        placeholder={props.placeholder ?? "0"}
        value={formatWon(props.value)}
        // 저장은 숫자만, 보이는 값은 천 단위 쉼표
        onChange={(e) => props.onChange(e.target.value.replace(/[^\d]/g, ""))}
      />
    </div>
  );
}

function StatementForm(props: {
  draft: StatementDraft;
  onChange: (p: Partial<StatementDraft>) => void;
  onRemove?: () => void;
}) {
  const { draft: d, onChange, onRemove } = props;
  const setAddon = (id: string, p: Partial<AddonDraft>) =>
    onChange({ addons: d.addons.map((a) => (a.id === id ? { ...a, ...p } : a)) });

  return (
    <div className="card">
      {d.kind === "mobile" && (
        <>
          <label className="field">
            <span>요금제 기본 요금 (할인 전)</span>
            <WonInput label="기본 요금" value={d.planMonthlyFee} onChange={(v) => onChange({ planMonthlyFee: v })} />
          </label>
          <label className="field">
            <span>기본 요금에서 할인된 금액</span>
            <WonInput label="기본 요금 할인" value={d.planDiscount} onChange={(v) => onChange({ planDiscount: v })} />
          </label>
          <div className="field">
            <span>요금 25% 할인 (선택약정)</span>
            <div className="seg">
              {(
                [
                  ["yes", "받는 중"],
                  ["no", "안 받음"],
                  ["unknown", "모르겠음"],
                ] as [Selective, string][]
              ).map(([v, t]) => (
                <button key={v} aria-pressed={d.selective === v} onClick={() => onChange({ selective: v })}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {d.kind === "home" && (
        <div className="field">
          <span>인터넷 약정</span>
          <div className="seg">
            {(
              [
                ["ended", "끝남"],
                ["soon", "곧 끝남"],
                ["long", "많이 남음"],
                ["unknown", "모름"],
              ] as [ContractState, string][]
            ).map(([v, t]) => (
              <button key={v} aria-pressed={d.contract === v} onClick={() => onChange({ contract: v })}>
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      {d.kind !== "device" && (
        <div className="field">
          <span>유료 부가서비스 (이용금액 / 할인금액)</span>
          {d.addons.some((a) => (parseWon(a.fee) ?? 0) - (parseWon(a.discount) ?? 0) > 0) && (
            <p className="hint">
              안 쓰는 서비스는 <b>쓰고 있음</b> 체크를 풀어 주세요. 체크를 푼 것만 1년 절감액에 들어가요.
            </p>
          )}
          {d.addons.map((a) => (
            <div key={a.id} className="card" style={{ padding: 12, gap: 8 }}>
              <div className="addon-name">
                <textarea
                  className="input"
                  rows={1}
                  aria-label="부가서비스 이름"
                  placeholder="이름"
                  value={a.name}
                  onChange={(e) => setAddon(a.id, { name: e.target.value.replace(/\n/g, " ") })}
                />
                <button
                  className="icon-btn"
                  aria-label={`${a.name || "부가서비스"} 빼기`}
                  onClick={() => onChange({ addons: d.addons.filter((x) => x.id !== a.id) })}
                >
                  ✕
                </button>
              </div>
              <div className="addon-amounts">
                <WonInput label={`${a.name || "부가서비스"} 이용금액`} placeholder="이용 0" value={a.fee} onChange={(v) => setAddon(a.id, { fee: v })} />
                <WonInput
                  label={`${a.name || "부가서비스"} 할인금액`}
                  placeholder="할인 0"
                  value={a.discount}
                  onChange={(v) => setAddon(a.id, { discount: v })}
                />
              </div>
              <label className="addon-used">
                <input type="checkbox" checked={a.used} onChange={(e) => setAddon(a.id, { used: e.target.checked })} />
                쓰고 있음
              </label>
            </div>
          ))}
          <button className="btn secondary" onClick={() => onChange({ addons: [...d.addons, newAddon()] })}>
            + 부가서비스 추가
          </button>
        </div>
      )}

      <label className="field">
        <span>연체료 (고지서의 가산금, 미납가산금)</span>
        <WonInput label="연체료" value={d.lateFees} onChange={(v) => onChange({ lateFees: v })} />
      </label>

      <label className="field">
        <span>이번 달 청구 합계</span>
        <WonInput label="이번 달 청구 합계" value={d.totalAmount} onChange={(v) => onChange({ totalAmount: v })} />
      </label>

      <label className="field">
        <span>지난 달들 청구 합계 (쉼표로 구분, 2개월 이상)</span>
        <input
          className="input"
          placeholder="예) 44,220, 44,220"
          value={d.pastTotals}
          onChange={(e) => onChange({ pastTotals: e.target.value })}
        />
      </label>

      {onRemove && (
        <button className="link-btn" onClick={onRemove}>이 고지서 빼기</button>
      )}
    </div>
  );
}

const findingKey = (f: Finding) => `${f.source ?? ""}:${f.rule}:${f.kind}`;

/** 결과, 조치 화면에서 쓰는 짧은 할 일 이름 */
function taskTitle(f: Finding): string {
  if (f.rule === "R2" && f.kind === "saving") return f.title.replace("안 쓰는 부가서비스", "안 쓰는 서비스") + " 끄기";
  return guideFor(f.rule, f.kind, undefined, f.variant).title;
}

function ResultScreen(props: {
  result: Diagnosis;
  done: Set<string>;
  onBack: () => void;
  onOpenGuide: (key: string) => void;
}) {
  const { result, done, onBack, onOpenGuide } = props;
  const [copied, setCopied] = useState(false);
  const tasks = result.findings;
  const left = tasks.filter((f) => !done.has(findingKey(f)));
  const savedSoFar = tasks
    .filter((f) => f.kind === "saving" && done.has(findingKey(f)))
    .reduce((s, f) => s + f.yearlySaving, 0);
  const allDone = tasks.length > 0 && left.length === 0;

  const share = async () => {
    const text = `새는돈: 지금 그대로 두면 1년에 ${won(result.yearlyTotal)} 새고 있대요.`;
    // 받은 사람이 바로 해 볼 수 있게 주소를 같이 보냄
    const url = window.location.origin;
    try {
      if (navigator.share) await navigator.share({ text, url });
      else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setCopied(true);
      }
    } catch {
      /* 사용자가 공유를 취소함 */
    }
  };

  return (
    <main className="screen">
      <div className="top-row">
        <button className="link-btn" onClick={onBack}>&lt; 입력 고치기</button>
        <button className="link-btn" onClick={share}>{copied ? "주소 복사됨" : "공유"}</button>
      </div>

      <div className="hero">
        {allDone ? (
          <>
            <span className="small">할 일을 다 했어요</span>
            <span className="big">{won(savedSoFar)}</span>
            <span className="small">1년 동안 이만큼 덜 새요.</span>
          </>
        ) : savedSoFar > 0 ? (
          <>
            <span className="small">아직 1년에</span>
            <span className="big">{won(result.yearlyTotal - savedSoFar)}</span>
            <span className="small">새고 있어요. 벌써 {won(savedSoFar)}은 막았어요.</span>
          </>
        ) : (
          <>
            <span className="small">지금 그대로 두면 1년에</span>
            <span className="big">{won(result.yearlyTotal)}</span>
            <span className="small">{result.yearlyTotal > 0 ? "새고 있어요." : "새는 돈은 못 찾았어요."}</span>
          </>
        )}
      </div>

      {tasks.length > 0 ? (
        <>
          <p className="section-title">
            {allDone ? "한 일" : `할 일 ${left.length}개`}
          </p>
          <ul className="sum-list">
            {tasks.map((f) => {
              const k = findingKey(f);
              const isDone = done.has(k);
              return (
                <li key={k}>
                  <button className={isDone ? "task done" : "task"} onClick={() => onOpenGuide(k)}>
                    <span className="task-mark" aria-hidden />
                    <span className="task-name">
                      {taskTitle(f)}
                      {isDone && <span className="sr-only"> (했어요)</span>}
                    </span>
                    <span className="task-amt">{f.kind === "saving" ? won(f.yearlySaving) : "확인"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <p className="empty">입력한 내용에서는 새는 돈이 보이지 않아요.</p>
      )}

      <div className="spacer" />
      <div className="cta-bar">
        <p className="note center">금액은 고지서 기준 예상치예요.</p>
        {left.length > 0 ? (
          <button className="btn" onClick={() => onOpenGuide(findingKey(left[0]))}>
            {left.length === tasks.length ? "하나씩 해 보기" : "남은 것 이어서 하기"}
          </button>
        ) : (
          allDone && (
            <button className="btn" onClick={share}>{copied ? "주소를 복사했어요" : "친구에게도 알려 주기"}</button>
          )
        )}
      </div>
    </main>
  );
}

/** 약정 끝나기 전 알림: 가입 없이 휴대폰 달력에 일정으로 넣음 */
function ContractReminder({ endYear }: { endYear: number }) {
  const [month, setMonth] = useState(0);
  const [added, setAdded] = useState(false);
  // 조치 화면에서만 그려지므로(서버 렌더 없음) 바로 기기 확인
  const [isAndroid] = useState(() => /Android/i.test(navigator.userAgent));
  const now = new Date();
  const plan = planContractReminder(endYear, month || undefined, {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  });

  const monthPicker = (
    <label className="remind-row">
      <span>설치한 달</span>
      <select className="select" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
        <option value={0}>모름</option>
        {Array.from({ length: 12 }, (_, i) => (
          <option key={i + 1} value={i + 1}>{i + 1}월</option>
        ))}
      </select>
    </label>
  );

  if (plan.kind === "ended") {
    return (
      <div className="remind">
        {monthPicker}
        <p className="remind-ended">
          {plan.endYear}년 {plan.month}월에 이미 끝났어요. 알림 대신 지금 바로 혜택을 비교해 보세요.
        </p>
      </div>
    );
  }

  const { date } = plan;
  const monthKnown = month > 0;
  const reminder = contractReminder(date, monthKnown, endYear, window.location.origin);
  const phoneLink = (
    <a className="btn secondary link-out" href={contractReminderPath(date, monthKnown, endYear)} onClick={() => setAdded(true)}>
      {added ? "달력에 넣는 중" : isAndroid ? "달력 파일" : "휴대폰 달력에 넣기"}
    </a>
  );
  const googleLink = (
    <a className="btn secondary link-out" href={googleCalendarUrl(reminder)} target="_blank" rel="noopener noreferrer">
      {isAndroid ? "구글 캘린더에 넣기" : "구글 캘린더"}
    </a>
  );
  return (
    <div className="remind">
      {monthPicker}
      {/* 안드로이드는 달력 파일이 받아지기만 하는 경우가 있어 구글 캘린더를 앞에 */}
      <div className="btn-row">{isAndroid ? <>{googleLink}{phoneLink}</> : <>{phoneLink}{googleLink}</>}</div>
      <p className="note">{date.year}년 {date.month}월 {date.day}일 아침에 알려 드려요. 가입은 필요 없어요.</p>
    </div>
  );
}

function ActionScreen(props: {
  result: Diagnosis;
  activeKey: string;
  done: Set<string>;
  onDone: (key: string) => void;
  onUndo: (key: string) => void;
  onLater: (key: string) => void;
  onBack: () => void;
  carrier: Carrier;
}) {
  const { result, activeKey, done, onDone, onUndo, onLater, onBack, carrier } = props;
  const active = result.findings.find((f) => findingKey(f) === activeKey) ?? result.findings[0];
  if (!active) return null;
  const key = findingKey(active);
  const g = guideFor(active.rule, active.kind, carrier, active.variant, active.statementType);
  const isDone = done.has(key);
  const at = result.findings.indexOf(active) + 1;

  return (
    <main className="screen">
      <TopBar backLabel="결과" onBack={onBack} at={at} total={result.findings.length} />

      <div>
        <h1 className="title">{taskTitle(active)}</h1>
        <p className="sub">
          {active.kind === "saving" ? `1년에 약 ${won(active.yearlySaving)} 아낄 수 있어요.` : "몇 분이면 확인할 수 있어요."}
        </p>
      </div>

      <ol className="how">
        {g.steps.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ol>

      {g.caution && <p className="caution">{g.caution}</p>}

      {active.rule === "R7" && active.endYear && (active.variant === "soon" || active.variant === "long") && (
        <ContractReminder endYear={active.endYear} />
      )}

      <div className="spacer" />
      <div className="cta-bar">
        {g.link && (
          <a className="btn secondary link-out" href={g.link.href} target="_blank" rel="noopener noreferrer">
            {g.link.label} 열기
          </a>
        )}
        {isDone ? (
          <button className="btn secondary" onClick={() => onUndo(key)}>했어요 취소</button>
        ) : (
          <>
            <button className="btn" onClick={() => onDone(key)}>했어요</button>
            <button className="link-btn center" onClick={() => onLater(key)}>나중에 할게요</button>
          </>
        )}
      </div>
    </main>
  );
}
