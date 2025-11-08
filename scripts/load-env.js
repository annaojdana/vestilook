#!/usr/bin/env node
/* eslint-disable no-console */
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const CWD = process.cwd();
const envFiles = [".env.local", ".env", ".env.test"];

envFiles.forEach((filename) => {
  const path = resolve(CWD, filename);
  if (!existsSync(path)) {
    return;
  }

  const result = config({ path });
  if (result.error) {
    console.warn(`[load-env] Failed to load ${filename}:`, result.error.message);
  } else {
    console.info(`[load-env] Loaded ${filename}`);
  }
});
