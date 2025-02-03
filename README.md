# hardhat-common-tools
A hardhat plugin providing common tools and functions for both ethers and viem projects.

# Installation
Run this command to install it from NPM:

```shell
npm install --save-dev hardhat-common-tools@^1.6.0
```

# Usage
This is a hardhat plugin, so the first thing to do is to install it in your hardhat.config.ts file:

```javascript
require("hardhat-common-tools");
```

This is a polyfill for both `ethers` and `viem`, and intended to develop further plugins depending on it.
The idea is that those plugins can leverage the tools provided by this plugin, so they don't have to
split their development between `ethers` support and `viem` support.

The provided methods are the following:

1. Retrieval of all the account signers (they'll become different objects, however):

   ```javascript
   const signers = await hre.common.getSigners(); // The result is still an array.
   const signer0 = signers[0];
   // Or:
   const signer0 = await hre.common.getSigner(0); // Just a shortcut.
   ```

2. Retrieval of an address from a signer (builds on the previous example):

   ```javascript
   const address = hre.common.getAddress(signer0);
   ```
   
3. Current chain id:

   ```javascript
   const chainId = await hre.common.getChainId();
   ```

4. Check whether the value is an address or not:

   ```javascript
   const isAddress = await hre.common.isAddress(value);
   ```

5. Instantiating an existing contract:

   ```javascript
   const contract = await hre.common.getContractAt("MyContract", "0xTheContractAddress");
   ```

6. Instantiating an existing ignition-deployed contract (if an ignition plugin is installed):

   ```javascript
   await hre.ignition.getDeployedContract("MyIgnitionModule#MyContract");
   // Or with an explicit deployment id:
   await hre.ignition.getDeployedContract("MyIgnitionModule#MyContract", "someDeploymentId");
   ```

7. Invoking a view/pure method via `call`:

   ```javascript
   // Invoking a method via `call` with arguments (they come in an array).
   const result = await hre.common.call(contract, "mymethod", [arg1, arg2, ...whatever]);
   ```

8. Invoking a view/pure method via `send`:

   ```javascript
   // Invoking a method via `send` (transactionally) with arguments (they come in an array).
   // By default:
   await hre.common.send(contract, "withdraw", []);
   // Choosing an account:
   await hre.common.send(contract, "withdraw", [], {account: await hre.common.getSigner(0)});
   // All the transaction options (all of them are optional):
   await hre.common.send(contract, "withdraw", [], {
       account: await hre.common.getSigner(0),
       from: "0xAnAddress",
       gas: 400000, // A gas amount.
       gasPrice: 400000000000, // A pre-EIP-1559 gas price.
       maxFeePerGas: 400000000000, // An EIP-1559 max gas price.
       maxPriorityFeePerGas: 100000000000, // An EIP-1559 max priority price.
       value: 1000000000000000000, // A payment of 1 eth.
       eip155: true|false, // Whether to avoid a replay-attack.
   }); 
   ```

9. Getting the address of a contract instance.

   ```javascript
   // Get a contract somehow.
   const contract = await hre.ignition.getDeployedContract("SomeModule#SomeContract");
   const address = hre.common.getContractAddress(contract);
   ```

10. Computing a keccak256 over a UTF-8 string.

    ```javascript
    const hash = hre.ignition.keccak256("Hello World");
    // '0x592fa743889fc7f92ac2a37bb1f5ba1daf2a5c84741ca0e0061d243a2e6707ba'
    ```

11. Getting the balance of an address:

    ```javascript
    const balance = await hre.common.getBalance("0xAnAddress");
    ```

12. Transferring native tokens to another account:

    ```javascript
    // Case 1: Only an amount, and everything else by default.
    const tx = await hre.common.transfer("0xAnAddress", 1000000000000000000);

    // Case 2: Explicit arguments (`from` is not supported here;
    //         use `account` argument). All the arguments are
    //         optional.
    const tx = await hre.common.transfer("0xAnAddress", {
        account: await hre.common.getSigner(0),
        gas: 400000, // A gas amount.
        gasPrice: 400000000000, // A pre-EIP-1559 gas price.
        maxFeePerGas: 400000000000, // An EIP-1559 max gas price.
        maxPriorityFeePerGas: 100000000000, // An EIP-1559 max priority price.
        value: 1000000000000000000, // A payment of 1 eth.
        eip155: true|false, // Whether to avoid a replay-attack.
    })
    ```

# Retrieving and watching logs

This feature deserves its own section because it's a complex topic on itself,
especially understanding both the event serialization and how different the
`ethers` and `viem` library handle them. This latter point makes it clear with
the need of a polyfill.

First, we'll assume we have this contract:

```solidity
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;

contract SampleContract {
    constructor(){}

    event SampleEvent(bytes32 indexed foo, uint256 indexed bar, int256 indexed baz, string data);

    function fireSampleEvent(bytes32 foo, uint256 bar, int256 baz, string memory data) external {
        emit SampleEvent(foo, bar, baz, data);
    }
}
```

_For curious developers: this example exists in the source code of the sample
projects, both for `ethers` and `viem`, in this package._

We can, both in `viem` and `ethers`, retrieve a contract instance and list or watch the logs:

```javascript
// First, get a contract named SampleContract from an ignition module named
// SampleContractModule. In this case we're using ignition, but we can ensure
// a contract instance by other means, being them ethers/viem specific, or a
// common polyfilled way in this package.
//
// The only requirement is that, by the end, we have an ethers instance (or a
// viem instance, respectively) of a contract.
const contract = await hre.ignition.getDeployedContract("SampleContractModule#SampleContract");

// Retrieve the logs, between block 0 and 100, of the event SampleEvent
// specifying indexed topics: foo=null (anything), bar=2, baz=-2.
const logs = await hre.common.getLogs(contract, "SampleEvent", 0, 100, [null, 2, -2]);

// Same, but the object can be a literal object.
const logs = await hre.common.getLogs(contract, "SampleEvent", 0, 100, {foo: null, bar: 2, baz: -2});

// To retrieve all the logs for that event, the topics are optional.
const logs = await hre.common.getLogs(contract, "SampleEvent", 0, 100);

// Conflicting ABI definitions for events with same name are still a WIP. This means:
// - SampleEvent(bytes32,uint256,int256,string) works well in ethers, to resolve conflicts.
// - SampleEvent(bytes32 indexed foo,uint256 indexed bar,int256 indexed baz,string data) works well in viem.
// But they're not unified yet.
const logs = await hre.common.getLogs(contract, "SampleEvent(bytes32,uint256,int256,string)", 0, 100, [null, 2, -2]);
const logs = await hre.common.getLogs(contract, "SampleEvent(bytes32 indexed foo,uint256 indexed bar,int256 indexed baz,string data)", 0, 100, [null, 2, -2]);

// Undefined or null from/to blocks refer to 0 and "latest". These calls are equivalent:
const logs = await hre.common.getLogs(contract, "SampleEvent");
const logs = await hre.common.getLogs(contract, "SampleEvent", 0);
const logs = await hre.common.getLogs(contract, "SampleEvent", 0, "latest");
const logs = await hre.common.getLogs(contract, "SampleEvent", null);
const logs = await hre.common.getLogs(contract, "SampleEvent", null, "latest");
const logs = await hre.common.getLogs(contract, "SampleEvent", null, null);
const logs = await hre.common.getLogs(contract, "SampleEvent", 0, null);

// Watching logs, AS LONG AS THE PROVIDER ENDPOINT SUPPORTS WATCHING LOGS (it's not always the case),
// becomes also easy:
const unwatch = await hre.common.watchLogs(contract, "SampleEvent", [null, 2, -2], (log) => { console.log(log); });

// The topics support the same syntax as before. This means: also an object is allowed:
const unwatch = await hre.common.watchLogs(contract, "SampleEvent", {foo: null, bar: 2, baz: -2}, (log) => { console.log(log); });

// The topics are also optional, if no topics are needed:
const unwatch = await hre.common.watchLogs(contract, "SampleEvent", (log) => { console.log(log); });

// There's also support for conflicting ABI definitions but, as in the
// getLogs case, it's still a WIP to polyfill them.
const unwatch = await hre.common.watchLogs(contract, "SampleEvent(bytes32,uint256,int256,string)", [null, 2, -2], (log) => { console.log(log); });
const unwatch = await hre.common.watchLogs(contract, "SampleEvent(bytes32 indexed foo,uint256 indexed bar,int256 indexed baz,string data)", [null, 2, -2], (log) => { console.log(log); });
```

The callback will receive all the logs properly.

The structure of a single log entry will look like this in either case, following the lookup example:

```
{
    name: "SampleEvent", // The name of the event
    args: {
        "0": "0xf5f74b0e3d12e6c52866a99cbb70d761db5ebb7258f39d97971e7cb3483c3493",
        "1": 2n,
        "2": -2n,
        "3": "Hello",
        foo: "0xf5f74b0e3d12e6c52866a99cbb70d761db5ebb7258f39d97971e7cb3483c3493",
        bar: 2n,
        baz: -2n,
        data: "Hello"
    },
    blockNumber: 20n, // or 20n in viem - it's always a BigInt in that library.
    blockHash: "0x8b0188a37d18b2f4792606709299f316418ce46748591074ad44e00ce7f79ba3",
    transactionIndex: 0,
    transactionHash: "0x3cf3b3135570ce29b9950c02af3d9f4b40a680c6f98c9e6fed605063054184ac",
    logIndex: 0,
    native: aNativeObject
}
```

The `native` object is intentionally not polyfilled. It has the top-level object
of an event being received in either library (it will be ethers/viem-specific,
respectively).

To stop watching the events, just do:

```javascript
unwatch()
```

from the returned unwatcher function.

# More common functions

1. Resetting the deployments (only present when `@nomicfoundation/hardhat-ignition` and the corresponding
   ignition plugin is installed):

   ```javascript
   // provided hre.ignition exists:
   await hre.ignition.resetDeployment();
   ```