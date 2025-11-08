export const USER_NAVIGATION_SHEET_EVENT = "layout:user-navigation-sheet";
export const MOBILE_NAVIGATION_PANEL_EVENT = "layout:mobile-navigation-panel";

export type NavigationOverlayEventDetail = {
  open: boolean;
  source: "user-navigation" | "mobile-navigation";
};
