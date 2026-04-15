// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {IOrbitalSwapCallback} from "../interfaces/IOrbitalSwapCallback.sol";
import {IOrbitalPoolActions}  from "../interfaces/IOrbitalPoolActions.sol";
import {IOrbitalPool}         from "../interfaces/IOrbitalPool.sol";
import {IOrbitalFactory}      from "../interfaces/IOrbitalFactory.sol";
import {IERC20Minimal}        from "../interfaces/IERC20Minimal.sol";

contract OrbitalRouter is IOrbitalSwapCallback {

    address public immutable factory;

    struct SwapParams {
        address pool;
        uint256 assetIn;
        uint256 assetOut;
        uint256 amountIn;
        uint256 amountOutMin;
        address recipient;
        uint256 deadline;
    }

    constructor(address _factory) {
        factory = _factory;
    }

    modifier checkDeadline(uint256 deadline) {
        require(block.timestamp <= deadline, "OrbitalRouter: expired");
        _;
    }

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

    function exactOutput(SwapParams calldata params)
        external
        checkDeadline(params.deadline)
        returns (uint256 amountIn)
    {
        uint256 lo = 1;
        uint256 hi = params.amountIn + 1;
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

    function multicall(bytes[] calldata data) external returns (bytes[] memory results) {
        results = new bytes[](data.length);
        for (uint256 i; i < data.length; ++i) {
            (bool success, bytes memory result) = address(this).delegatecall(data[i]);
            require(success, "OrbitalRouter: call failed");
            results[i] = result;
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
            abi.encode(address(0), true, assetOut)
        ) returns (uint256) {
            revert("OrbitalRouter: quote did not revert");
        } catch (bytes memory reason) {
            require(reason.length == 32, "OrbitalRouter: bad quote");
            amountOut = abi.decode(reason, (uint256));
        }
    }

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
