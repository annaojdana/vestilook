import type { Locator, Page } from "@playwright/test";

import { BasePage } from "./BasePage";

export class GenerationFormPage extends BasePage {
  readonly form: Locator;
  readonly quotaIndicator: Locator;
  readonly garmentInput: Locator;
  readonly garmentPlaceholder: Locator;
  readonly garmentPreview: Locator;
  readonly garmentError: Locator;
  readonly consentCheckbox: Locator;
  readonly consentWarning: Locator;
  readonly retentionSection: Locator;
  readonly submitButton: Locator;
  readonly alerts: Locator;
  readonly successAlert: Locator;
  readonly errorAlert: Locator;

  constructor(page: Page) {
    super(page);
    this.form = page.getByTestId("generation-form");
    this.quotaIndicator = page.getByTestId("quota-indicator");
    this.garmentInput = page.getByTestId("garment-upload-input");
    this.garmentPlaceholder = page.getByTestId("garment-placeholder");
    this.garmentPreview = page.getByTestId("garment-preview");
    this.garmentError = page.getByTestId("garment-error-alert");
    this.consentCheckbox = page.getByTestId("consent-checkbox");
    this.consentWarning = page.getByTestId("consent-warning-alert");
    this.retentionSection = page.getByTestId("retention-options");
    this.submitButton = page.getByTestId("generation-submit-button");
    this.alerts = page.getByTestId("generation-form-alerts");
    this.successAlert = page.getByTestId("generation-success-alert");
    this.errorAlert = page.getByTestId("generation-error-alert");
  }

  async goto() {
    await super.goto("/generations/new");
  }

  async uploadGarment(filePath: string) {
    await this.garmentInput.setInputFiles(filePath);
  }

  async acceptConsent() {
    const checked = await this.consentCheckbox.isChecked();
    if (!checked) {
      await this.consentCheckbox.check();
    }
  }

  async selectRetention(hours: number) {
    await this.page.getByTestId(`retention-option-${hours}`).click();
  }

  async submit() {
    await this.submitButton.click();
  }
}
