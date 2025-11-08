/**
 * Returns a readable set of initials for avatar placeholders.
 * Falls back to "??" when the identifier cannot be parsed.
 */
export function getUserInitials(identifier?: string | null): string {
  if (!identifier) {
    return "??";
  }

  const username = identifier.split("@")[0] ?? identifier;
  const compact = username.replace(/[^a-zA-Z0-9]/g, "");

  if (compact.length >= 2) {
    return compact.slice(0, 2).toUpperCase();
  }

  if (compact.length === 1) {
    return `${compact.toUpperCase()}•`;
  }

  return "??";
}
