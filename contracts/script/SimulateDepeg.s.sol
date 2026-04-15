// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";

import {OrbitalRouter}  from "../src/periphery/OrbitalRouter.sol";
import {IOrbitalPool}   from "../src/interfaces/IOrbitalPool.sol";
import {IERC20Minimal}  from "../src/interfaces/IERC20Minimal.sol";
import {TickLib}        from "../src/lib/TickLib.sol";
import {SphereMath}     from "../src/lib/SphereMath.sol";
import {MockERC20}      from "../src/mocks/MockERC20.sol";

/// @notice Drives the seeded pool toward USDC→USDT depeg via 50 escalating swaps.
///         Logs tick interior/boundary status, capital efficiency, and eff_price.
contract SimulateDepeg is Script {
    using stdJson for string;

    uint256 internal constant WAD = 1e18;

    address internal pool;
    address internal router;
    address internal usdc;
    address internal usdt;

    function run() external {
        _load("deployments/local.json");

        vm.startBroadcast();

        // Ensure the signer has USDC (top up for the escalating swap series).
        MockERC20(usdc).mint(msg.sender, 5_000_000 * WAD);
        IERC20Minimal(usdc).approve(router, type(uint256).max);

        uint256 n = IOrbitalPool(pool).n();
        (uint256 aIn, uint256 aOut) = _indicesOf(n);

        uint256[] memory interiorBefore = _snapInterior();

        // 50 escalating swaps: 500, 1000, 1500, ... (step 500 WAD).
        for (uint256 s; s < 50; ++s) {
            uint256 amtIn = (s + 1) * 500 * WAD;

            bool ok = _trySwap(aIn, aOut, amtIn);
            if (!ok) {
                console.log("SWAP FAILED at step:", s, "amountIn:", amtIn);
                console.log("All ticks at boundary - depeg frontier reached.");
                break;
            }

            _logStep(s, aIn, aOut, amtIn, interiorBefore);
        }

        vm.stopBroadcast();
    }

    function _trySwap(uint256 aIn, uint256 aOut, uint256 amtIn) internal returns (bool) {
        try OrbitalRouter(router).exactInput(
            OrbitalRouter.SwapParams({
                pool:         pool,
                assetIn:      aIn,
                assetOut:     aOut,
                amountIn:     amtIn,
                amountOutMin: 0,
                recipient:    msg.sender,
                deadline:     block.timestamp + 600
            })
        ) {
            return true;
        } catch {
            return false;
        }
    }

    function _logStep(
        uint256 step,
        uint256 aIn,
        uint256 aOut,
        uint256 amtIn,
        uint256[] memory interiorBefore
    ) internal view {
        console.log("=== step ===", step);
        console.log("amountIn:", amtIn);

        uint256 n = IOrbitalPool(pool).n();
        uint256 xi = IOrbitalPool(pool).reserves(aIn);
        uint256 xj = IOrbitalPool(pool).reserves(aOut);

        (, , uint256 rInt, , , ) = IOrbitalPool(pool).slot0();
        if (rInt > xi && rInt > xj) {
            console.log("eff_price (out/in):", SphereMath.spotPrice(rInt, xi, xj));
        }

        uint256 ticks = IOrbitalPool(pool).numTicks();
        for (uint256 i; i < ticks; ++i) {
            TickLib.Tick memory t = IOrbitalPool(pool).ticks(i);

            if (interiorBefore[i] == 1 && !t.isInterior) {
                console.log("TICK CROSSED -> boundary idx:", i);
            } else if (interiorBefore[i] == 0 && t.isInterior) {
                console.log("TICK CROSSED -> interior idx:", i);
            }

            uint256 ce = TickLib.capitalEfficiency(t.r, n, t.k);
            console.log("  tick idx:", i);
            console.log("    k:", t.k);
            console.log("    r:", t.r);
            console.log("    isInterior:", t.isInterior ? uint256(1) : uint256(0));
            console.log("    capitalEff (WAD):", ce);
        }
    }

    function _snapInterior() internal view returns (uint256[] memory out) {
        uint256 len = IOrbitalPool(pool).numTicks();
        out = new uint256[](len);
        for (uint256 i; i < len; ++i) {
            out[i] = IOrbitalPool(pool).ticks(i).isInterior ? 1 : 0;
        }
    }

    function _indicesOf(uint256 n) internal view returns (uint256 aIn, uint256 aOut) {
        // tokens are sorted ascending at pool creation; locate USDC / USDT indices.
        for (uint256 i; i < n; ++i) {
            address t = IOrbitalPool(pool).tokens(i);
            if (t == usdc) aIn  = i;
            if (t == usdt) aOut = i;
        }
    }

    function _load(string memory path) internal {
        string memory json = vm.readFile(path);
        pool   = json.readAddress(".pool");
        router = json.readAddress(".router");
        usdc   = json.readAddress(".usdc");
        usdt   = json.readAddress(".usdt");
    }
}
