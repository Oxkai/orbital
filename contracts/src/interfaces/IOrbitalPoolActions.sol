// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

/// @title IOrbitalPoolActions
/// @notice State-mutating user entrypoints on the pool.
interface IOrbitalPoolActions {
    /// @notice Add liquidity to a tick.
    /// @param recipient Position owner.
    /// @param kWad      Tick plane constant, WAD-scaled.
    /// @param rWad      Liquidity (radius contribution) to add, WAD-scaled.
    /// @param data      Opaque payload forwarded to the mint callback.
    /// @return amounts  Token amounts pulled from the caller, one per asset.
    function mint(
        address recipient,
        uint256 kWad,
        uint256 rWad,
        bytes calldata data
    ) external returns (uint256[] memory amounts);

    /// @notice Swap one asset for another.
    /// @param recipient    Receiver of the output amount.
    /// @param assetIn      Index of the asset being sold.
    /// @param assetOut     Index of the asset being bought.
    /// @param amountIn     Input amount, WAD-scaled.
    /// @param amountOutMin Minimum acceptable output (slippage guard), WAD-scaled.
    /// @param data         Opaque payload forwarded to the swap callback.
    /// @return amountOut   Output amount delivered, WAD-scaled.
    function swap(
        address recipient,
        uint256 assetIn,
        uint256 assetOut,
        uint256 amountIn,
        uint256 amountOutMin,
        bytes calldata data
    ) external returns (uint256 amountOut);

    /// @notice Remove liquidity from a tick.
    /// @param tickIndex Tick to burn from.
    /// @param rWad      Liquidity to remove, WAD-scaled.
    /// @return amounts  Token amounts credited to tokensOwed, one per asset.
    function burn(uint256 tickIndex, uint256 rWad)
        external
        returns (uint256[] memory amounts);

    /// @notice Collect accrued fees for a position.
    /// @param tickIndex Tick the caller's position belongs to.
    /// @return fees     Fees transferred to the caller, one per asset.
    function collect(uint256 tickIndex) external returns (uint256[] memory fees);
}
