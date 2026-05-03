// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";

import {MockERC20}              from "../src/mocks/MockERC20.sol";
import {OrbitalFactory}         from "../src/core/OrbitalFactory.sol";
import {OrbitalPositionManager} from "../src/periphery/OrbitalPositionManager.sol";
import {OrbitalRouter}          from "../src/periphery/OrbitalRouter.sol";
import {IERC20Minimal}          from "../src/interfaces/IERC20Minimal.sol";

/// @notice Deploy a 5-token pool (USDC/USDT/DAI/FRAX/crvUSD) using the
///         existing factory/router/PM, seed it with 4 realistic LP tiers,
///         and run 20 cross-pair swap tests.
///
///         forge script script/Deploy5Pool.s.sol \
///           --rpc-url $SEPOLIA_RPC_URL --private-key $PRIVATE_KEY --broadcast
contract Deploy5Pool is Script {
    using stdJson for string;

    uint256 constant WAD     = 1e18;
    uint24  constant FEE_005 = 500; // 0.05%

    // Existing infrastructure (from sepolia_new.json)
    address constant FACTORY          = 0x50C64861c68CCFfE2F2464DE829Bca17DBa70a1b;
    address constant POSITION_MANAGER = 0x0519BC11599aFc4571ee053b1609ada6dD81624f;
    address constant ROUTER           = 0xE3F3fC6b64FE618d263F931dB052Ac8FdbaC33b9;

    // Existing 4 tokens
    address constant USDC = 0x6874393CFe557b9288EF5B0A71a830cC8ce7f0fB;
    address constant USDT = 0x4a6b63081a2c1933EBb662d5462EdB9158654B1E;
    address constant DAI  = 0x3aF83cd2fA7fC93C17bE0CfA6A1Faaf2c6c5B215;
    address constant FRAX = 0xedc7917961Ce6d4c6922E903eA633fB8b4C9e5Cc;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address me = vm.addr(pk);
        vm.startBroadcast(pk);

        // ── 1. Deploy 5th token: crvUSD ────────────────────────────────────
        MockERC20 crvusd = new MockERC20("Mock crvUSD", "mcrvUSD", 18);
        console.log("crvUSD deployed:", address(crvusd));

        // ── 2. Create 5-token pool ─────────────────────────────────────────
        address[] memory tokens = new address[](5);
        tokens[0] = USDC;
        tokens[1] = USDT;
        tokens[2] = DAI;
        tokens[3] = FRAX;
        tokens[4] = address(crvusd);
        address pool = OrbitalFactory(FACTORY).createPool(tokens, FEE_005);
        console.log("5-token pool deployed:", pool);

        // ── 3. Mint tokens ─────────────────────────────────────────────────
        uint256 mintAmt = 15_000_000 * WAD;
        MockERC20(USDC).mint(me, mintAmt);
        MockERC20(USDT).mint(me, mintAmt);
        MockERC20(DAI ).mint(me, mintAmt);
        MockERC20(FRAX).mint(me, mintAmt);
        crvusd.mint(me, mintAmt);

        // ── 4. Approve PM and Router ───────────────────────────────────────
        IERC20Minimal(USDC).approve(POSITION_MANAGER, type(uint256).max);
        IERC20Minimal(USDT).approve(POSITION_MANAGER, type(uint256).max);
        IERC20Minimal(DAI ).approve(POSITION_MANAGER, type(uint256).max);
        IERC20Minimal(FRAX).approve(POSITION_MANAGER, type(uint256).max);
        IERC20Minimal(address(crvusd)).approve(POSITION_MANAGER, type(uint256).max);

        IERC20Minimal(USDC).approve(ROUTER, type(uint256).max);
        IERC20Minimal(USDT).approve(ROUTER, type(uint256).max);
        IERC20Minimal(DAI ).approve(ROUTER, type(uint256).max);
        IERC20Minimal(FRAX).approve(ROUTER, type(uint256).max);
        IERC20Minimal(address(crvusd)).approve(ROUTER, type(uint256).max);

        // ── 5. Seed liquidity (n=5 kNorm values) ──────────────────────────
        // For n=5: kMin=1.236068, kSingleMax=1.341641
        // All kNorm values must be < kSingleMax
        //   Tier A: depeg $0.999  kNorm=1.23606806  r=5M   ~very tight
        //   Tier B: depeg $0.997  kNorm=1.23606870  r=4M
        //   Tier C: depeg $0.995  kNorm=1.23606998  r=3M
        //   Tier D: depeg $0.990  kNorm=1.23607601  r=2M   ~wider safety net
        OrbitalPositionManager pm = OrbitalPositionManager(POSITION_MANAGER);
        uint256[] memory amountsMin = new uint256[](5);

        _mint(pm, pool, amountsMin, me, 5_000_000 * WAD, 1236068057531789824);
        _mint(pm, pool, amountsMin, me, 4_000_000 * WAD, 1236068698363788544);
        _mint(pm, pool, amountsMin, me, 3_000_000 * WAD, 1236069981499773696);
        _mint(pm, pool, amountsMin, me, 2_000_000 * WAD, 1236076009499275776);

        console.log("Liquidity seeded. Total r = 14M across 4 tiers");

        // ── 6. Swap tests — all 10 pairs, both directions ─────────────────
        OrbitalRouter router = OrbitalRouter(ROUTER);
        uint256 swapAmt = 1_000 * WAD;

        uint256[2][20] memory pairs = [
            [uint256(0), 1], [uint256(1), 0],
            [uint256(0), 2], [uint256(2), 0],
            [uint256(0), 3], [uint256(3), 0],
            [uint256(0), 4], [uint256(4), 0],
            [uint256(1), 2], [uint256(2), 1],
            [uint256(1), 3], [uint256(3), 1],
            [uint256(1), 4], [uint256(4), 1],
            [uint256(2), 3], [uint256(3), 2],
            [uint256(2), 4], [uint256(4), 2],
            [uint256(3), 4], [uint256(4), 3]
        ];

        for (uint256 i = 0; i < 20; i++) {
            uint256 out = router.exactInput(OrbitalRouter.SwapParams({
                pool:         pool,
                assetIn:      pairs[i][0],
                assetOut:     pairs[i][1],
                amountIn:     swapAmt,
                amountOutMin: 0,
                recipient:    me,
                deadline:     block.timestamp + 600
            }));
            console.log("swap out:", out / WAD);
        }

        vm.stopBroadcast();

        console.log("=== DONE ===");
        console.log("5-token pool:", pool);
        console.log("crvUSD token:", address(crvusd));
    }

    function _mint(
        OrbitalPositionManager pm,
        address pool,
        uint256[] memory amountsMin,
        address me,
        uint256 rWad,
        uint256 kNormWad
    ) internal {
        uint256 kWad = rWad * kNormWad / WAD;
        (uint256 tokenId,) = pm.mint(OrbitalPositionManager.MintParams({
            pool:       pool,
            kWad:       kWad,
            rWad:       rWad,
            amountsMin: amountsMin,
            recipient:  me,
            deadline:   block.timestamp + 600
        }));
        console.log("minted tokenId:", tokenId, "rWad:", rWad / WAD);
    }
}
