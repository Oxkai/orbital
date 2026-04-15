// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

/// @title IOrbitalFactory
/// @notice Deploys orbital pools and tracks them by token-set hash.
interface IOrbitalFactory {
    /// @notice Emitted when a new pool is created.
    /// @param tokenSetHash keccak256 of the canonical token set
    /// @param fee          Pool fee in hundredths of a bip
    /// @param pool         Address of the newly created pool
    event PoolCreated(bytes32 indexed tokenSetHash, uint24 indexed fee, address pool);

    /// @notice Owner of the factory (privileged for protocol fee config).
    function owner() external view returns (address);

    /// @notice Global pause flag. When true, pools reject mint/swap/burn.
    function paused() external view returns (bool);

    /// @notice Look up an existing pool by its token-set hash.
    function getPool(bytes32 tokenSetHash) external view returns (address pool);

    /// @notice Deploy a new orbital pool for the given tokens and fee tier.
    /// @param tokens The set of tokens (n >= 2) the pool will trade.
    /// @param fee    Fee tier in hundredths of a bip.
    /// @return pool  The address of the newly created pool.
    function createPool(address[] calldata tokens, uint24 fee) external returns (address pool);
}
