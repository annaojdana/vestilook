import type { VtonEnvironmentConfig } from '../../types.ts';

function readEnv(name: string, required = true): string | undefined {
  const value =
    (typeof import.meta !== 'undefined' &&
      typeof import.meta.env !== 'undefined' &&
      (import.meta.env[name] as string | undefined)) ??
    process.env[name];

  if (required && (!value || value.length === 0)) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function parseIntegerEnv(name: string, defaultValue?: number): number {
  const raw = readEnv(name, defaultValue === undefined);

  if (raw === undefined || raw === null) {
    if (defaultValue === undefined) {
      throw new Error(`Missing required numeric environment variable: ${name}`);
    }

    return defaultValue;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Environment variable ${name} must be a finite integer.`);
  }

  return parsed;
}

function parseMimeList(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }

  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export function loadVtonEnvironmentConfig(): VtonEnvironmentConfig {
  const projectId = readEnv('PRIVATE_VERTEX_PROJECT_ID')!;
  const location = readEnv('PRIVATE_VERTEX_LOCATION')!;
  const model = readEnv('PRIVATE_VERTEX_VTO_MODEL')!;
  const garmentBucket = readEnv('PRIVATE_VTON_GARMENT_BUCKET')!;
  const personaBucket = readEnv('PRIVATE_VTON_PERSONA_BUCKET')!;
  const generationBucket = readEnv('PRIVATE_VTON_GENERATION_BUCKET')!;
  const defaultEtaSeconds = parseIntegerEnv('VITE_VTON_DEFAULT_ETA_SECONDS', 180);
  const maxGarmentBytes = parseIntegerEnv('PRIVATE_VTON_MAX_GARMENT_BYTES');
  const minGarmentWidth = parseIntegerEnv('PRIVATE_VTON_MIN_GARMENT_WIDTH');
  const minGarmentHeight = parseIntegerEnv('PRIVATE_VTON_MIN_GARMENT_HEIGHT');
  const allowedMimeRaw = readEnv('PRIVATE_VTON_ALLOWED_GARMENT_MIME', false);
  const allowedMimeTypes = parseMimeList(allowedMimeRaw);

  if (allowedMimeTypes.length === 0) {
    throw new Error('PRIVATE_VTON_ALLOWED_GARMENT_MIME must list at least one MIME type.');
  }

  return {
    vertexProjectId: projectId,
    vertexLocation: location,
    vertexModel: model,
    garmentBucket,
    personaBucket,
    generationBucket,
    defaultEtaSeconds,
    maxGarmentBytes,
    minGarmentWidth,
    minGarmentHeight,
    allowedGarmentMimeTypes: allowedMimeTypes,
  };
}
