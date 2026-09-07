import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { defineConfig } from "hardhat/config";
import hardhatCommonToolsPlugin from "../src/index.js";

export default defineConfig({
  plugins: [hardhatToolboxMochaEthersPlugin, hardhatCommonToolsPlugin],
  solidity: "0.8.24",
});
