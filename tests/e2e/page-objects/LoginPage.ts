import type { Locator, Page } from "@playwright/test";

import { BasePage } from "./BasePage";

export class LoginPage extends BasePage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorAlert: Locator;

  constructor(page: Page) {
    super(page);
    this.emailInput = page.getByTestId("login-email");
    this.passwordInput = page.getByTestId("login-password");
    this.submitButton = page.getByTestId("login-submit");
    this.errorAlert = page.getByTestId("login-error-alert");
  }

  async goto(options: { redirect?: string } = {}) {
    const target = options.redirect
      ? `/auth/login?redirect=${encodeURIComponent(options.redirect)}`
      : "/auth/login";
    await super.goto(target);
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
