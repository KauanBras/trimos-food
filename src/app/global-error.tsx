"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="pt-PT">
      <body>
        <main
          style={{
            display: "grid",
            minHeight: "100vh",
            placeItems: "center",
            padding: 24,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div style={{ maxWidth: 480, textAlign: "center" }}>
            <h1>O Trimos Food encontrou um problema</h1>
            <p>
              O seu pedido não foi enviado. Tente carregar novamente a
              aplicação.
            </p>
            <button
              type="button"
              onClick={retry}
              style={{
                marginTop: 16,
                border: 0,
                borderRadius: 12,
                background: "#18181b",
                color: "white",
                padding: "12px 18px",
                fontWeight: 600,
              }}
            >
              Tentar novamente
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
