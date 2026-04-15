// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {OrbitalFactory}       from "../src/core/OrbitalFactory.sol";
import {OrbitalPool}          from "../src/core/OrbitalPool.sol";
import {OrbitalRouter}        from "../src/periphery/OrbitalRouter.sol";
import {OrbitalQuoter}        from "../src/periphery/OrbitalQuoter.sol";
import {MockERC20}            from "../src/mocks/MockERC20.sol";
import {TickLib}              from "../src/lib/TickLib.sol";
import {IERC20Minimal}        from "../src/interfaces/IERC20Minimal.sol";
import {IOrbitalMintCallback} from "../src/interfaces/IOrbitalMintCallback.sol";

/// @dev Trusted payer that mints LP positions directly against the pool.
///      The router is not involved in LP setup.
contract LPPayer is IOrbitalMintCallback {
    function seed(OrbitalPool pool, address recipient, uint256 kWad, uint256 rWad)
        external
        returns (uint256[] memory amounts)
    {
        return pool.mint(recipient, kWad, rWad, "");
    }

    function orbitalMintCallback(uint256[] calldata amounts, bytes calldata) external override {
        OrbitalPool pool = OrbitalPool(msg.sender);
        for (uint256 i; i < amounts.length; ++i) {
            IERC20Minimal(pool.tokens(i)).transfer(msg.sender, amounts[i]);
        }
    }
}

contract OrbitalRouterTest is Test {
    uint256 constant WAD = 1e18;
    uint24  constant FEE = 3000; // 0.30%

    OrbitalFactory factory;
    OrbitalPool    pool;
    OrbitalRouter  router;
    OrbitalQuoter  quoter;
    MockERC20[2]   toks;
    LPPayer        lp;

    address constant TRADER = address(0x7EA7);

    function setUp() public {
        factory = new OrbitalFactory();

        MockERC20 a = new MockERC20("A", "A", 18);
        MockERC20 b = new MockERC20("B", "B", 18);
        (MockERC20 t0, MockERC20 t1) = address(a) < address(b) ? (a, b) : (b, a);
        toks[0] = t0;
        toks[1] = t1;

        address[] memory addrs = new address[](2);
        addrs[0] = address(t0);
        addrs[1] = address(t1);
        pool = OrbitalPool(factory.createPool(addrs, FEE));

        router = new OrbitalRouter(address(factory));
        quoter = new OrbitalQuoter();

        // Seed liquidity: single LP, mid-range k, r = 100k WAD.
        lp = new LPPayer();
        toks[0].mint(address(lp), 10_000_000 * WAD);
        toks[1].mint(address(lp), 10_000_000 * WAD);

        uint256 r  = 100_000 * WAD;
        uint256 km = TickLib.kMin(r, 2);
        uint256 kM = TickLib.kMax(r, 2);
        uint256 k  = (km + kM) / 2; // mid-range
        lp.seed(pool, address(this), k, r);

        // Fund trader and approve the router to pull its tokens.
        toks[0].mint(TRADER, 1_000_000 * WAD);
        toks[1].mint(TRADER, 1_000_000 * WAD);
        vm.startPrank(TRADER);
        toks[0].approve(address(router), type(uint256).max);
        toks[1].approve(address(router), type(uint256).max);
        vm.stopPrank();
    }

    // ── pause ──────────────────────────────────────────────────────────

    function test_swap_reverts_when_paused() public {
        factory.setPaused(true);

        vm.prank(TRADER);
        // exactInput wraps the pool revert in its callback; the underlying
        // reason propagates as "OrbitalPool: paused".
        vm.expectRevert(bytes("OrbitalPool: paused"));
        router.exactInput(
            OrbitalRouter.SwapParams({
                pool:         address(pool),
                assetIn:      0,
                assetOut:     1,
                amountIn:     1_000 * WAD,
                amountOutMin: 0,
                recipient:    TRADER,
                deadline:     block.timestamp + 60
            })
        );
    }

    function test_swap_resumes_after_unpause() public {
        factory.setPaused(true);
        factory.setPaused(false);

        vm.prank(TRADER);
        uint256 out = router.exactInput(
            OrbitalRouter.SwapParams({
                pool:         address(pool),
                assetIn:      0,
                assetOut:     1,
                amountIn:     1_000 * WAD,
                amountOutMin: 0,
                recipient:    TRADER,
                deadline:     block.timestamp + 60
            })
        );
        assertGt(out, 0, "swap works after unpause");
    }

    // ── exactInput ─────────────────────────────────────────────────────

    function test_exactInput_basic() public {
        uint256 amountIn = 1_000 * WAD;
        uint256 balOutBefore = toks[1].balanceOf(TRADER);
        uint256 balInBefore  = toks[0].balanceOf(TRADER);

        vm.prank(TRADER);
        uint256 amountOut = router.exactInput(
            OrbitalRouter.SwapParams({
                pool:         address(pool),
                assetIn:      0,
                assetOut:     1,
                amountIn:     amountIn,
                amountOutMin: 0,
                recipient:    TRADER,
                deadline:     block.timestamp + 60
            })
        );

        assertGt(amountOut, 0, "got output");
        assertEq(toks[0].balanceOf(TRADER), balInBefore - amountIn, "input debited");
        assertEq(toks[1].balanceOf(TRADER), balOutBefore + amountOut, "output credited");
    }

    function test_exactInput_slippage_reverts() public {
        uint256 amountIn = 1_000 * WAD;

        // First quote to get the exact expected output, then demand more than that.
        uint256 quoted = quoter.quoteExactInput(address(pool), 0, 1, amountIn);

        vm.prank(TRADER);
        vm.expectRevert(bytes("OrbitalPool: slippage"));
        router.exactInput(
            OrbitalRouter.SwapParams({
                pool:         address(pool),
                assetIn:      0,
                assetOut:     1,
                amountIn:     amountIn,
                amountOutMin: quoted + 1,
                recipient:    TRADER,
                deadline:     block.timestamp + 60
            })
        );
    }

    function test_exactInput_deadline_expired_reverts() public {
        vm.warp(1_000);
        vm.prank(TRADER);
        vm.expectRevert(bytes("OrbitalRouter: expired"));
        router.exactInput(
            OrbitalRouter.SwapParams({
                pool:         address(pool),
                assetIn:      0,
                assetOut:     1,
                amountIn:     1_000 * WAD,
                amountOutMin: 0,
                recipient:    TRADER,
                deadline:     999 // in the past
            })
        );
    }

    // ── exactOutput ────────────────────────────────────────────────────

    function test_exactOutput_basic() public {
        uint256 desiredOut = 500 * WAD;
        uint256 maxIn      = 10_000 * WAD;

        uint256 balOutBefore = toks[1].balanceOf(TRADER);
        uint256 balInBefore  = toks[0].balanceOf(TRADER);

        vm.prank(TRADER);
        uint256 amountIn = router.exactOutput(
            OrbitalRouter.SwapParams({
                pool:         address(pool),
                assetIn:      0,
                assetOut:     1,
                amountIn:     maxIn,
                amountOutMin: desiredOut,
                recipient:    TRADER,
                deadline:     block.timestamp + 60
            })
        );

        assertLe(amountIn, maxIn, "spent within cap");
        assertEq(toks[0].balanceOf(TRADER), balInBefore - amountIn, "input debited");
        assertGe(toks[1].balanceOf(TRADER) - balOutBefore, desiredOut, "received >= desired");
    }

    function test_exactOutput_max_input_exceeded_reverts() public {
        // Ask for more output than `maxIn` could ever produce.
        uint256 desiredOut = 50_000 * WAD;
        uint256 maxIn      = 10 * WAD; // way too low

        vm.prank(TRADER);
        vm.expectRevert(bytes("OrbitalRouter: insufficient output"));
        router.exactOutput(
            OrbitalRouter.SwapParams({
                pool:         address(pool),
                assetIn:      0,
                assetOut:     1,
                amountIn:     maxIn,
                amountOutMin: desiredOut,
                recipient:    TRADER,
                deadline:     block.timestamp + 60
            })
        );
    }

    // ── Quote vs actual ────────────────────────────────────────────────

    function test_quote_matches_actual_output() public {
        uint256 amountIn = 2_500 * WAD;
        uint256 quoted = quoter.quoteExactInput(address(pool), 0, 1, amountIn);

        vm.prank(TRADER);
        uint256 actual = router.exactInput(
            OrbitalRouter.SwapParams({
                pool:         address(pool),
                assetIn:      0,
                assetOut:     1,
                amountIn:     amountIn,
                amountOutMin: 0,
                recipient:    TRADER,
                deadline:     block.timestamp + 60
            })
        );

        assertEq(quoted, actual, "quote equals live swap output");
    }

    // ── Multicall ──────────────────────────────────────────────────────

    function test_multicall_two_swaps() public {
        uint256 amt = 500 * WAD;

        bytes memory call0 = abi.encodeCall(
            router.exactInput,
            OrbitalRouter.SwapParams({
                pool:         address(pool),
                assetIn:      0,
                assetOut:     1,
                amountIn:     amt,
                amountOutMin: 0,
                recipient:    TRADER,
                deadline:     block.timestamp + 60
            })
        );
        bytes memory call1 = abi.encodeCall(
            router.exactInput,
            OrbitalRouter.SwapParams({
                pool:         address(pool),
                assetIn:      1,
                assetOut:     0,
                amountIn:     amt,
                amountOutMin: 0,
                recipient:    TRADER,
                deadline:     block.timestamp + 60
            })
        );

        bytes[] memory calls = new bytes[](2);
        calls[0] = call0;
        calls[1] = call1;

        uint256 in0Before = toks[0].balanceOf(TRADER);
        uint256 in1Before = toks[1].balanceOf(TRADER);

        vm.prank(TRADER);
        bytes[] memory results = router.multicall(calls);

        uint256 out1 = abi.decode(results[0], (uint256));
        uint256 out0 = abi.decode(results[1], (uint256));
        assertGt(out0, 0);
        assertGt(out1, 0);

        // Round-trip drains a bit of each asset to fees/slippage; balances should
        // move in the expected direction.
        assertLt(toks[0].balanceOf(TRADER), in0Before + out0 - amt + 1);
        assertLt(toks[1].balanceOf(TRADER), in1Before + out1 - amt + 1);
    }
}
