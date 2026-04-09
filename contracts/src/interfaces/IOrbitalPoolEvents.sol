// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

/// @title IOrbitalPoolEvents
/// @notice Events emitted by the orbital pool.
interface IOrbitalPoolEvents {
    /// @notice Emitted when liquidity is added to a tick.
    event Mint(
        address indexed recipient,
        uint256 kWad,
        uint256 rWad,
        uint256[] amounts
    );

    /// @notice Emitted when a swap settles.
    event Swap(
        address indexed sender,
        address indexed recipient,
        uint256 assetIn,
        uint256 assetOut,
        uint256 amountIn,
        uint256 amountOut
    );

    /// @notice Emitted when liquidity is removed from a tick.
    event Burn(
        address indexed owner,
        uint256 indexed tickIndex,
        uint256 rWad,
        uint256[] amounts
    );

    /// @notice Emitted when accrued fees are collected.
    event Collect(
        address indexed owner,
        uint256 indexed tickIndex,
        uint256[] fees
    );

    /// @notice Emitted when a tick transitions between interior and boundary.
    /// @param newIsInterior True if the tick is now interior, false if now boundary.
    event TickCrossed(uint256 indexed tickIndex, bool newIsInterior);
}
