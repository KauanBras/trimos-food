import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";

export function LegalPage({
  eyebrow,
  title,
  introduction,
  sections,
}: {
  eyebrow: string;
  title: string;
  introduction: string;
  sections: Array<{ title: string; paragraphs: string[] }>;
}) {
  return (
    <div className="min-h-screen bg-zinc-50">
      <MarketingHeader />
      <main className="mx-auto max-w-4xl px-5 py-16 lg:px-8">
        <p className="text-sm font-medium text-amber-600">{eyebrow}</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          {title}
        </h1>
        <p className="mt-5 text-lg leading-8 text-zinc-500">{introduction}</p>
        <p className="mt-3 text-xs text-zinc-400">
          Última atualização: 8 de agosto de 2026
        </p>
        <div className="mt-12 space-y-10">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-semibold">{section.title}</h2>
              <div className="mt-3 space-y-3">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph} className="leading-7 text-zinc-600">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
