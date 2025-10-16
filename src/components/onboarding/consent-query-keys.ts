export const consentQueryKeys = {
  profileRoot: () => ["profile"] as const,
  consentStatus: () => ["profile", "consent"] as const,
} as const;

export type ConsentQueryKey = ReturnType<(typeof consentQueryKeys)[keyof typeof consentQueryKeys]>;
