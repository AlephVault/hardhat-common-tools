import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const SampleContractModule = buildModule("SampleContractModule", (m) => {
  const sampleContract = m.contract("SampleContract", [], {});

  m.call(sampleContract, "fireSampleEvent", [
    "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    1, -1, "Hello World (A)"
  ]);
  m.call(sampleContract, "fireSampleEvent", [
    "0xf0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcde",
    2, -2, "Hello World (B)"
  ]);
  m.call(sampleContract, "fireSampleEvent", [
    "0xef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcd",
    3, -3, "Hello World (C)"
  ]);
  m.call(sampleContract, "fireSampleEvent", [
    "0xdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abc",
    4, -4, "Hello World (D)"
  ]);
  m.call(sampleContract, "fireSampleEvent", [
    "0xcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789ab",
    5, -5, "Hello World (E)"
  ]);
  m.call(sampleContract, "fireSampleEvent", [
    "0xbcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789a",
    6, -6, "Hello World (F)"
  ]);
  m.call(sampleContract, "fireSampleEvent", [
    "0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
    7, -7, "Hello World (G)"
  ]);
  m.call(sampleContract, "fireSampleEvent", [
    "0x9abcdef0123456789abcdef0123456789abcdef0123456789abcdef012345678",
    8, -8, "Hello World (H)"
  ]);

  return { sampleContract };
});

export default SampleContractModule;
