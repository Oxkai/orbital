// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {IOrbitalPoolState}   from "./IOrbitalPoolState.sol";
import {IOrbitalPoolActions} from "./IOrbitalPoolActions.sol";
import {IOrbitalPoolEvents}  from "./IOrbitalPoolEvents.sol";

/// @title IOrbitalPool
/// @notice Aggregate interface for an orbital pool.
/// @dev Protocol-fee owner actions (IOrbitalPoolOwnerActions) are intentionally
///      excluded from the prototype — see contracts/SECURITY.md.
interface IOrbitalPool is
    IOrbitalPoolState,
    IOrbitalPoolActions,
    IOrbitalPoolEvents
{}
