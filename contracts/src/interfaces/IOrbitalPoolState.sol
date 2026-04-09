// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {TickLib}     from "../lib/TickLib.sol";
import {PositionLib} from "../lib/PositionLib.sol";

/// @title IOrbitalPoolState
/// @notice Read-only views into pool storage.
interface IOrbitalPoolState {
    /// @notice The factory that deployed this pool.
    function factory() external view returns (address);

    /// @notice Token at the given index in the pool's canonical asset list.
    function tokens(uint256 index) external view returns (address);

    /// @notice Number of assets the pool trades.
    function n() external view returns (uint256);

    /// @notice Pool fee in hundredths of a bip.
    function fee() external view returns (uint24);

    /// @notice Packed pool-level torus state, mirroring TorusMath.TorusState plus a reentrancy lock.
    /// @return sumX     Σxᵢ across all reserves, WAD-scaled
    /// @return sumXSq   Σ(xᵢ²/WAD) across all reserves, WAD-scaled
    /// @return rInt    Consolidated interior radius, WAD-scaled
    /// @return kBound   Σk over boundary ticks, WAD-scaled
    /// @return sBound   Σs over boundary ticks, WAD-scaled
    /// @return unlocked True when not currently inside a state-mutating call
    function slot0()
        external
        view
        returns (
            uint256 sumX,
            uint256 sumXSq,
            uint256 rInt,
            uint256 kBound,
            uint256 sBound,
            bool    unlocked
        );

    /// @notice Reserve of the asset at the given index, WAD-scaled.
    function reserves(uint256 assetIndex) external view returns (uint256);

    /// @notice Per-asset accumulated fee growth per unit of interior liquidity (r),
    ///         WAD-scaled. Indexed by asset position in `tokens`.
    function feeGrowthGlobal(uint256 assetIndex) external view returns (uint256);

    /// @notice Uncollected fees credited to a position, per asset, in token units.
    function tokensOwed(bytes32 positionKey, uint256 assetIndex)
        external
        view
        returns (uint256);

    /// @notice Tick metadata for the given tick index.
    function ticks(uint256 index) external view returns (TickLib.Tick memory);

    /// @notice Position metadata for the given position key.
    function positions(bytes32 key) external view returns (PositionLib.Position memory);
}
