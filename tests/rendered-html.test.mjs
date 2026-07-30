import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Limited Exchange redemption interface", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Limited Exchange<\/title>/i);
  assert.match(html, /Burn the original/);
  assert.match(html, /Claim the limited/);
  assert.match(html, /CashX/);
  assert.match(html, /LCashX/);
  assert.match(html, /LDistroX/);
  assert.match(html, /LDivX/);
  assert.match(html, /LGSX/);
  assert.match(html, /1:1 token redemption on PulseChain/);
  assert.match(html, /role="status"/);
  assert.match(html, /property="og:image"/);
  assert.doesNotMatch(html, /Your site is taking shape|codex-preview/);
});

test("ships the source-matched theme and atomic redemption contract", async () => {
  const [page, layout, styles, packageJson, vault] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../contracts/src/TokenRedemptionVault.sol", import.meta.url), "utf8"),
  ]);

  assert.match(page, /function redeem\(\)/);
  assert.match(page, /function fundPool\(\)/);
  assert.match(page, /id: 369/);
  assert.match(page, /CashX.*LCashX/);
  assert.match(layout, /Limited Exchange/);
  assert.doesNotMatch(page, /Nexion/i);
  assert.doesNotMatch(layout, /Nexion/i);
  assert.match(styles, /--bg:\s*#282c34/);
  assert.match(styles, /--fg:\s*#9cdef2/);
  assert.match(styles, /--panel:\s*#111111/);
  assert.match(styles, /--border:\s*#355a66/);
  assert.match(styles, /--red:\s*#e06c75/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.match(vault, /burnToken\.burnFrom\(msg\.sender, amount\)/);
  assert.match(vault, /limitedToken\.safeTransfer\(msg\.sender, amount\)/);
  assert.match(vault, /ExactOutputRequired/);
  assert.match(vault, /function fund\(uint256 amount\) external onlyOwner/);
});
