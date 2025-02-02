// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;

contract SampleContract {
    constructor(){}

    event SampleEvent(bytes32 indexed foo, uint256 indexed bar, int256 indexed baz, bytes data);

    function fireSampleEvent(bytes32 foo, uint256 bar, int256 baz, bytes memory data) external {
        emit SampleEvent(foo, bar, baz, data);
    }
}
