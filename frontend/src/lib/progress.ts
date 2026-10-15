"use client";
import { useEffect, useState } from "react";
import { api, Progress } from "./api";
export function useProgress() {
  const [items, setItems] = useState<Progress[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let mounted = true;
    void api<Progress[]>("/api/progress")
      .then((value) => {
        if (mounted) setItems(value);
      })
      .catch((e) => {
        if (mounted) setError(e.message);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);
  async function save(task: string, completed_steps: number[]) {
    setSaving(true);
    setError("");
    try {
      const result = await api<Progress>(
        "/api/progress/" + task,
        { completed_steps },
        "PUT",
      );
      setItems((previous) => [
        ...previous.filter((item) => item.task !== task),
        result,
      ]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return { items, loading, saving, error, save };
}
