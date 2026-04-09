// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {IOrbitalFactory}    from "../interfaces/IOrbitalFactory.sol";
import {OrbitalPoolDeployer} from "./OrbitalPoolDeployer.sol";

/// @title OrbitalFactory
/// @notice Canonical registry and deployer for orbital pools.
///         Pools are keyed by `keccak256(sortedTokens, fee)` so a given asset
///         set + fee tier maps to exactly one pool.
contract OrbitalFactory is IOrbitalFactory, OrbitalPoolDeployer {
    /// @notice Address allowed to enable new fee tiers and rotate ownership.
    address public override owner;

    /// @notice Pending owner for the two-step transfer pattern.
    address public pendingOwner;

    /// @notice Pool address by token-set hash. Zero if not yet created.
    mapping(bytes32 => address) public override getPool;

    /// @notice Every pool ever created by this factory, in creation order.
    address[] public allPools;

    /// @notice Whitelist of fee tiers (hundredths of a bip) usable for new pools.
    mapping(uint24 => bool) public feeAmountEnabled;

    event FeeAmountEnabled(uint24 indexed fee);
    event OwnerTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnerTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "OrbitalFactory: not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnerTransferred(address(0), msg.sender);

        // Default fee tiers, matching Uniswap V3 conventions.
        feeAmountEnabled[100]   = true; // 0.01%
        feeAmountEnabled[500]   = true; // 0.05%
        feeAmountEnabled[3000]  = true; // 0.30%
        feeAmountEnabled[10000] = true; // 1.00%
        emit FeeAmountEnabled(100);
        emit FeeAmountEnabled(500);
        emit FeeAmountEnabled(3000);
        emit FeeAmountEnabled(10000);
    }

    /// @notice Total number of pools deployed by this factory.
    function allPoolsLength() external view returns (uint256) {
        return allPools.length;
    }

    /// @inheritdoc IOrbitalFactory
    function createPool(address[] calldata tokens, uint24 fee)
        external
        override
        returns (address pool)
    {
        require(feeAmountEnabled[fee], "OrbitalFactory: fee not enabled");
        require(tokens.length >= 2, "OrbitalFactory: need >= 2 tokens");

        // Copy + sort + uniqueness check. Sorting canonicalises the hash so
        // (A,B) and (B,A) map to the same pool.
        address[] memory sorted = _sortAndValidate(tokens);

        bytes32 tokenSetHash = keccak256(abi.encode(sorted, fee));
        require(getPool[tokenSetHash] == address(0), "OrbitalFactory: pool exists");

        pool = _deploy(address(this), sorted, fee, tokenSetHash);

        getPool[tokenSetHash] = pool;
        allPools.push(pool);

        emit PoolCreated(tokenSetHash, fee, pool);
    }

    /// @notice Enable a new fee tier. Cannot be undone.
    function enableFeeAmount(uint24 fee) external onlyOwner {
        require(fee < 1_000_000, "OrbitalFactory: fee too large");
        require(!feeAmountEnabled[fee], "OrbitalFactory: already enabled");
        feeAmountEnabled[fee] = true;
        emit FeeAmountEnabled(fee);
    }

    /// @notice Step 1 of two-step ownership transfer.
    function setOwner(address newOwner) external onlyOwner {
        pendingOwner = newOwner;
        emit OwnerTransferStarted(owner, newOwner);
    }

    /// @notice Step 2 of two-step ownership transfer. Called by the new owner
    ///         to accept ownership; protects against fat-fingered transfers.
    function acceptOwner() external {
        require(msg.sender == pendingOwner, "OrbitalFactory: not pending owner");
        address previous = owner;
        owner = pendingOwner;
        delete pendingOwner;
        emit OwnerTransferred(previous, owner);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────────────

    /// @dev Returns a memory copy of `tokens` sorted ascending. Reverts on
    ///      duplicates or zero addresses. Uses insertion sort: token sets are
    ///      small (≤ ~10) so O(n²) is fine and avoids quicksort overhead.
    function _sortAndValidate(address[] calldata tokens)
        private
        pure
        returns (address[] memory sorted)
    {
        uint256 n = tokens.length;
        sorted = new address[](n);
        for (uint256 i; i < n; ++i) {
            address t = tokens[i];
            require(t != address(0), "OrbitalFactory: zero token");

            // Insertion: find slot, shift larger elements right.
            uint256 j = i;
            while (j > 0 && sorted[j - 1] > t) {
                sorted[j] = sorted[j - 1];
                --j;
            }
            // Duplicate detection: equal to left neighbour.
            require(j == 0 || sorted[j - 1] != t, "OrbitalFactory: duplicate token");
            sorted[j] = t;
        }
    }
}
