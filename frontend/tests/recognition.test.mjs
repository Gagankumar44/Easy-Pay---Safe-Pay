import test from "node:test";
import assert from "node:assert/strict";
import { startRecognition } from "../src/lib/recognition.ts";
import { microphoneError } from "../src/lib/microphone-copy.ts";

function harness(language = "en-IN", throws = false) {
  let now = 0;
  let sequence = 0;
  const timers = new Map();
  const status = [],
    words = [],
    errors = [];
  class Recognizer {
    static last;
    constructor() {
      Recognizer.last = this;
    }
    start() {
      if (throws) throw new Error("unavailable");
    }
    stop() {
      this.stopped = true;
    }
    abort() {
      this.aborted = true;
    }
  }
  const capture = startRecognition(
    Recognizer,
    language,
    {
      status: (value) => status.push(value),
      text: (value) => words.push(value),
      error: (value) => errors.push(value),
    },
    (callback, ms) => {
      const id = ++sequence;
      timers.set(id, { at: now + ms, callback });
      return () => timers.delete(id);
    },
  );
  const native = Recognizer.last;
  const advance = (ms) => {
    const end = now + ms;
    while (true) {
      const due = [...timers.entries()]
        .filter(([, value]) => value.at <= end)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      now = due[1].at;
      timers.delete(due[0]);
      due[1].callback();
    }
    now = end;
  };
  const result = (...parts) =>
    native.onresult?.({
      results: parts.map((transcript) => ({ 0: { transcript } })),
    });
  return { native, capture, status, words, errors, advance, result, timers };
}

test("a missing startup event never falsely says listening and times out", () => {
  const h = harness();
  assert.deepEqual(h.status, ["starting"]);
  h.advance(10000);
  assert.deepEqual(h.status, ["starting", "idle"]);
  assert.deepEqual(h.errors, ["start-timeout"]);
  assert.equal(h.native.aborted, true);
});

for (const [language, phrase] of [
  ["en-IN", "Pay Akash five hundred"],
  ["hi-IN", "आकाश को पाँच सौ भेजो"],
  ["kn-IN", "ಆಕಾಶ್ ಅವರಿಗೆ ಐನೂರು ಕಳುಹಿಸಿ"],
]) {
  test(`live partial words and corrected final words work in ${language}`, () => {
    const h = harness(language);
    assert.equal(h.native.lang, language);
    assert.equal(h.native.interimResults, true);
    assert.equal(h.native.continuous, true);
    h.native.onstart();
    h.result(phrase);
    h.result(phrase, "for groceries");
    assert.deepEqual(h.words, [phrase, phrase + " for groceries"]);
    h.native.onend();
    assert.deepEqual(h.status, ["starting", "listening", "idle"]);
    assert.deepEqual(h.errors, []);
    assert.equal(h.timers.size, 0);
  });
}

test("Finish speaking retains a final result delivered after stop", () => {
  const h = harness();
  h.native.onstart();
  h.capture.stop();
  h.result("Pay Suraj 125 for groceries");
  h.native.onend();
  h.advance(5000);
  assert.deepEqual(h.words, ["Pay Suraj 125 for groceries"]);
  assert.deepEqual(h.errors, []);
});

test("a recognizer that starts but returns no words stops with recovery", () => {
  const h = harness();
  h.native.onstart();
  h.advance(15000);
  assert.equal(h.status.at(-1), "idle");
  assert.deepEqual(h.errors, ["no-speech"]);
});

test("silent completion is explained rather than disappearing", () => {
  const h = harness();
  h.native.onend();
  assert.deepEqual(h.errors, ["no-speech"]);
});

test("service and permission errors stay distinct", () => {
  for (const code of [
    "network",
    "not-allowed",
    "audio-capture",
    "language-not-supported",
  ]) {
    const h = harness();
    h.native.onerror({ error: code });
    assert.deepEqual(h.errors, [code]);
    assert.equal(h.status.at(-1), "idle");
    h.advance(60000);
    assert.equal(h.errors.length, 1);
  }
  assert.match(microphoneError("not-allowed", "en-IN"), /site settings/);
  assert.match(microphoneError("network", "en-IN"), /online voice/);
  assert.match(microphoneError("audio-capture", "en-IN"), /Connect one/);
});

test("cancellation drops stale results and releases all timers", () => {
  const h = harness();
  const oldResult = h.native.onresult;
  h.capture.cancel();
  oldResult({ results: [{ 0: { transcript: "stale answer" } }] });
  h.advance(60000);
  assert.deepEqual(h.words, []);
  assert.deepEqual(h.errors, []);
  assert.equal(h.timers.size, 0);
});

test("capture ends after 45 seconds even when the browser never ends it", () => {
  const h = harness();
  h.native.onstart();
  h.result("Pay Gowtham");
  h.advance(45000);
  assert.equal(h.native.stopped, true);
  h.advance(1500);
  assert.equal(h.status.at(-1), "idle");
  assert.equal(h.timers.size, 0);
});

test("a synchronous browser failure has a recoverable state", () => {
  const h = harness("en-IN", true);
  assert.equal(h.status.at(-1), "idle");
  assert.deepEqual(h.errors, ["service-not-allowed"]);
});
