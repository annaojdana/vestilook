import { access } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { parseMultipartRequest } from './multipart.ts';

describe('parseMultipartRequest', () => {
  it('parses multipart form-data with fields and files', async () => {
    const garmentData = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const garment = new Blob([garmentData], { type: 'image/png' });

    const formData = new FormData();
    formData.set('consentVersion', 'v1');
    formData.set('retainForHours', '48');
    formData.set('garment', garment, 'sample.png');

    const request = new Request('http://localhost', {
      method: 'POST',
      body: formData,
    });

    const result = await parseMultipartRequest(request);
    expect(result.fields.consentVersion).toEqual(['v1']);
    expect(result.fields.retainForHours).toEqual(['48']);
    expect(result.files).toHaveLength(1);

    const [file] = result.files;
    expect(file.fieldName).toBe('garment');
    expect(file.filename).toBe('sample.png');
    expect(file.mimeType).toBe('image/png');
    expect(file.size).toBe(garmentData.byteLength);

    const blob = await file.toBlob();
    const [original, stored] = await Promise.all([garment.arrayBuffer(), blob.arrayBuffer()]);

    expect(new Uint8Array(stored)).toEqual(new Uint8Array(original));

    await file.cleanup();
    await expect(access(file.path)).rejects.toThrow();
  });
});
