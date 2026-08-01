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
  assert.match(html, /> Theme</);
  assert.match(html, /role="status"/);
  assert.match(html, /property="og:image"/);
  assert.doesNotMatch(html, /Your site is taking shape|codex-preview/);
});

test("ships the source-matched theme and atomic redemption contract", async () => {
  const [page, themePicker, themeEffects, layout, styles, packageJson, vault] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ThemePicker.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/themeEffects.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../contracts/src/TokenRedemptionVault.sol", import.meta.url), "utf8"),
  ]);

  assert.match(page, /function redeem\(\)/);
  assert.match(page, /function fundPool\(\)/);
  assert.match(page, /id: 369/);
  assert.match(page, /CashX.*LCashX/);
  assert.match(page, /0x4C450b3C2b89a2DAbE5A3eE39FF475134A30d665/);
  assert.match(page, /0xA1198e47Ac3D89903D7eCFd04a14b8Bfd72d7B03/);
  assert.match(page, /0x6df9CD07BF067b42A700dc679bD9325Ff61Da8f3/);
  assert.match(page, /0x395127a44Ac1CDc609C8CC9d048E096e8E8fC30e/);
  assert.match(page, /Total burned/);
  assert.match(page, /Unique wallets/);
  assert.match(page, /<ThemePicker \/>/);
  assert.match(themePicker, /#282c34.*#9cdef2.*#111111.*#355a66.*#e06c75/);
  assert.match(themePicker, /Apply Custom Theme/);
  assert.match(themePicker, /limited-exchange-theme-v1/);
  assert.match(themePicker, /setPointerCapture/);
  assert.match(themePicker, /function onHeaderPointerMove/);
  assert.match(themePicker, /function snapZoneFor/);
  assert.match(themePicker, /Theme window pro tip/);
  assert.match(themePicker, /Drag to the top for fullscreen/);
  assert.match(themePicker, /proTipSeen = true/);
  assert.match(themePicker, /light:\s*\{ pattern: "dots" \}/);
  assert.match(themePicker, /cyberpunk:\s*\{ pattern: "synapse" \}/);
  assert.match(themePicker, /retrowave:\s*\{ pattern: "embers" \}/);
  assert.match(themePicker, /ocean:\s*\{ pattern: "constellations" \}/);
  assert.match(themeEffects, /function _initRain\(\)/);
  assert.match(themeEffects, /function _initPerlinFlow\(\)/);
  assert.match(themeEffects, /function _initSparkles\(\)/);
  assert.match(styles, /body\.bg-pattern-dots/);
  assert.match(styles, /\.theme-window\s*\{[\s\S]*top:\s*50vh[\s\S]*left:\s*50vw/);
  assert.match(styles, /\.theme-window-title[\s\S]*cursor:\s*grab/);
  assert.match(styles, /\.theme-snap-hint/);
  assert.match(styles, /\.theme-pro-tip/);
  assert.match(styles, /@keyframes th-modal-slide/);
  assert.match(layout, /Limited Exchange/);
  assert.doesNotMatch(page, /Nexion/i);
  assert.doesNotMatch(layout, /Nexion/i);
  assert.match(styles, /--bg:\s*#282c34/);
  assert.match(styles, /--fg:\s*#9cdef2/);
  assert.match(styles, /--panel:\s*#111111/);
  assert.match(styles, /--border:\s*#355a66/);
  assert.match(styles, /--red:\s*#e06c75/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.match(vault, /BURN_SINK/);
  assert.match(vault, /safeTransferFrom\(msg\.sender, BURN_SINK, amount\)/);
  assert.match(vault, /supplyBefore - supplyAfter/);
  assert.match(vault, /ExactBurnRequired/);
  assert.match(vault, /limitedToken\.safeTransfer\(msg\.sender, amount\)/);
  assert.match(vault, /ExactOutputRequired/);
  assert.match(vault, /uint256 public totalBurned/);
  assert.match(vault, /uint256 public totalLimitedDistributed/);
  assert.match(vault, /uint256 public redemptionCount/);
  assert.match(vault, /uint256 public uniqueRedeemers/);
  assert.match(vault, /function fund\(uint256 amount\) external onlyOwner/);
});
