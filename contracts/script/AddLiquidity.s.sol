// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {MockERC20}              from "../src/mocks/MockERC20.sol";
import {OrbitalPositionManager} from "../src/periphery/OrbitalPositionManager.sol";
import {IERC20Minimal}          from "../src/interfaces/IERC20Minimal.sol";

/// @notice Mints tokens and adds deep liquidity to the 0.05% pool.
///         forge script script/AddLiquidity.s.sol \
///           --rpc-url $SEPOLIA_RPC_URL --private-key 0x<KEY> --broadcast
contract AddLiquidity is Script {
    using stdJson for string;

    uint256 constant WAD = 1e18;

    address constant POOL             = 0x285398F9Ac1D317Bca922691316BDf5B1493dA71;
    address constant POSITION_MANAGER = 0x08AC49be269F1c6C2821D56c4C729C9843152EE3;
    address constant USDT             = 0x168DEB69184ea184AadB8a626DC4d3013dc08Fe8;
    address constant FRAX             = 0x39855B7DE333de50A7b2e97a3A3E2Ec1CF0411a9;
    address constant USDC             = 0x44406ad771b05827F5fd95b002189e51EEbEDC91;
    address constant DAI              = 0x60Cb112631Ce92f9fe164878d690FAc1FD1C295d;

    function run() external {
        vm.startBroadcast();

        address me = msg.sender;
        uint256 mintAmt = 10_000_000 * WAD; // 10M each

        // Mint tokens
        MockERC20(USDT).mint(me, mintAmt);
        MockERC20(FRAX).mint(me, mintAmt);
        MockERC20(USDC).mint(me, mintAmt);
        MockERC20(DAI ).mint(me, mintAmt);

        // Approve position manager
        IERC20Minimal(USDT).approve(POSITION_MANAGER, type(uint256).max);
        IERC20Minimal(FRAX).approve(POSITION_MANAGER, type(uint256).max);
        IERC20Minimal(USDC).approve(POSITION_MANAGER, type(uint256).max);
        IERC20Minimal(DAI ).approve(POSITION_MANAGER, type(uint256).max);

        OrbitalPositionManager pm = OrbitalPositionManager(POSITION_MANAGER);
        uint256[] memory amountsMin = new uint256[](4);

        // Add 4M * 4 = 16M total liquidity across tight tick range
        _mint(pm, amountsMin, me, 4_000_000 * WAD, 1_050e15);
        _mint(pm, amountsMin, me, 3_500_000 * WAD, 1_150e15);
        _mint(pm, amountsMin, me, 2_000_000 * WAD, 1_275e15);
        _mint(pm, amountsMin, me,   500_000 * WAD, 1_375e15);

        vm.stopBroadcast();

        console.log("Done - added ~10M liquidity per asset to pool");
        console.log("Pool:", POOL);
    }

    function _mint(OrbitalPositionManager pm, uint256[] memory amountsMin, address me, uint256 rWad, uint256 kNormWad) internal {
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
        console.log("LP tokenId:", tokenId);
        console.log("  rWad:", rWad / WAD);
        console.log("  deposit[0]:", amounts[0] / WAD);
    }
}
