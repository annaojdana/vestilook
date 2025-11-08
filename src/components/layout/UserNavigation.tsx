import { useEffect, useState } from "react";
import type { FC } from "react";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { getUserInitials } from "@/lib/user-profile";
import { USER_NAVIGATION_SHEET_EVENT, type NavigationOverlayEventDetail } from "@/components/layout/navigationEvents";

interface UserNavigationProps {
  userEmail: string;
}

export const UserNavigation: FC<UserNavigationProps> = ({ userEmail }) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const detail: NavigationOverlayEventDetail = {
      open: isOpen,
      source: "user-navigation",
    };

    window.dispatchEvent(new CustomEvent(USER_NAVIGATION_SHEET_EVENT, { detail }));
  }, [isOpen]);

  return (
    <div className="flex items-center gap-4">
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            className="flex items-center gap-2 hover:bg-gray-100"
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-xs">
                {getUserInitials(userEmail)}
              </AvatarFallback>
            </Avatar>
            <span className="hidden md:inline text-sm font-medium">
              {userEmail}
            </span>
          </Button>
        </SheetTrigger>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Twoje konto</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white">
                  {getUserInitials(userEmail)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{userEmail}</p>
                <p className="text-xs text-gray-500">Użytkownik</p>
              </div>
            </div>

            <nav className="space-y-2">
              <a
                href="/dashboard"
                className="block px-3 py-2 rounded-md hover:bg-gray-100 text-sm"
              >
                Dashboard
              </a>
              <a
                href="/profile"
                className="block px-3 py-2 rounded-md hover:bg-gray-100 text-sm"
              >
                Profil
              </a>
              <a
                href="/generations"
                className="block px-3 py-2 rounded-md hover:bg-gray-100 text-sm"
              >
                Moje generacje
              </a>
            </nav>

            <div className="pt-4 border-t">
              <LogoutButton
                variant="outline"
                onLogoutStart={() => setIsOpen(false)}
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};
