import path from "node:path";

import { expect, test } from "@playwright/test";

import { GenerationFormPage } from "./page-objects/GenerationFormPage";

const REQUIRED_ENV_VARS = ["E2E_USERNAME", "E2E_PASSWORD"] as const;
const missingEnvVars = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
const SMALL_GARMENT = path.resolve(process.cwd(), "tests/e2e/fixtures/garment-small.png");

test.describe("Generowanie stylizacji — walidacja danych", () => {
  test.skip(
    missingEnvVars.length > 0,
    `Brak wymaganych zmiennych środowiskowych: ${missingEnvVars.join(", ")}`
  );

  test("plik poniżej minimalnej rozdzielczości blokuje wysłanie formularza", async ({ page }) => {
    const generationPage = new GenerationFormPage(page);

    await generationPage.goto();
    await expect(generationPage.submitButton).toBeDisabled();

    await generationPage.uploadGarment(SMALL_GARMENT);

    await expect(generationPage.garmentError).toBeVisible();
    await expect(generationPage.submitButton).toBeDisabled();
    await expect(generationPage.garmentPlaceholder).toBeVisible();
    await expect(generationPage.garmentPreview).toHaveCount(0);
  });
});
