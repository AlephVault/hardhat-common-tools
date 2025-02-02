/**
 * Gets the logs of a certain event from the contract.
 * @param hre The hardhat runtime environment.
 * @param contract The contract instance.
 * @param eventName The name, or specification, of the event.
 * @param fromBlock The start block. Will be 0 if not given.
 * @param toBlock The end block. Will be "latest" if not given.
 * @param indexedArgs The indexed arguments. They must not be
 * encoded, for they will later.
 * @returns {Promise<*>} An array of logs (async function).
 */
async function fetchLogs(
    hre,
    contract, eventName,
    fromBlock, toBlock,
    indexedArgs
) {
    const provider = hre.ethers.provider;
    indexedArgs ||= [];

    // Find event details in ABI.
    const eventFragment = contract.interface.getEvent(eventName);
    if (!eventFragment) throw new Error(`Event "${eventName}" not found in ABI`);

    // Prepare topics array (first topic is event signature).
    const topics = [contract.interface.encodeFilterTopics(eventFragment, indexedArgs)];

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
    return logs.map(normalizeLog);
}

/**
 * Normalizes an event log to a standard format, so it becomes
 * a normal facade/adapter to the end user, although the `native`
 * field will still remain specific.
 * @param log The native log to normalize.
 * @returns {{args: {}, native, name}} An object with the result,
 * being {args, native, name} where `name` is the name part of
 * the event, `native` is the event itself, and `args` is the
 * set of arguments passed to the event, both by key and by index.
 */
function normalizeLog(log) {
    const argKeys = log.fragment.inputs.map(i => i.name);
    const args = {};
    argKeys.forEach((key, index) => {
        args[key] = log.args[key]
        args[index] = log.args[index]
    });
    return {name: log.name, args, native: log};
}

module.exports = {
    fetchLogs
}