// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {OrbitalFactory} from "../src/core/OrbitalFactory.sol";

/// @notice Deploys a new 4-asset pool at 0.05% fee using the already-deployed
///         factory and mock tokens from the existing Sepolia deployment.
///
///         forge script script/DeployPool005.s.sol \
///           --rpc-url $SEPOLIA_RPC_URL --broadcast
contract DeployPool005 is Script {
    using stdJson for string;

    // ── existing Sepolia infrastructure ──────────────────────────────────
    address constant FACTORY = 0x7e1B4FE6170AccA1789e249eAB3D247182D30B44;
    address constant USDC    = 0x44406ad771b05827F5fd95b002189e51EEbEDC91;
    address constant DAI     = 0x60Cb112631Ce92f9fe164878d690FAc1FD1C295d;
    address constant FRAX    = 0x39855B7DE333de50A7b2e97a3A3E2Ec1CF0411a9;
    address constant USDT    = 0x168DEB69184ea184AadB8a626DC4d3013dc08Fe8;

    uint24 constant FEE = 500; // 0.05% — enabled by default in OrbitalFactory

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);

        address[] memory tokens = new address[](4);
        tokens[0] = USDC;
        tokens[1] = DAI;
        tokens[2] = FRAX;
        tokens[3] = USDT;

        address pool = OrbitalFactory(FACTORY).createPool(tokens, FEE);

        vm.stopBroadcast();

        console.log("=== New Pool @ 0.05% ===");
        console.log("Pool:", pool);
        console.log("Fee: 500 (0.05%)");
        console.log("Tokens: USDC DAI FRAX USDT");

        // write to deployments/sepolia_005.json
        string memory k = "pool005";
        vm.serializeAddress(k, "factory",         FACTORY);
        vm.serializeAddress(k, "pool",            pool);
        vm.serializeAddress(k, "router",          0x60CEC0218b501Cf4E045CbDbA3eF021374e1aFAc);
        vm.serializeAddress(k, "quoter",          0x713cd4D1a453705fa31D81A89817174d1c37d489);
        vm.serializeAddress(k, "positionManager", 0x08AC49be269F1c6C2821D56c4C729C9843152EE3);
        vm.serializeAddress(k, "usdc",            USDC);
        vm.serializeAddress(k, "usdt",            USDT);
        vm.serializeAddress(k, "dai",             DAI);
        string memory json = vm.serializeAddress(k, "frax", FRAX);
        vm.writeJson(json, "deployments/sepolia_005.json");
    }
}
