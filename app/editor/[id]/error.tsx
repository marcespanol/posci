"use client";

import Link from "next/link";

interface EditorErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function EditorError({ error, reset }: EditorErrorProps) {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "1rem" }}>
      <section
        style={{
          width: "100%",
          maxWidth: "640px",
          border: "1px solid #d6dde6",
          borderRadius: "12px",
          background: "#fff",
          padding: "1rem",
          display: "grid",
          gap: "0.75rem"
        }}
      >
        <h1 style={{ margin: 0, fontSize: "1.2rem" }}>Editor crashed</h1>
        <p style={{ margin: 0, color: "#4f6175" }}>{error.message || "Unexpected error"}</p>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            type="button"
            onClick={reset}
            style={{ border: "1px solid #2d62bc", borderRadius: "8px", background: "#2d62bc", color: "#fff", padding: "0.45rem 0.7rem", cursor: "pointer" }}
          >
            Retry
          </button>
          <Link
            href="/dashboard"
            style={{ border: "1px solid #d6dde6", borderRadius: "8px", background: "#fff", color: "#223953", padding: "0.45rem 0.7rem" }}
          >
            Back to dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
