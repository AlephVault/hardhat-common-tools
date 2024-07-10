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

# More common functions

1. Resetting the deployments (only present when `@nomicfoundation/hardhat-ignition` and the corresponding
   ignition plugin is installed):

   ```javascript
   // provided hre.ignition exists:
   await hre.ignition.resetDeployment();
   ```