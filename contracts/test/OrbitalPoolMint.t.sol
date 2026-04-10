// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Test}                 from "forge-std/Test.sol";
import {OrbitalFactory}       from "../src/core/OrbitalFactory.sol";
import {OrbitalPool}          from "../src/core/OrbitalPool.sol";
import {SphereMath}           from "../src/lib/SphereMath.sol";
import {TickLib}              from "../src/lib/TickLib.sol";
import {IERC20Minimal}        from "../src/interfaces/IERC20Minimal.sol";
import {IOrbitalMintCallback} from "../src/interfaces/IOrbitalMintCallback.sol";

// ─────────────────────────────────────────────────────────────────────────
// Test helpers — minimal ERC20 + a callback payer
// ─────────────────────────────────────────────────────────────────────────

contract MockERC20 is IERC20Minimal {
    string public name;
    string public symbol;
    uint8  public decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(string memory n_, string memory s_) {
        name = n_;
        symbol = s_;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 a = allowance[from][msg.sender];
        if (a != type(uint256).max) allowance[from][msg.sender] = a - amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}

/// @dev Trusted payer that holds funds and pays the pool when the mint
///      callback fires. Equivalent to a periphery contract — keeps the test
///      surface focused on the pool's mint accounting, not on token wiring.
contract MintPayer is IOrbitalMintCallback {
    function pay(
        OrbitalPool pool,
        address recipient,
        uint256 kWad,
        uint256 rWad
    ) external returns (uint256[] memory amounts) {
        return pool.mint(recipient, kWad, rWad, "");
    }

    function orbitalMintCallback(uint256[] calldata amounts, bytes calldata) external override {
        OrbitalPool pool = OrbitalPool(msg.sender);
        for (uint256 i; i < amounts.length; ++i) {
            address tok = pool.tokens(i);
            // Naïve transfer — this contract has been pre-funded by the test.
            IERC20Minimal(tok).transfer(msg.sender, amounts[i]);
        }
    }
}

/// @dev Callback that intentionally underpays asset 0 to exercise the M0 revert.
contract UnderpayingMintPayer is IOrbitalMintCallback {
    function pay(
        OrbitalPool pool,
        address recipient,
        uint256 kWad,
        uint256 rWad
    ) external returns (uint256[] memory amounts) {
        return pool.mint(recipient, kWad, rWad, "");
    }

    function orbitalMintCallback(uint256[] calldata amounts, bytes calldata) external override {
        OrbitalPool pool = OrbitalPool(msg.sender);
        for (uint256 i; i < amounts.length; ++i) {
            address tok = pool.tokens(i);
            uint256 send = i == 0 ? amounts[i] - 1 : amounts[i];
            IERC20Minimal(tok).transfer(msg.sender, send);
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────

contract OrbitalPoolMintTest is Test {
    uint256 constant WAD = 1e18;

    OrbitalFactory factory;
    OrbitalPool    pool;
    MockERC20[]    toks;
    MintPayer      payer;
    address constant ALICE = address(0xA11CE);
    address constant BOB   = address(0xB0B);

    /// @dev Build a 2-asset pool with two mock tokens, fund the payer with
    ///      a large balance of each.
    function setUp() public {
        factory = new OrbitalFactory();

        // Two mocks, but we need to provide them sorted to the factory so the
        // pool's `tokens(0)`, `tokens(1)` ordering is deterministic.
        MockERC20 a = new MockERC20("A", "A");
        MockERC20 b = new MockERC20("B", "B");
        (MockERC20 t0, MockERC20 t1) = address(a) < address(b) ? (a, b) : (b, a);

        toks.push(t0);
        toks.push(t1);

        address[] memory addrs = new address[](2);
        addrs[0] = address(t0);
        addrs[1] = address(t1);
        pool = OrbitalPool(factory.createPool(addrs, 3000));

        payer = new MintPayer();

        // Fund the payer generously so individual tests don't need to worry.
        toks[0].mint(address(payer), 1_000_000 * WAD);
        toks[1].mint(address(payer), 1_000_000 * WAD);
    }

    // ── Validation ────────────────────────────────────────────────────────

    function test_mint_reverts_on_zero_r() public {
        uint256 r = 0;
        // Even kMin would also revert downstream because of n=0 division;
        // we just want to confirm the rWad guard fires.
        vm.expectRevert("OrbitalPool: rWad=0");
        payer.pay(pool, ALICE, 1, r);
    }

    function test_mint_reverts_on_k_below_kMin() public {
        uint256 r = 100 * WAD;
        uint256 km = TickLib.kMin(r, 2);
        vm.expectRevert("OrbitalPool: k out of range");
        payer.pay(pool, ALICE, km - 1, r);
    }

    function test_mint_reverts_on_k_above_kMax() public {
        uint256 r = 100 * WAD;
        uint256 kM = TickLib.kMax(r, 2);
        vm.expectRevert("OrbitalPool: k out of range");
        payer.pay(pool, ALICE, kM + 1, r);
    }

    function test_mint_reverts_on_underpayment() public {
        uint256 r = 100 * WAD;
        uint256 k = TickLib.kMin(r, 2) + 1; // any valid k

        UnderpayingMintPayer bad = new UnderpayingMintPayer();
        toks[0].mint(address(bad), 1_000_000 * WAD);
        toks[1].mint(address(bad), 1_000_000 * WAD);

        vm.expectRevert("OrbitalPool: M0");
        bad.pay(pool, ALICE, k, r);
    }

    // ── First mint into empty pool ────────────────────────────────────────

    function test_first_mint_seeds_state() public {
        uint256 r = 100 * WAD;
        uint256 k = TickLib.kMin(r, 2) + WAD;

        uint256 expectedPerAsset = SphereMath.equalPricePoint(r, 2);
        uint256 b0Before = toks[0].balanceOf(address(pool));
        uint256 b1Before = toks[1].balanceOf(address(pool));

        uint256[] memory amounts = payer.pay(pool, ALICE, k, r);

        // Returned amounts match the equal-price formula.
        assertEq(amounts.length, 2);
        assertEq(amounts[0], expectedPerAsset);
        assertEq(amounts[1], expectedPerAsset);

        // ERC20 balances increased by the same amount.
        assertEq(toks[0].balanceOf(address(pool)) - b0Before, expectedPerAsset);
        assertEq(toks[1].balanceOf(address(pool)) - b1Before, expectedPerAsset);

        // slot0 reflects the new tick.
        (uint256 sumX, uint256 sumXSq, uint256 rInt, uint256 kBound, uint256 sBound, bool unlocked) =
            pool.slot0();
        assertEq(rInt, r);
        assertEq(kBound, 0);
        assertEq(sBound, 0);
        assertEq(sumX, 2 * expectedPerAsset);
        // sumXSq = 2 * (perAsset^2 / WAD)
        uint256 perSq = (expectedPerAsset * expectedPerAsset) / WAD;
        assertEq(sumXSq, 2 * perSq);
        assertTrue(unlocked, "lock released after mint");

        // reserves mapping populated.
        assertEq(pool.reserves(0), expectedPerAsset);
        assertEq(pool.reserves(1), expectedPerAsset);

        // One tick recorded.
        assertEq(pool.numTicks(), 1);
        (uint256 tk, uint256 tr, bool isInt, , uint128 lg) = pool.ticks(0);
        assertEq(tk, k);
        assertEq(tr, r);
        assertTrue(isInt, "first tick interior at equal price");
        assertEq(uint256(lg), r);

        // Position keyed by (ALICE, 0).
        bytes32 key = keccak256(abi.encodePacked(ALICE, uint256(0)));
        (uint256 ti, uint256 pr) = pool.positions(key);
        assertEq(ti, 0);
        assertEq(pr, r);
        // No fees outstanding right after a mint.
        assertEq(pool.tokensOwed(key, 0), 0);
        assertEq(pool.tokensOwed(key, 1), 0);
    }

    // ── Multi-LP mint ─────────────────────────────────────────────────────

    function test_two_LPs_same_k_merged_tick() public {
        uint256 r = 100 * WAD;
        uint256 k = TickLib.kMin(r, 2) + WAD;

        payer.pay(pool, ALICE, k, r);
        payer.pay(pool, BOB,   k, r);

        // Same-k ticks are merged.
        assertEq(pool.numTicks(), 1, "merged into one tick");

        (uint256 sumX, , uint256 rInt, , , ) = pool.slot0();
        assertEq(rInt, 2 * r);
        // Each LP added equalPricePoint(r, 2) per asset.
        uint256 perAsset = SphereMath.equalPricePoint(r, 2);
        assertEq(sumX, 2 * 2 * perAsset);

        // Two distinct positions exist, both at tick 0.
        bytes32 keyA = keccak256(abi.encodePacked(ALICE, uint256(0)));
        bytes32 keyB = keccak256(abi.encodePacked(BOB,   uint256(0)));
        (, uint256 prA) = pool.positions(keyA);
        (, uint256 prB) = pool.positions(keyB);
        assertEq(prA, r);
        assertEq(prB, r);
    }

    function test_two_LPs_different_k_both_succeed() public {
        uint256 r1 = 100 * WAD;
        uint256 r2 = 200 * WAD;
        uint256 k1 = TickLib.kMin(r1, 2) + WAD;
        uint256 k2 = TickLib.kMin(r2, 2) + 5 * WAD;

        payer.pay(pool, ALICE, k1, r1);
        payer.pay(pool, BOB,   k2, r2);

        (, , uint256 rInt, , , ) = pool.slot0();
        assertEq(rInt, r1 + r2, "rInt is sum of all LP radii");

        // Both reserves still equal — equal-price preservation.
        assertEq(pool.reserves(0), pool.reserves(1));

        // The pool is at equal price for the new combined rInt.
        uint256 expectedTotal =
            SphereMath.equalPricePoint(r1, 2) + SphereMath.equalPricePoint(r2, 2);
        assertEq(pool.reserves(0), expectedTotal);
    }

    function test_three_LPs_invariant_holds() public {
        // Three LPs at three different (k, r). All should stack cleanly.
        uint256[3] memory rs = [uint256(50 * WAD), uint256(75 * WAD), uint256(125 * WAD)];
        for (uint256 i; i < 3; ++i) {
            uint256 ki = TickLib.kMin(rs[i], 2) + (i + 1) * WAD;
            payer.pay(pool, address(uint160(0xC0DE + i)), ki, rs[i]);
        }

        assertEq(pool.numTicks(), 3);
        (, , uint256 rInt, , , ) = pool.slot0();
        assertEq(rInt, 50 * WAD + 75 * WAD + 125 * WAD);

        // Reserves equal — invariant holds at equal price by construction.
        assertEq(pool.reserves(0), pool.reserves(1));
    }

    // ── Three-asset pool ──────────────────────────────────────────────────

    function test_three_asset_pool_first_mint() public {
        // Stand up a 3-asset pool to verify n=3 deposit math.
        MockERC20 c = new MockERC20("C", "C");
        toks.push(c);

        // Sort the three addresses.
        address[3] memory raw =
            [address(toks[0]), address(toks[1]), address(c)];
        // Insertion-sort 3 elements.
        for (uint256 i = 1; i < 3; ++i) {
            address v = raw[i];
            uint256 j = i;
            while (j > 0 && raw[j-1] > v) {
                raw[j] = raw[j-1];
                j--;
            }
            raw[j] = v;
        }
        address[] memory addrs = new address[](3);
        addrs[0] = raw[0];
        addrs[1] = raw[1];
        addrs[2] = raw[2];

        OrbitalPool pool3 = OrbitalPool(factory.createPool(addrs, 3000));

        // Fund payer with the third token, plus already-funded A & B.
        c.mint(address(payer), 1_000_000 * WAD);

        uint256 r = 90 * WAD;
        uint256 k = TickLib.kMin(r, 3) + WAD;

        uint256[] memory amounts = payer.pay(pool3, ALICE, k, r);

        uint256 expected = SphereMath.equalPricePoint(r, 3);
        assertEq(amounts.length, 3);
        assertEq(amounts[0], expected);
        assertEq(amounts[1], expected);
        assertEq(amounts[2], expected);
        assertEq(pool3.reserves(0), expected);
        assertEq(pool3.reserves(1), expected);
        assertEq(pool3.reserves(2), expected);

        (, , uint256 rInt, , , ) = pool3.slot0();
        assertEq(rInt, r);
    }
}
