import path from "node:path";
import fs from "node:fs/promises";

import { chromium, type FullConfig } from "@playwright/test";

import { LoginPage } from "./page-objects/LoginPage";

const STORAGE_STATE_PATH = path.resolve(process.cwd(), "tests/e2e/.auth/state.json");

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Brak wymaganej zmiennej środowiskowej: ${name}`);
  }
  return value;
}

export default async function globalSetup(config: FullConfig) {
  const email = requireEnv("E2E_USERNAME");
  const password = requireEnv("E2E_PASSWORD");

  const project = config.projects[0];
  const baseURL = (project?.use?.baseURL as string | undefined) ?? process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL });
  const loginPage = new LoginPage(page);

  await loginPage.goto({ redirect: "/generations/new" });
  await loginPage.login(email, password);
  await page.waitForURL("**/generations/new", { waitUntil: "networkidle" });

  await fs.mkdir(path.dirname(STORAGE_STATE_PATH), { recursive: true });
  await page.context().storageState({ path: STORAGE_STATE_PATH });
  await browser.close();
}
