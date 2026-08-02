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

test("server-renders the Limited Exchange burn interface", async () => {
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
  assert.match(html, /1:1 burn exchange on PulseChain/);
  assert.match(html, /class="nav-tab active"[^>]*aria-current="page"[^>]*>Burn Exchange</);
  assert.match(html, /aria-label="Telegram"/);
  assert.match(html, /aria-label="X"/);
  assert.match(html, /aria-label="DexScreener"/);
  assert.match(html, /aria-label="YouTube"/);
  assert.match(html, /Local contract tests passed/);
  assert.match(html, /Awaiting LCashX contract/);
  assert.doesNotMatch(html, /Owner pool management|Owner refill console/);
  assert.match(html, /> Theme</);
  assert.match(html, /role="status"/);
  assert.match(html, /property="og:image"/);
  assert.doesNotMatch(html, /Your site is taking shape|codex-preview/);
});

test("ships the source-matched theme and atomic burn exchange contracts", async () => {
  const [page, themePicker, themeEffects, layout, styles, packageJson, core, burnExchanges, deploymentConfig, compiler, hardhatConfig, remixGuide] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ThemePicker.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/themeEffects.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../contracts/src/BurnExchangeCore.sol", import.meta.url), "utf8"),
    readFile(new URL("../contracts/src/BurnExchanges.sol", import.meta.url), "utf8"),
    readFile(new URL("../contracts/deployment/pulsechain-pools.json", import.meta.url), "utf8"),
    readFile(new URL("../scripts/compile-contracts.mjs", import.meta.url), "utf8"),
    readFile(new URL("../hardhat.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../contracts/REMIX-DEPLOYMENT.md", import.meta.url), "utf8"),
  ]);

  assert.match(page, /function burnAndClaim\(\)/);
  assert.match(page, /function fundPool\(\)/);
  assert.match(page, /id: 369/);
  assert.match(page, /CashX.*LCashX/);
  assert.match(page, /0x4C450b3C2b89a2DAbE5A3eE39FF475134A30d665/);
  assert.match(page, /0xA1198e47Ac3D89903D7eCFd04a14b8Bfd72d7B03/);
  assert.match(page, /0x6df9CD07BF067b42A700dc679bD9325Ff61Da8f3/);
  assert.match(page, /0x395127a44Ac1CDc609C8CC9d048E096e8E8fC30e/);
  assert.match(page, /Total burned/);
  assert.match(page, /Unique wallets/);
  assert.match(page, /navigator\.clipboard\.writeText\(address\)/);
  assert.match(page, /Copy.*contract address/);
  assert.match(page, /Address pending/);
  assert.match(page, /Limited token contract/);
  assert.match(page, /Burn exchange contract/);
  assert.match(page, /copyAddress\(pair\.receiveAddress, pair\.receive\)/);
  assert.match(page, /copyAddress\(pair\.exchangeAddress, `\$\{pair\.burn\} burn exchange`\)/);
  assert.match(page, /Burn exchange code/);
  assert.match(page, /Local tests passed/);
  assert.match(page, /busy \|\| !configured/);
  assert.match(page, /\{configured && \(/);
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
  assert.match(styles, /\.topbar\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) auto minmax\(0, 1fr\)/);
  assert.match(styles, /\.nav-tab\s*\{/);
  assert.match(styles, /\.nav-actions\s*\{/);
  assert.match(styles, /\.topbar\s*\{[\s\S]*position:\s*sticky[\s\S]*top:\s*0/);
  assert.match(styles, /\.social-icon\s*\{/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.match(core, /BURN_SINK/);
  assert.match(core, /abstract contract BurnExchangeCore/);
  assert.match(core, /safeTransferFrom\(msg\.sender, BURN_SINK, amount\)/);
  assert.match(core, /supplyBefore - supplyAfter/);
  assert.match(core, /ExactBurnRequired/);
  assert.match(core, /limitedToken\.safeTransfer\(msg\.sender, amount\)/);
  assert.match(core, /ExactOutputRequired/);
  assert.match(core, /uint256 public totalBurned/);
  assert.match(core, /uint256 public totalLimitedDistributed/);
  assert.match(core, /uint256 public exchangeCount/);
  assert.match(core, /uint256 public uniqueExchangers/);
  assert.match(core, /function fund\(uint256 amount\) external onlyOwner/);
  assert.match(core, /function burnAndClaim\(uint256 amount\)/);
  assert.match(burnExchanges, /contract CashXBurnExchange is BurnExchangeCore/);
  assert.match(burnExchanges, /contract DistroXBurnExchange is BurnExchangeCore/);
  assert.match(burnExchanges, /contract DivXBurnExchange is BurnExchangeCore/);
  assert.match(burnExchanges, /contract GSXBurnExchange is BurnExchangeCore/);
  assert.match(burnExchanges, /BurnExchangeCore\(ORIGINAL_TOKEN, limitedToken_, initialOwner\)/);
  assert.match(deploymentConfig, /"limitedToken": null/);
  assert.match(deploymentConfig, /"burnExchange": null/);
  assert.match(compiler, /CashXBurnExchange/);
  assert.match(compiler, /GSXBurnExchange/);
  assert.match(compiler, /evmVersion: "paris"/);
  assert.match(hardhatConfig, /evmVersion: "paris"/);
  assert.match(hardhatConfig, /hardfork: "merge"/);
  assert.match(remixGuide, /0\.8\.36\+commit\.8a079791/);
  assert.match(remixGuide, /EVM version: `paris`/);
  assert.match(remixGuide, /Optimization runs: `200`/);
  assert.match(remixGuide, /Chain ID: `369`/);
});

test("compiles four deployable pool artifacts with the required constructor inputs", async () => {
  const contractNames = [
    "CashXBurnExchange",
    "DistroXBurnExchange",
    "DivXBurnExchange",
    "GSXBurnExchange",
  ];

  for (const contractName of contractNames) {
    const artifact = JSON.parse(
      await readFile(new URL(`../contracts/artifacts/${contractName}.json`, import.meta.url), "utf8"),
    );
    const constructor = artifact.abi.find((entry) => entry.type === "constructor");
    const functions = new Set(
      artifact.abi.filter((entry) => entry.type === "function").map((entry) => entry.name),
    );

    assert.equal(artifact.contractName, contractName);
    assert.match(artifact.compiler.version, /^0\.8\.36\+commit\.8a079791/);
    assert.equal(artifact.compiler.evmVersion, "paris");
    assert.deepEqual(artifact.compiler.optimizer, { enabled: true, runs: 200 });
    assert.match(artifact.bytecode, /^0x[0-9a-f]{100,}$/i);
    assert.deepEqual(
      constructor.inputs.map((input) => [input.name, input.type]),
      [["limitedToken_", "address"], ["initialOwner", "address"]],
    );
    for (const requiredFunction of ["burnAndClaim", "fund", "pause", "unpause", "reserve", "totalBurned"]) {
      assert.equal(functions.has(requiredFunction), true, `${contractName} is missing ${requiredFunction}`);
    }
  }
});
