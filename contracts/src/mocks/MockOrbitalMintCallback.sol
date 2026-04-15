// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IOrbitalMintCallback} from "../interfaces/IOrbitalMintCallback.sol";
import {IERC20Minimal} from "../interfaces/IERC20Minimal.sol";

/// @notice Test-only mint callback that forwards owed amounts to the calling pool.
contract MockOrbitalMintCallback is IOrbitalMintCallback {
    address[] public tokens;

    function setTokens(address[] calldata tokens_) external {
        delete tokens;
        for (uint256 i = 0; i < tokens_.length; i++) {
            tokens.push(tokens_[i]);
        }
    }

    function orbitalMintCallback(uint256[] calldata amounts, bytes calldata) external override {
        for (uint256 i = 0; i < amounts.length; i++) {
            if (amounts[i] > 0) {
                IERC20Minimal(tokens[i]).transfer(msg.sender, amounts[i]);
            }
        }
    }
}
