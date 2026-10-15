"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  api,
  defaults,
  Language,
  Preferences,
  profile,
  validPreferences,
  Profile,
  resetProfile,
} from "@/lib/api";
import { translate } from "@/lib/i18n";
import { Icon } from "./icons";
import { DueReminders } from "./reminders";
import { elderCopy } from "@/lib/elder-copy";
import { uiCopy, localizedError } from "@/lib/ui-copy";

type AppContext = {
  prefs: Preferences;
  ready: boolean;
  account: Profile["account"];
  refreshProfile: () => Promise<void>;
  update: (patch: Partial<Preferences>) => Promise<void>;
  t: (key: Parameters<typeof translate>[1]) => string;
};
const Context = createContext<AppContext>({
  prefs: defaults,
  ready: false,
  account: null,
  refreshProfile: async () => {},
  update: async () => {},
  t: (key) => translate("en-IN", key),
});
export const useApp = () => useContext(Context);
export function AppShell({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState(defaults);
  const [ready, setReady] = useState(false);
  const [account, setAccount] = useState<Profile["account"]>(null);
  const [offline, setOffline] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState("");
  const currentPrefs = useRef(defaults);
  const savedPrefs = useRef(defaults);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const saveVersion = useRef(0);
  const path = usePathname();
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let mounted = true;
    Promise.resolve().then(() => {
      try {
        const cached = JSON.parse(
          localStorage.getItem("easy-pay-preferences") ?? "null",
        );
        const candidate = { ...defaults, ...cached };
        if (validPreferences(candidate) && mounted) {
          currentPrefs.current = candidate;
          savedPrefs.current = candidate;
          setPrefs(candidate);
        }
      } catch {
        /* Use readable defaults. */
      }
    });
    profile()
      .then((p) => {
        if (mounted) {
          setPrefs(p.preferences);
          currentPrefs.current = p.preferences;
          savedPrefs.current = p.preferences;
          setAccount(p.account);
          setUnavailable(false);
          setReady(true);
        }
      })
      .catch(() => {
        if (mounted) {
          setUnavailable(true);
          setReady(true);
        }
      });
    const connected = () => setOffline(!navigator.onLine);
    Promise.resolve().then(connected);
    window.addEventListener("online", connected);
    window.addEventListener("offline", connected);
    return () => {
      mounted = false;
      window.removeEventListener("online", connected);
      window.removeEventListener("offline", connected);
    };
  }, []);
  useEffect(() => {
    document.documentElement.lang = prefs.language.slice(0, 2);
    document.documentElement.dataset.textSize = prefs.text_size;
    document.documentElement.dataset.contrast = String(prefs.contrast);
    if (ready) {
      try {
        localStorage.setItem("easy-pay-preferences", JSON.stringify(prefs));
      } catch {
        /* Server preferences remain available when browser storage is blocked. */
      }
    }
  }, [prefs, ready]);
  useEffect(() => {
    content.current?.focus({ preventScroll: true });
  }, [path]);
  const update = useCallback(async (patch: Partial<Preferences>) => {
    const version = ++saveVersion.current;
    const next = { ...currentPrefs.current, ...patch };
    currentPrefs.current = next;
    setPrefs(next);
    const request = saveQueue.current
      .catch(() => {})
      .then(() => api("/api/profile/preferences", next, "PUT"));
    saveQueue.current = request;
    try {
      await request;
      savedPrefs.current = next;
      setUnavailable(false);
    } catch (e) {
      if (version === saveVersion.current) {
        currentPrefs.current = savedPrefs.current;
        setPrefs(savedPrefs.current);
      }
      setUnavailable(true);
      throw e;
    }
  }, []);
  const refreshProfile = useCallback(async () => {
    await saveQueue.current.catch(() => {});
    resetProfile();
    const value = await profile();
    setPrefs(value.preferences);
    currentPrefs.current = value.preferences;
    savedPrefs.current = value.preferences;
    setAccount(value.account);
    setUnavailable(false);
  }, []);
  useEffect(() => {
    if (!unavailable || offline) return;
    let checking = false;
    const retry = async () => {
      if (checking || document.hidden) return;
      checking = true;
      try {
        await refreshProfile();
      } catch {
        /* Keep the recovery action visible. */
      } finally {
        checking = false;
      }
    };
    const timer = window.setInterval(() => void retry(), 15000);
    window.addEventListener("online", retry);
    window.addEventListener("focus", retry);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", retry);
      window.removeEventListener("focus", retry);
    };
  }, [unavailable, offline, refreshProfile]);
  const t = (key: Parameters<typeof translate>[1]) =>
    translate(prefs.language, key);
  return (
    <Context.Provider
      value={{ prefs, ready, account, refreshProfile, update, t }}
    >
      <a className="skip-link" href="#main-content">
        {uiCopy(prefs.language).skip}
      </a>
      <header className="app-header">
        <div className="header-inner">
          <Link href="/" className="brand" aria-label="Easy Pay Safe Pay home">
            <span className="brand-icon">
              <Icon name="shield" size={25} />
            </span>
            <span>
              Easy Pay<span className="brand-sub">SAFE PAY</span>
            </span>
          </Link>
          <div className="header-actions">
            <label className="sr-only" htmlFor="global-language">
              {t("language")}
            </label>
            <select
              id="global-language"
              className="language-select"
              value={prefs.language}
              disabled={!ready}
              onChange={(e) =>
                void update({ language: e.target.value as Language }).catch(
                  (err) => setError(err.message),
                )
              }
            >
              <option value="en-IN">English</option>
              <option value="hi-IN">हिन्दी</option>
              <option value="kn-IN">ಕನ್ನಡ</option>
            </select>
            <Link
              href="/settings"
              className="icon-button"
              aria-label={t("settings")}
              title={t("settings")}
            >
              <Icon name="settings" />
            </Link>
          </div>
        </div>
      </header>
      <div className="practice-note">{elderCopy(prefs.language).practice}</div>
      <div
        className="app-content"
        ref={content}
        tabIndex={-1}
        id="main-content"
      >
        {offline && (
          <div className="notice warning" role="status">
            {t("offline")}
          </div>
        )}
        {unavailable && !offline && (
          <div className="notice warning" role="status">
            {uiCopy(prefs.language).servicesUnavailable}{" "}
            <button
              className="text-button"
              onClick={() => void refreshProfile().catch(() => {})}
            >
              {t("retry")}
            </button>
          </div>
        )}
        {error && (
          <div className="notice warning" role="alert">
            {error}
            <button className="text-button" onClick={() => setError("")}>
              {t("stop")}
            </button>
          </div>
        )}
        <DueReminders />
        {children}
      </div>
      <nav className="bottom-nav" aria-label="Main navigation">
        {[
          { href: "/", label: "home", icon: "home" },
          { href: "/activity", label: "activity", icon: "clock" },
          { href: "/help", label: "help", icon: "help" },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={
              (
                item.href === "/help"
                  ? /^\/(help|contacts|trusted-help)(\/|$)/.test(path)
                  : item.href === "/activity"
                    ? /^\/(activity|payment-result|reminders|familiar-tasks)(\/|$)/.test(
                        path,
                      )
                    : !/^\/(help|contacts|trusted-help|activity|payment-result|reminders|familiar-tasks)(\/|$)/.test(
                        path,
                      )
              )
                ? "page"
                : undefined
            }
            className={
              (
                item.href === "/help"
                  ? /^\/(help|contacts|trusted-help)(\/|$)/.test(path)
                  : item.href === "/activity"
                    ? /^\/(activity|payment-result|reminders|familiar-tasks)(\/|$)/.test(
                        path,
                      )
                    : !/^\/(help|contacts|trusted-help|activity|payment-result|reminders|familiar-tasks)(\/|$)/.test(
                        path,
                      )
              )
                ? "active"
                : ""
            }
          >
            <Icon name={item.icon} size={21} />
            <span>{t(item.label as "home" | "activity" | "help")}</span>
          </Link>
        ))}
      </nav>
    </Context.Provider>
  );
}
export function PageHeading({
  title,
  description,
  back = true,
}: {
  title: string;
  description?: string;
  back?: boolean;
}) {
  const { t } = useApp();
  const path = usePathname();
  const parent =
    path.startsWith("/payment-result/") ||
    ["/reminders", "/familiar-tasks"].includes(path)
      ? { href: "/activity", label: t("activity") }
      : path.startsWith("/help/") ||
          ["/contacts", "/trusted-help"].includes(path)
        ? { href: "/help", label: t("help") }
        : ["/qr", "/recipients"].includes(path)
          ? { href: "/send-money", label: t("send") }
          : path.startsWith("/services/") ||
              ["/learn", "/controls", "/reading", "/glossary"].includes(path)
            ? { href: "/services", label: t("services") }
            : { href: "/", label: t("home") };
  return (
    <div className="page-heading">
      {back && (
        <Link className="back-link" href={parent.href}>
          <Icon name="back" size={18} />
          {parent.label}
        </Link>
      )}
      <h1>{title}</h1>
      {description && <p className="lead">{description}</p>}
    </div>
  );
}
export function ErrorNotice({ error }: { error: string }) {
  const { prefs } = useApp();
  return error ? (
    <p className="notice warning" role="alert">
      {localizedError(error, prefs.language)}
    </p>
  ) : null;
}
export function StatusBadge({ status }: { status: string }) {
  const { t } = useApp();
  return (
    <span
      className={`status-badge ${status === "success" ? "positive" : status === "pending" || status === "unknown" ? "caution" : status === "failed" ? "negative" : ""}`}
    >
      <span className="status-dot" />
      {["success", "failed", "pending", "unknown"].includes(status)
        ? t(status as "success" | "failed" | "pending" | "unknown")
        : status.replaceAll("_", " ")}
    </span>
  );
}
