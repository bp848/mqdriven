import React, { useEffect, useMemo, useRef, useState } from "react";

type ChatMsg = { role: "user" | "assistant"; text: string; ts: number };
type ToolAction =
  | { id: string; label: string; tool: string; args?: any }
  | { id: string; label: string; tool: string; args?: any; danger?: boolean };

type PreviewState = {
  activeTab: "Draft" | "Files" | "Manual" | "Log";
  draft?: { title: string; content: string };
  files?: { suggestedPath: string; suggestedName: string; note?: string };
  manual?: { hits: { title: string; snippet: string; url?: string }[] };
  log?: { markdown: string };
};

export default function AssistantPage() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [actions, setActions] = useState<ToolAction[]>([]);
  const [preview, setPreview] = useState<PreviewState>({
    activeTab: "Draft",
  });
  const [today, setToday] = useState<{ title: string; time: string }[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  const canSend = useMemo(() => msg.trim().length > 0 || files.length > 0, [msg, files]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/assistant/today");
        const j = await r.json();
        setToday(j.items ?? []);
      } catch {
        setToday([]);
      }
    })();
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [chat.length]);

  const send = async () => {
    if (!canSend || loading) return;
    setLoading(true);

    const userText = msg.trim();
    const now = Date.now();
    setChat((c) => [...c, ...(userText ? [{ role: "user", text: userText, ts: now }] : [])]);
    setMsg("");

    try {
      const form = new FormData();
      form.append("message", userText);
      files.forEach((f) => form.append("files", f));
      setFiles([]);

      const r = await fetch("/api/assistant/chat", { method: "POST", body: form });
      const j = await r.json();

      if (j.assistantText) {
        setChat((c) => [...c, { role: "assistant", text: j.assistantText, ts: Date.now() }]);
      }
      setActions(j.actions ?? []);

      if (j.preview) {
        setPreview((p) => ({ ...p, ...j.preview }));
      }
    } catch (e: any) {
      setChat((c) => [
        ...c,
        { role: "assistant", text: "通信エラー。もう一度。", ts: Date.now() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const runAction = async (a: ToolAction) => {
    if (loading) return;
    setLoading(true);
    try {
      const r = await fetch("/api/assistant/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: a.tool, args: a.args ?? {} }),
      });
      const j = await r.json();
      if (j.assistantText) {
        setChat((c) => [...c, { role: "assistant", text: j.assistantText, ts: Date.now() }]);
      }
      if (j.preview) {
        setPreview((p) => ({ ...p, ...j.preview }));
      }
      setActions(j.actions ?? []);
    } catch {
      setChat((c) => [
        ...c,
        { role: "assistant", text: "実行エラー。", ts: Date.now() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const uploadHint = files.length ? `添付 ${files.length} 件` : "添付（画像/PDF/Excel）";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "420px 1fr", height: "100vh" }}>
      <div style={{ borderRight: "1px solid #e5e7eb", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: 16, borderBottom: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>業務AIアシスタント</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>今日の予定</div>
          <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
            {(today.length ? today : [{ title: "（未取得）", time: "—" }]).map((t, i) => (
              <div key={i} style={{ fontSize: 12, display: "flex", justifyContent: "space-between" }}>
                <span>{t.title}</span>
                <span style={{ opacity: 0.7 }}>{t.time}</span>
              </div>
            ))}
          </div>
        </div>

        <div ref={listRef} style={{ flex: 1, overflow: "auto", padding: 16 }}>
          {chat.map((m, i) => (
            <div
              key={i}
              style={{
                marginBottom: 10,
                display: "flex",
                justifyContent: m.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  maxWidth: "90%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  background: m.role === "user" ? "#111827" : "#f3f4f6",
                  color: m.role === "user" ? "white" : "#111827",
                  whiteSpace: "pre-wrap",
                  fontSize: 13,
                  lineHeight: 1.45,
                }}
              >
                {m.text}
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: 12, borderTop: "1px solid #e5e7eb" }}>
          {actions.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
              {actions.map((a) => (
                <button
                  key={a.id}
                  onClick={() => runAction(a)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid #e5e7eb",
                    background: a.danger ? "#fee2e2" : "white",
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              placeholder="例：じゃあ今から何する？ / OCRして / メール下書き作って"
              style={{
                flex: 1,
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                padding: "10px 12px",
                fontSize: 13,
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <label
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                padding: "10px 12px",
                fontSize: 12,
                cursor: "pointer",
                background: "white",
                whiteSpace: "nowrap",
              }}
            >
              {uploadHint}
              <input
                type="file"
                multiple
                hidden
                onChange={(e) => {
                  const list = Array.from(e.target.files ?? []);
                  setFiles(list);
                }}
              />
            </label>
            <button
              disabled={!canSend || loading}
              onClick={send}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                padding: "10px 12px",
                fontSize: 12,
                cursor: canSend && !loading ? "pointer" : "not-allowed",
                background: canSend && !loading ? "#111827" : "#f3f4f6",
                color: canSend && !loading ? "white" : "#9ca3af",
              }}
            >
              {loading ? "…" : "送信"}
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ padding: 12, borderBottom: "1px solid #e5e7eb", display: "flex", gap: 8 }}>
          {(["Draft", "Files", "Manual", "Log"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setPreview((p) => ({ ...p, activeTab: t }))}
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                background: preview.activeTab === t ? "#111827" : "white",
                color: preview.activeTab === t ? "white" : "#111827",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
          {preview.activeTab === "Draft" && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{preview.draft?.title ?? "下書き"}</div>
              <pre
                style={{
                  marginTop: 12,
                  padding: 14,
                  borderRadius: 14,
                  border: "1px solid #e5e7eb",
                  background: "#fafafa",
                  whiteSpace: "pre-wrap",
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                {preview.draft?.content ?? "（まだ出力がありません）"}
              </pre>
            </div>
          )}

          {preview.activeTab === "Files" && (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>保存提案</div>
              <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 14 }}>
                <div style={{ fontSize: 12, opacity: 0.7 }}>保存先</div>
                <div style={{ marginTop: 6, fontSize: 13 }}>
                  {preview.files?.suggestedPath ?? "（未提案）"}
                </div>
                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 10 }}>ファイル名</div>
                <div style={{ marginTop: 6, fontSize: 13 }}>
                  {preview.files?.suggestedName ?? "（未提案）"}
                </div>
                {preview.files?.note && (
                  <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>{preview.files.note}</div>
                )}
                <div style={{ marginTop: 12 }}>
                  <button
                    onClick={() =>
                      runAction({
                        id: "finalize_save",
                        label: "保存（確定）",
                        tool: "finalize_save",
                        args: preview.files ?? {},
                        danger: true,
                      })
                    }
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid #e5e7eb",
                      background: "#111827",
                      color: "white",
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    保存（確定）
                  </button>
                </div>
              </div>
            </div>
          )}

          {preview.activeTab === "Manual" && (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>マニュアル</div>
              {(preview.manual?.hits?.length ? preview.manual.hits : []).map((h, i) => (
                <div key={i} style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{h.title}</div>
                  <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8, whiteSpace: "pre-wrap" }}>
                    {h.snippet}
                  </div>
                  {h.url && (
                    <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
                      {h.url}
                    </div>
                  )}
                </div>
              ))}
              {!preview.manual?.hits?.length && (
                <div style={{ fontSize: 13, opacity: 0.7 }}>（まだ検索していません）</div>
              )}
            </div>
          )}

          {preview.activeTab === "Log" && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>日報（自動）</div>
              <pre
                style={{
                  marginTop: 12,
                  padding: 14,
                  borderRadius: 14,
                  border: "1px solid #e5e7eb",
                  background: "#fafafa",
                  whiteSpace: "pre-wrap",
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                {preview.log?.markdown ?? "（まだログがありません）"}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
