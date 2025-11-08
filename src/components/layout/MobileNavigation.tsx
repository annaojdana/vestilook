import type { FC } from "react";
import { useEffect, useMemo, useState } from "react";
import { LayoutDashboard, Sparkles, UserRound, Image, Menu } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { getUserInitials } from "@/lib/user-profile";
import { LogoutButton } from "@/components/auth/LogoutButton";
import {
  MOBILE_NAVIGATION_PANEL_EVENT,
  USER_NAVIGATION_SHEET_EVENT,
  type NavigationOverlayEventDetail,
} from "@/components/layout/navigationEvents";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const PRIMARY_LINKS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/generations", label: "Generacje", icon: Image },
  { href: "/profile", label: "Profil", icon: UserRound },
];

interface MobileNavigationProps {
  activePath: string;
  userEmail?: string | null;
  canGenerate?: boolean;
  generationHref?: string;
}

export const MobileNavigation: FC<MobileNavigationProps> = ({
  activePath,
  userEmail,
  canGenerate = true,
  generationHref = "/generations/new",
}) => {
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleUserSheetToggle = (event: Event) => {
      const { detail } = event as CustomEvent<NavigationOverlayEventDetail>;

      if (detail?.source === "user-navigation" && detail.open) {
        setIsPanelOpen(false);
      }
    };

    window.addEventListener(USER_NAVIGATION_SHEET_EVENT, handleUserSheetToggle as EventListener);
    return () => window.removeEventListener(USER_NAVIGATION_SHEET_EVENT, handleUserSheetToggle as EventListener);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const detail: NavigationOverlayEventDetail = {
      open: isPanelOpen,
      source: "mobile-navigation",
    };

    window.dispatchEvent(new CustomEvent(MOBILE_NAVIGATION_PANEL_EVENT, { detail }));
  }, [isPanelOpen]);

  const isAuthenticated = Boolean(userEmail);
  const initials = useMemo(() => getUserInitials(userEmail ?? undefined), [userEmail]);

  const isLinkActive = (href: string) => {
    if (!activePath) {
      return false;
    }

    if (href === "/") {
      return activePath === "/";
    }

    return activePath === href || activePath.startsWith(`${href}/`);
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <section className="md:hidden" aria-label="Mobilna nawigacja">
      {canGenerate ? (
        <Button
          asChild
          size="lg"
          className="fixed bottom-20 left-1/2 z-40 -translate-x-1/2 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-3 text-base font-semibold text-white shadow-lg hover:from-purple-700 hover:to-pink-700 md:hidden"
        >
          <a href={generationHref} aria-label="Rozpocznij nową generację stylizacji">
            <Sparkles className="size-4" />
            Nowa stylizacja
          </a>
        </Button>
      ) : null}

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-white/95 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_32px_-18px_rgb(15_23_42/0.35)] backdrop-blur-xl"
        aria-label="Główne linki"
      >
        <div className="mx-auto flex max-w-md items-end justify-around gap-1 px-4">
          {PRIMARY_LINKS.map(({ href, icon: Icon, label }) => {
            const active = isLinkActive(href);

            return (
              <a
                key={href}
                href={href}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-medium text-gray-500 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-purple-400",
                  active && "text-purple-600"
                )}
              >
                <Icon className={cn("size-5", active ? "text-purple-600" : "text-gray-400")} />
                {label}
              </a>
            );
          })}

          <Sheet open={isPanelOpen} onOpenChange={setIsPanelOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="flex flex-col items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-medium text-gray-500 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-purple-400"
              >
                <Menu className="size-5 text-gray-400" />
                Menu
              </button>
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="rounded-t-3xl border-none bg-white/95 px-0 pb-6 pt-4 shadow-[0_-16px_64px_-24px_rgb(15_23_42/0.5)]"
            >
              <SheetHeader className="px-6 pt-0">
                <SheetTitle className="text-base font-semibold text-gray-900">Twoja przestrzeń</SheetTitle>
                <p className="text-sm text-muted-foreground">
                  Przejdź do najważniejszych ekranów lub zarządzaj kontem.
                </p>
              </SheetHeader>

              <div className="flex items-center gap-3 border-b border-border/80 px-6 py-4">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-gray-900">{userEmail}</span>
                  <span className="text-xs text-muted-foreground">Zalogowano do Vestilook</span>
                </div>
              </div>

              <div className="flex flex-col gap-2 px-6 py-4">
                {PRIMARY_LINKS.map(({ href, label }) => (
                  <a
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center justify-between rounded-xl border border-transparent px-4 py-3 text-sm font-medium text-gray-600 transition-colors hover:border-purple-200 hover:bg-purple-50",
                      isLinkActive(href) && "border-purple-200 bg-purple-50 text-purple-700"
                    )}
                  >
                    <span>{label}</span>
                    <span aria-hidden="true" className="text-xs font-semibold tracking-wide text-gray-400">
                      →
                    </span>
                  </a>
                ))}
              </div>

              {canGenerate ? (
                <div className="px-6">
                  <Button
                    asChild
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-base font-semibold text-white shadow-lg hover:from-purple-700 hover:to-pink-700"
                  >
                    <a href={generationHref} onClick={() => setIsPanelOpen(false)}>
                      <Sparkles className="size-4" />
                      Generuj stylizację
                    </a>
                  </Button>
                </div>
              ) : null}

              <SheetFooter className="mt-6 border-t border-border/80 px-6 pt-4">
                <LogoutButton variant="outline" onLogoutStart={() => setIsPanelOpen(false)} />
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </section>
  );
};
