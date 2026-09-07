import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";
require("..");

const config: HardhatUserConfig = {
  solidity: "0.8.24",
};

export default config;
