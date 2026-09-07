import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { defineConfig } from "hardhat/config";
import hardhatCommonToolsPlugin from "../src/index.js";

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin, hardhatCommonToolsPlugin],
  solidity: "0.8.24",
});
