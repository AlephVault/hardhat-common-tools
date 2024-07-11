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
        hre.common.getContractAt = async (artifactOrAbi, address, account) => {
            let contract = await hre.ethers.getContractAt(artifactOrAbi, address);
            if (typeof account === "bigint") {
                account = account.toNumber();
            }
            if (typeof account === "number") {
                account = await hre.common.getSigner(Number(account));
            }
            if (account) {
                contract = contract.connect(account);
            }
            return contract;
        }
    } else if (hre.viem) {
        const {isAddress, getContract} = require("viem");
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
        hre.common.getContractAt = async (artifactOrAbi, address, account) => {
            if (typeof account === "number" || typeof account === "bigint") {
                account = await hre.common.getSigner(Number(account));
            }

            if (typeof artifactOrAbi === "string") {
                if (account) {
                    const handlerArgs = {client: {wallet: account}};
                    return await hre.viem.getContractAt(artifactOrAbi, address, handlerArgs);
                } else {
                    return await hre.viem.getContractAt(artifactOrAbi, address);
                }
            } else {
                const publicClient = await hre.viem.getPublicClient(hre.network.provider);
                const walletClients = await hre.common.getSigners();
                if (!walletClients.length) {
                    const {DefaultWalletClientNotFoundError} =
                        await import("@nomicfoundation/hardhat-viem/internal/errors.js");
                    throw new DefaultWalletClientNotFoundError(hre.network.name);
                }
                const walletClient = walletClients[0];
                return getContract({
                    address,
                    client: {
                        public: publicClient,
                        wallet: walletClient,
                    },
                    abi: artifactOrAbi,
                });
            }
        }
    } else {
        throw new Error("It seems that neither ethers nor viem is installed in this project");
    }
    hre.common.getSigner = async (idx) => (await hre.common.getSigners())[idx];
    if (hre.ignition && !hre.ignition.resetDeployment) {
        hre.ignition.resetDeployment = (deploymentId) => resetDeployment(hre, deploymentId);
    }
});