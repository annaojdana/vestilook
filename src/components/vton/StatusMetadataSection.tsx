import { useMemo } from "react";
import type { JSX } from "react";

import type { StatusMetadataViewModel } from "@/lib/vton/status.mapper.ts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { CalendarClock, ClipboardCopy, Clock3, ImageOff, Link2 } from "lucide-react";

export interface StatusMetadataSectionProps {
  metadata: StatusMetadataViewModel;
  loading?: boolean;
}

const formatter = new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" });

export function StatusMetadataSection({ metadata, loading }: StatusMetadataSectionProps): JSX.Element {
  const rows = useMemo(
    () =>
      [
        { label: "Utworzono", value: metadata.createdAt },
        { label: "Rozpoczęto", value: metadata.startedAt },
        { label: "Zakończono", value: metadata.completedAt },
        { label: "Wygasa", value: metadata.expiresAt },
        {
          label: "Pozostały limit",
          value: metadata.quotaRemaining !== null && metadata.quotaRemaining !== undefined ? `${metadata.quotaRemaining}` : null,
        },
      ] as const,
    [metadata.completedAt, metadata.createdAt, metadata.expiresAt, metadata.quotaRemaining, metadata.startedAt]
  );

  const assetCards = [
    {
      title: "Persona",
      previewUrl: metadata.personaPreviewUrl,
      path: metadata.personaPath,
    },
    {
      title: "Ubranie",
      previewUrl: metadata.garmentPreviewUrl,
      path: metadata.garmentPath,
    },
  ] as const;

  return (
    <section aria-labelledby="generation-metadata-heading" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 id="generation-metadata-heading" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Szczegóły generacji
        </h3>
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => void copyToClipboard(metadata.generationId)}>
          <ClipboardCopy className="size-3.5" aria-hidden="true" />
          ID: {truncate(metadata.generationId, 10)}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card className="overflow-hidden border-dashed">
          <CardHeader className="px-5 py-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Podgląd assetów</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 px-5 pb-5">
            {assetCards.map((asset) => (
              <AssetPreview
                key={asset.title}
                title={asset.title}
                previewUrl={asset.previewUrl}
                path={asset.path}
                loading={loading}
              />
            ))}
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardHeader className="px-5 py-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Czasy i identyfikatory</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 px-5 pb-5 text-sm">
            {rows.map((row) => (
              <MetadataRow key={row.label} label={row.label} value={row.value} />
            ))}

            {metadata.vertexJobId ? (
              <div className="flex items-center justify-between gap-3 rounded-md border border-muted/60 bg-muted/20 px-3 py-2">
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-muted-foreground">Vertex job</span>
                  <span className="font-mono text-xs">{truncate(metadata.vertexJobId, 18)}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => void copyToClipboard(metadata.vertexJobId!)}
                >
                  <ClipboardCopy className="size-3.5" aria-hidden="true" />
                  Kopiuj
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

interface AssetPreviewProps {
  title: string;
  previewUrl?: string;
  path?: string | null;
  loading?: boolean;
}

function AssetPreview({ title, previewUrl, path, loading }: AssetPreviewProps): JSX.Element {
  return (
    <div className="flex items-center gap-3 rounded-md border border-muted/60 bg-muted/20 p-3">
      <div className="relative h-16 w-16 overflow-hidden rounded-sm border border-muted bg-background">
        {previewUrl && !loading ? (
          <img
            src={previewUrl}
            alt={`${title} preview`}
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            {loading ? <CalendarClock className="size-5 animate-pulse" aria-hidden="true" /> : <ImageOff className="size-5" aria-hidden="true" />}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</span>
        <span className="text-xs text-muted-foreground">
          {path ? truncate(path, 40) : "Brak podpisanego zasobu"}
        </span>
      </div>

      {previewUrl ? (
        <Button
          asChild
          size="icon"
          variant="ghost"
          className="size-8"
        >
          <a href={previewUrl} target="_blank" rel="noreferrer">
            <Link2 className="size-4" aria-hidden="true" />
            <span className="sr-only">Otwórz podgląd {title}</span>
          </a>
        </Button>
      ) : null}
    </div>
  );
}

interface MetadataRowProps {
  label: string;
  value: string | null | undefined;
}

function MetadataRow({ label, value }: MetadataRowProps): JSX.Element {
  const icon = label === "Wygasa" ? <Clock3 className="size-3.5 text-amber-600" aria-hidden="true" /> : <CalendarClock className="size-3.5 text-muted-foreground" aria-hidden="true" />;

  return (
    <div className="flex items-start gap-3 rounded-md border border-transparent px-3 py-2 hover:border-muted/60">
      <span className="mt-0.5">{icon}</span>
      <div className="flex flex-col">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="text-sm text-foreground">{value ? formatter.format(new Date(value)) : <span className="text-muted-foreground">—</span>}</span>
      </div>
    </div>
  );
}

async function copyToClipboard(payload: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(payload);
  } catch (error) {
    console.warn("Nie udało się skopiować wartości.", error);
  }
}

function truncate(value: string, max = 24): string {
  if (value.length <= max) {
    return value;
  }

  return `${value.slice(0, Math.ceil(max / 2) - 1)}…${value.slice(-Math.floor(max / 2))}`;
}
