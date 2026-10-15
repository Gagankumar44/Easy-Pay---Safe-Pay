"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";
import { api, money, prefill } from "@/lib/api";
import { ErrorNotice, PageHeading, useApp } from "@/components/app-shell";
import { Icon } from "@/components/icons";
type QR = {
  recipient: string;
  upi_id: string;
  amount: string | null;
  purpose: string;
  direction: string;
  message: string;
  paused: boolean;
  mismatches: string[];
};
export default function Scanner() {
  const { t, prefs } = useApp();
  const router = useRouter();
  const [content, setContent] = useState("");
  const [expectedName, setExpectedName] = useState("");
  const [expectedAmount, setExpectedAmount] = useState("");
  const [direction, setDirection] = useState("outgoing");
  const [mode, setMode] = useState("learn");
  const [result, setResult] = useState<QR | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [camera, setCamera] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const mounted = useRef(true);
  const frameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stream.current?.getTracks().forEach((track) => track.stop());
      if (frameTimer.current) clearTimeout(frameTimer.current);
    };
  }, []);
  function stopCamera() {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    setCamera(false);
    if (frameTimer.current) clearTimeout(frameTimer.current);
  }
  useEffect(() => {
    if (!camera || !video.current) return;
    let active = true;
    const element = video.current;
    element.srcObject = stream.current;
    void element
      .play()
      .catch(() =>
        setError("Could not start the camera preview. Try a QR image instead."),
      );
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    function frame() {
      if (!active) return;
      if (element.readyState >= 2 && context) {
        const scale = Math.min(1, 800 / element.videoWidth);
        canvas.width = Math.round(element.videoWidth * scale);
        canvas.height = Math.round(element.videoHeight * scale);
        context.drawImage(element, 0, 0, canvas.width, canvas.height);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(pixels.data, pixels.width, pixels.height);
        if (code) {
          setContent(code.data);
          setResult(null);
          stream.current?.getTracks().forEach((track) => track.stop());
          setCamera(false);
          return;
        }
      }
      frameTimer.current = setTimeout(frame, 160);
    }
    frame();
    return () => {
      active = false;
      if (frameTimer.current) clearTimeout(frameTimer.current);
    };
  }, [camera]);
  async function startCamera() {
    setBusy(true);
    setError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw Error(
          "Camera access is unavailable. Use an image or paste the QR contents.",
        );
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      if (!mounted.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = media;
      setCamera(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function image(file?: File) {
    if (!file) return;
    setError("");
    if (
      file.size > 8 * 1024 * 1024 ||
      !["image/png", "image/jpeg", "image/webp"].includes(file.type)
    ) {
      setError("Choose a PNG, JPEG or WebP image under 8 MB.");
      return;
    }
    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const context = canvas.getContext("2d");
      if (!context) throw Error("Image reading is unavailable.");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(pixels.data, pixels.width, pixels.height);
      if (!code)
        throw Error("No QR found. Try a clearer image or paste the contents.");
      setContent(code.data);
      setResult(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      bitmap?.close();
    }
  }
  async function check() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(
        await api<QR>("/api/qr/check", {
          content,
          intended_recipient: expectedName,
          intended_amount: expectedAmount || null,
          direction,
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="narrow">
      <PageHeading
        title={t("scan")}
        description="Read a QR on your device and check where the money would go. The camera opens only when you choose it."
      />
      <ErrorNotice error={error} />
      <section className="panel stack">
        <div className="actions">
          <button
            className="btn"
            disabled={busy}
            onClick={camera ? stopCamera : () => void startCamera()}
          >
            <Icon name="qr" size={19} />
            {camera ? "Stop camera" : "Open camera"}
          </button>
          <button
            className="text-button"
            onClick={() => {
              setContent(
                "upi://pay?pa=demo.shop@example&pn=Demo%20Shop&am=250&cu=INR&tn=Groceries",
              );
              setResult(null);
            }}
          >
            Use sample QR
          </button>
        </div>
        {camera && (
          <video
            className="video-preview"
            ref={video}
            autoPlay
            muted
            playsInline
            aria-label="QR camera preview"
          />
        )}
        <div className="field">
          <label htmlFor="qr-image">Or choose a QR image</label>
          <input
            id="qr-image"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => void image(e.target.files?.[0])}
          />
          <small>Images are decoded here and are not uploaded.</small>
        </div>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            void check();
          }}
        >
          <div className="field">
            <label htmlFor="qr-content">QR contents</label>
            <textarea
              id="qr-content"
              required
              maxLength={2048}
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setResult(null);
              }}
              placeholder="upi://pay?pa=name@bank…"
            />
          </div>
          <div className="form-row">
            <div className="field">
              <label htmlFor="expected-name">Expected name (optional)</label>
              <input
                id="expected-name"
                value={expectedName}
                maxLength={80}
                onChange={(e) => {
                  setExpectedName(e.target.value);
                  setResult(null);
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="expected-amount">
                Expected amount (optional)
              </label>
              <input
                id="expected-amount"
                type="number"
                min=".01"
                max="100000"
                step=".01"
                value={expectedAmount}
                onChange={(e) => {
                  setExpectedAmount(e.target.value);
                  setResult(null);
                }}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="direction">What are you trying to do?</label>
            <select
              id="direction"
              value={direction}
              onChange={(e) => {
                setDirection(e.target.value);
                setResult(null);
              }}
            >
              <option value="outgoing">Send money</option>
              <option value="incoming">Receive money or a refund</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="qr-mode">How would you like to use this QR?</label>
            <select
              id="qr-mode"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            >
              <option value="learn">Learn what it means</option>
              <option value="prepare">Prepare a simulated payment</option>
            </select>
          </div>
          <button className="btn primary" disabled={busy}>
            {busy ? t("wait") : "Check QR details"}
          </button>
        </form>
      </section>
      {result && (
        <section className="panel stack" style={{ marginTop: 22 }}>
          <h2>This QR sends money out</h2>
          <p className="muted">{result.message}</p>
          <dl className="details">
            <div>
              <dt>{t("recipient")}</dt>
              <dd>{result.recipient}</dd>
            </div>
            <div>
              <dt>{t("upi")}</dt>
              <dd>{result.upi_id}</dd>
            </div>
            <div>
              <dt>{t("amount")}</dt>
              <dd>
                {result.amount
                  ? money(result.amount)
                  : "You will enter the amount"}
              </dd>
            </div>
          </dl>
          {result.paused && (
            <div className="danger-panel stack-sm" role="alert">
              <div className="alert-heading">
                <Icon name="warning" />
                <h3>
                  {prefs.language === "kn-IN"
                    ? "ವಿವರ ಹೊಂದುವುದಿಲ್ಲ. ನಿಲ್ಲಿಸಿ."
                    : prefs.language === "hi-IN"
                      ? "विवरण अलग हैं। रुकें।"
                      : "Stop. Details do not match."}
                </h3>
              </div>
              {result.mismatches.map((m) => (
                <p key={m}>
                  {prefs.language === "en-IN"
                    ? m
                    : m.includes("receive money")
                      ? prefs.language === "kn-IN"
                        ? "ನೀವು ಹಣ ಪಡೆಯಲು ಬಯಸುತ್ತೀರಿ. ಈ QR ಹಣ ಕಳುಹಿಸುತ್ತದೆ."
                        : "आप पैसे पाना चाहते हैं। यह QR पैसे भेजता है।"
                      : m.includes("recipient")
                        ? prefs.language === "kn-IN"
                          ? "QR ನಲ್ಲಿ ಸ್ವೀಕರಿಸುವವರ ಹೆಸರು ನೀವು ನಿರೀಕ್ಷಿಸಿದ್ದಕ್ಕಿಂತ ಬೇರೆಯಾಗಿದೆ."
                          : "QR का प्राप्तकर्ता आपकी अपेक्षा से अलग है।"
                        : prefs.language === "kn-IN"
                          ? "QR ಮೊತ್ತ ನೀವು ನಿರೀಕ್ಷಿಸಿದ್ದಕ್ಕಿಂತ ಬೇರೆಯಾಗಿದೆ."
                          : "QR की रकम आपकी अपेक्षा से अलग है।"}
                </p>
              ))}
            </div>
          )}
          {mode === "prepare" && !result.paused && (
            <button
              className="btn primary"
              onClick={() => {
                prefill({
                  recipient: result.recipient,
                  upi_id: result.upi_id,
                  amount: result.amount ?? expectedAmount,
                  purpose: result.purpose,
                });
                router.push("/send-money");
              }}
            >
              {t("review")}
              <Icon name="arrow" size={18} />
            </button>
          )}
          <p className="hint">{t("unverified")}</p>
        </section>
      )}
    </main>
  );
}
