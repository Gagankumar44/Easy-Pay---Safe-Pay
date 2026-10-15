export type Language = "en-IN" | "hi-IN" | "kn-IN";
export type Preferences = {
  language: Language;
  text_size: "normal" | "large" | "extra-large";
  contrast: boolean;
  speech_rate: number;
  audio: boolean;
  interaction: "voice" | "touch" | "both";
  onboarded: boolean;
  reminders: boolean;
  cloud_voice: boolean;
};
export const defaults: Preferences = {
  language: "en-IN",
  text_size: "normal",
  contrast: false,
  speech_rate: 0.85,
  audio: false,
  interaction: "both",
  onboarded: false,
  reminders: false,
  cloud_voice: false,
};
export function validPreferences(value: unknown): value is Preferences {
  if (!value || typeof value !== "object") return false;
  const prefs = value as Preferences;
  return (
    ["en-IN", "hi-IN", "kn-IN"].includes(prefs.language) &&
    ["normal", "large", "extra-large"].includes(prefs.text_size) &&
    ["voice", "touch", "both"].includes(prefs.interaction) &&
    typeof prefs.contrast === "boolean" &&
    typeof prefs.audio === "boolean" &&
    typeof prefs.onboarded === "boolean" &&
    typeof prefs.reminders === "boolean" &&
    typeof prefs.cloud_voice === "boolean" &&
    Number.isFinite(prefs.speech_rate) &&
    prefs.speech_rate >= 0.5 &&
    prefs.speech_rate <= 1.2
  );
}
const memory = new Map<string, string>();
// Private browsing or storage quotas must not prevent a reviewed demo task.
export const session = {
  getItem(key: string) {
    try {
      return sessionStorage.getItem(key) ?? memory.get(key) ?? null;
    } catch {
      return memory.get(key) ?? null;
    }
  },
  setItem(key: string, value: string) {
    memory.set(key, value);
    try {
      sessionStorage.setItem(key, value);
    } catch {
      /* Keep the current tab usable. */
    }
  },
  removeItem(key: string) {
    memory.delete(key);
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* Already absent. */
    }
  },
};
export type Profile = {
  id: string;
  demo_mode: boolean;
  preferences: Preferences;
  account: { username: string } | null;
};
export type PaymentFields = {
  recipient: string;
  amount: string;
  purpose: string;
  upi_id?: string;
  phone?: string;
  recipient_id?: string | null;
  bill_id?: string;
  frequency?: "one_time" | "recurring";
  direction?: "outgoing" | "incoming";
};
export type PaymentContact = {
  id: string;
  name: string;
  upi_id: string;
  phone?: string;
  demo?: boolean;
};
export type Safety = {
  risk_level: "no_signals" | "needs_clarification" | "strong_warning";
  paused: boolean;
  message: string;
  reasons: string[];
  signals: { code: string; noticed: string; action: string }[];
  transaction_id?: string;
};
export type Draft = PaymentFields &
  Safety & {
    id: string;
    revision: number;
    state: string;
    identity_verified: false;
    consumer_number?: string;
    transaction_id?: string;
  };
export type Payment = PaymentFields & {
  transaction_id: string;
  status: "success" | "failed" | "pending" | "unknown";
  message: string;
  demo_mode: boolean;
  provider: string;
  created_at: string;
  updated_at: string;
  events: { status: string; at: string }[];
  biller_status: string | null;
  consumer_number?: string;
};
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
let profilePromise: Promise<Profile> | null = null;
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/backend${path}`, {
      ...init,
      cache: "no-store",
      credentials: "same-origin",
      signal: AbortSignal.timeout(20000),
      headers: { "Content-Type": "application/json", ...init.headers },
    });
  } catch {
    throw new ApiError(
      "We could not reach the service. Check your connection and try again.",
      0,
    );
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new ApiError(
      response.status >= 500
        ? "The payment service is temporarily unavailable. Your details are kept here. Try again shortly."
        : response.status === 429
          ? "Please wait a moment, then try again."
          : typeof data.detail === "string"
            ? data.detail
            : Array.isArray(data.detail)
              ? data.detail
                  .map(
                    (item: { loc?: string[]; msg?: string }) =>
                      `${item.loc?.at(-1)?.replaceAll("_", " ") ?? "Details"}: ${(item.msg ?? "Check this field.").replace(/^Value error, /, "")}`,
                  )
                  .join(" ")
              : "Check the information you entered and try again.",
      response.status,
    );
  return data as T;
}
export function profile(): Promise<Profile> {
  return (profilePromise ??= request<Profile>("/api/profile").catch((error) => {
    profilePromise = null;
    throw error;
  }));
}
export function resetProfile() {
  profilePromise = null;
}
export function switchProfile() {
  resetProfile();
  [
    "easy-pay-chat",
    "easy-pay-fraud-chat",
    "easy-pay-attempt",
    "easy-pay-prefill",
    "easy-pay-send-form",
    "easy-pay-voice-paused",
  ].forEach((key) => session.removeItem(key));
  try {
    localStorage.removeItem("easy-pay-preferences");
  } catch {
    /* Server data remains available. */
  }
  window.location.assign(new URL("/", window.location.origin).href);
}
export async function readImage(file: File, language: Language) {
  await profile();
  return request<Reading>(
    "/api/reading/image?consent=true&language=" + encodeURIComponent(language),
    {
      method: "POST",
      body: file,
      headers: { "Content-Type": file.type },
    },
  );
}
async function audioRequest(
  path: string,
  body: BodyInit,
  contentType: string,
  signal: AbortSignal,
) {
  await profile();
  const response = await fetch("/backend/api/speech/" + path, {
    method: "POST",
    body,
    headers: { "Content-Type": contentType },
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(
      error.detail || "Audio is unavailable.",
      response.status,
    );
  }
  return response;
}
export async function speechAudio(
  text: string,
  language: Language,
  signal: AbortSignal,
) {
  return (
    await audioRequest(
      "speak",
      JSON.stringify({ text, language, consent: true }),
      "application/json",
      signal,
    )
  ).blob();
}
export async function speechTranscript(
  blob: Blob,
  language: Language,
  signal: AbortSignal,
): Promise<{ text: string }> {
  return (
    await audioRequest(
      "transcribe?consent=true&language=" + encodeURIComponent(language),
      blob,
      blob.type,
      signal,
    )
  ).json();
}
export type Reminder = {
  id: string;
  transaction_id: string;
  recipient: string;
  due_at: string;
  state: "scheduled" | "resolved" | "dismissed";
  due?: boolean;
};
export type Reminders = { enabled: boolean; items: Reminder[] };
export type Progress = { id: string; task: string; completed_steps: number[] };
export type Reading = {
  language: Language;
  title: string;
  summary: string;
  visible_text: string;
  unclear: boolean;
  possible_deception: boolean;
  engine: string;
  notice: string;
  safety: Safety;
};
export async function api<T>(
  path: string,
  body?: unknown,
  method?: string,
): Promise<T> {
  await profile();
  try {
    return await request<T>(path, {
      method: method ?? (body === undefined ? "GET" : "POST"),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) resetProfile();
    throw error;
  }
}
export function money(amount: string | number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(amount));
}
export function dateTime(value: string, language: Language = "en-IN") {
  if (!Number.isFinite(Date.parse(value))) return value;
  return new Intl.DateTimeFormat(language, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}
export function prefill(fields: PaymentFields) {
  session.setItem("easy-pay-prefill", JSON.stringify(fields));
}
export function downloadText(name: string, text: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/plain;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
