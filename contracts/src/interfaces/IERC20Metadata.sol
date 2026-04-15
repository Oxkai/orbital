// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

/// @title IERC20Metadata
/// @notice Minimal view of the optional ERC-20 metadata extension. Only the
///         pieces the factory needs to validate token decimals.
interface IERC20Metadata {
    function decimals() external view returns (uint8);
}
