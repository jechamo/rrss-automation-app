import { expect, type Page } from "playwright/test";

export class ProjectPage {
  constructor(private readonly page: Page, private readonly projectId: string) {}

  async open(): Promise<void> {
    await this.page.goto(`/proyecto/${this.projectId}`);
    await expect(this.page.getByRole("heading", { name: "Dossier de negocio" }))
      .toBeVisible({ timeout: 60_000 });
  }

  async expectMarketFixtures(): Promise<void> {
    await expect(this.page.getByText("Competidor Fixture", { exact: true }).first())
      .toBeVisible({ timeout: 60_000 });
    await expect(this.page.getByText("Lead Fixture", { exact: true }).first())
      .toBeVisible({ timeout: 60_000 });
    await expect(this.page.getByText("Viral Fixture", { exact: true }).first())
      .toBeVisible({ timeout: 60_000 });
  }
}
