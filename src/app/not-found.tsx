import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
      <div className="max-w-md text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-600">
          Erro 404
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-zinc-950">
          Página não encontrada
        </h1>
        <p className="mt-3 text-zinc-500">
          O endereço pode estar incorreto ou o conteúdo deixou de estar
          disponível.
        </p>
        <Link
          href="/"
          className="mt-7 inline-flex h-11 items-center justify-center rounded-xl bg-zinc-950 px-5 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}
