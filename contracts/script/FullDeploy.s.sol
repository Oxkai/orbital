// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";

import {OrbitalFactory}         from "../src/core/OrbitalFactory.sol";
import {OrbitalRouter}          from "../src/periphery/OrbitalRouter.sol";
import {OrbitalPositionManager} from "../src/periphery/OrbitalPositionManager.sol";
import {OrbitalQuoter}          from "../src/periphery/OrbitalQuoter.sol";
import {MockERC20}              from "../src/mocks/MockERC20.sol";
import {IERC20Minimal}          from "../src/interfaces/IERC20Minimal.sol";

/// @notice Full deploy + seed in one shot (Base Sepolia).
/// @dev    forge script script/FullDeploy.s.sol \
///           --rpc-url $SEPOLIA_RPC_URL --broadcast
contract FullDeploy is Script {
    using stdJson for string;

    uint256 constant WAD     = 1e18;
    uint24  constant FEE_005 = 500; // 0.05%

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address me = vm.addr(pk);
        vm.startBroadcast(pk);

        // ── 1. Deploy core ──────────────────────────────────────────────────
        OrbitalFactory         factory = new OrbitalFactory();
        OrbitalRouter          router  = new OrbitalRouter(address(factory));
        OrbitalPositionManager pm      = new OrbitalPositionManager(address(factory));
        OrbitalQuoter          quoter  = new OrbitalQuoter();

        // ── 2. Deploy mock tokens (18 dec each) ────────────────────────────
        MockERC20 usdc = new MockERC20("Mock USD Coin", "mUSDC", 18);
        MockERC20 usdt = new MockERC20("Mock Tether",   "mUSDT", 18);
        MockERC20 dai  = new MockERC20("Mock Dai",      "mDAI",  18);
        MockERC20 frax = new MockERC20("Mock FRAX",     "mFRAX", 18);

        // ── 3. Create pool @ 0.05% ─────────────────────────────────────────
        address[] memory tokens = new address[](4);
        tokens[0] = address(usdc);
        tokens[1] = address(usdt);
        tokens[2] = address(dai);
        tokens[3] = address(frax);
        address pool = factory.createPool(tokens, FEE_005);

        // ── 4. Mint test tokens ────────────────────────────────────────────
        uint256 mintAmt = 10_000_000 * WAD;
        usdc.mint(me, mintAmt);
        usdt.mint(me, mintAmt);
        dai.mint(me,  mintAmt);
        frax.mint(me, mintAmt);

        // ── 5. Approve position manager ────────────────────────────────────
        IERC20Minimal(address(usdc)).approve(address(pm), type(uint256).max);
        IERC20Minimal(address(usdt)).approve(address(pm), type(uint256).max);
        IERC20Minimal(address(dai )).approve(address(pm), type(uint256).max);
        IERC20Minimal(address(frax)).approve(address(pm), type(uint256).max);

        // ── 6. Seed liquidity across 4 ticks ──────────────────────────────
        uint256[] memory amountsMin = new uint256[](4);
        _mint(pm, amountsMin, me, pool, 4_000_000 * WAD, 1_050e15); // k_norm ≈ 1.050 → tight depeg
        _mint(pm, amountsMin, me, pool, 3_500_000 * WAD, 1_150e15);
        _mint(pm, amountsMin, me, pool, 2_000_000 * WAD, 1_275e15);
        _mint(pm, amountsMin, me, pool,   500_000 * WAD, 1_375e15);

        vm.stopBroadcast();

        // ── 7. Log & persist ───────────────────────────────────────────────
        console.log("=== Orbital Full Deploy ===");
        console.log("Factory:         ", address(factory));
        console.log("Pool (0.05%):    ", pool);
        console.log("Router:          ", address(router));
        console.log("PositionManager: ", address(pm));
        console.log("Quoter:          ", address(quoter));
        console.log("mUSDC:           ", address(usdc));
        console.log("mUSDT:           ", address(usdt));
        console.log("mDAI:            ", address(dai));
        console.log("mFRAX:           ", address(frax));

        string memory k = "orbital";
        vm.serializeAddress(k, "factory",         address(factory));
        vm.serializeAddress(k, "pool",            pool);
        vm.serializeAddress(k, "router",          address(router));
        vm.serializeAddress(k, "positionManager", address(pm));
        vm.serializeAddress(k, "quoter",          address(quoter));
        vm.serializeAddress(k, "usdc",            address(usdc));
        vm.serializeAddress(k, "usdt",            address(usdt));
        vm.serializeAddress(k, "dai",             address(dai));
        string memory json = vm.serializeAddress(k, "frax", address(frax));
        vm.writeJson(json, "deployments/sepolia_new.json");
    }

    function _mint(
        OrbitalPositionManager pm,
        uint256[] memory amountsMin,
        address me,
        address pool,
        uint256 rWad,
        uint256 kNormWad
    ) internal {
        uint256 kWad = rWad * kNormWad / WAD;
        (uint256 tokenId,) = pm.mint(
            OrbitalPositionManager.MintParams({
                pool:       pool,
                kWad:       kWad,
                rWad:       rWad,
                amountsMin: amountsMin,
                recipient:  me,
                deadline:   block.timestamp + 600
            })
        );
        console.log("  minted LP tokenId:", tokenId, " rWad:", rWad / WAD);
    }
}
