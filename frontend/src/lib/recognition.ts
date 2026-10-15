import type { Language } from "./api";

export type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onstart: (() => void) | null;
  onresult:
    | ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void)
    | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
export type NativeCapture = { stop: () => void; cancel: () => void };
type Events = {
  status: (status: "starting" | "listening" | "idle") => void;
  text: (text: string) => void;
  error: (code: string) => void;
};
type After = (callback: () => void, ms: number) => () => void;
const after: After = (callback, ms) => {
  const timer = setTimeout(callback, ms);
  return () => clearTimeout(timer);
};

// A browser can expose this API without a functioning recognition service.
// Bound startup and silence, and accept results arriving just after Stop.
export function startRecognition(
  Constructor: new () => Recognition,
  language: Language,
  events: Events,
  schedule: After = after,
): NativeCapture {
  const input = new Constructor();
  let active = true;
  let heard = false;
  const timers: (() => void)[] = [];
  const clear = () => timers.splice(0).forEach((cancel) => cancel());
  const detach = () => {
    input.onstart = input.onresult = input.onerror = input.onend = null;
  };
  const finish = (error?: string) => {
    if (!active) return;
    active = false;
    clear();
    detach();
    try {
      input.abort();
    } catch {
      /* Already closed. */
    }
    events.status("idle");
    if (error) events.error(error);
  };
  const stop = () => {
    if (!active) return;
    clear();
    timers.push(schedule(() => finish(heard ? undefined : "no-speech"), 1500));
    try {
      input.stop();
    } catch {
      finish(heard ? undefined : "no-speech");
    }
  };
  input.lang = language;
  input.interimResults = true;
  input.continuous = true;
  input.onstart = () => {
    if (!active) return;
    clear();
    events.status("listening");
    timers.push(
      schedule(() => {
        if (!heard) finish("no-speech");
      }, 15000),
    );
    timers.push(schedule(stop, 45000));
  };
  input.onresult = (event) => {
    if (!active) return;
    const text = Array.from(event.results)
      .map((result) => result[0].transcript)
      .join(" ")
      .trim();
    if (text) {
      heard = true;
      events.text(text);
    }
  };
  input.onerror = (event) =>
    finish(event.error === "aborted" ? undefined : event.error);
  input.onend = () => finish(heard ? undefined : "no-speech");
  events.status("starting");
  timers.push(schedule(() => finish("start-timeout"), 10000));
  try {
    input.start();
  } catch {
    finish("service-not-allowed");
  }
  return { stop, cancel: () => finish() };
}
