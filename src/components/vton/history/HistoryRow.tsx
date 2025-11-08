import { ArrowUpRightIcon, DownloadIcon, Trash2Icon } from "lucide-react";
import type { FC } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import InlineRating from "./InlineRating";
import TTLWarningBadge from "./TTLWarningBadge";

import type { GenerationHistoryItemViewModel } from "../../../types";

interface HistoryRowProps {
  item: GenerationHistoryItemViewModel;
  onOpen: (id: string) => void;
  onDownload: (id: string) => void;
  onDelete: (item: GenerationHistoryItemViewModel) => void;
  onRate: (id: string, rating: number) => void;
}

const toneToBadgeClass: Record<GenerationHistoryItemViewModel["statusTone"], string> = {
  default: "bg-muted/60 text-foreground border-border/70",
  success: "bg-emerald-500/10 text-emerald-500 border-emerald-500/40",
  warning: "bg-amber-500/10 text-amber-600 border-amber-500/40",
  danger: "bg-destructive/15 text-destructive border-destructive/40",
};

const HistoryRow: FC<HistoryRowProps> = ({ item, onOpen, onDownload, onDelete, onRate }) => {
  const { open: openAction, download: downloadAction, delete: deleteAction } = item.actions;

  const handleRate = (rating: number) => {
    onRate(item.id, rating);
  };

  const handleOpen = () => {
    if (!openAction.enabled) {
      return;
    }
    onOpen(item.id);
  };

  const handleDownload = () => {
    if (!downloadAction.enabled) {
      return;
    }
    onDownload(item.id);
  };

  const handleDelete = () => {
    if (!deleteAction.enabled) {
      return;
    }
    onDelete(item);
  };

  const ratingDisabled = item.canRate === false;

  return (
    <li
      role="listitem"
      aria-label={`Generacja ${item.title}`}
      className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card/80 p-4 shadow-[0_20px_45px_-30px_rgb(15_23_42/0.7)] transition hover:border-border/80 focus-within:ring-2 focus-within:ring-ring/40 md:flex-row md:items-center md:gap-6"
    >
      <div className="flex items-start gap-4 md:flex-[2]">
        {item.thumbnailUrl ? (
          <img
            src={item.thumbnailUrl}
            alt={item.thumbnailAlt}
            className="aspect-square w-20 rounded-xl object-cover"
            loading="lazy"
          />
        ) : (
          <div className="aspect-square w-20 rounded-xl border border-dashed border-border/50 bg-muted/30" aria-hidden />
        )}
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className={cn("capitalize", toneToBadgeClass[item.statusTone])}>
              {item.statusLabel}
            </Badge>
            {item.expiresSoon ? (
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-600">
                Wygasa wkrótce
              </span>
            ) : null}
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/80">
              {item.createdAtLabel}
            </p>
            <h3 className="text-base font-semibold text-foreground sm:text-lg">{item.title}</h3>
            <p className="text-sm text-muted-foreground">{item.summary}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 text-sm text-muted-foreground">
        <TTLWarningBadge
          expiresAt={item.expiresAt}
          expiresAtLabel={item.expiresAtLabel}
          expiresInLabel={item.expiresInLabel}
          status={item.status}
        />
        <InlineRating
          value={item.rating ?? null}
          onRate={handleRate}
          disabled={ratingDisabled}
          isSubmitting={Boolean(item.ratingSubmitting)}
          ariaLabel={`Ocena generacji ${item.title}`}
        />
      </div>

      <div className="flex flex-wrap gap-2 md:flex-col md:items-end md:justify-center">
        <Button
          type="button"
          variant="secondary"
          className="min-h-11 min-w-[8.5rem]"
          onClick={handleOpen}
          disabled={!openAction.enabled}
          aria-busy={openAction.busy}
        >
          Podgląd
          <ArrowUpRightIcon className="size-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 min-w-[8.5rem]"
          onClick={handleDownload}
          disabled={!downloadAction.enabled}
          aria-busy={downloadAction.busy}
        >
          Pobierz
          <DownloadIcon className="size-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 min-w-[8.5rem] text-destructive hover:text-destructive"
          onClick={handleDelete}
          disabled={!deleteAction.enabled}
          aria-busy={deleteAction.busy}
        >
          Usuń
          <Trash2Icon className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </li>
  );
};

export default HistoryRow;
