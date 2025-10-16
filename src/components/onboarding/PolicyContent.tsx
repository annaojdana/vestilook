import type { FC } from "react";

import type { ConsentViewModel } from "./consent-types.ts";

interface PolicyContentProps {
  headingId: string;
  descriptionId: string;
  viewModel: ConsentViewModel;
}

const PolicyContent: FC<PolicyContentProps> = ({ headingId, descriptionId, viewModel }) => {
  const { policyContent, policyUrl, requiredVersion, metadata } = viewModel;

  return (
    <section
      aria-labelledby={headingId}
      aria-describedby={descriptionId}
      className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-background/90 shadow-inner"
    >
      <div className="border-b border-border/50 bg-muted/40 px-5 py-4">
        <p id={headingId} className="text-lg font-semibold text-foreground">
          Treść polityki przetwarzania wizerunku
        </p>
        <p id={descriptionId} className="mt-1 text-xs text-muted-foreground">
          Wersja {requiredVersion}. Ostatnia aktualizacja:{" "}
          {metadata?.updatedAt ? (
            <time dateTime={metadata.updatedAt}>{formatDate(metadata.updatedAt)}</time>
          ) : (
            "nieznana"
          )}
          . Źródło: {metadata?.source === "gcp" ? "Google Cloud" : "Vestilook"}.
        </p>
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-background via-background/60 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-background via-background/60 to-transparent" />
      <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-6 text-sm leading-relaxed text-muted-foreground">
        {policyContent ? (
          <article
            className="space-y-4 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_h2]:text-lg [&_h3]:text-base [&_strong]:text-foreground"
            dangerouslySetInnerHTML={{ __html: policyContent }}
          />
        ) : (
          <div className="space-y-2">
            <p>Nie udało się pobrać treści polityki z serwera.</p>
            <p>
              Pełny dokument znajdziesz pod adresem{" "}
              <a href={policyUrl} target="_blank" rel="noreferrer noopener" className="font-semibold text-primary">
                {policyUrl}
              </a>
              .
            </p>
          </div>
        )}
      </div>
    </section>
  );
};

function formatDate(date: string): string {
  const parsed = Number.isNaN(Date.parse(date)) ? null : new Date(date);
  if (!parsed) {
    return "nieznana";
  }

  return parsed.toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default PolicyContent;
