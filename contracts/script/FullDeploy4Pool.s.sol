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

/// @notice Full lifecycle demo for a 4-token stablecoin pool (USDC/USDT/DAI/FRAX).
///
///  Phase 1 — Deploy everything from scratch
///  Phase 2 — First LP round: 4 tiers at realistic depeg thresholds
///  Phase 3 — Swap tests: 12 cross-pair swaps in both directions
///  Phase 4 — Second LP round: 2 more positions at tighter + wider ranges
///  Phase 5 — LP actions: collect fees, decrease liquidity, increase liquidity, burn
///  Phase 6 — Write deployment JSON (update frontend addresses from this file)
///
///  n=4 math reference:
///    kMin       = sqrt(4) - 1            = 1.0
///    kSingleMax = sqrt(4) - (4-1)/sqrt(4*(4-1)) = 1.1340
///    All kNorm values below must be < 1.1340
///    kNorm -> depeg price mapping (approx):
///      1.000009  -> $0.999   (ultra-tight, ~133x efficiency)
///      1.000085  -> $0.997   (~44x)
///      1.000235  -> $0.995   (~26x)
///      1.000985  -> $0.990   (~13x)
///      1.002500  -> $0.980   (~6x)
///      1.005000  -> $0.970   (~3x)
///
///  forge script script/FullDeploy4Pool.s.sol \
///    --rpc-url $SEPOLIA_RPC_URL --private-key $PRIVATE_KEY --broadcast \
///    --slow -g 200
contract FullDeploy4Pool is Script {
    using stdJson for string;

    uint256 constant WAD     = 1e18;
    uint24  constant FEE_005 = 500; // 0.05%

    // ─── Contracts (filled during deploy) ────────────────────────────────────
    OrbitalFactory         factory;
    OrbitalRouter          router;
    OrbitalPositionManager pm;
    OrbitalQuoter          quoter;

    MockERC20 usdc;
    MockERC20 usdt;
    MockERC20 dai;
    MockERC20 frax;

    address pool;
    address me;

    // ─── Token index helpers ──────────────────────────────────────────────────
    uint256 constant I_USDC = 0;
    uint256 constant I_USDT = 1;
    uint256 constant I_DAI  = 2;
    uint256 constant I_FRAX = 3;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        me = vm.addr(pk);
        vm.startBroadcast(pk);

        _phase1_deploy();
        _phase2_firstLiquidity();
        _phase3_swaps();
        _phase4_secondLiquidity();
        _phase5_lpActions();

        vm.stopBroadcast();

        _phase6_writeJson();
    }

    // ─── Phase 1: Deploy all contracts ───────────────────────────────────────

    function _phase1_deploy() internal {
        console.log("\n=== Phase 1: Deploy ===");

        factory = new OrbitalFactory();
        router  = new OrbitalRouter(address(factory));
        pm      = new OrbitalPositionManager(address(factory));
        quoter  = new OrbitalQuoter();

        usdc = new MockERC20("Mock USD Coin", "mUSDC", 18);
        usdt = new MockERC20("Mock Tether",   "mUSDT", 18);
        dai  = new MockERC20("Mock Dai",      "mDAI",  18);
        frax = new MockERC20("Mock FRAX",     "mFRAX", 18);

        address[] memory tokens = new address[](4);
        tokens[I_USDC] = address(usdc);
        tokens[I_USDT] = address(usdt);
        tokens[I_DAI]  = address(dai);
        tokens[I_FRAX] = address(frax);
        pool = factory.createPool(tokens, FEE_005);

        console.log("Factory:         ", address(factory));
        console.log("Router:          ", address(router));
        console.log("PositionManager: ", address(pm));
        console.log("Quoter:          ", address(quoter));
        console.log("Pool (0.05%):    ", pool);
        console.log("mUSDC:           ", address(usdc));
        console.log("mUSDT:           ", address(usdt));
        console.log("mDAI:            ", address(dai));
        console.log("mFRAX:           ", address(frax));

        // Mint a generous supply for all phases
        uint256 supply = 30_000_000 * WAD;
        usdc.mint(me, supply);
        usdt.mint(me, supply);
        dai.mint(me,  supply);
        frax.mint(me, supply);

        // Approve PM and Router once
        IERC20Minimal(address(usdc)).approve(address(pm),     type(uint256).max);
        IERC20Minimal(address(usdt)).approve(address(pm),     type(uint256).max);
        IERC20Minimal(address(dai )).approve(address(pm),     type(uint256).max);
        IERC20Minimal(address(frax)).approve(address(pm),     type(uint256).max);
        IERC20Minimal(address(usdc)).approve(address(router), type(uint256).max);
        IERC20Minimal(address(usdt)).approve(address(router), type(uint256).max);
        IERC20Minimal(address(dai )).approve(address(router), type(uint256).max);
        IERC20Minimal(address(frax)).approve(address(router), type(uint256).max);

        console.log("Tokens minted and approved.");
    }

    // ─── Phase 2: First LP round ──────────────────────────────────────────────
    // Four tiers covering a realistic depeg spectrum.
    // Tighter positions earn more fees (higher capital efficiency) but go
    // inactive first during a depeg event.

    function _phase2_firstLiquidity() internal {
        console.log("\n=== Phase 2: First LP round ===");
        uint256[] memory amountsMin = new uint256[](4);

        // Tier A — $0.999 threshold, $4M liquidity
        // kNorm=1.000009 → within 0.1% of peg, very concentrated
        uint256 idA = _mint(4_000_000 * WAD, 1_000009423917760000, amountsMin);
        console.log("Tier A (depeg $0.999, r=$4M): tokenId =", idA);

        // Tier B — $0.997 threshold, $3M liquidity
        uint256 idB = _mint(3_000_000 * WAD, 1_000085601597900000, amountsMin);
        console.log("Tier B (depeg $0.997, r=$3M): tokenId =", idB);

        // Tier C — $0.995 threshold, $2M liquidity
        uint256 idC = _mint(2_000_000 * WAD, 1_000234961209800000, amountsMin);
        console.log("Tier C (depeg $0.995, r=$2M): tokenId =", idC);

        // Tier D — $0.990 threshold, $1M liquidity (wide safety net)
        uint256 idD = _mint(1_000_000 * WAD, 1_000942191820800000, amountsMin);
        console.log("Tier D (depeg $0.990, r=$1M): tokenId =", idD);

        console.log("Total seeded: $10M across 4 tiers");
    }

    // ─── Phase 3: Swap tests ──────────────────────────────────────────────────
    // 12 swaps: all 6 pairs in both directions (USDC/USDT/DAI/FRAX).
    // Amounts stay well within the pool's active liquidity (< 2% of r per swap)
    // so no single swap exhausts a reserve and triggers the invariant guard.

    function _phase3_swaps() internal {
        console.log("\n=== Phase 3: Swap tests ===");

        // Each pair is swapped then immediately reversed so reserves stay balanced.
        // This generates fees in both directions without accumulating imbalance.
        uint256[3][12] memory swaps = [
            [I_USDC, I_USDT,  1_000 * WAD],   // small
            [I_USDT, I_USDC,  1_000 * WAD],   // reverse
            [I_DAI,  I_FRAX,  1_000 * WAD],   // small
            [I_FRAX, I_DAI,   1_000 * WAD],   // reverse
            [I_USDT, I_DAI,  30_000 * WAD],   // medium
            [I_DAI,  I_USDT, 30_000 * WAD],   // reverse
            [I_USDC, I_FRAX, 30_000 * WAD],   // medium
            [I_FRAX, I_USDC, 30_000 * WAD],   // reverse
            [I_USDC, I_DAI,  50_000 * WAD],   // larger
            [I_DAI,  I_USDC, 50_000 * WAD],   // reverse
            [I_USDT, I_FRAX, 50_000 * WAD],   // larger
            [I_FRAX, I_USDT, 50_000 * WAD]    // reverse
        ];

        for (uint256 i = 0; i < 12; i++) {
            uint256 amtIn  = swaps[i][2];
            uint256 amtOut = router.exactInput(OrbitalRouter.SwapParams({
                pool:         pool,
                assetIn:      swaps[i][0],
                assetOut:     swaps[i][1],
                amountIn:     amtIn,
                amountOutMin: 0,
                recipient:    me,
                deadline:     block.timestamp + 600
            }));
            console.log(
                string.concat(
                    "  swap[", vm.toString(i), "] ",
                    vm.toString(amtIn / WAD), " -> ",
                    vm.toString(amtOut / WAD)
                )
            );
        }
        console.log("All 12 swaps complete. Fees accrued in pool.");
    }

    // ─── Phase 4: Second LP round ─────────────────────────────────────────────
    // Two additional positions added after swaps have occurred.
    // One tighter (captures more fees near peg), one wider (covers deeper depeg).

    function _phase4_secondLiquidity() internal {
        console.log("\n=== Phase 4: Second LP round ===");
        uint256[] memory amountsMin = new uint256[](4);

        // Extra tight — $0.998, $2M
        uint256 idE = _mint(2_000_000 * WAD, 1_000038406640490000, amountsMin);
        console.log("Tier E (depeg $0.998, r=$2M): tokenId =", idE);

        // Extra wide — $0.980, $500K (acts as a backstop)
        uint256 idF = _mint(500_000 * WAD, 1_002455484219430000, amountsMin);
        console.log("Tier F (depeg $0.980, r=$500K): tokenId =", idF);

        // Run swaps after the second LP round so all positions accrue fees.
        console.log("Running 6 more swaps after second LP round...");
        _doSwap(I_USDC, I_USDT, 10_000 * WAD);
        _doSwap(I_USDT, I_USDC, 10_000 * WAD);
        _doSwap(I_DAI,  I_FRAX, 10_000 * WAD);
        _doSwap(I_FRAX, I_DAI,  10_000 * WAD);
        _doSwap(I_USDC, I_DAI,  10_000 * WAD);
        _doSwap(I_DAI,  I_USDC, 10_000 * WAD);
    }

    // ─── Phase 5: LP lifecycle actions ───────────────────────────────────────
    // Demonstrates all PM operations on existing positions.

    function _phase5_lpActions() internal {
        console.log("\n=== Phase 5: LP Actions ===");
        uint256[] memory amountsMin = new uint256[](4);

        // ── 5a. Collect fees from Tier A (tokenId=1) ─────────────────────
        // (Only tiers active during swaps earn fees — use try/catch for safety)
        console.log("5a. Collect fees from tokenId=1...");
        try pm.collect(OrbitalPositionManager.CollectParams({ tokenId: 1, recipient: me }))
            returns (uint256[] memory collected) {
            console.log("  collected[0]:", collected[0] / 1e12, "micro");
            console.log("  collected[1]:", collected[1] / 1e12, "micro");
        } catch {
            console.log("  no fees accrued on tokenId=1");
        }

        // ── 5b. Collect fees from Tier B (tokenId=2) ─────────────────────
        console.log("5b. Collect fees from tokenId=2...");
        try pm.collect(OrbitalPositionManager.CollectParams({ tokenId: 2, recipient: me }))
            returns (uint256[] memory collected2) {
            console.log("  collected[0]:", collected2[0] / 1e12, "micro");
        } catch {
            console.log("  no fees accrued on tokenId=2");
        }

        // ── 5c. Increase liquidity on Tier C (tokenId=3) ──────────────────
        // The PM passes pos.kWad (absolute) with the delta rWad to pool.mint(),
        // which validates kWad ∈ [kMin(rWad,n), kMax(rWad,n)].
        // The stored kWad was computed as kNorm * originalRWad — so it is in range
        // only when the delta rWad equals the original rWad. We pass the full
        // current rWad of the position as the increase (doubling it) so the
        // stored kWad stays valid. Alternatively, use the correctly-scaled kWad
        // by calling mint() directly with the same kNorm applied to the delta.
        // Here we just pass the same rWad as originally minted (2M) so kWad is valid.
        console.log("5c. Increase liquidity on tokenId=3 (+$2M, matching original rWad)...");
        uint256[] memory amtsIncreased = pm.increaseLiquidity(
            OrbitalPositionManager.IncreaseLiquidityParams({
                tokenId:    3,
                rWad:       2_000_000 * WAD,
                amountsMin: amountsMin,
                deadline:   block.timestamp + 600
            })
        );
        console.log("  deposited[0]:", amtsIncreased[0] / WAD);

        // ── 5d. Decrease liquidity on Tier D (tokenId=4) ──────────────────
        // Remove $400K from the $0.990 wide tier
        console.log("5d. Decrease liquidity on tokenId=4 (-$400K)...");
        uint256[] memory amtsWithdrawn = pm.decreaseLiquidity(
            OrbitalPositionManager.DecreaseLiquidityParams({
                tokenId:    4,
                rWad:       400_000 * WAD,
                amountsMin: amountsMin,
                deadline:   block.timestamp + 600
            })
        );
        console.log("  withdrawn[0]:", amtsWithdrawn[0] / WAD);

        // Principal sits in PM _tokensHeld — collectable once fee accounting is settled.
        console.log("  $400K withdrawn from position (principal held in PM).");

        // ── 5e. Fully exit Tier F (tokenId=6): decrease to zero ─────────
        // (burn requires zero rWad AND zero _tokensHeld AND zero tokensOwed.
        //  Since feesAccrued may be insufficient after earlier collects, we
        //  decrease to zero and leave the position in drained state for now.)
        console.log("5e. Decrease tokenId=6 to zero (full exit, no burn)...");
        (,,, uint256 rWad6) = pm.positions(6);
        if (rWad6 > 0) {
            pm.decreaseLiquidity(
                OrbitalPositionManager.DecreaseLiquidityParams({
                    tokenId:    6,
                    rWad:       rWad6,
                    amountsMin: amountsMin,
                    deadline:   block.timestamp + 600
                })
            );
            console.log("  tokenId=6 fully decreased to rWad=0.");
        }

        // ── 5f. Collect fees from Tier E (tokenId=5) ─────────────────────
        console.log("5f. Collect fees from tokenId=5...");
        try pm.collect(OrbitalPositionManager.CollectParams({ tokenId: 5, recipient: me }))
            returns (uint256[] memory f5) {
            console.log("  fees collected[0]:", f5[0] / 1e12, "micro");
        } catch {
            console.log("  no fees accrued on tokenId=5");
        }

        console.log("All LP lifecycle actions complete.");
    }

    // ─── Phase 6: Write deployment JSON ──────────────────────────────────────

    function _phase6_writeJson() internal {
        console.log("\n=== Phase 6: Write deployment ===");

        string memory k = "orbital4pool";
        vm.serializeAddress(k, "factory",         address(factory));
        vm.serializeAddress(k, "router",          address(router));
        vm.serializeAddress(k, "positionManager", address(pm));
        vm.serializeAddress(k, "quoter",          address(quoter));
        vm.serializeAddress(k, "pool",            pool);
        vm.serializeAddress(k, "usdc",            address(usdc));
        vm.serializeAddress(k, "usdt",            address(usdt));
        vm.serializeAddress(k, "dai",             address(dai));
        string memory json = vm.serializeAddress(k, "frax", address(frax));
        vm.writeJson(json, "deployments/sepolia_4pool.json");

        console.log("Written to deployments/sepolia_4pool.json");
        console.log("\n>>> Update frontend/lib/contracts.ts with:");
        console.log("  FACTORY_ADDRESS  =", address(factory));
        console.log("  POOL_ADDRESS     =", pool);
        console.log("  ROUTER_ADDRESS   =", address(router));
        console.log("  PM_ADDRESS       =", address(pm));
        console.log("  QUOTER_ADDRESS   =", address(quoter));
        console.log("  TOKEN_ADDRESSES.USDC  =", address(usdc));
        console.log("  TOKEN_ADDRESSES.USDT  =", address(usdt));
        console.log("  TOKEN_ADDRESSES.DAI   =", address(dai));
        console.log("  TOKEN_ADDRESSES.FRAX  =", address(frax));
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    function _mint(
        uint256 rWad,
        uint256 kNormWad,
        uint256[] memory amountsMin
    ) internal returns (uint256 tokenId) {
        uint256 kWad = rWad * kNormWad / WAD;
        uint256[] memory amounts;
        (tokenId, amounts) = pm.mint(
            OrbitalPositionManager.MintParams({
                pool:       pool,
                kWad:       kWad,
                rWad:       rWad,
                amountsMin: amountsMin,
                recipient:  me,
                deadline:   block.timestamp + 600
            })
        );
        console.log(
            string.concat(
                "  minted tokenId=", vm.toString(tokenId),
                " rWad=", vm.toString(rWad / WAD),
                " amounts[0]=", vm.toString(amounts[0] / WAD)
            )
        );
    }

    function _doSwap(uint256 assetIn, uint256 assetOut, uint256 amtIn) internal {
        uint256 out = router.exactInput(OrbitalRouter.SwapParams({
            pool:         pool,
            assetIn:      assetIn,
            assetOut:     assetOut,
            amountIn:     amtIn,
            amountOutMin: 0,
            recipient:    me,
            deadline:     block.timestamp + 600
        }));
        console.log(
            string.concat(
                "  swap ", vm.toString(amtIn / WAD),
                " -> ", vm.toString(out / WAD)
            )
        );
    }

}
