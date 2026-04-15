// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IOrbitalSwapCallback} from "../interfaces/IOrbitalSwapCallback.sol";
import {IERC20Minimal} from "../interfaces/IERC20Minimal.sol";

/// @notice Test-only swap callback that forwards the owed input token to the calling pool.
contract MockOrbitalSwapCallback is IOrbitalSwapCallback {
    address[] public tokens;

    function setTokens(address[] calldata tokens_) external {
        delete tokens;
        for (uint256 i = 0; i < tokens_.length; i++) {
            tokens.push(tokens_[i]);
        }
    }

    function approve(address token, address spender, uint256 amount) external {
        IERC20Minimal(token).approve(spender, amount);
    }

    function orbitalSwapCallback(uint256 assetIn, uint256 amountIn, bytes calldata) external override {
        IERC20Minimal(tokens[assetIn]).transfer(msg.sender, amountIn);
    }
}
