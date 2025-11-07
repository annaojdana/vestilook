import path from "node:path";

import { expect, test } from "@playwright/test";

import { GenerationFormPage } from "./page-objects/GenerationFormPage";

const REQUIRED_ENV_VARS = ["E2E_USERNAME", "E2E_PASSWORD"] as const;
const missingEnvVars = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
const GARMENT_FIXTURE = path.resolve(process.cwd(), "tests/e2e/fixtures/garment.png");

test.describe("Generowanie stylizacji — dostęp", () => {
  test.skip(
    missingEnvVars.length > 0,
    `Brak wymaganych zmiennych środowiskowych: ${missingEnvVars.join(", ")}`
  );

  test("sesja z globalSetup umożliwia przygotowanie formularza generacji bez ponownego logowania", async ({ page }) => {
    const generationPage = new GenerationFormPage(page);

    // Arrange
    await generationPage.goto();

    // Assert
    await expect(generationPage.form).toBeVisible();
    await expect(generationPage.quotaIndicator).toBeVisible();
    await expect(generationPage.garmentPlaceholder).toBeVisible();
    await expect(generationPage.submitButton).toBeDisabled();

    await generationPage.uploadGarment(GARMENT_FIXTURE);
    await expect(generationPage.garmentPreview).toBeVisible();
    await generationPage.acceptConsent();
    await generationPage.selectRetention(24);

    await expect(generationPage.submitButton).toBeEnabled();
  });
});
