// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {IOrbitalPoolState}        from "./IOrbitalPoolState.sol";
import {IOrbitalPoolActions}      from "./IOrbitalPoolActions.sol";
import {IOrbitalPoolEvents}       from "./IOrbitalPoolEvents.sol";
import {IOrbitalPoolOwnerActions} from "./IOrbitalPoolOwnerActions.sol";

/// @title IOrbitalPool
/// @notice Aggregate interface for an orbital pool.
interface IOrbitalPool is
    IOrbitalPoolState,
    IOrbitalPoolActions,
    IOrbitalPoolEvents,
    IOrbitalPoolOwnerActions
{}
