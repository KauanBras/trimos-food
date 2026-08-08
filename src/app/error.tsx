"use client";

import { useEffect } from "react";

export default function AppError({
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
    <main className="flex min-h-[70vh] items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-red-600">
          Ocorreu um problema
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">
          Não foi possível carregar esta área
        </h1>
        <p className="mt-3 text-zinc-500">
          A ligação pode ter sido interrompida. Tente novamente sem perder o seu
          trabalho.
        </p>
        <button
          type="button"
          onClick={retry}
          className="mt-7 h-11 rounded-xl bg-zinc-950 px-5 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Tentar novamente
        </button>
      </div>
    </main>
  );
}
