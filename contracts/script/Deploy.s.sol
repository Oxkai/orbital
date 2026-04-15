// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";

import {OrbitalFactory}         from "../src/core/OrbitalFactory.sol";
import {OrbitalRouter}          from "../src/periphery/OrbitalRouter.sol";
import {OrbitalPositionManager} from "../src/periphery/OrbitalPositionManager.sol";
import {OrbitalQuoter}          from "../src/periphery/OrbitalQuoter.sol";
import {MockERC20}              from "../src/mocks/MockERC20.sol";

/// @notice Core deployment routine shared by local and Sepolia scripts.
abstract contract DeployBase is Script {
    using stdJson for string;

    uint24 internal constant FEE_BPS30 = 3000; // 0.30% = 30 bips (Uniswap default)

    struct Deployment {
        address factory;
        address router;
        address positionManager;
        address quoter;
        address usdc;
        address usdt;
        address dai;
        address frax;
        address pool;
    }

    function _deployAll() internal returns (Deployment memory d) {
        OrbitalFactory factory = new OrbitalFactory();
        d.factory = address(factory);

        // Pool math is WAD-native — all mocks deployed at 18 decimals.
        MockERC20 usdc = new MockERC20("Mock USD Coin", "mUSDC", 18);
        MockERC20 usdt = new MockERC20("Mock Tether",   "mUSDT", 18);
        MockERC20 dai  = new MockERC20("Mock Dai",      "mDAI",  18);
        MockERC20 frax = new MockERC20("Mock FRAX",     "mFRAX", 18);

        d.usdc = address(usdc);
        d.usdt = address(usdt);
        d.dai  = address(dai);
        d.frax = address(frax);

        address[] memory tokens = new address[](4);
        tokens[0] = d.usdc;
        tokens[1] = d.usdt;
        tokens[2] = d.dai;
        tokens[3] = d.frax;

        d.pool = factory.createPool(tokens, FEE_BPS30);

        d.router          = address(new OrbitalRouter(d.factory));
        d.positionManager = address(new OrbitalPositionManager(d.factory));
        d.quoter          = address(new OrbitalQuoter());
    }

    function _logDeployment(Deployment memory d) internal pure {
        console.log("=== Orbital Deployment ===");
        console.log("Factory:         ", d.factory);
        console.log("Pool (4-asset):  ", d.pool);
        console.log("Router:          ", d.router);
        console.log("PositionManager: ", d.positionManager);
        console.log("Quoter:          ", d.quoter);
        console.log("MockUSDC (6):    ", d.usdc);
        console.log("MockUSDT (6):    ", d.usdt);
        console.log("MockDAI (18):    ", d.dai);
        console.log("MockFRAX (18):   ", d.frax);
    }

    function _writeDeployment(Deployment memory d, string memory outPath) internal {
        string memory k = "orbital";
        vm.serializeAddress(k, "factory",         d.factory);
        vm.serializeAddress(k, "pool",            d.pool);
        vm.serializeAddress(k, "router",          d.router);
        vm.serializeAddress(k, "positionManager", d.positionManager);
        vm.serializeAddress(k, "quoter",          d.quoter);
        vm.serializeAddress(k, "usdc",            d.usdc);
        vm.serializeAddress(k, "usdt",            d.usdt);
        vm.serializeAddress(k, "dai",             d.dai);
        string memory json = vm.serializeAddress(k, "frax", d.frax);
        vm.writeJson(json, outPath);
    }
}

/// @notice Local deployment (Anvil / forge test). Uses default foundry broadcaster.
contract Deploy is DeployBase {
    function run() external {
        vm.startBroadcast();
        Deployment memory d = _deployAll();
        vm.stopBroadcast();

        _logDeployment(d);
        _writeDeployment(d, "deployments/local.json");
    }
}
