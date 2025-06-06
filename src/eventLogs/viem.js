const {parseAbiItem, parseEventLogs} = require("viem");

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
    const client = await hre.viem.getPublicClient();

    // Parse event ABI dynamically.
    let eventAbi = getEventAbi(contract, eventName);

    let indexedArgsObject = normalizeIndexedArgs(eventAbi, indexedArgs || []);

    // Prepare the filter arguments and get the logs.
    const filter = {
        address: contract.address, event: eventAbi,
        fromBlock: BigInt(fromBlock ?? 0n),
        toBlock: (toBlock ?? null) === null ? "latest" : BigInt(toBlock),
        args: indexedArgsObject
    };
    return (await client.getLogs(filter)).map(e => normalizeLog(eventAbi, e));
}

/**
 * Starts watching the logs for a given event and filtering from the contract.
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
    const client = await hre.viem.getPublicClient();
    if (callback === undefined) {
        callback = indexedArgs;
        indexedArgs = undefined;
    }
    indexedArgs ||= [];

    // Parse event ABI dynamically.
    let eventAbi = getEventAbi(contract, eventName);

    return client.watchEvent({
        address: contract.address, event: eventAbi,
        args: normalizeIndexedArgs(eventAbi, indexedArgs || []),
        onLogs: (logs) => {
            logs.forEach(log => {
                try {
                    callback(normalizeLog(eventAbi, log));
                } catch (e) {
                    console.error(e);
                }
            })
        },
    });
}

// Gets the Abi entry for an event name in a contract.
function getEventAbi(contract, eventName) {
    // Parse event ABI dynamically.
    let eventAbi;
    if (!eventName.includes("(")) {
        // CASE 1: Only event name is provided → Pick first matching event.
        const matchingEvents = contract.abi.filter(
            (item) => item.type === "event" && item.name === eventName
        );

        if (matchingEvents.length === 0) {
            throw new Error(`Event "${eventName}" not found in contract ABI.`);
        }

        eventAbi = matchingEvents[0]; // Use the first found event
    } else {
        // CASE 2: Full event specification is provided → Ensure exact match.
        const parsedAbiItem = parseAbiItem(eventName);

        const matchingEvents = contract.abi.filter(
            (item) => item.type === "event" && JSON.stringify(item) === JSON.stringify(parsedAbiItem)
        );

        if (matchingEvents.length === 0) {
            throw new Error(`Exact event specification "${eventName}" not found in contract ABI.`);
        }

        eventAbi = parsedAbiItem;
    }
    return eventAbi;
}

// Converts the indexed arguments to an object.
function normalizeIndexedArgs(eventAbi, indexedArgs) {
    let indexedArgsObject = {};
    if (Array.isArray(indexedArgs)) {
        // Converting the array indexed args to an object.
        const indexedParams = eventAbi.inputs.filter(
            param => param.indexed
        );

        if (indexedArgs.length > indexedParams.length) {
            throw new Error(`Too many indexed arguments provided. Expected at most ${indexedParams.length}, got ${indexedArgs.length}.`);
        }

        indexedArgsObject = indexedParams.reduce((acc, param, index) => {
            if (indexedArgs[index] !== undefined) {
                acc[param.name] = indexedArgs[index];
            }
            return acc;
        }, {});
    } else {
        indexedArgsObject = indexedArgs ?? {};
    }
    return indexedArgsObject;
}

/**
 * Normalizes an event log to a standard format, so it becomes
 * a normal facade/adapter to the end user, although the `native`
 * field will still remain specific.
 * @param abi The ABI element used to parse the event.
 * @param log The native log to normalize.
 * @returns {{args: {}, native, name}} An object with the result,
 * being {args, native, name} where `name` is the name part of
 * the event, `native` is the event itself, and `args` is the
 * set of arguments passed to the event, both by key and by index.
 */
function normalizeLog(abi, log) {
    const args = {...log.args};
    abi.inputs.forEach((input, index) => {
        args[index] = args[input.name];
    });

    return {
        name: log.eventName, args,
        blockNumber: log.blockNumber,
        blockHash: log.blockHash,
        transactionIndex: log.transactionIndex,
        transactionHash: log.transactionHash,
        logIndex: log.logIndex,
        native: log
    }
}

/**
 * Get the logs for a certain event from the contract for a transaction.
 * @param hre The hardhat runtime environment.
 * @param contract The contract instance.
 * @param eventName The name, or specification, of the event.
 * @param tx The transaction, as returned from hre.common.send (i.e. a hash).
 * @param eventName The name of the event.
 * @returns {Promise<{args: {}, native, name}[]>} The list of normalized events (async function).
 */
async function fetchTransactionLogs(hre, contract, tx, eventName) {
    // Here, tx is a string, as returned from hre.common.send().
    const receipt = await (await hre.viem.getPublicClient()).getTransactionReceipt({hash: tx});
    const logs = receipt.logs;
    const abi = [getEventAbi(contract, eventName)];
    const parsedLogs = parseEventLogs({
        abi, eventName, logs, strict: true
    });
    return parsedLogs.map((log) => normalizeLog(
        abi[0], log
    ));
}

module.exports = {
    fetchLogs, watchLogs, fetchTransactionLogs
}