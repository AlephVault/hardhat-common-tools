import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const SampleContractModule = buildModule("SampleContractModule", (m) => {
  const sampleContract = m.contract("SampleContract", [], {});

  m.call(sampleContract, "fireSampleEvent", [
    "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    1, -1, "Hello World (A)"
  ], {id: "fireSampleEvent1"});
  m.call(sampleContract, "fireSampleEvent", [
    "0xf0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcde",
    2, -2, "Hello World (B)"
  ], {id: "fireSampleEvent2"});
  m.call(sampleContract, "fireSampleEvent", [
    "0xef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcd",
    3, -3, "Hello World (C)"
  ], {id: "fireSampleEvent3"});
  m.call(sampleContract, "fireSampleEvent", [
    "0xdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abc",
    4, -4, "Hello World (D)"
  ], {id: "fireSampleEvent4"});
  m.call(sampleContract, "fireSampleEvent", [
    "0xcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789ab",
    5, -5, "Hello World (E)"
  ], {id: "fireSampleEvent5"});
  m.call(sampleContract, "fireSampleEvent", [
    "0xbcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789a",
    6, -6, "Hello World (F)"
  ], {id: "fireSampleEvent6"});
  m.call(sampleContract, "fireSampleEvent", [
    "0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
    7, -7, "Hello World (G)"
  ], {id: "fireSampleEvent7"});
  m.call(sampleContract, "fireSampleEvent", [
    "0x9abcdef0123456789abcdef0123456789abcdef0123456789abcdef012345678",
    8, -8, "Hello World (H)"
  ], {id: "fireSampleEvent8"});

  return { sampleContract };
});

export default SampleContractModule;
