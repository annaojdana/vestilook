import { Buffer } from "node:buffer";

export function setTestEnvironment(overrides: Partial<NodeJS.ProcessEnv> = {}) {
  const defaults: Record<string, string> = {
    PRIVATE_VERTEX_PROJECT_ID: "test-project",
    PRIVATE_VERTEX_LOCATION: "europe-west1",
    PRIVATE_VERTEX_VTO_MODEL: "virtualTryOnModels/test",
    PRIVATE_VTON_GARMENT_BUCKET: "garments-bucket",
    PRIVATE_VTON_PERSONA_BUCKET: "persona-bucket",
    PRIVATE_VTON_GENERATION_BUCKET: "generation-bucket",
    PRIVATE_VTON_MAX_GARMENT_BYTES: String(10 * 1024 * 1024),
    PRIVATE_VTON_MIN_GARMENT_WIDTH: "8",
    PRIVATE_VTON_MIN_GARMENT_HEIGHT: "8",
    PRIVATE_VTON_ALLOWED_GARMENT_MIME: "image/png,image/jpeg",
    VITE_VTON_DEFAULT_ETA_SECONDS: "240",
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_KEY: "test-supabase-key",
    GOOGLE_VERTEX_API_KEY: "vertex-key",
  };

  for (const [key, value] of Object.entries({ ...defaults, ...overrides })) {
    process.env[key] = value;
  }
}

export function createTestPngBlob(): Blob {
  const base64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAO0lEQVR42mNgwA3+w8DAk8EwCiaGQJRmAEmYwBhApgFEMGATmQhikCQBZPEUMXPnzwzUgAAIShGo0RZQAAAxQBIYwkHM4AAAAASUVORK5CYII=";
  return new Blob([Buffer.from(base64, "base64")], { type: "image/png" });
}
