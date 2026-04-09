// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

/// @title IOrbitalSwapCallback
/// @notice Callback invoked by an orbital pool during `swap` to pull the input token from the caller.
interface IOrbitalSwapCallback {
    /// @notice Pay the input amount to the calling pool.
    /// @dev Must be implemented by any contract that calls IOrbitalPoolActions.swap.
    ///      The pool will revert if the expected input balance is not met after this returns.
    /// @param assetIn  Index of the asset being sold.
    /// @param amountIn Amount of `assetIn` owed to the pool.
    /// @param data     The opaque payload originally passed to swap.
    function orbitalSwapCallback(
        uint256 assetIn,
        uint256 amountIn,
        bytes calldata data
    ) external;
}
