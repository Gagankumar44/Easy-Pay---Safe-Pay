"use client";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { api, downloadText, switchProfile } from "@/lib/api";
import { ErrorNotice, PageHeading, useApp } from "@/components/app-shell";

export default function Account() {
  const { account, ready, t, refreshProfile } = useApp();
  const [mode, setMode] = useState<"sign-in" | "register" | "recover">(
    "sign-in",
  );
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api<{ recovery_codes?: string[] }>(
        "/api/auth/" + mode,
        { username, password, ...(mode === "recover" ? { code } : {}) },
      );
      setPassword("");
      setCode("");
      if (result.recovery_codes) {
        setCodes(result.recovery_codes);
        void refreshProfile().catch(() => {});
      } else switchProfile();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function signOut() {
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/sign-out", {});
      switchProfile();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <main className="narrow">
      <PageHeading
        title="Your app account"
        description="Keep your practice activity across devices on this demo server."
      />
      <ErrorNotice error={error} />
      {!ready ? (
        <p role="status">{t("wait")}</p>
      ) : codes.length ? (
        <section className="panel stack">
          <h2>Save your recovery codes</h2>
          <p>
            Each code can reset your app password once. Keep them privately.
            They will not be shown again. There is no email recovery.
          </p>
          <ul className="recovery-codes">
            {codes.map((value) => (
              <li key={value}>
                <code>{value}</code>
              </li>
            ))}
          </ul>
          <div className="actions">
            <button
              className="btn"
              onClick={() =>
                downloadText(
                  "easy-pay-recovery-codes.txt",
                  "Easy Pay local demo account: " +
                    username +
                    "\nKeep these private. Each code works once.\n\n" +
                    codes.join("\n"),
                )
              }
            >
              Download codes
            </button>
            <button className="btn primary" onClick={switchProfile}>
              I saved my codes
            </button>
          </div>
        </section>
      ) : account ? (
        <section className="panel stack">
          <h2>Signed in as {account.username}</h2>
          <p>
            Your app account owns your demo activity. A sign-in session lasts 7
            days. Inactive accounts are removed after 90 days when a profile is
            opened.
          </p>
          <button
            className="btn"
            disabled={busy}
            onClick={() => void signOut()}
          >
            {busy ? t("wait") : "Sign out on this device"}
          </button>
          <Link className="text-button" href="/settings">
            Manage preferences and delete data
          </Link>
        </section>
      ) : (
        <section className="panel stack">
          <div className="filters">
            {(["sign-in", "register", "recover"] as const).map((value) => (
              <button
                className={"filter " + (mode === value ? "active" : "")}
                aria-pressed={mode === value}
                key={value}
                disabled={busy}
                onClick={() => {
                  setMode(value);
                  setError("");
                  setPassword("");
                  setCode("");
                }}
              >
                {value === "sign-in"
                  ? "Sign in"
                  : value === "register"
                    ? "Create account"
                    : "Recover access"}
              </button>
            ))}
          </div>
          <p className="hint">
            {mode === "register"
              ? "Your current guest activity will belong to this new account. Choose a username you can remember."
              : mode === "recover"
                ? "Use an unused recovery code and choose a new app password. Recovery signs out all older sessions."
                : "Signing in opens that account’s activity. The current guest activity is not merged."}
          </p>
          <form className="stack" onSubmit={(event) => void submit(event)}>
            <div className="field">
              <label htmlFor="account-name">Username</label>
              <input
                id="account-name"
                required
                minLength={3}
                maxLength={32}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
              <small>3–32 letters, numbers, dots, dashes or underscores.</small>
            </div>
            {mode === "recover" && (
              <div className="field">
                <label htmlFor="recovery-code">Unused recovery code</label>
                <input
                  id="recovery-code"
                  required
                  maxLength={80}
                  autoComplete="off"
                  spellCheck={false}
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                />
              </div>
            )}
            <div className="field">
              <label htmlFor="account-password">
                {mode === "recover" ? "New app password" : "App password"}
              </label>
              <input
                id="account-password"
                type="password"
                required
                minLength={15}
                maxLength={128}
                autoComplete={
                  mode === "sign-in" ? "current-password" : "new-password"
                }
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <small>
                Use a phrase of 15–128 characters. This is only for Easy Pay.
                Never use your bank password or UPI PIN.
              </small>
            </div>
            <button className="btn primary" disabled={busy}>
              {busy
                ? t("wait")
                : mode === "register"
                  ? "Create account"
                  : mode === "recover"
                    ? "Reset app password"
                    : "Sign in"}
            </button>
          </form>
          <p className="hint">
            Local demo accounts do not verify your identity or connect a bank
            account.
          </p>
        </section>
      )}
    </main>
  );
}
