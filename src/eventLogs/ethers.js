const {ethers} = require("hardhat");
const {Interface, Log} = require("ethers");

/**
 * Gets the logs of a certain event from the contract.
 * @param contract The contract instance.
 * @param eventName The name, or specification, of the event.
 * @param fromBlock The start block. Will be 0 if not given.
 * @param toBlock The end block. Will be "latest" if not given.
 * @param indexedArgs The indexed arguments. They must not be
 * encoded, for they will later.
 * @returns {Promise<*>} An array of logs (async function).
 */
async function fetchLogs(
    contract, eventName,
    fromBlock, toBlock,
    indexedArgs
) {
    const provider = ethers.provider;

    // Find event details in ABI.
    const eventFragment = contract.interface.getEvent(eventName);
    if (!eventFragment) throw new Error(`Event "${eventName}" not found in ABI`);

    // Prepare topics array (first topic is event signature).
    const topics = [contract.interface.getEventTopic(eventFragment)];

    // Extract indexed parameters and encode them properly
    for (const param of eventFragment.inputs) {
        if (param.indexed) {
            const value = indexedArgs?.[param.name];
            if (value !== undefined) {
                topics.push(encodeIndexedValue(param.type, value)); // A null value means wildcard.
            } else {
                topics.push(null); // Wildcard (any value)
            }
        }
    }

    // Construct the filter.
    const filter = {
        address: contract.address,
        fromBlock: fromBlock ?? 0,
        toBlock: toBlock ?? "latest",
        topics,
    };

    // Fetch logs.
    const logs = await provider.getLogs(filter);

    // Decode logs into readable event data.
    return logs.map(log => contract.interface.parseLog(log));
}

const uintTypes = [];
const intTypes = [];
const bytesTypes = [];

for(let j = 1; j <= 32; j++) {
    uintTypes.push(`uint${j * 8}`);
    intTypes.push(`int${j * 8}`);
    bytesTypes.push(`bytes${j}`);
}

// Function to encode indexed values correctly
function encodeIndexedValue(type, value, cannotBeArrayOrNull) {
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

module.exports = {
    fetchLogs
}