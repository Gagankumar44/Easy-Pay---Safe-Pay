"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ErrorNotice, PageHeading } from "@/components/app-shell";
export default function SharedInstruction() {
  const { token } = useParams<{ token: string }>();
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    const load = () =>
      api<{ text: string }>(
        "/api/assistance/shared/" + encodeURIComponent(token),
      )
        .then((data) => {
          if (live) {
            setText(data.text);
            setError("");
          }
        })
        .catch((e) => {
          if (live) {
            setText("");
            setError(e.message);
          }
        });
    void load();
    const timer = setInterval(() => void load(), 10000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [token]);
  return (
    <main className="narrow">
      <PageHeading
        title="Help with one instruction."
        description="The owner has shared this general instruction for a short time."
      />
      <ErrorNotice error={error} />
      <div className="panel stack">
        <p>
          {text ||
            (!error
              ? "Loading the instruction…"
              : "This instruction is no longer available.")}
        </p>
        <p className="hint">
          Help explain the instruction. The owner makes their own decisions.
          This link has no payment controls or access to private records.
        </p>
      </div>
    </main>
  );
}
