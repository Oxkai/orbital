// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {IOrbitalPoolActions}  from "../interfaces/IOrbitalPoolActions.sol";
import {IOrbitalSwapCallback} from "../interfaces/IOrbitalSwapCallback.sol";
import {IOrbitalPool}         from "../interfaces/IOrbitalPool.sol";
import {IERC20Minimal}        from "../interfaces/IERC20Minimal.sol";
import {TickLib}              from "../lib/TickLib.sol";

contract OrbitalQuoter is IOrbitalSwapCallback {

    // ─── Tick math helpers ────────────────────────────────────────────────────

    /// @notice Returns the valid [kMin, kMax] range for a given liquidity (r) and asset count (n).
    function kBounds(uint256 r, uint256 n)
        external
        pure
        returns (uint256 kMinVal, uint256 kMaxVal)
    {
        kMinVal = TickLib.kMin(r, n);
        kMaxVal = TickLib.kMax(r, n);
    }

    /// @notice Converts a depeg price to its corresponding k value.
    /// @param r    Liquidity radius, WAD-scaled (1e18 = 1.0).
    /// @param n    Number of assets in the pool.
    /// @param pWad Depeg price, WAD-scaled (e.g. 0.97e18 = $0.97).
    function kForDepegPrice(uint256 r, uint256 n, uint256 pWad)
        external
        pure
        returns (uint256 k)
    {
        k = TickLib.kFromDepegPrice(r, n, pWad);
    }

    function quoteExactInput(
        address pool,
        uint256 assetIn,
        uint256 assetOut,
        uint256 amountIn
    ) external returns (uint256 amountOut) {
        amountOut = _quoteExactInput(pool, assetIn, assetOut, amountIn);
    }

    function quoteExactOutput(
        address pool,
        uint256 assetIn,
        uint256 assetOut,
        uint256 amountOut,
        uint256 maxAmountIn
    ) external returns (uint256 amountIn) {
        uint256 lo = 1;
        uint256 hi = maxAmountIn + 1;
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
