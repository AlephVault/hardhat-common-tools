import { expect } from "chai";
import hre from "hardhat";
import { getAddress, parseGwei } from "viem";

describe("Lock", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployOneYearLockFixture() {
    const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60;

    const lockedAmount = parseGwei("1");
    const { viem, networkHelpers } = await hre.network.getOrCreate();
    const unlockTime = BigInt(
      (await networkHelpers.time.latest()) + ONE_YEAR_IN_SECS
    );

    // Contracts are deployed using the first signer/account by default
    const [owner, otherAccount] = await viem.getWalletClients();

    const lock = await viem.deployContract("Lock", [unlockTime], {
      value: lockedAmount,
    });

    const publicClient = await viem.getPublicClient();

    return {
      lock,
      unlockTime,
      lockedAmount,
      owner,
      otherAccount,
      publicClient,
    };
  }

  describe("Deployment", function () {
    it("Should set the right unlockTime", async function () {
      const { networkHelpers } = await hre.network.getOrCreate();
      const { lock, unlockTime } =
        await networkHelpers.loadFixture(deployOneYearLockFixture);

      expect(await lock.read.unlockTime()).to.equal(unlockTime);
    });

    it("Should set the right owner", async function () {
      const { networkHelpers } = await hre.network.getOrCreate();
      const { lock, owner } =
        await networkHelpers.loadFixture(deployOneYearLockFixture);

      expect(await lock.read.owner()).to.equal(
        getAddress(owner.account.address)
      );
    });

    it("Should receive and store the funds to lock", async function () {
      const { networkHelpers } = await hre.network.getOrCreate();
      const { lock, lockedAmount, publicClient } =
        await networkHelpers.loadFixture(deployOneYearLockFixture);

      expect(
        await publicClient.getBalance({
          address: lock.address,
        })
      ).to.equal(lockedAmount);
    });

    it("Should fail if the unlockTime is not in the future", async function () {
      // We don't use the fixture here because we want a different deployment
      const { viem, networkHelpers } = await hre.network.getOrCreate();
      const latestTime = BigInt(await networkHelpers.time.latest());
      await expect(
        viem.deployContract("Lock", [latestTime], {
          value: 1n,
        })
      ).to.be.rejectedWith("Unlock time should be in the future");
    });
  });

  describe("Withdrawals", function () {
    describe("Validations", function () {
      it("Should revert with the right error if called too soon", async function () {
        const { networkHelpers } = await hre.network.getOrCreate();
        const { lock } =
          await networkHelpers.loadFixture(deployOneYearLockFixture);

        await expect(lock.write.withdraw()).to.be.rejectedWith(
          "You can't withdraw yet"
        );
      });

      it("Should revert with the right error if called from another account", async function () {
        const { viem, networkHelpers } = await hre.network.getOrCreate();
        const { lock, unlockTime, otherAccount } =
          await networkHelpers.loadFixture(deployOneYearLockFixture);

        // We can increase the time in Hardhat Network
        await networkHelpers.time.increaseTo(unlockTime);

        // We retrieve the contract with a different account to send a transaction
        const lockAsOtherAccount = await viem.getContractAt(
          "Lock",
          lock.address,
          { client: { wallet: otherAccount } }
        );
        await expect(lockAsOtherAccount.write.withdraw()).to.be.rejectedWith(
          "You aren't the owner"
        );
      });

      it("Shouldn't fail if the unlockTime has arrived and the owner calls it", async function () {
        const { networkHelpers } = await hre.network.getOrCreate();
        const { lock, unlockTime } =
          await networkHelpers.loadFixture(deployOneYearLockFixture);

        // Transactions are sent using the first signer by default
        await networkHelpers.time.increaseTo(unlockTime);

        await expect(lock.write.withdraw()).to.be.fulfilled;
      });
    });

    describe("Events", function () {
      it("Should emit an event on withdrawals", async function () {
        const { networkHelpers } = await hre.network.getOrCreate();
        const { lock, unlockTime, lockedAmount, publicClient } =
          await networkHelpers.loadFixture(deployOneYearLockFixture);

        await networkHelpers.time.increaseTo(unlockTime);

        const hash = await lock.write.withdraw();
        await publicClient.waitForTransactionReceipt({ hash });

        // get the withdrawal events in the latest block
        const withdrawalEvents = await lock.getEvents.Withdrawal();
        expect(withdrawalEvents).to.have.lengthOf(1);
        expect(withdrawalEvents[0].args).to.have.property(
          "amount",
          lockedAmount
        );
      });
    });
  });
});
