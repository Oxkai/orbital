// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {IOrbitalSwapCallback} from "../interfaces/IOrbitalSwapCallback.sol";
import {IOrbitalPoolActions}  from "../interfaces/IOrbitalPoolActions.sol";
import {IOrbitalPool}         from "../interfaces/IOrbitalPool.sol";
import {IOrbitalFactory}      from "../interfaces/IOrbitalFactory.sol";
import {IERC20Minimal}        from "../interfaces/IERC20Minimal.sol";

/// @title OrbitalRouter
/// @notice User-facing entry point for swaps against orbital pools.
///         Handles deadline checks, slippage protection, token pulls via
///         the swap callback, and both exact-input and exact-output modes.
contract OrbitalRouter is IOrbitalSwapCallback {

    address public immutable factory;

    // ─────────────────────────────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────────────────────────────

    struct SwapParams {
        address pool;
        uint256 assetIn;
        uint256 assetOut;
        /// @dev exactInput: exact amount to spend. exactOutput: maximum amount to spend.
        uint256 amountIn;
        /// @dev exactInput: minimum amount out (slippage floor). exactOutput: exact amount wanted.
        uint256 amountOutMin;
        address recipient;
        uint256 deadline;
    }

    // ─────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────

    constructor(address _factory) {
        factory = _factory;
    }

    // ─────────────────────────────────────────────────────────────────────
    // Modifiers
    // ─────────────────────────────────────────────────────────────────────

    modifier checkDeadline(uint256 deadline) {
        require(block.timestamp <= deadline, "OrbitalRouter: expired");
        _;
    }

    // ─────────────────────────────────────────────────────────────────────
    // Swap entrypoints
    // ─────────────────────────────────────────────────────────────────────

    /// @notice Swap an exact input amount for as much output as possible.
    /// @param params  amountIn is exact; amountOutMin is the slippage floor.
    /// @return amountOut Amount of assetOut delivered to recipient.
    function exactInput(SwapParams calldata params)
        external
        checkDeadline(params.deadline)
        returns (uint256 amountOut)
    {
        amountOut = IOrbitalPoolActions(params.pool).swap(
            params.recipient,
            params.assetIn,
            params.assetOut,
            params.amountIn,
            params.amountOutMin,
            abi.encode(msg.sender, false, params.assetOut)
        );
    }

    /// @notice Swap as little input as possible to receive an exact output.
    ///         Uses an on-chain binary search (20 iterations) to find the
    ///         minimum amountIn that satisfies the desired output.
    /// @param params  amountOutMin is the exact desired output; amountIn is the max spend.
    /// @return amountIn The input amount actually spent.
    function exactOutput(SwapParams calldata params)
        external
        checkDeadline(params.deadline)
        returns (uint256 amountIn)
    {
        uint256 lo = 0;
        uint256 hi = params.amountIn;
        uint256 bestAmountIn = type(uint256).max;

        for (uint256 i; i < 20; ++i) {
            if (lo >= hi) break;
            uint256 mid = (lo + hi) / 2;
            uint256 quoted = _quoteExactInput(
                params.pool, params.assetIn, params.assetOut, mid
            );
            if (quoted >= params.amountOutMin) {
                bestAmountIn = mid;
                hi = mid;
            } else {
                lo = mid + 1;
            }
        }

        require(bestAmountIn != type(uint256).max, "OrbitalRouter: insufficient output");
        require(bestAmountIn <= params.amountIn,   "OrbitalRouter: amountIn exceeds max");

        IOrbitalPoolActions(params.pool).swap(
            params.recipient,
            params.assetIn,
            params.assetOut,
            bestAmountIn,
            params.amountOutMin,
            abi.encode(msg.sender, false, params.assetOut)
        );

        amountIn = bestAmountIn;
    }

    // ─────────────────────────────────────────────────────────────────────
    // Callback
    // ─────────────────────────────────────────────────────────────────────

    /// @inheritdoc IOrbitalSwapCallback
    /// @dev data layout: abi.encode(address payer, bool isQuote, uint256 assetOut)
    ///
    ///      Real swap   — payer != address(0), isQuote = false.
    ///                    Pulls amountIn of tokens[assetIn] from payer into the pool.
    ///
    ///      Quote mode  — payer = address(0), isQuote = true.
    ///                    The pool has already transferred amountOut tokens to address(1).
    ///                    We read that balance then revert with it encoded; _quoteExactInput
    ///                    catches the revert to get the simulated output. All EVM state
    ///                    changes (including the token transfer) are rolled back.
    function orbitalSwapCallback(
        uint256 assetIn,
        uint256 amountIn,
        bytes calldata data
    ) external override {
        _verifyPool(msg.sender);

        (address payer, bool isQuote, uint256 assetOut) =
            abi.decode(data, (address, bool, uint256));

        if (isQuote) {
            address tokenOut = IOrbitalPool(msg.sender).tokens(assetOut);
            uint256 received = IERC20Minimal(tokenOut).balanceOf(address(1));
            assembly {
                let ptr := mload(0x40)
                mstore(ptr, received)
                revert(ptr, 32)
            }
        }

        address tokenIn = IOrbitalPool(msg.sender).tokens(assetIn);
        _safeTransferFrom(tokenIn, payer, msg.sender, amountIn);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Multicall
    // ─────────────────────────────────────────────────────────────────────

    /// @notice Batch multiple router calls in one transaction.
    ///         Uses delegatecall so msg.sender is preserved across all calls.
    /// @param data   ABI-encoded calldata for each call to this contract.
    /// @return results ABI-encoded return values, one per call.
    function multicall(bytes[] calldata data) external returns (bytes[] memory results) {
        results = new bytes[](data.length);
        for (uint256 i; i < data.length; ++i) {
            (bool success, bytes memory result) = address(this).delegatecall(data[i]);
            require(success, "OrbitalRouter: call failed");
            results[i] = result;
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────────────

    /// @dev Simulate a swap without committing state changes.
    ///      Initiates a real pool.swap call with address(1) as the recipient and
    ///      isQuote=true in data. The callback reads the output transferred to
    ///      address(1) and reverts with it; the entire pool state change reverts
    ///      with it. We decode the output from the caught revert reason.
    function _quoteExactInput(
        address pool,
        uint256 assetIn,
        uint256 assetOut,
        uint256 amountIn
    ) private returns (uint256 amountOut) {
        try IOrbitalPoolActions(pool).swap(
            address(1),    // quote sink — zero balance for any real token
            assetIn,
            assetOut,
            amountIn,
            0,             // no slippage check during simulation
            abi.encode(address(0), true, assetOut)
        ) returns (uint256) {
            revert("OrbitalRouter: quote did not revert");
        } catch (bytes memory reason) {
            require(reason.length == 32, "OrbitalRouter: bad quote");
            amountOut = abi.decode(reason, (uint256));
        }
    }

    /// @dev Verify that `pool` was deployed by this router's factory by
    ///      reconstructing its token-set hash and checking the factory registry.
    ///      Reverts if the pool is not registered.
    function _verifyPool(address pool) private view {
        uint256 numAssets = IOrbitalPool(pool).n();
        uint24  poolFee   = IOrbitalPool(pool).fee();
        address[] memory tokenArr = new address[](numAssets);
        for (uint256 i; i < numAssets; ++i) {
            tokenArr[i] = IOrbitalPool(pool).tokens(i);
        }
        bytes32 hash = keccak256(abi.encode(tokenArr, poolFee));
        require(
            IOrbitalFactory(factory).getPool(hash) == pool,
            "OrbitalRouter: unknown pool"
        );
    }

    /// @dev ERC20 transferFrom with return-value check (handles non-standard tokens).
    function _safeTransferFrom(
        address token,
        address from,
        address to,
        uint256 amount
    ) private {
        (bool success, bytes memory returndata) = token.call(
            abi.encodeWithSelector(IERC20Minimal.transferFrom.selector, from, to, amount)
        );
        require(
            success && (returndata.length == 0 || abi.decode(returndata, (bool))),
            "OrbitalRouter: TF"
        );
    }
}
