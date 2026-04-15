// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Test}            from "forge-std/Test.sol";
import {OrbitalFactory}  from "../src/core/OrbitalFactory.sol";
import {OrbitalPool}     from "../src/core/OrbitalPool.sol";
import {MockERC20}       from "../src/mocks/MockERC20.sol";

contract OrbitalFactoryTest is Test {
    OrbitalFactory factory;

    // Pool math is WAD-native — factory enforces 18-decimal tokens. Deploy
    // three mocks and sort their addresses ascending so tests can reason about
    // canonical ordering without recomputing.
    address TOK_A;
    address TOK_B;
    address TOK_C;

    function setUp() public {
        factory = new OrbitalFactory();

        address[3] memory raw = [
            address(new MockERC20("A", "A", 18)),
            address(new MockERC20("B", "B", 18)),
            address(new MockERC20("C", "C", 18))
        ];
        // Insertion sort ascending.
        for (uint256 i = 1; i < 3; ++i) {
            address x = raw[i];
            uint256 j = i;
            while (j > 0 && raw[j - 1] > x) {
                raw[j] = raw[j - 1];
                --j;
            }
            raw[j] = x;
        }
        TOK_A = raw[0];
        TOK_B = raw[1];
        TOK_C = raw[2];
    }

    // ── ownership ────────────────────────────────────────────────────────

    function test_owner_is_deployer() public view {
        assertEq(factory.owner(), address(this));
    }

    function test_default_fee_tiers_enabled() public view {
        assertTrue(factory.feeAmountEnabled(100));
        assertTrue(factory.feeAmountEnabled(500));
        assertTrue(factory.feeAmountEnabled(3000));
        assertTrue(factory.feeAmountEnabled(10000));
    }

    function test_two_step_owner_transfer() public {
        address newOwner = address(0xBEEF);
        factory.setOwner(newOwner);
        assertEq(factory.owner(), address(this), "owner unchanged before accept");

        vm.prank(newOwner);
        factory.acceptOwner();
        assertEq(factory.owner(), newOwner);
    }

    function test_acceptOwner_reverts_for_non_pending() public {
        factory.setOwner(address(0xBEEF));
        vm.expectRevert("OrbitalFactory: not pending owner");
        factory.acceptOwner();
    }

    // ── createPool ───────────────────────────────────────────────────────

    function test_createPool_deploys_and_registers() public {
        address[] memory toks = new address[](2);
        toks[0] = TOK_A;
        toks[1] = TOK_B;

        address pool = factory.createPool(toks, 3000);
        assertTrue(pool != address(0));
        assertEq(factory.allPoolsLength(), 1);

        OrbitalPool p = OrbitalPool(pool);
        assertEq(p.factory(), address(factory));
        assertEq(p.fee(), 3000);
        assertEq(p.n(), 2);
        assertEq(p.tokens(0), TOK_A);
        assertEq(p.tokens(1), TOK_B);

        // Slot0 should start unlocked, all numeric fields zero.
        (uint256 sumX, uint256 sumXSq, uint256 rInt, uint256 kBound, uint256 sBound, bool unlocked) =
            p.slot0();
        assertEq(sumX, 0);
        assertEq(sumXSq, 0);
        assertEq(rInt, 0);
        assertEq(kBound, 0);
        assertEq(sBound, 0);
        assertTrue(unlocked);
    }

    function test_createPool_canonicalizes_token_order() public {
        // Pass tokens in reverse order — factory should sort them, so the
        // resulting pool stores them ascending and (B,A) hits the same key
        // as (A,B).
        address[] memory toks = new address[](2);
        toks[0] = TOK_B;
        toks[1] = TOK_A;

        address pool = factory.createPool(toks, 500);
        OrbitalPool p = OrbitalPool(pool);
        assertEq(p.tokens(0), TOK_A, "tokens[0] should be smaller");
        assertEq(p.tokens(1), TOK_B, "tokens[1] should be larger");

        // Same set in original order should now revert as duplicate.
        address[] memory toks2 = new address[](2);
        toks2[0] = TOK_A;
        toks2[1] = TOK_B;
        vm.expectRevert("OrbitalFactory: pool exists");
        factory.createPool(toks2, 500);
    }

    function test_createPool_three_assets() public {
        address[] memory toks = new address[](3);
        toks[0] = TOK_C;
        toks[1] = TOK_A;
        toks[2] = TOK_B;

        address pool = factory.createPool(toks, 100);
        OrbitalPool p = OrbitalPool(pool);
        assertEq(p.n(), 3);
        assertEq(p.tokens(0), TOK_A);
        assertEq(p.tokens(1), TOK_B);
        assertEq(p.tokens(2), TOK_C);
    }

    function test_createPool_reverts_on_disabled_fee() public {
        address[] memory toks = new address[](2);
        toks[0] = TOK_A;
        toks[1] = TOK_B;
        vm.expectRevert("OrbitalFactory: fee not enabled");
        factory.createPool(toks, 7);
    }

    function test_createPool_reverts_on_too_few_tokens() public {
        address[] memory toks = new address[](1);
        toks[0] = TOK_A;
        vm.expectRevert("OrbitalFactory: need >= 2 tokens");
        factory.createPool(toks, 3000);
    }

    function test_createPool_reverts_on_zero_token() public {
        address[] memory toks = new address[](2);
        toks[0] = address(0);
        toks[1] = TOK_A;
        vm.expectRevert("OrbitalFactory: zero token");
        factory.createPool(toks, 3000);
    }

    function test_createPool_reverts_on_duplicate_token() public {
        address[] memory toks = new address[](2);
        toks[0] = TOK_A;
        toks[1] = TOK_A;
        vm.expectRevert("OrbitalFactory: duplicate token");
        factory.createPool(toks, 3000);
    }

    // ── enableFeeAmount ──────────────────────────────────────────────────

    function test_enableFeeAmount_owner_only() public {
        vm.prank(address(0xBEEF));
        vm.expectRevert("OrbitalFactory: not owner");
        factory.enableFeeAmount(250);
    }

    function test_enableFeeAmount_enables_and_can_be_used() public {
        factory.enableFeeAmount(250);
        assertTrue(factory.feeAmountEnabled(250));

        address[] memory toks = new address[](2);
        toks[0] = TOK_A;
        toks[1] = TOK_B;
        address pool = factory.createPool(toks, 250);
        assertTrue(pool != address(0));
    }

    // ── pause ────────────────────────────────────────────────────────────

    function test_setPaused_owner_only() public {
        vm.prank(address(0xBEEF));
        vm.expectRevert("OrbitalFactory: not owner");
        factory.setPaused(true);
    }

    function test_setPaused_toggles_flag() public {
        assertFalse(factory.paused(), "starts unpaused");
        factory.setPaused(true);
        assertTrue(factory.paused(), "paused after setPaused(true)");
        factory.setPaused(false);
        assertFalse(factory.paused(), "unpaused after setPaused(false)");
    }

    // ── parameters cleared after deploy ──────────────────────────────────

    function test_parameters_cleared_after_deploy() public {
        address[] memory toks = new address[](2);
        toks[0] = TOK_A;
        toks[1] = TOK_B;
        factory.createPool(toks, 3000);

        (address f, address[] memory ts, uint24 fe) = factory.getParameters();
        assertEq(f, address(0));
        assertEq(ts.length, 0);
        assertEq(fe, 0);
    }
}
