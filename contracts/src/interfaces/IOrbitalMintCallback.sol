// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

/// @title IOrbitalMintCallback
/// @notice Callback invoked by an orbital pool during `mint` to pull tokens from the caller.
interface IOrbitalMintCallback {
    /// @notice Pay the owed token amounts to the calling pool.
    /// @dev Must be implemented by any contract that calls IOrbitalPoolActions.mint.
    ///      The pool will revert if the expected balances are not met after this returns.
    /// @param amounts Amount owed per asset, indexed by the pool's token ordering.
    /// @param data    The opaque payload originally passed to mint.
    function orbitalMintCallback(uint256[] calldata amounts, bytes calldata data) external;
}
