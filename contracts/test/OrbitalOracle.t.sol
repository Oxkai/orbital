// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Test}          from "forge-std/Test.sol";
import {OrbitalOracle} from "../src/lib/OrbitalOracle.sol";

/// @notice Thin storage harness around the library so we can hold the
///         ring-buffer in real storage and exercise it through external calls.
contract OracleHarness {
    using OrbitalOracle for OrbitalOracle.Observation[65535];

    OrbitalOracle.Observation[65535] public observations;

    uint16 public index;
    uint16 public cardinality;
    uint16 public cardinalityNext;

    function initialize(uint32 time) external {
        (cardinality, cardinalityNext) = observations.initialize(time);
    }

    function write(
        uint32 blockTimestamp,
        uint256 sumX,
        uint256 sumXSq
    ) external {
        (index, cardinality) = observations.write(
            index, blockTimestamp, sumX, sumXSq, cardinality, cardinalityNext
        );
    }

    function grow(uint16 next) external {
        cardinalityNext = observations.grow(cardinalityNext, next);
    }

    function observe(
        uint32 time,
        uint32[] memory secondsAgos,
        uint256 sumX,
        uint256 sumXSq
    )
        external
        view
        returns (uint256[] memory cumX, uint256[] memory cumXSq)
    {
        return observations.observe(time, secondsAgos, sumX, sumXSq, index, cardinality);
    }

    function getObservation(uint16 i)
        external
        view
        returns (uint32 ts, uint256 cumX, uint256 cumXSq, bool init)
    {
        OrbitalOracle.Observation memory o = observations[i];
        return (o.blockTimestamp, o.cumulativeSumX, o.cumulativeSumXSq, o.initialized);
    }
}

contract OrbitalOracleTest is Test {
    OracleHarness h;

    function setUp() public {
        h = new OracleHarness();
    }

    // ── initialize ───────────────────────────────────────────────────────

    function test_initialize_writes_slot0() public {
        h.initialize(1000);
        (uint32 ts, uint256 cumX, uint256 cumXSq, bool init) = h.getObservation(0);
        assertEq(ts, 1000);
        assertEq(cumX, 0);
        assertEq(cumXSq, 0);
        assertTrue(init);
        assertEq(h.cardinality(), 1);
        assertEq(h.cardinalityNext(), 1);
        assertEq(h.index(), 0);
    }

    // ── write ────────────────────────────────────────────────────────────

    function test_write_advances_cumulative() public {
        h.initialize(1000);

        // After 60 seconds with sumX = 100, sumXSq = 10_000:
        // cumX should advance by 100 * 60 = 6000.
        h.write(1060, 100, 10_000);

        (uint32 ts, uint256 cumX, uint256 cumXSq,) = h.getObservation(0);
        assertEq(ts, 1060);
        assertEq(cumX, 6000);
        assertEq(cumXSq, 600_000);
    }

    function test_write_same_block_is_noop() public {
        h.initialize(1000);
        h.write(1000, 999, 999);

        (uint32 ts, uint256 cumX,,) = h.getObservation(0);
        assertEq(ts, 1000, "ts unchanged");
        assertEq(cumX, 0, "cumX unchanged");
        assertEq(h.index(), 0, "index unchanged");
    }

    function test_write_does_not_grow_until_index_wraps_to_boundary() public {
        h.initialize(1000);
        h.grow(3); // cardinalityNext = 3, cardinality still 1

        // First post-init write: index was 0, cardinality was 1, so it sits
        // exactly at the boundary (index == cardinality - 1) and grows now.
        h.write(1010, 1, 1);
        assertEq(h.cardinality(), 3);
        assertEq(h.index(), 1);
    }

    // ── observe: target == now ───────────────────────────────────────────

    function test_observe_now_extrapolates_from_latest() public {
        h.initialize(1000);
        h.write(1100, 50, 25); // 100s @ (50, 25) → (5000, 2500)

        uint32[] memory ago = new uint32[](1);
        ago[0] = 0;

        // Query at time = 1150 with current sumX = 50, sumXSq = 25.
        // Latest observation is at 1100; transform forward 50s → +2500, +1250.
        (uint256[] memory cumX, uint256[] memory cumXSq) = h.observe(1150, ago, 50, 25);
        assertEq(cumX[0], 7500);
        assertEq(cumXSq[0], 3750);
    }

    function test_observe_now_at_exact_latest_no_extrapolation() public {
        h.initialize(1000);
        h.write(1100, 50, 25);

        uint32[] memory ago = new uint32[](1);
        ago[0] = 0;
        (uint256[] memory cumX,) = h.observe(1100, ago, 999, 999);
        assertEq(cumX[0], 5000, "should match stored cumulative, not extrapolate");
    }

    // ── observe: exact historical hit ────────────────────────────────────

    function test_observe_exact_historical_observation() public {
        h.initialize(1000);
        h.grow(4);
        h.write(1100, 50, 25);  // cumX = 5000
        h.write(1200, 80, 40);  // cumX = 5000 + 80*100 = 13000

        uint32[] memory ago = new uint32[](1);
        ago[0] = 100; // target = 1200 - 100 = 1100, exact match
        (uint256[] memory cumX,) = h.observe(1200, ago, 80, 40);
        assertEq(cumX[0], 5000);
    }

    // ── observe: interpolation ───────────────────────────────────────────

    function test_observe_interpolates_between_observations() public {
        h.initialize(1000);
        h.grow(4);
        h.write(1100, 100, 50); // cumX = 10000
        h.write(1200, 200, 80); // cumX = 10000 + 200*100 = 30000

        // Target = 1150, halfway between 1100 and 1200.
        // Linear interp: 10000 + (30000 - 10000) * 50/100 = 20000.
        uint32[] memory ago = new uint32[](1);
        ago[0] = 50;
        (uint256[] memory cumX,) = h.observe(1200, ago, 200, 80);
        assertEq(cumX[0], 20000);
    }

    function test_observe_extrapolates_beyond_latest() public {
        h.initialize(1000);
        h.write(1100, 50, 25); // cumX = 5000

        // Query "now = 1300" with secondsAgo = 100 → target = 1200, which is
        // *after* the latest observation at 1100. Should extrapolate from 1100
        // forward by 100s @ sumX=50 → cumX = 5000 + 5000 = 10000.
        uint32[] memory ago = new uint32[](1);
        ago[0] = 100;
        (uint256[] memory cumX,) = h.observe(1300, ago, 50, 25);
        assertEq(cumX[0], 10000);
    }

    // ── observe: too old ─────────────────────────────────────────────────

    function test_observe_reverts_when_target_predates_oldest() public {
        h.initialize(1000);
        h.write(1100, 50, 25);

        uint32[] memory ago = new uint32[](1);
        ago[0] = 200; // target = 1100 - 200 = 900, before slot0 ts 1000

        vm.expectRevert("OrbitalOracle: OLD");
        h.observe(1100, ago, 50, 25);
    }

    function test_observe_reverts_before_init() public {
        uint32[] memory ago = new uint32[](1);
        ago[0] = 0;
        vm.expectRevert("OrbitalOracle: not initialized");
        h.observe(1000, ago, 0, 0);
    }

    // ── grow ─────────────────────────────────────────────────────────────

    function test_grow_increases_cardinalityNext() public {
        h.initialize(1000);
        h.grow(10);
        assertEq(h.cardinalityNext(), 10);
        assertEq(h.cardinality(), 1, "actual cardinality only grows on next write");
    }

    function test_grow_noop_when_next_le_current() public {
        h.initialize(1000);
        h.grow(5);
        h.grow(3);
        assertEq(h.cardinalityNext(), 5);
    }

    function test_grow_reverts_before_init() public {
        vm.expectRevert("OrbitalOracle: not initialized");
        h.grow(10);
    }

    // ── ring buffer wrap ─────────────────────────────────────────────────

    function test_ring_buffer_wraps_and_observe_walks_history() public {
        h.initialize(1000);
        h.grow(4);

        // Write 5 observations into a 4-slot buffer to force a wrap.
        h.write(1100, 10, 1); // cumX after = 1000
        h.write(1200, 20, 1); // cumX after = 1000 + 20*100 = 3000
        h.write(1300, 30, 1); // cumX after = 3000 + 30*100 = 6000
        h.write(1400, 40, 1); // cumX after = 6000 + 40*100 = 10000  ← overwrites slot0
        h.write(1500, 50, 1); // cumX after = 10000 + 50*100 = 15000

        assertEq(h.cardinality(), 4);
        // Oldest live observation is now at ts=1200 (slot0 evicted).

        // Sanity: exact-hit on 1300 (which is still in the ring).
        uint32[] memory ago = new uint32[](1);
        ago[0] = 200; // 1500 - 200 = 1300
        (uint256[] memory cumX,) = h.observe(1500, ago, 50, 1);
        assertEq(cumX[0], 6000);

        // Querying older than 1200 must revert.
        ago[0] = 400; // 1500 - 400 = 1100, evicted
        vm.expectRevert("OrbitalOracle: OLD");
        h.observe(1500, ago, 50, 1);
    }

    // ── multi-target observe ─────────────────────────────────────────────

    function test_observe_multiple_targets_in_one_call() public {
        h.initialize(1000);
        h.grow(4);
        h.write(1100, 100, 0); // cumX = 10000
        h.write(1200, 200, 0); // cumX = 30000

        uint32[] memory ago = new uint32[](3);
        ago[0] = 0;     // now (=1200) → 30000
        ago[1] = 50;    // 1150 → interp 20000
        ago[2] = 100;   // 1100 → exact 10000

        (uint256[] memory cumX,) = h.observe(1200, ago, 200, 0);
        assertEq(cumX[0], 30000);
        assertEq(cumX[1], 20000);
        assertEq(cumX[2], 10000);
    }
}
