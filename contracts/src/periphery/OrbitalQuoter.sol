// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {IOrbitalPoolActions}  from "../interfaces/IOrbitalPoolActions.sol";
import {IOrbitalSwapCallback} from "../interfaces/IOrbitalSwapCallback.sol";
import {IOrbitalPool}         from "../interfaces/IOrbitalPool.sol";
import {IERC20Minimal}        from "../interfaces/IERC20Minimal.sol";

/// @title OrbitalQuoter
/// @notice Off-chain price simulation for orbital pools.
///         All functions return quotes without committing any state changes.
///         Uses the same revert-to-quote trick as the router: the swap callback
///         reads the output transferred to address(1) and reverts with it encoded;
///         the caller catches that revert and decodes the amount.
contract OrbitalQuoter is IOrbitalSwapCallback {

    // ─────────────────────────────────────────────────────────────────────
    // quoteExactInput
    // ─────────────────────────────────────────────────────────────────────

    /// @notice Simulate swapping `amountIn` of asset `assetIn` for asset `assetOut`.
    /// @param pool     The orbital pool to query.
    /// @param assetIn  Index of the asset being sold.
    /// @param assetOut Index of the asset being bought.
    /// @param amountIn Input amount, WAD-scaled.
    /// @return amountOut Simulated output, WAD-scaled. No state change occurs.
    function quoteExactInput(
        address pool,
        uint256 assetIn,
        uint256 assetOut,
        uint256 amountIn
    ) external returns (uint256 amountOut) {
        amountOut = _quoteExactInput(pool, assetIn, assetOut, amountIn);
    }

    // ─────────────────────────────────────────────────────────────────────
    // quoteExactOutput
    // ─────────────────────────────────────────────────────────────────────

    /// @notice Find the minimum input needed to receive at least `amountOut` of `assetOut`.
    ///         Uses a 20-iteration binary search over [0, maxAmountIn].
    /// @param pool        The orbital pool to query.
    /// @param assetIn     Index of the asset being sold.
    /// @param assetOut    Index of the asset being bought.
    /// @param amountOut   Desired output amount, WAD-scaled.
    /// @param maxAmountIn Search upper bound for amountIn, WAD-scaled.
    /// @return amountIn   Minimum input that produces >= amountOut. Reverts if unreachable.
    function quoteExactOutput(
        address pool,
        uint256 assetIn,
        uint256 assetOut,
        uint256 amountOut,
        uint256 maxAmountIn
    ) external returns (uint256 amountIn) {
        uint256 lo = 0;
        uint256 hi = maxAmountIn;
        uint256 best = type(uint256).max;

        for (uint256 i; i < 20; ++i) {
            if (lo >= hi) break;
            uint256 mid = (lo + hi) / 2;
            uint256 quoted = _quoteExactInput(pool, assetIn, assetOut, mid);
            if (quoted >= amountOut) {
                best = mid;
                hi = mid;
            } else {
                lo = mid + 1;
            }
        }

        require(best != type(uint256).max, "OrbitalQuoter: insufficient output");
        amountIn = best;
    }

    // ─────────────────────────────────────────────────────────────────────
    // Callback — required to implement IOrbitalSwapCallback
    // ─────────────────────────────────────────────────────────────────────

    /// @inheritdoc IOrbitalSwapCallback
    /// @dev In quote mode the pool has already transferred amountOut to address(1).
    ///      We read that balance, then revert with it encoded so the try/catch above
    ///      can recover it. The entire EVM state change (including the token transfer)
    ///      is rolled back on revert.
    function orbitalSwapCallback(
        uint256 /* assetIn */,
        uint256 /* amountIn */,
        bytes calldata data
    ) external override {
        uint256 assetOut = abi.decode(data, (uint256));
        address tokenOut = IOrbitalPool(msg.sender).tokens(assetOut);
        uint256 received = IERC20Minimal(tokenOut).balanceOf(address(1));
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, received)
            revert(ptr, 32)
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────────────────────────────────

    function _quoteExactInput(
        address pool,
        uint256 assetIn,
        uint256 assetOut,
        uint256 amountIn
    ) private returns (uint256 amountOut) {
        try IOrbitalPoolActions(pool).swap(
            address(1),
            assetIn,
            assetOut,
            amountIn,
            0,
            abi.encode(assetOut)
        ) returns (uint256) {
            revert("OrbitalQuoter: quote did not revert");
        } catch (bytes memory reason) {
            require(reason.length == 32, "OrbitalQuoter: bad quote");
            amountOut = abi.decode(reason, (uint256));
        }
    }
}
