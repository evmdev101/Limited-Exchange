import { defineConfig } from "hardhat/config";

export default defineConfig({
  paths: {
    sources: "./contracts/src",
    tests: {
      solidity: "./test",
    },
    cache: "./.hardhat/cache",
    artifacts: "./.hardhat/artifacts",
  },
  solidity: {
    version: "0.8.36",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
});
