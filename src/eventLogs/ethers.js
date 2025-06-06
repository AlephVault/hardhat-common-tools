const {parseEventLogs} = require("viem");

/**
 * Gets the logs of a certain event from the contract.
 * @param hre The hardhat runtime environment.
 * @param contract The contract instance.
 * @param eventName The name, or specification, of the event.
 * @param fromBlock The start block. Will be 0 if not given.
 * @param toBlock The end block. Will be "latest" if not given.
 * @param indexedArgs The indexed arguments. They must not be
 * encoded, for they will later be.
 * @returns {Promise<*>} An array of logs (async function).
 */
async function fetchLogs(
    hre,
    contract, eventName,
    fromBlock, toBlock,
    indexedArgs
) {
    const provider = hre.ethers.provider;
    const iface = contract.interface;
    indexedArgs ||= [];

    // Find event details in ABI.
    const eventFragment = iface.getEvent(eventName);
    if (!eventFragment) throw new Error(`Event "${eventName}" not found in ABI`);

    // Prepare topics array (first topic is event signature).
    const topics = [hre.ethers.id(eventFragment.format()), ...encodeTopics(hre, eventFragment, indexedArgs)];

    // Construct the filter.
    const filter = {
        address: contract.target,
        fromBlock: fromBlock ?? 0,
        toBlock: toBlock ?? "latest",
        topics,
    };

    // Fetch logs.
    const logs = await provider.getLogs(filter);

    // Decode logs into readable event data.
    return logs.map((entry) => normalizeLog(iface, entry));
}

/**
 * Starts watching the logs for a given event and filtering.
 * @param hre The hardhat runtime environment.
 * @param contract The contract instance.
 * @param eventName The name, or specification, of the event.
 * @param indexedArgs The indexed arguments. They must not be
 * encoded, for they will later be. Also, instead, the callback
 * can be given if no indexed arguments are intended.
 * @param callback The callback, if indexed arguments are given.
 * @returns {Promise<*>} A function to un-watch this watch (async function).
 */
async function watchLogs(
    hre,
    contract, eventName, indexedArgs,
    callback
) {
    const iface = contract.interface;
    if (callback === undefined) {
        callback = indexedArgs;
        indexedArgs = undefined;
    }
    indexedArgs ||= [];

    // Find event details in ABI.
    const eventFragment = iface.getEvent(eventName);
    if (!eventFragment) throw new Error(`Event "${eventName}" not found in ABI`);

    const filter = [
        hre.ethers.id(eventFragment.format()),
        ...encodeTopics(hre, eventFragment, indexedArgs)
    ];
    const wrappedCallback = (...args) => {
        const lastIndex = args.length - 1;
        callback(normalizeLog(iface, args[lastIndex].log));
    };
    await contract.on(filter, wrappedCallback);
    return async () => await contract.off(filter, wrappedCallback);
}

/**
 * Stops a watch.
 * @param hre The hardhat runtime environment.
 * @param contract The contract instance.
 * @param filter The filter returned by watchLogs, the event name,
 * or the event specification.
 * @param callback The used callback. Optional. If not given, all
 * the listeners will be turned off for the used filter.
 * @returns {Promise<void>}
 */
async function unWatchLogs(
    hre, contract, filter, callback
) {
    await contract.off(filter, callback);
}

/**
 * Normalizes an event log to a standard format, so it becomes
 * a normal facade/adapter to the end user, although the `native`
 * field will still remain specific.
 * @param iface The interface to use for decoding.
 * @param entry The native entry to normalize.
 * @returns {{args: {}, native, name, blockNumber, blockHash, transactionIndex, transactionHash, logIndex}|null}
 * An object with the result, being {args, native, name} where `name` is the name part of the event,
 * `native` is the event itself, and `args` is the set of arguments passed to the event, both by key
 * and by index. Returns null if there was no ABI entry that could parse the event.
 */
function normalizeLog(iface, entry) {
    const log = iface.parseLog(entry);
    if (!log) return null;
    const argKeys = log.fragment.inputs.map(i => i.name);
    const args = {};
    argKeys.forEach((key, index) => {
        args[key] = log.args[key]
        args[index] = log.args[index]
    });
    return {
        name: log.name, args,
        blockNumber: entry.blockNumber,
        blockHash: entry.blockHash,
        transactionIndex: entry.transactionIndex,
        transactionHash: entry.transactionHash,
        logIndex: entry.index,
        native: entry
    };
}

// Encodes the given values to be used as topics.
function encodeTopics(hre, eventFragment, indexedArgs) {
    const topics = [];
    let index = 0;
    for (const param of eventFragment.inputs) {
        if (param.indexed) {
            const value = indexedArgs[eventFragment.name] ?? indexedArgs[index++];
            if (value !== undefined) {
                topics.push(encodeIndexedValue(hre, param.type, value));
            } else {
                topics.push(null);
            }
        }
    }
    return topics;
}

const uintTypes = [];
const intTypes = [];
const bytesTypes = [];

for(let j = 1; j <= 32; j++) {
    uintTypes.push(`uint${j * 8}`);
    intTypes.push(`int${j * 8}`);
    bytesTypes.push(`bytes${j}`);
}

// Encodes an indexed value.
function encodeIndexedValue(hre, type, value, cannotBeArrayOrNull) {
    const ethers = hre.ethers;

    // If array/null are allowed by this point, test
    // for arrays or null values and return appropriately.
    cannotBeArrayOrNull ||= false;
    if (!cannotBeArrayOrNull) {
        if (value === null) return null;
        if (Array.isArray(value)) return value.map((v) => encodeIndexedValue(type, v, true));
    }

    // By this point, this null check will only occur
    // if array/null values is not allowed. In this
    // case, an error will be thrown.
    if (value === null) throw new Error(`null cannot be an individual topic in an array`);

    // By this point, we don't care about arrays or
    // null values, but test against the types instead.
    if (type === "address") {
        return ethers.zeroPadValue(value, 32); // Address encoding
    } else if (uintTypes.indexOf(type) >= 0) {
        return ethers.zeroPadValue(ethers.toBeHex(value, 32), 32); // Uint encoding
    } else if (intTypes.indexOf(type) >= 0) {
        return ethers.zeroPadValue(ethers.toBeHex(ethers.toTwos(value, 256), 32), 32); // Signed int encoding
    } else if (type === "bool") {
        return ethers.zeroPadValue(ethers.toBeHex(value ? 1 : 0, 32), 32); // Boolean encoding (true = 1, false = 0)
    } else if (bytesTypes.indexOf(type) >= 0) {
        return ethers.zeroPadValue(value, 32); // Zero-pad fixed bytes types (bytes1 to bytes32)
    }
    throw new Error(`Unsupported indexed type: ${type}`);
}

/**
 * Get the logs for a certain event from the contract for a transaction.
 * @param hre The hardhat runtime environment.
 * @param contract The contract instance.
 * @param eventName The name, or specification, of the event.
 * @param tx The transaction, as returned from hre.common.send (i.e. a Contract Transaction Response).
 * @param eventName The name of the event.
 * @returns {Promise<{args: {}, native, name}[]>} The list of normalized events (async function).
 */
async function fetchTransactionLogs(hre, contract, {hash}, eventName) {
    // Here, tx is a string, as returned from hre.common.send().
    const receipt = await hre.ethers.provider.getTransactionReceipt(hash);
    const iface = contract.interface;
    return receipt.logs.map((log) => normalizeLog(iface, log)).filter((e) => e).filter(
        ({name, native: {signature}}) => name === eventName || signature === eventName
    );
}

module.exports = {
    fetchLogs, watchLogs, fetchTransactionLogs
}