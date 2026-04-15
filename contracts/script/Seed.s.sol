// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";

import {MockERC20}              from "../src/mocks/MockERC20.sol";
import {OrbitalFactory}         from "../src/core/OrbitalFactory.sol";
import {OrbitalPositionManager} from "../src/periphery/OrbitalPositionManager.sol";
import {OrbitalRouter}          from "../src/periphery/OrbitalRouter.sol";
import {IOrbitalPool}           from "../src/interfaces/IOrbitalPool.sol";
import {IERC20Minimal}          from "../src/interfaces/IERC20Minimal.sol";
import {TorusMath}              from "../src/lib/TorusMath.sol";

/// @notice Reads deployments/local.json, mints tokens, adds 4 LPs at
///         increasing k_norm, runs 20 cross-pair swaps, asserts invariant.
contract Seed is Script {
    using stdJson for string;

    uint256 internal constant WAD       = 1e18;
    uint256 internal constant MINT_EACH = 1_000_000 * 1e18;

    struct Addrs {
        address factory;
        address pool;
        address router;
        address positionManager;
        address usdc;
        address usdt;
        address dai;
        address frax;
    }

    function run() external {
        // DEPLOYMENT_PATH env var overrides; defaults to local.json for anvil.
        string memory path = vm.envOr("DEPLOYMENT_PATH", string("deployments/local.json"));
        Addrs memory a = _loadAddrs(path);

        vm.startBroadcast();
        address signer = msg.sender;

        _mintAll(a, signer);
        _approveAll(a);

        _addLP(a, 400_000 * WAD, 1_050e15); // k_norm = 1.050
        _addLP(a, 350_000 * WAD, 1_150e15); // k_norm = 1.150
        _addLP(a, 200_000 * WAD, 1_275e15); // k_norm = 1.275
        _addLP(a,  50_000 * WAD, 1_375e15); // k_norm = 1.375

        _runSwaps(a);

        vm.stopBroadcast();
    }

    function _addLP(Addrs memory a, uint256 rWad, uint256 kNormWad) internal {
        uint256 kWad = rWad * kNormWad / WAD;

        OrbitalPositionManager pm = OrbitalPositionManager(a.positionManager);
        uint256[] memory amountsMin = new uint256[](4);

        (uint256 tokenId, uint256[] memory amounts) = pm.mint(
            OrbitalPositionManager.MintParams({
                pool:       a.pool,
                kWad:       kWad,
                rWad:       rWad,
                amountsMin: amountsMin,
                recipient:  msg.sender,
                deadline:   block.timestamp + 600
            })
        );

        console.log("LP minted tokenId:", tokenId);
        console.log("  rWad:", rWad);
        console.log("  kWad:", kWad);
        for (uint256 i; i < amounts.length; ++i) {
            console.log("  deposit amount[i]:", i, amounts[i]);
        }
    }

    function _runSwaps(Addrs memory a) internal {
        OrbitalRouter router = OrbitalRouter(a.router);

        uint256[2][20] memory pairs = [
            [uint256(0), 1], [uint256(1), 0],
            [uint256(0), 2], [uint256(2), 0],
            [uint256(0), 3], [uint256(3), 0],
            [uint256(1), 2], [uint256(2), 1],
            [uint256(1), 3], [uint256(3), 1],
            [uint256(2), 3], [uint256(3), 2],
            [uint256(0), 1], [uint256(1), 2],
            [uint256(2), 3], [uint256(3), 0],
            [uint256(0), 2], [uint256(1), 3],
            [uint256(2), 0], [uint256(3), 1]
        ];

        uint256 amountIn = 1_000 * WAD;

        for (uint256 s; s < 20; ++s) {
            uint256 aIn  = pairs[s][0];
            uint256 aOut = pairs[s][1];

            router.exactInput(
                OrbitalRouter.SwapParams({
                    pool:         a.pool,
                    assetIn:      aIn,
                    assetOut:     aOut,
                    amountIn:     amountIn,
                    amountOutMin: 0,
                    recipient:    msg.sender,
                    deadline:     block.timestamp + 600
                })
            );

            _logPoolState(a.pool, s, aIn, aOut);
            _assertInvariant(a.pool);
        }
    }

    function _logPoolState(address pool, uint256 step, uint256 aIn, uint256 aOut) internal view {
        uint256 n = IOrbitalPool(pool).n();
        console.log("--- swap step:", step);
        console.log("  in->out:", aIn, aOut);
        for (uint256 i; i < n; ++i) {
            console.log("  reserve[i]:", i, IOrbitalPool(pool).reserves(i));
        }
        console.log("  numTicks:", IOrbitalPool(pool).numTicks());
    }

    function _assertInvariant(address pool) internal view {
        (bool ok, ) = TorusMath.checkInvariant(_buildTorusState(pool));
        require(ok, "Seed: torus invariant broken");
    }

    function _buildTorusState(address pool) internal view returns (TorusMath.TorusState memory s) {
        (uint256 sumX, uint256 sumXSq, uint256 rInt, uint256 kBound, uint256 sBound, ) =
            IOrbitalPool(pool).slot0();
        s.n      = IOrbitalPool(pool).n();
        s.sumX   = sumX;
        s.sumXSq = sumXSq;
        s.rInt   = rInt;
        s.kBound = kBound;
        s.sBound = sBound;
    }

    function _mintAll(Addrs memory a, address to) internal {
        MockERC20(a.usdc).mint(to, MINT_EACH);
        MockERC20(a.usdt).mint(to, MINT_EACH);
        MockERC20(a.dai ).mint(to, MINT_EACH);
        MockERC20(a.frax).mint(to, MINT_EACH);
    }

    function _approveAll(Addrs memory a) internal {
        address[4] memory toks = [a.usdc, a.usdt, a.dai, a.frax];
        address[2] memory spenders = [a.positionManager, a.router];
        for (uint256 i; i < 4; ++i) {
            for (uint256 j; j < 2; ++j) {
                IERC20Minimal(toks[i]).approve(spenders[j], type(uint256).max);
            }
        }
    }

    function _loadAddrs(string memory path) internal view returns (Addrs memory a) {
        string memory json = vm.readFile(path);
        a.factory         = json.readAddress(".factory");
        a.pool            = json.readAddress(".pool");
        a.router          = json.readAddress(".router");
        a.positionManager = json.readAddress(".positionManager");
        a.usdc            = json.readAddress(".usdc");
        a.usdt            = json.readAddress(".usdt");
        a.dai             = json.readAddress(".dai");
        a.frax            = json.readAddress(".frax");
    }
}
