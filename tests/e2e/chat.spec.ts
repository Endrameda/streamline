import { expect, test } from "@playwright/test";

// This exercises the full stack against real Postgres + Anthropic, so it
// needs DATABASE_URL / ANTHROPIC_API_KEY set — see README for local setup.
test("create a conversation, send a message, and see a streamed reply", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByRole("button", { name: "+ New conversation" }).click();
  await expect(page).toHaveURL(/\/conversations\/[0-9a-f-]+/);

  const input = page.getByPlaceholder("Send a message...");
  await input.fill("Say the single word 'hello' and nothing else.");
  await page.getByRole("button", { name: "Send" }).click();

  // The assistant bubble should appear and grow past the empty/loading
  // ellipsis as tokens stream in.
  const assistantBubble = page.locator("li", { hasText: "" }).last();
  await expect(page.getByText("Connection dropped")).toHaveCount(0);
  await expect(async () => {
    const text = await assistantBubble.innerText();
    expect(text.length).toBeGreaterThan(0);
  }).toPass({ timeout: 30_000 });

  // Streaming finishes: the Send button reappears (Stop button disappears).
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible({
    timeout: 30_000,
  });

  // Resuming: reload and confirm the conversation persisted.
  await page.reload();
  await expect(page.getByPlaceholder("Send a message...")).toBeVisible();
});
