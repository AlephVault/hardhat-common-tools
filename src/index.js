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

/**
 * Normalizes the options for a transfer operation.
 * @param txOpts The transaction options or amount.
 * @returns {Promise<{}|{value: (string|number|bigint)}>}
 */
async function normalizeTransferTxOptions(txOpts) {
    // This normalization only makes sense for TRANSFER operations,
    // where a numeric value is required.

    if (txOpts === undefined || txOpts === null) {
        txOpts = {};
    }
    if (typeof txOpts === "string" || typeof txOpts === "number" || typeof txOpts === "bigint") {
        txOpts = {value: txOpts}
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
            account = account.toNumber();
        }

        if (typeof account === "number") {
            signer = await hre.common.getSigner(account);
        } else {
            signer = account;
        }
    }

    return signer;
}

/**
 * Inspects the ignition addresses for a deployment id and retrieves
 a contract instance from a given deployed contract (future) id.
 * @param hre The hardhat runtime environment.
 * @Param contractId The deployed contract (future) id.
 * @param deploymentId The deployment id.
 * @return {Promise<*>} A contract instance (async function).
 */
async function getDeployedContract(hre, contractId, deploymentId) {
    // 1. Determine the actual deployment id.
    const chainId = await hre.common.getChainId();
    deploymentId ||= `chain-${chainId}`;

    // 2. Determine the path and load the deployed addresses, if able.
    let addresses = {};
    try {
        const fullPath = path.resolve(
            hre.config.paths.root, "ignition", "deployments", deploymentId, "deployed_addresses.json"
        );
        addresses = JSON.parse(fs.readFileSync(fullPath, {encoding: 'utf8'}));
    } catch(e) {}

    // 3. From the deployed addresses, get the address we want.
    const address = addresses[contractId];
    if (!address) {
        throw new Error(
            `It seems that the contract ${contractId} is not deployed in the ` +
            `deployment id ${deploymentId}. Ensure the deployment is actually ` +
            "done for that contract."
        )
    }

    // 4. Now, load the artifact and get its ABI:
    let artifact = {};
    try {
        const artifactPath = path.resolve(
            hre.config.paths.root, "ignition", "deployments", deploymentId, "artifacts", contractId + ".json"
        );
        artifact = JSON.parse(fs.readFileSync(artifactPath, {encoding: 'utf8'}));
    } catch(e) {}
    const abi = artifact.abi;
    if (!abi || !abi.length) {
        throw new Error(
            `The contract data for the contract id ${contractId} in the deployment `
            `id ${deploymentId} seems to be corrupted. Either you're in serious `
            `troubles or this is your local network and you just need to redeploy `
            `everything to make this work. Keep in touch with your team if this is `
            `related to corrupted contract deployment data in a mainnet.`
        );
    }

    // 5. Instantiate the contract by using the proper provider.
    return await hre.common.getContractAt(abi, address);
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
        hre.common.send = async (contract, method, args, txOpts) => {
            let {account, from, gas, gasPrice, maxFeePerGas, maxPriorityFeePerGas, value, eip155} = txOpts || {};
            const newOpts = {
                gasLimit: gas, gasPrice, maxFeePerGas, maxPriorityFeePerGas,
                value, chainId: eip155 ? (await hre.common.getChainId()) : undefined
            };
            if (account !== undefined) {
                if (typeof account === "bigint") {
                    account = account.toNumber();
                }
                if (typeof account === "number") {
                    account = await hre.common.getSigner(account);
                }
                contract = contract.connect(account);
            } else if (from) {
                newOpts.from = from;
            }
            // The method might be "foo" or "foo(type1,type2,...)".
            // It will be respected both ways.
            return await contract[method](...args, newOpts);
        }
        hre.common.call = async (contract, method, args) => {
            // The method might be "foo" or "foo(type1,type2,...)".
            // It will be respected both ways.
            return await contract[method](...args);
        }
        hre.common.getContractAddress = (contract) => contract.target;
        hre.common.keccak256 = (text) => hre.ethers.keccak256(hre.ethers.toUtf8Bytes(text));
        hre.common.getBalance = (address) => hre.ethers.provider.getBalance(address);
        hre.common.transfer = async (to, txOpts) => {
            txOpts = await normalizeTransferTxOptions(txOpts);
            // `from` will not be supported.
            let {account, gas, gasPrice, maxFeePerGas, maxPriorityFeePerGas, value, eip155} = txOpts || {};
            const newOpts = {
                to, gasLimit: gas, gasPrice, maxFeePerGas, maxPriorityFeePerGas,
                value, chainId: eip155 ? (await hre.common.getChainId()) : undefined
            };
            let signer = await normalizeSigner(hre, account);
            return await signer.sendTransaction(newOpts);
        }
    } else if (hre.viem) {
        const {isAddress, getContract, keccak256} = require("viem");
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
        hre.common.send = async (contract, method, args, txOpts) => {
            let {account, from, gas, gasPrice, maxFeePerGas, maxPriorityFeePerGas, value, eip155} = txOpts || {};
            const newOpts = {
                gas, gasPrice, maxFeePerGas, maxPriorityFeePerGas,
                value, chainId: eip155 ? (await hre.common.getChainId()) : undefined
            };
            if (account !== undefined) {
                if (typeof account === "bigint") {
                    account = account.toNumber();
                }
                if (typeof account === "number") {
                    account = await hre.common.getSigner(Number(account));
                }
                // The method might be "foo" or "foo(type1,type2,...)".
                // It will keep only the name.
                return await contract.write[method.split("(")[0]](account, args, newOpts);
            } else if (from) {
                newOpts.from = from;
            }
            // The method might be "foo" or "foo(type1,type2,...)".
            // It will keep only the name.
            return await contract.write[method.split("(")[0]](args, newOpts);
        }
        hre.common.call = async (contract, method, args) => {
            // The method might be "foo" or "foo(type1,type2,...)".
            // It will keep only the name.
            return await contract.read[method.split("(")[0]](args);
        }
        hre.common.getContractAddress = (contract) => contract.address;
        hre.common.keccak256 = (text) => keccak256(text);
        hre.common.getBalance = async (address) => await (
            await hre.viem.getPublicClient(hre.network.provider)
        ).getBalance({address});
        hre.common.transfer = async (to, txOpts) => {
            txOpts = await normalizeTransferTxOptions(txOpts);
            // `from` will not be supported.
            let {account, gas, gasPrice, maxFeePerGas, maxPriorityFeePerGas, value, eip155} = txOpts || {};
            const newOpts = {
                to, gas, gasPrice, maxFeePerGas, maxPriorityFeePerGas,
                value, chainId: eip155 ? (await hre.common.getChainId()) : undefined
            };
            let signer = await normalizeSigner(hre, account);
            return await signer.sendTransaction(newOpts);
        }
    } else {
        throw new Error("It seems that neither ethers nor viem is installed in this project");
    }
    hre.common.getSigner = async (idx) => (await hre.common.getSigners())[idx];
    if (hre.ignition && !hre.ignition.resetDeployment) {
        hre.ignition.resetDeployment = (deploymentId) => resetDeployment(hre, deploymentId);
        hre.ignition.getDeployedContract = (contractId, deploymentId) => getDeployedContract(
            hre, contractId, deploymentId
        );
    }
});