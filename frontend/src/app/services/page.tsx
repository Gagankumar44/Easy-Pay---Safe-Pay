"use client";
import Link from "next/link";
import { PageHeading, useApp } from "@/components/app-shell";
import { Icon } from "@/components/icons";
import { guidesFor } from "@/lib/guides";
import { followupCopy } from "@/lib/followup-copy";
import { elderCopy } from "@/lib/elder-copy";
import { uiCopy } from "@/lib/ui-copy";
export default function Services() {
  const { t, prefs } = useApp();
  const c = followupCopy(prefs.language);
  const u = uiCopy(prefs.language);
  return (
    <main>
      <PageHeading title={t("services")} />
      <h2 className="service-group-title">{u.official}</h2>
      <div className="service-list">
        {guidesFor(prefs.language).map((guide) => (
          <Link
            className="task-card"
            href={"/services/" + guide.id}
            key={guide.id}
          >
            <span className="task-icon">
              <Icon name={guide.icon} size={27} />
            </span>
            <div>
              <h2>{guide.title}</h2>
              <p>{guide.description}</p>
            </div>
            <span className="task-arrow">
              <Icon name="arrow" size={20} />
            </span>
          </Link>
        ))}
      </div>
      <div className="section-space" />
      <details className="panel service-tool-group">
        <summary>{u.tools}</summary>
        <div className="service-list" style={{ marginTop: 16 }}>
          {[
            { href: "/reading", title: c.reading, icon: "book" },
            { href: "/glossary", title: c.glossary, icon: "help" },
            { href: "/learn", title: t("learn"), icon: "book" },
          ].map((item) => (
            <Link className="task-card" key={item.href} href={item.href}>
              <span className="task-icon">
                <Icon name={item.icon} />
              </span>
              <h2>{item.title}</h2>
              <span className="task-arrow">
                <Icon name="arrow" size={18} />
              </span>
            </Link>
          ))}
        </div>
      </details>
      <details className="panel service-tool-group">
        <summary>
          {prefs.language === "kn-IN"
            ? "ಜನರು ಮತ್ತು ಸಹಾಯ"
            : prefs.language === "hi-IN"
              ? "संपर्क और मदद"
              : "People and help"}
        </summary>
        <div className="task-grid" style={{ marginTop: 16 }}>
          {[
            {
              href: "/keypad",
              title: "keypad",
              text: "keypadText",
              icon: "phone",
            },
            {
              href: "/trusted-help",
              title: "trusted",
              text: "trustedText",
              icon: "users",
            },
            {
              href: "/recipients",
              title: "saved",
              text: "unverified",
              icon: "send",
            },
          ].map((item) => (
            <Link className="task-card" href={item.href} key={item.href}>
              <span className="task-icon">
                <Icon name={item.icon} />
              </span>
              <div>
                <h2>
                  {t(item.title as "learn" | "keypad" | "trusted" | "saved")}
                </h2>
                <p>
                  {t(
                    item.text as
                      "learnText" | "keypadText" | "trustedText" | "unverified",
                  )}
                </p>
              </div>
            </Link>
          ))}
        </div>
        <Link className="btn" href="/contacts" style={{ marginTop: 16 }}>
          <Icon name="phone" size={20} />
          {elderCopy(prefs.language).contacts}
        </Link>
      </details>
    </main>
  );
}
