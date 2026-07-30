import fs from "node:fs";
import path from "node:path";
import solc from "solc";

const root = process.cwd();
const sourceDir = path.join(root, "contracts", "src");
const sourceNames = fs.readdirSync(sourceDir).filter((name) => name.endsWith(".sol"));
const sources = Object.fromEntries(
  sourceNames.map((name) => [
    `contracts/src/${name}`,
    { content: fs.readFileSync(path.join(sourceDir, name), "utf8") },
  ]),
);

function findImports(importPath) {
  const candidates = [path.join(root, importPath), path.join(root, "node_modules", importPath)];
  const resolved = candidates.find((candidate) => fs.existsSync(candidate));
  return resolved
    ? { contents: fs.readFileSync(resolved, "utf8") }
    : { error: `Import not found: ${importPath}` };
}

const input = {
  language: "Solidity",
  sources,
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
const errors = (output.errors ?? []).filter((item) => item.severity === "error");
if (errors.length) {
  for (const error of errors) process.stderr.write(`${error.formattedMessage}\n`);
  process.exit(1);
}

const vault = output.contracts["contracts/src/TokenRedemptionVault.sol"].TokenRedemptionVault;
const artifactDir = path.join(root, "contracts", "artifacts");
fs.mkdirSync(artifactDir, { recursive: true });
fs.writeFileSync(
  path.join(artifactDir, "TokenRedemptionVault.json"),
  JSON.stringify({ abi: vault.abi, bytecode: `0x${vault.evm.bytecode.object}` }, null, 2),
);
process.stdout.write("TokenRedemptionVault compiled successfully.\n");
