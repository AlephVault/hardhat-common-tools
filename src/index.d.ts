import type { HardhatPlugin } from "hardhat/types/plugins";

declare module "@nomicfoundation/hardhat-ignition-ethers/types" {
  interface EthersIgnitionHelper {
    resetDeployment(deploymentId?: string): Promise<void>;
    getDeployedContract(
      contractId: string,
      deploymentId?: string,
    ): Promise<unknown>;
  }
}

declare module "@nomicfoundation/hardhat-ignition-viem/types" {
  interface ViemIgnitionHelper {
    resetDeployment(deploymentId?: string): Promise<void>;
    getDeployedContract(
      contractId: string,
      deploymentId?: string,
    ): Promise<unknown>;
  }
}

declare const hardhatCommonToolsPlugin: HardhatPlugin;

export default hardhatCommonToolsPlugin;
