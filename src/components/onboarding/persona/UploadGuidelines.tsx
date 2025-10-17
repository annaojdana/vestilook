import { ShieldIcon, SparklesIcon, SunIcon } from "lucide-react";
import type { FC, ReactNode } from "react";

import type { UploadConstraints } from "@/types.ts";

interface UploadGuidelinesProps {
  constraints: UploadConstraints;
}

const UploadGuidelines: FC<UploadGuidelinesProps> = ({ constraints }) => {
  return (
    <aside className="flex h-full flex-col gap-6 rounded-2xl border border-border/70 bg-card/70 p-6 shadow-inner">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground/80">Jakość persony</p>
        <h2 className="text-lg font-semibold text-foreground">Jak przygotować idealne zdjęcie</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Dobre zdjęcie persony gwarantuje realistyczne odwzorowanie podczas wirtualnych przymiarek.
        </p>
      </header>

      <ol className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        <GuidelineItem
          icon={<SunIcon className="size-4" aria-hidden="true" />}
          title="Zadbaj o oświetlenie"
          description="Ustaw się przodem do źródła światła, unikaj ostrych cieni i filtrów, które zmieniają kolory skóry."
        />
        <GuidelineItem
          icon={<SparklesIcon className="size-4" aria-hidden="true" />}
          title="Pokaż całą sylwetkę"
          description="Stań prosto, zadbaj o wolną przestrzeń wokół ramion i nóg — pozwoli to na dokładne dopasowanie ubrań."
        />
        <GuidelineItem
          icon={<ShieldIcon className="size-4" aria-hidden="true" />}
          title="Bezpieczeństwo danych"
          description="Plik jest automatycznie pozbawiany metadanych EXIF. Przechowujemy go maksymalnie 72 godziny do finalizacji generacji."
        />
      </ol>

      <dl className="grid grid-cols-1 gap-3 rounded-xl border border-border/60 bg-background/60 p-4 text-xs text-muted-foreground sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <dt className="font-semibold uppercase tracking-wider text-muted-foreground/70">Format &amp; rozdzielczość</dt>
          <dd>
            {constraints.allowedMimeTypes.map((type) => type.replace("image/", "").toUpperCase()).join(" / ")} • min{" "}
            {constraints.minWidth}×{constraints.minHeight}px
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-semibold uppercase tracking-wider text-muted-foreground/70">Rozmiar pliku</dt>
          <dd>Do {formatBytes(constraints.maxBytes)}. Większe pliki odrzucone automatycznie.</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-semibold uppercase tracking-wider text-muted-foreground/70">Retencja</dt>
          <dd>{constraints.retentionHours}h od przesłania, następnie persona usuwana z magazynu.</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-semibold uppercase tracking-wider text-muted-foreground/70">Ochrona prywatności</dt>
          <dd>Twoje zdjęcie nie jest wykorzystywane do trenowania modeli. Dostęp wyłącznie dla Ciebie.</dd>
        </div>
      </dl>
    </aside>
  );
};

export default UploadGuidelines;

interface GuidelineItemProps {
  icon: ReactNode;
  title: string;
  description: string;
}

const GuidelineItem: FC<GuidelineItemProps> = ({ icon, title, description }) => {
  return (
    <li className="flex gap-3 rounded-lg bg-background/80 p-3 ring-1 ring-border/50">
      <div className="mt-0.5 flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">{icon}</div>
      <div>
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground/80">{description}</p>
      </div>
    </li>
  );
};

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) {
    return "–";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  const formatted = value % 1 === 0 ? value.toFixed(0) : value.toFixed(1);
  return `${formatted} ${units[index]}`;
}
