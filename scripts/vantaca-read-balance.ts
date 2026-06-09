import { chromium } from "playwright";

type BalanceRead = {
  externalBillingId: string;
  unitAddress: string;
  residentName: string;
  email?: string;
  balance: number;
  balanceReference: string;
  asOf: string;
};

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name}.`);
  return value;
}

function optional(name: string) {
  return process.env[name] || undefined;
}

function parseBalance(text: string) {
  const match = text.match(/-?\$?\s*[\d,]+(?:\.\d{2})?/);
  if (!match) throw new Error(`Could not read balance from text: ${text}`);
  return Number(match[0].replace(/[$,\s]/g, ""));
}

async function postToReviewQueue(record: BalanceRead) {
  const baseUrl = required("HOA_APP_BASE_URL").replace(/\/$/, "");
  const secret = required("INBOUND_EMAIL_SHARED_SECRET");
  const response = await fetch(`${baseUrl}/api/vantaca/import`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-hoa-sync-secret": secret },
    body: JSON.stringify({ records: [record] })
  });
  if (!response.ok) throw new Error(`Review queue import failed with ${response.status}: ${await response.text()}`);
  return response.json() as Promise<unknown>;
}

async function main() {
  const query = process.argv.slice(2).join(" ").trim();
  if (!query) throw new Error("Pass an address/account search term, for example: npm run vantaca:read-balance -- \"<unit address or account number>\"");

  const browser = await chromium.launch({ headless: optional("VANTACA_HEADLESS") !== "false", channel: optional("VANTACA_BROWSER_CHANNEL") });
  const page = await browser.newPage();
  try {
    await page.goto(required("VANTACA_LOGIN_URL"), { waitUntil: "domcontentloaded" });
    const usernameSelector = optional("VANTACA_USERNAME_SELECTOR");
    const passwordSelector = optional("VANTACA_PASSWORD_SELECTOR");
    const submitSelector = optional("VANTACA_SUBMIT_SELECTOR");
    if (usernameSelector && passwordSelector && submitSelector) {
      await page.fill(usernameSelector, required("VANTACA_USERNAME"));
      await page.fill(passwordSelector, required("VANTACA_PASSWORD"));
      await page.click(submitSelector);
      await page.waitForLoadState("networkidle");
    } else {
      console.log("Login selectors were not provided. Complete login manually in the opened browser, then press Enter here.");
      await new Promise<void>((resolve) => process.stdin.once("data", () => resolve()));
    }

    await page.fill(required("VANTACA_SEARCH_SELECTOR"), query);
    const searchSubmit = optional("VANTACA_SEARCH_SUBMIT_SELECTOR");
    if (searchSubmit) await page.click(searchSubmit);
    await page.waitForSelector(required("VANTACA_RESULT_SELECTOR"), { timeout: 30_000 });
    await page.click(required("VANTACA_RESULT_SELECTOR"));
    await page.waitForSelector(required("VANTACA_BALANCE_SELECTOR"), { timeout: 30_000 });

    const balanceText = (await page.locator(required("VANTACA_BALANCE_SELECTOR")).first().innerText()).trim();
    const addressText = optional("VANTACA_ADDRESS_SELECTOR")
      ? (await page.locator(required("VANTACA_ADDRESS_SELECTOR")).first().innerText()).trim()
      : query;
    const nameText = optional("VANTACA_NAME_SELECTOR")
      ? (await page.locator(required("VANTACA_NAME_SELECTOR")).first().innerText()).trim()
      : "";
    const accountText = optional("VANTACA_ACCOUNT_SELECTOR")
      ? (await page.locator(required("VANTACA_ACCOUNT_SELECTOR")).first().innerText()).trim()
      : query;
    const emailText = optional("VANTACA_EMAIL_SELECTOR")
      ? (await page.locator(required("VANTACA_EMAIL_SELECTOR")).first().innerText()).trim()
      : undefined;

    const record: BalanceRead = {
      externalBillingId: accountText,
      unitAddress: addressText,
      residentName: nameText,
      email: emailText,
      balance: parseBalance(balanceText),
      balanceReference: `playwright:${query}`,
      asOf: new Date().toISOString()
    };
    const result = await postToReviewQueue(record);
    console.log(JSON.stringify({ record, result }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
