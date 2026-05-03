// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {MockERC20}              from "../src/mocks/MockERC20.sol";
import {OrbitalPositionManager} from "../src/periphery/OrbitalPositionManager.sol";
import {IERC20Minimal}          from "../src/interfaces/IERC20Minimal.sol";

/// @notice Adds liquidity to the live pool at realistic depeg thresholds.
///         Does NOT redeploy any contracts — only mints new positions.
///
///         Tick layout (n=4, kSingleMax=1.1340):
///           Tier A  kNorm=1.000009  depeg=$0.999  r=$4M   — tightest, max efficiency
///           Tier B  kNorm=1.000085  depeg=$0.997  r=$3M
///           Tier C  kNorm=1.000235  depeg=$0.995  r=$2M
///           Tier D  kNorm=1.000985  depeg=$0.990  r=$1M   — wider safety net
///
///         forge script script/AddLiquidity.s.sol \
///           --rpc-url $SEPOLIA_RPC_URL --private-key $PRIVATE_KEY --broadcast
contract AddLiquidity is Script {
    uint256 constant WAD = 1e18;

    address constant POOL             = 0x9A034ef31254e3C74586b67017edCf9248acBB51;
    address constant POSITION_MANAGER = 0x0519BC11599aFc4571ee053b1609ada6dD81624f;
    address constant USDC             = 0x6874393CFe557b9288EF5B0A71a830cC8ce7f0fB;
    address constant USDT             = 0x4a6b63081a2c1933EBb662d5462EdB9158654B1E;
    address constant DAI              = 0x3aF83cd2fA7fC93C17bE0CfA6A1Faaf2c6c5B215;
    address constant FRAX             = 0xedc7917961Ce6d4c6922E903eA633fB8b4C9e5Cc;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address me = vm.addr(pk);
        vm.startBroadcast(pk);

        // Mint enough tokens to cover deposits
        MockERC20(USDC).mint(me, 10_000_000 * WAD);
        MockERC20(USDT).mint(me, 10_000_000 * WAD);
        MockERC20(DAI ).mint(me, 10_000_000 * WAD);
        MockERC20(FRAX).mint(me, 10_000_000 * WAD);

        IERC20Minimal(USDC).approve(POSITION_MANAGER, type(uint256).max);
        IERC20Minimal(USDT).approve(POSITION_MANAGER, type(uint256).max);
        IERC20Minimal(DAI ).approve(POSITION_MANAGER, type(uint256).max);
        IERC20Minimal(FRAX).approve(POSITION_MANAGER, type(uint256).max);

        OrbitalPositionManager pm = OrbitalPositionManager(POSITION_MANAGER);
        uint256[] memory amountsMin = new uint256[](4);

        // kNormWad = kNorm * 1e18  (must be < kSingleMax*1e18 = 1.1340e18)
        // Tier A: depeg $0.999 — very tight, highest capital efficiency (~133x)
        _mint(pm, amountsMin, me, 4_000_000 * WAD, 1_000009423917760000);
        // Tier B: depeg $0.997 — tight (~44x efficiency)
        _mint(pm, amountsMin, me, 3_000_000 * WAD, 1_000085601597900000);
        // Tier C: depeg $0.995 — moderate (~26x efficiency)
        _mint(pm, amountsMin, me, 2_000_000 * WAD, 1_000234961209800000);
        // Tier D: depeg $0.990 — wide safety net (~13x efficiency)
        _mint(pm, amountsMin, me, 1_000_000 * WAD, 1_000942191820800000);

        vm.stopBroadcast();

        console.log("Done. New zones:");
        console.log("  Tier A: $0.999 -> $1.00  r=4M");
        console.log("  Tier B: $0.997 -> $1.00  r=3M");
        console.log("  Tier C: $0.995 -> $1.00  r=2M");
        console.log("  Tier D: $0.990 -> $1.00  r=1M");
        console.log("  Total:  $10M");
    }

    function _mint(
        OrbitalPositionManager pm,
        uint256[] memory amountsMin,
        address me,
        uint256 rWad,
        uint256 kNormWad
    ) internal {
        uint256 kWad = rWad * kNormWad / WAD;
        (uint256 tokenId, uint256[] memory amounts) = pm.mint(
            OrbitalPositionManager.MintParams({
                pool:       POOL,
                kWad:       kWad,
                rWad:       rWad,
                amountsMin: amountsMin,
                recipient:  me,
                deadline:   block.timestamp + 600
            })
        );
        console.log("minted tokenId:", tokenId, " rWad:", rWad / WAD);
        console.log("  amounts[0]:", amounts[0] / WAD, " amounts[1]:", amounts[1] / WAD);
    }
}
