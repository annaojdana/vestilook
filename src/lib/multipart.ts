import { randomUUID } from 'node:crypto';
import { createWriteStream, promises as fs } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import Busboy, { type BusboyConfig, type FileInfo } from 'busboy';

import type { Logger } from './logger.ts';

export interface StoredFile {
  fieldName: string;
  filename: string;
  mimeType: string;
  encoding: string;
  size: number;
  path: string;
  toBlob: () => Promise<Blob>;
  cleanup: () => Promise<void>;
}

export interface MultipartParseResult {
  fields: Record<string, string[]>;
  files: StoredFile[];
}

export interface MultipartParserOptions {
  limits?: BusboyConfig['limits'];
  tempDir?: string;
  logger?: Logger;
}

function ensureMultipart(contentType: string | null): asserts contentType is string {
  if (!contentType || !contentType.toLowerCase().includes('multipart/form-data')) {
    throw new Error('Request content type must be multipart/form-data.');
  }
}

async function createTempDir(baseDir?: string): Promise<string> {
  const root = baseDir ?? tmpdir();
  return mkdtemp(join(root, 'vestilook-upload-'));
}

async function toBlob(path: string, mimeType: string): Promise<Blob> {
  const buffer = await fs.readFile(path);
  return new Blob([buffer], { type: mimeType });
}

async function removeFile(path: string, logger?: Logger): Promise<void> {
  try {
    await fs.unlink(path);
  } catch (error) {
    logger?.warn?.('Failed to cleanup temporary multipart file.', { path, error });
  }
}

export async function parseMultipartRequest(
  request: Request,
  options: MultipartParserOptions = {},
): Promise<MultipartParseResult> {
  const { limits, tempDir, logger } = options;

  const contentType = request.headers.get('content-type');
  ensureMultipart(contentType);
  if (!request.body) {
    throw new Error('Multipart request body is empty.');
  }

  const temporaryDirectory = await createTempDir(tempDir);
  const fields: Record<string, string[]> = {};
  const files: StoredFile[] = [];
  const fileWrites: Promise<void>[] = [];

  await new Promise<void>((resolve, reject) => {
    const busboy = Busboy({
      headers: { 'content-type': contentType },
      limits,
    });

    busboy.on('field', (name, value) => {
      if (!fields[name]) {
        fields[name] = [];
      }

      fields[name].push(value);
    });

    busboy.on('file', (fieldName, stream, info: FileInfo) => {
      const { filename, mimeType, encoding } = info;
      const uniqueName = `${randomUUID()}-${filename}`;
      const filePath = join(temporaryDirectory, uniqueName);
      const writeStream = createWriteStream(filePath);
      let bytes = 0;

      stream.on('data', (chunk: Buffer) => {
        bytes += chunk.length;
      });

      const writePromise = pipeline(stream, writeStream)
        .then(() => {
          files.push({
            fieldName,
            filename,
            mimeType,
            encoding,
            size: bytes,
            path: filePath,
            toBlob: () => toBlob(filePath, mimeType),
            cleanup: () => removeFile(filePath, logger),
          });
        })
        .catch((error) => {
          logger?.error('Failed to persist multipart file stream.', {
            fieldName,
            filename,
            error,
          });
          throw error;
        });

      fileWrites.push(writePromise);
    });

    busboy.on('error', (error) => {
      logger?.error('Multipart parser encountered an error.', { error });
      reject(error);
    });

    busboy.on('close', () => {
      Promise.all(fileWrites).then(() => resolve()).catch(reject);
    });

    const nodeStream = Readable.fromWeb(request.body as ReadableStream<Uint8Array>);
    nodeStream.pipe(busboy);
  });

  return { fields, files };
}
