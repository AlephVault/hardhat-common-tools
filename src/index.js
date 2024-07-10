const {extendEnvironment} = require("hardhat/config");
const path = require("path");
const fs = require("fs");

/**
 * Resets the deployments for the current network.
 * @param hre The hardhat runtime environment.
 * @param deploymentId The deployment id. If missing, it will be inferred.
 * @returns {Promise<void>} Nothing (async function).
 */
async function resetDeployment(hre, deploymentId) {
    const chainId = (await hre.ethers.provider.getNetwork()).chainId;
    const deploymentDir = path.resolve(
        hre.config.paths.root, "ignition", 'deployments', deploymentId || `chain-${chainId}`
    );
    try {
        fs.rmdirSync(deploymentDir, { recursive: true });
    } catch {
        try {
            fs.rmSync(deploymentDir, { recursive: true });
        } catch {}
    }
}

extendEnvironment((hre) => {
    hre.common ||= {};
    if (hre.ethers) {
        hre.common.isAddress = (value) => {
            try {
                hre.ethers.getAddress(value);
                return true;
            } catch {
                return false;
            }
        }
        hre.common.getAddress = (signer) => signer.address;
        hre.common.getSigners = async () => (await hre.ethers.getSigners());
        hre.common.getChainId = async () => {
            return BigInt((await hre.ethers.provider.getNetwork()).chainId);
        };
    } else if (hre.viem) {
        const {isAddress} = require("viem");
        hre.common.isAddress = (value) => isAddress(value, {strict: true});
        hre.common.getAddress = (signer) => signer.account.address;
        hre.common.getSigners = async () => (await hre.viem.getWalletClients());
        hre.common.getChainId = async () => {
            const signers = await hre.viem.getWalletClients();
            if (!signers || !signers.length) {
                throw new Error("It seems that this network does not have any configured account");
            }
            return BigInt(await signers[0].getChainId());
        };
    } else {
        throw new Error("It seems that neither ethers nor viem is installed in this project");
    }
    hre.common.getSigner = async (idx) => (await hre.common.getSigners())[idx];
    if (hre.ignition && !hre.ignition.resetDeployment) {
        hre.ignition.resetDeployment = (deploymentId) => resetDeployment(hre, deploymentId);
    }
});