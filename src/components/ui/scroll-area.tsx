import { forwardRef } from "react";
import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils.ts";

export interface ScrollAreaProps extends HTMLAttributes<HTMLDivElement> {}

export const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(function ScrollArea(
  { className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn("overflow-y-auto", className)}
      {...props}
    />
  );
});

