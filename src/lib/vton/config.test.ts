import { describe, expect, it, beforeEach, afterEach } from 'vitest';

import { loadVtonEnvironmentConfig } from './config.ts';

const REQUIRED_VARS = {
  PRIVATE_VERTEX_PROJECT_ID: 'project-123',
  PRIVATE_VERTEX_LOCATION: 'us-central1',
  PRIVATE_VERTEX_VTO_MODEL: 'virtualTryOnModels/default',
  PRIVATE_VTON_GARMENT_BUCKET: 'garment-bucket',
  PRIVATE_VTON_PERSONA_BUCKET: 'persona-bucket',
  PRIVATE_VTON_GENERATION_BUCKET: 'generation-bucket',
  PRIVATE_VTON_MAX_GARMENT_BYTES: '7340032',
  PRIVATE_VTON_MIN_GARMENT_WIDTH: '1024',
  PRIVATE_VTON_MIN_GARMENT_HEIGHT: '1024',
  PRIVATE_VTON_ALLOWED_GARMENT_MIME: 'image/jpeg,image/png',
  VITE_VTON_DEFAULT_ETA_SECONDS: '240',
};

describe('loadVtonEnvironmentConfig', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    Object.assign(process.env, REQUIRED_VARS);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('loads configuration from environment variables', () => {
    const config = loadVtonEnvironmentConfig();

    expect(config.vertexProjectId).toBe(REQUIRED_VARS.PRIVATE_VERTEX_PROJECT_ID);
    expect(config.vertexLocation).toBe(REQUIRED_VARS.PRIVATE_VERTEX_LOCATION);
    expect(config.vertexModel).toBe(REQUIRED_VARS.PRIVATE_VERTEX_VTO_MODEL);
    expect(config.garmentBucket).toBe(REQUIRED_VARS.PRIVATE_VTON_GARMENT_BUCKET);
    expect(config.allowedGarmentMimeTypes).toEqual(['image/jpeg', 'image/png']);
    expect(config.defaultEtaSeconds).toBe(240);
    expect(config.maxGarmentBytes).toBe(7340032);
  });

  it('throws when required mime list missing', () => {
    process.env.PRIVATE_VTON_ALLOWED_GARMENT_MIME = '';
    expect(() => loadVtonEnvironmentConfig()).toThrow(/list at least one MIME type/i);
  });
});
