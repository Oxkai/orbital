// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

/// @title IOrbitalPoolOwnerActions
/// @notice Privileged entrypoints callable only by the factory owner.
interface IOrbitalPoolOwnerActions {
    /// @notice Set the protocol fee fraction.
    /// @param feeProtocol Encoded protocol fee setting (0 disables).
    function setFeeProtocol(uint8 feeProtocol) external;

    /// @notice Sweep accumulated protocol fees to the recipient.
    /// @param recipient Address that receives the protocol fees.
    /// @return fees     Amount swept per asset.
    function collectProtocol(address recipient) external returns (uint256[] memory fees);
}
