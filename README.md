# hardhat-common-tools
A hardhat plugin providing common tools and functions for both ethers and viem projects.

# Installation
Run this command to install it from NPM:

```shell
npm install hardhat-common-tools@^1.0.0
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

# More common functions

1. Resetting the deployments (only present when `@nomicfoundation/hardhat-ignition` and the corresponding
   ignition plugin is installed):

   ```javascript
   // provided hre.ignition exists:
   await hre.ignition.resetDeployment();
   ```
   