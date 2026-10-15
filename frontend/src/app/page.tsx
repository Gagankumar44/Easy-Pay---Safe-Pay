"use client";
import Link from "next/link";
import { useApp } from "@/components/app-shell";
import { Icon } from "@/components/icons";
import { assistantInputCopy } from "@/lib/assistant-input-copy";
import { useEffect, useState } from "react";
import { session } from "@/lib/api";
import { uiCopy } from "@/lib/ui-copy";
export default function Home() {
  const { t, prefs, ready } = useApp();
  const a = assistantInputCopy(prefs.language);
  const [resume, setResume] = useState(false);
  useEffect(() => {
    void Promise.resolve().then(() =>
      setResume(
        !!session.getItem("easy-pay-send-form") ||
          !!session.getItem("easy-pay-attempt"),
      ),
    );
  }, []);
  const tasks = [
    { href: "/send-money", icon: "send", title: "send", text: "sendText" },
    { href: "/bills", icon: "bill", title: "bills", text: "billsText" },
    { href: "/activity", icon: "clock", title: "check", text: "checkText" },
    {
      href: "/services",
      icon: "grid",
      title: "services",
      text: "servicesText",
    },
  ] as const;
  return (
    <main>
      <section className="home-hero">
        <h1>{t("homeTitle")}</h1>
      </section>
      {resume && (
        <Link className="resume-payment" href="/send-money">
          <Icon name="clock" size={22} />
          <span>{uiCopy(prefs.language).resume}</span>
          <Icon name="arrow" size={19} />
        </Link>
      )}
      <section
        className="assistant-entry"
        aria-labelledby="assistant-entry-title"
      >
        <div className="assistant-entry-heading">
          <span className="assistant-entry-mark">
            <Icon name="volume" size={26} />
          </span>
          <div>
            <h2 id="assistant-entry-title">{t("assistant")}</h2>
            <p>{t("assistantText")}</p>
          </div>
        </div>
        <div className="assistant-entry-actions">
          <Link
            href="/assistant?mode=voice"
            className="assistant-entry-action entry-voice"
          >
            <Icon name="mic" size={25} />
            <span>{a.speak}</span>
            <Icon name="arrow" size={19} />
          </Link>
          <Link
            href="/assistant?mode=text"
            className="assistant-entry-action entry-text"
          >
            <Icon name="keyboard" size={25} />
            <span>{a.type}</span>
            <Icon name="arrow" size={19} />
          </Link>
        </div>
      </section>
      <div className="section-space" />
      <div className="task-grid">
        {tasks.map((task) => (
          <Link key={task.href} href={task.href} className="task-card">
            <span className="task-icon">
              <Icon name={task.icon} size={27} />
            </span>
            <div>
              <h2>{t(task.title)}</h2>
              {task.href === "/services" && <p>{t(task.text)}</p>}
            </div>
            <span className="task-arrow">
              <Icon name="arrow" size={18} />
            </span>
          </Link>
        ))}
      </div>
      <section className="help-strip">
        <Icon name="shield" />
        <div>
          <h3>{t("worried")}</h3>
          <p>{t("worriedText")}</p>
        </div>
        <Link href="/help" className="text-button">
          {t("getHelp")}
          <Icon name="arrow" size={17} />
        </Link>
      </section>
      <div className="home-secondary">
        <Link href="/learn">
          <Icon name="book" size={19} />
          {t("learn")}
        </Link>
        <Link href="/keypad">
          <Icon name="phone" size={19} />
          {t("keypad")}
        </Link>
        <Link href="/trusted-help">
          <Icon name="users" size={19} />
          {t("trusted")}
        </Link>
      </div>
      {ready && !prefs.onboarded && (
        <div className="home-secondary">
          <Link href="/onboarding">
            {t("setup")}
            <Icon name="arrow" size={17} />
          </Link>
        </div>
      )}
    </main>
  );
}
