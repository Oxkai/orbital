// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {OrbitalPool} from "./OrbitalPool.sol";

/// @title OrbitalPoolDeployer
/// @notice Deploys OrbitalPool contracts using transient parameter storage,
///         mirroring the Uniswap V3 deployer/factory split.
///
///         The factory inherits this contract. When the factory creates a pool,
///         it stages the constructor args in `parameters`, calls CREATE2, and
///         clears `parameters` afterward. The pool's constructor reads the
///         arguments back via `parameters()` rather than receiving them as
///         calldata, which keeps the deployed bytecode (and therefore the
///         CREATE2 address) independent of the constructor inputs.
abstract contract OrbitalPoolDeployer {
    /// @notice Constructor parameters staged for the next pool deployment.
    struct Parameters {
        address   factory;
        address[] tokens;
        uint24    fee;
    }

    /// @notice Read by `OrbitalPool`'s constructor immediately after CREATE2.
    ///         Cleared at the end of `_deploy` so the slot is empty between
    ///         deployments.
    Parameters public parameters;

    /// @dev Auto-generated getter cannot return a dynamic array, so we expose
    ///      one explicitly. `OrbitalPool` calls this from its constructor.
    function getParameters()
        external
        view
        returns (address factory, address[] memory tokens, uint24 fee)
    {
        Parameters storage p = parameters;
        return (p.factory, p.tokens, p.fee);
    }

    /// @dev Stage parameters, CREATE2-deploy the pool, then clear parameters.
    ///      `salt` must be unique per pool — the factory passes the token-set
    ///      hash, which already encodes both the asset list and the fee tier.
    function _deploy(
        address factory,
        address[] memory tokens,
        uint24 fee,
        bytes32 salt
    ) internal returns (address pool) {
        parameters = Parameters({factory: factory, tokens: tokens, fee: fee});
        pool = address(new OrbitalPool{salt: salt}());
        delete parameters;
    }
}
