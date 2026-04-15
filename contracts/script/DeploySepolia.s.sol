// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {DeployBase} from "./Deploy.s.sol";

/// @notice Sepolia deployment. Reads PRIVATE_KEY from env and broadcasts.
/// @dev Run with:
///      forge script script/DeploySepolia.s.sol --rpc-url $SEPOLIA_RPC_URL \
///          --broadcast --verify --etherscan-api-key $ETHERSCAN_API_KEY
contract DeploySepolia is DeployBase {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(pk);
        Deployment memory d = _deployAll();
        vm.stopBroadcast();

        _logDeployment(d);
        _writeDeployment(d, "deployments/sepolia.json");
    }
}
