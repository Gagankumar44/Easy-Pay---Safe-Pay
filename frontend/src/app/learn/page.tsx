"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { prefill } from "@/lib/api";
import { ErrorNotice, PageHeading, useApp } from "@/components/app-shell";
import { useProgress } from "@/lib/progress";
import { followupCopy } from "@/lib/followup-copy";
import { useVoice } from "@/lib/voice";
import { Icon } from "@/components/icons";
const lessons = [
  {
    title: "Send a small payment",
    question:
      "You want to send ₹100 to Ramesh for groceries. What do you check before continuing?",
    options: [
      "The recipient, amount, reason and money leaving my account",
      "Only whether the button is green",
    ],
    answer: 0,
    explanation:
      "Read all the details and make your own decision. You can change or cancel before confirming.",
    action: "payment",
  },
  {
    title: "Receive money safely",
    question:
      "A stranger says you need to enter your UPI PIN to receive a refund. What should you do?",
    options: [
      "Enter my PIN to receive the refund",
      "Stop and verify the refund independently",
    ],
    answer: 1,
    explanation:
      "Entering a UPI PIN authorises a transaction. Do not approve an outgoing payment to receive money.",
    action: "",
  },
  {
    title: "Spot a fake bank call",
    question:
      "A caller claims your bank account is at risk and asks you to move money into a safe account.",
    options: [
      "Stop and call the bank through its official channel",
      "Transfer quickly because the caller sounds official",
    ],
    answer: 0,
    explanation:
      "A claim of authority and pressure to move money are warning signs. Use a number you already know.",
    action: "",
  },
  {
    title: "Understand a QR code",
    question:
      "A QR code has a valid UPI address. Does that prove the recipient is trustworthy?",
    options: [
      "Yes, valid QR codes are always safe",
      "No. Check the recipient, amount and purpose",
    ],
    answer: 1,
    explanation:
      "A QR can identify a payment destination. Its format does not establish who owns it or whether the request is legitimate.",
    action: "qr",
  },
  {
    title: "Handle a pending payment",
    question: "Your payment has no final result yet. What is the next step?",
    options: [
      "Make the same payment again",
      "Check the existing receipt and ask the provider if needed",
    ],
    answer: 1,
    explanation:
      "An uncertain result can lead to duplicate payments. Checking the existing transaction does not send another payment.",
    action: "",
  },
  {
    title: "Review a subscription",
    question:
      "You intended a one-time payment, but the screen says recurring. What should you do?",
    options: [
      "Pause and review the ongoing authorisation terms",
      "Confirm because the first amount looks right",
    ],
    answer: 0,
    explanation:
      "A recurring authorisation can repeat. Understand frequency, limits and how to cancel before approval.",
    action: "",
  },
  {
    title: "Verify a family emergency",
    question:
      "Someone on a new number claims to be your grandson and asks for an urgent transfer.",
    options: [
      "Call your family member on a previously saved number",
      "Send first because it is an emergency",
    ],
    answer: 0,
    explanation:
      "Verify the person independently through a known contact. A familiar name alone does not establish identity.",
    action: "",
  },
];
export default function Learn() {
  const { t, prefs } = useApp();
  const router = useRouter();
  const [active, setActive] = useState<number | null>(null);
  const [choice, setChoice] = useState<number | null>(null);
  const progress = useProgress();
  const completed = lessons
    .map((_, i) => i)
    .filter((i) =>
      progress.items.some(
        (item) =>
          item.task === "lesson-" + i && item.completed_steps.includes(0),
      ),
    );
  const voice = useVoice(
    "en-IN",
    prefs.speech_rate,
    undefined,
    prefs.cloud_voice,
  );
  const lesson = active === null ? null : lessons[active];
  return (
    <main className="narrow">
      <PageHeading
        title={t("learn")}
        description="Short exercises. No score, no pressure, and no money at risk."
      />
      <ErrorNotice error={progress.error} />
      {progress.loading && <p role="status">{t("wait")}</p>}
      {!lesson ? (
        <div className="service-list">
          {lessons.map((item, index) => (
            <button
              className="task-card"
              style={{ textAlign: "left" }}
              key={item.title}
              onClick={() => {
                setActive(index);
                setChoice(null);
              }}
            >
              <span className="task-icon">
                <Icon name={completed.includes(index) ? "check" : "book"} />
              </span>
              <div>
                <h2>{item.title}</h2>
                <p>
                  {completed.includes(index)
                    ? followupCopy(prefs.language).practised
                    : "One everyday decision"}
                </p>
              </div>
              <span className="task-arrow">
                <Icon name="arrow" size={18} />
              </span>
            </button>
          ))}
        </div>
      ) : (
        <section className="panel stack">
          <h2>{lesson.title}</h2>
          <p>{lesson.question}</p>
          <div className="option-list">
            {lesson.options.map((option, index) => (
              <button
                className={"btn " + (choice === index ? "primary" : "")}
                aria-pressed={choice === index}
                disabled={progress.loading || progress.saving}
                key={option}
                onClick={() => {
                  setChoice(index);
                  if (index === lesson.answer && active !== null)
                    void progress.save("lesson-" + active, [0]);
                }}
              >
                {option}
              </button>
            ))}
          </div>
          {choice !== null && (
            <div className="notice" role="status">
              <h3>
                {choice === lesson.answer
                  ? "That’s a useful next step."
                  : "Take another look."}
              </h3>
              <p>{lesson.explanation}</p>
            </div>
          )}
          <div className="actions">
            <button
              className="text-button"
              onClick={() =>
                voice.speak(
                  lesson.question +
                    " " +
                    (choice === null ? "" : lesson.explanation),
                )
              }
            >
              <Icon name="volume" size={18} />
              {t("replay")} · English
            </button>
            <button
              className="text-button"
              onClick={() => {
                voice.stop();
                setActive(null);
                setChoice(null);
              }}
            >
              {t("back")}
            </button>
          </div>
          {choice === lesson.answer && lesson.action && (
            <button
              className="btn primary"
              onClick={() => {
                if (lesson.action === "payment")
                  prefill({
                    recipient: "Ramesh (sample)",
                    amount: "100",
                    purpose: "Groceries",
                  });
                router.push(lesson.action === "qr" ? "/qr" : "/send-money");
              }}
            >
              Try the demo
              <Icon name="arrow" size={18} />
            </button>
          )}
        </section>
      )}
      <Link
        className="text-button"
        href="https://www.npci.org.in/what-we-do/upi/faqs"
        target="_blank"
        rel="noopener noreferrer"
      >
        Official UPI information · NPCI
      </Link>
    </main>
  );
}
