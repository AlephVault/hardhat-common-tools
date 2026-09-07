import fs from "fs";
import path from "path";
import {getContract, isAddress, keccak256, stringToHex} from "viem";

import {
    fetchLogs as fetchEthersLogs,
    fetchTransactionLogs as fetchEthersTransactionLogs,
    watchLogs as watchEthersLogs,
} from "./eventLogs/ethers.js";
import {
    fetchLogs as fetchViemLogs,
    fetchTransactionLogs as fetchViemTransactionLogs,
    watchLogs as watchViemLogs,
} from "./eventLogs/viem.js";

/**
 * Resets the deployments for the current network.
 * @param hre The hardhat runtime environment.
 * @param deploymentId The deployment id. If missing, it will be inferred.
 * @returns {Promise<void>} Nothing (async function).
 */
async function resetDeployment(hre, deploymentId) {
    const chainId = await hre.common.getChainId();
    const deploymentDir = path.resolve(
        hre.config.paths.root, "ignition", "deployments", deploymentId || `chain-${chainId}`
    );
    fs.rmSync(deploymentDir, {recursive: true, force: true});
}

/**
 * Normalizes the options for a transfer operation.
 * @param txOpts The transaction options or amount.
 * @returns {Promise<{}|{value: (string|number|bigint)}>}
 */
async function normalizeTransferTxOptions(txOpts) {
    if (txOpts === undefined || txOpts === null) {
        txOpts = {};
    }
    if (typeof txOpts === "string" || typeof txOpts === "number" || typeof txOpts === "bigint") {
        txOpts = {value: txOpts};
    }

    try {
        txOpts.value = BigInt(txOpts.value);
    } catch {
        throw new Error("A non-empty valid value must be specified");
    }

    return txOpts;
}

/**
 * Given an account index, normalizes it to get an account.
 * If undefined, it uses the default one.
 * @param hre The hardhat runtime environment.
 * @param account The account index.
 * @returns {Promise<void>} The signer (async function).
 */
async function normalizeSigner(hre, account) {
    let signer = await hre.common.getSigner(0);

    if (account !== undefined) {
        if (typeof account === "bigint") {
            account = Number(account);
        }

        if (typeof account === "number") {
            signer = await hre.common.getSigner(account);
        } else {
            signer = account;
        }
    }

    return signer;
}

async function getConnection(hre) {
    return hre.network.getOrCreate();
}

async function getEthersConnection(hre) {
    const connection = await getConnection(hre);
    return "ethers" in connection ? connection : undefined;
}

async function getViemConnection(hre) {
    const connection = await getConnection(hre);
    return "viem" in connection ? connection : undefined;
}

async function getActiveConnection(hre) {
    const connection = await getConnection(hre);
    if ("ethers" in connection || "viem" in connection) {
        return connection;
    }
    throw new Error("It seems that neither ethers nor viem is installed in this project");
}

/**
 * Inspects the ignition addresses for a deployment id and retrieves
 * a contract instance from a given deployed contract (future) id.
 * @param hre The hardhat runtime environment.
 * @Param contractId The deployed contract (future) id.
 * @param deploymentId The deployment id.
 * @return {Promise<*>} A contract instance (async function).
 */
async function getDeployedContract(hre, contractId, deploymentId) {
    const chainId = await hre.common.getChainId();
    deploymentId ||= `chain-${chainId}`;

    let addresses = {};
    try {
        const fullPath = path.resolve(
            hre.config.paths.root, "ignition", "deployments", deploymentId, "deployed_addresses.json"
        );
        addresses = JSON.parse(fs.readFileSync(fullPath, {encoding: "utf8"}));
    } catch {}

    const address = addresses[contractId];
    if (!address) {
        throw new Error(
            `It seems that the contract ${contractId} is not deployed in the ` +
            `deployment id ${deploymentId}. Ensure the deployment is actually ` +
            "done for that contract."
        );
    }

    let artifact = {};
    try {
        const artifactPath = path.resolve(
            hre.config.paths.root, "ignition", "deployments", deploymentId, "artifacts", contractId + ".json"
        );
        artifact = JSON.parse(fs.readFileSync(artifactPath, {encoding: "utf8"}));
    } catch {}
    const abi = artifact.abi;
    if (!abi || !abi.length) {
        throw new Error(
            `The contract data for the contract id ${contractId} in the deployment ` +
            `id ${deploymentId} seems to be corrupted. Either you're in serious ` +
            `troubles or this is your local network and you just need to redeploy ` +
            `everything to make this work. Keep in touch with your team if this is ` +
            `related to corrupted contract deployment data in a mainnet.`
        );
    }

    return hre.common.getContractAt(abi, address);
}

function installIgnitionHelpers(hre, connection) {
    if (!connection.ignition || connection.ignition.resetDeployment) {
        return;
    }

    connection.ignition.resetDeployment = (deploymentId) => resetDeployment(hre, deploymentId);
    connection.ignition.getDeployedContract = (contractId, deploymentId) => getDeployedContract(
        hre, contractId, deploymentId
    );
}

function installCommonHelpers(hre) {
    hre.common ||= {};

    hre.common.isAddress = (value) => isAddress(value, {strict: true});
    hre.common.getAddress = (signer) => signer.account?.address ?? signer.address;
    hre.common.getSigner = async (idx) => (await hre.common.getSigners())[idx];
    hre.common.getContractAddress = (contract) => contract.address ?? contract.target;
    hre.common.keccak256 = (text) => keccak256(stringToHex(text));

    hre.common.getSigners = async () => {
        const ethersConnection = await getEthersConnection(hre);
        if (ethersConnection !== undefined) {
            return ethersConnection.ethers.getSigners();
        }
        const viemConnection = await getViemConnection(hre);
        if (viemConnection !== undefined) {
            return viemConnection.viem.getWalletClients();
        }
        throw new Error("It seems that neither ethers nor viem is installed in this project");
    };

    hre.common.getChainId = async () => {
        const ethersConnection = await getEthersConnection(hre);
        if (ethersConnection !== undefined) {
            return BigInt((await ethersConnection.ethers.provider.getNetwork()).chainId);
        }
        const viemConnection = await getViemConnection(hre);
        if (viemConnection !== undefined) {
            return BigInt(await (await viemConnection.viem.getPublicClient()).getChainId());
        }
        throw new Error("It seems that neither ethers nor viem is installed in this project");
    };

    hre.common.getContractAt = async (artifactOrAbi, address, account) => {
        const ethersConnection = await getEthersConnection(hre);
        if (ethersConnection !== undefined) {
            let contract = await ethersConnection.ethers.getContractAt(artifactOrAbi, address);
            if (typeof account === "bigint") {
                account = Number(account);
            }
            if (typeof account === "number") {
                account = await hre.common.getSigner(Number(account));
            }
            if (account) {
                contract = contract.connect(account);
            }
            return contract;
        }

        const viemConnection = await getViemConnection(hre);
        if (viemConnection !== undefined) {
            if (typeof account === "number" || typeof account === "bigint") {
                account = await hre.common.getSigner(Number(account));
            }

            if (typeof artifactOrAbi === "string") {
                if (account) {
                    return viemConnection.viem.getContractAt(artifactOrAbi, address, {client: {wallet: account}});
                }
                return viemConnection.viem.getContractAt(artifactOrAbi, address);
            }

            const publicClient = await viemConnection.viem.getPublicClient();
            const walletClients = await hre.common.getSigners();
            if (!walletClients.length) {
                throw new Error("It seems that this network does not have any configured account");
            }
            const walletClient = account ?? walletClients[0];
            return getContract({
                address,
                client: {
                    public: publicClient,
                    wallet: walletClient,
                },
                abi: artifactOrAbi,
            });
        }

        throw new Error("It seems that neither ethers nor viem is installed in this project");
    };

    hre.common.send = async (contract, method, args, txOpts) => {
        contract = await contract;
        const methodName = method.split("(")[0];

        const ethersConnection = await getEthersConnection(hre);
        if (ethersConnection !== undefined) {
            let {account, from, gas, gasPrice, maxFeePerGas, maxPriorityFeePerGas, value, eip155} = txOpts || {};
            const newOpts = {
                gasLimit: gas, gasPrice, maxFeePerGas, maxPriorityFeePerGas,
                value, chainId: eip155 ? (await hre.common.getChainId()) : undefined
            };
            if (account !== undefined) {
                if (typeof account === "bigint") {
                    account = Number(account);
                }
                if (typeof account === "number") {
                    account = await hre.common.getSigner(account);
                }
                contract = contract.connect(account);
            } else if (from) {
                newOpts.from = from;
            }
            if (contract[method] === undefined) {
                throw new Error(
                    `The contract does not expose a write function named ${methodName}. ` +
                    "Use hre.common.call for view/pure functions."
                );
            }
            return contract[method](...args, newOpts);
        }

        const viemConnection = await getViemConnection(hre);
        if (viemConnection !== undefined) {
            let {account, from, gas, gasPrice, maxFeePerGas, maxPriorityFeePerGas, value, eip155} = txOpts || {};
            const newOpts = {
                gas, gasPrice, maxFeePerGas, maxPriorityFeePerGas,
                value, chainId: eip155 ? (await hre.common.getChainId()) : undefined
            };
            if (account !== undefined) {
                if (typeof account === "bigint") {
                    account = Number(account);
                }
                if (typeof account === "number") {
                    account = await hre.common.getSigner(Number(account));
                }
                newOpts.account = account.account ?? account;
            } else if (from) {
                newOpts.account = from;
            }
            if (contract.write?.[methodName] === undefined) {
                throw new Error(
                    `The contract does not expose a write function named ${methodName}. ` +
                    "Use hre.common.call for view/pure functions."
                );
            }
            return contract.write[methodName](args, newOpts);
        }

        throw new Error("It seems that neither ethers nor viem is installed in this project");
    };

    hre.common.call = async (contract, method, args) => {
        contract = await contract;

        const connection = await getActiveConnection(hre);
        if ("ethers" in connection) {
            return contract[method](...args);
        }

        const methodName = method.split("(")[0];
        if (contract.read?.[methodName] === undefined) {
            throw new Error(
                `The contract does not expose a read function named ${methodName}. ` +
                "Use hre.common.send for non-view/non-pure functions."
            );
        }
        return contract.read[methodName](args);
    };

    hre.common.getLogs = async (...args) => {
        const connection = await getActiveConnection(hre);
        return "ethers" in connection ? fetchEthersLogs(hre, ...args) : fetchViemLogs(hre, ...args);
    };
    hre.common.getTransactionLogs = async (...args) => {
        const connection = await getActiveConnection(hre);
        return "ethers" in connection
            ? fetchEthersTransactionLogs(hre, ...args)
            : fetchViemTransactionLogs(hre, ...args);
    };
    hre.common.watchLogs = async (...args) => {
        const connection = await getActiveConnection(hre);
        return "ethers" in connection ? watchEthersLogs(hre, ...args) : watchViemLogs(hre, ...args);
    };

    hre.common.getBalance = async (address) => {
        const ethersConnection = await getEthersConnection(hre);
        if (ethersConnection !== undefined) {
            return ethersConnection.ethers.provider.getBalance(address);
        }
        const viemConnection = await getViemConnection(hre);
        if (viemConnection !== undefined) {
            return (await viemConnection.viem.getPublicClient()).getBalance({address});
        }
        throw new Error("It seems that neither ethers nor viem is installed in this project");
    };

    hre.common.transfer = async (to, txOpts) => {
        txOpts = await normalizeTransferTxOptions(txOpts);
        let {account, gas, gasPrice, maxFeePerGas, maxPriorityFeePerGas, value, eip155} = txOpts || {};

        const ethersConnection = await getEthersConnection(hre);
        if (ethersConnection !== undefined) {
            const newOpts = {
                to, gasLimit: gas, gasPrice, maxFeePerGas, maxPriorityFeePerGas,
                value, chainId: eip155 ? (await hre.common.getChainId()) : undefined
            };
            const signer = await normalizeSigner(hre, account);
            return signer.sendTransaction(newOpts);
        }

        const viemConnection = await getViemConnection(hre);
        if (viemConnection !== undefined) {
            const newOpts = {
                to, gas, gasPrice, maxFeePerGas, maxPriorityFeePerGas,
                value, chainId: eip155 ? (await hre.common.getChainId()) : undefined
            };
            const signer = await normalizeSigner(hre, account);
            return signer.sendTransaction(newOpts);
        }

        throw new Error("It seems that neither ethers nor viem is installed in this project");
    };

}

const hardhatCommonToolsPlugin = {
    id: "hardhat-common-tools",
    npmPackage: "hardhat-common-tools",
    hookHandlers: {
        hre: async () => ({
            default: async () => ({
                created: async (_context, hre) => {
                    installCommonHelpers(hre);
                },
            }),
        }),
        network: async () => ({
            default: async () => ({
                newConnection: async (context, next) => {
                    const connection = await next(context);
                    installIgnitionHelpers(context, connection);
                    return connection;
                },
            }),
        }),
    },
};

export default hardhatCommonToolsPlugin;
