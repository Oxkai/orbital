// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

/// @title OrbitalOracle
/// @notice Time-weighted oracle for the orbital AMM, mirroring Uniswap V3
///         `Oracle.sol`. Stores time-weighted accumulators for the pool's
///         `sumX` and `sumXSq` so consumers can derive TWAPs and TWAVs of
///         pool depth between any two timestamps.
///
/// @dev    Conventions:
///         - `blockTimestamp` is `uint32` (seconds), wrapping every ~136 years.
///           All comparisons go through `_lte` to handle the wrap.
///         - `cumulativeSumX` and `cumulativeSumXSq` are `uint256`. With
///           realistic pool sizes (sumX ≤ 1e27 WAD ≈ 2^90) and a max age of
///           136 years (≈ 2^32 s), the product fits well below 2^128. They
///           may wrap; consumers must compute *differences*, not absolute
///           values, just like Uniswap V3 tickCumulative.
///         - Ring-buffer storage is owned by the pool: `Observation[65535]`.
library OrbitalOracle {
    // ─────────────────────────────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────────────────────────────

    struct Observation {
        // Block timestamp at which this observation was written.
        uint32  blockTimestamp;
        // Time-weighted cumulative sumX up to `blockTimestamp`.
        uint256 cumulativeSumX;
        // Time-weighted cumulative sumXSq up to `blockTimestamp`.
        uint256 cumulativeSumXSq;
        // True once this slot has been written at least once.
        bool    initialized;
    }

    // ─────────────────────────────────────────────────────────────────────
    // Initialization
    // ─────────────────────────────────────────────────────────────────────

    /// @notice Seed slot 0 with the pool's first observation.
    /// @param self    Storage ring buffer.
    /// @param time    Current block timestamp.
    /// @return cardinality      Number of populated slots (1).
    /// @return cardinalityNext  Next-target cardinality (1).
    function initialize(
        Observation[65535] storage self,
        uint32 time
    ) internal returns (uint16 cardinality, uint16 cardinalityNext) {
        self[0] = Observation({
            blockTimestamp:    time,
            cumulativeSumX:    0,
            cumulativeSumXSq:  0,
            initialized:       true
        });
        return (1, 1);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Write
    // ─────────────────────────────────────────────────────────────────────

    /// @notice Write a new observation if `blockTimestamp` has advanced since
    ///         the most recent write. Same-block writes are no-ops because the
    ///         time delta would be zero.
    /// @param self                  Storage ring buffer.
    /// @param index                 Index of the most recent observation.
    /// @param blockTimestamp        Current block timestamp.
    /// @param sumX                  Current pool sumX.
    /// @param sumXSq                Current pool sumXSq.
    /// @param cardinality           Current populated cardinality.
    /// @param cardinalityNext       Target cardinality after this write.
    /// @return indexUpdated         New most-recent index.
    /// @return cardinalityUpdated   New populated cardinality.
    function write(
        Observation[65535] storage self,
        uint16 index,
        uint32 blockTimestamp,
        uint256 sumX,
        uint256 sumXSq,
        uint16 cardinality,
        uint16 cardinalityNext
    ) internal returns (uint16 indexUpdated, uint16 cardinalityUpdated) {
        Observation memory last = self[index];

        // Skip same-block writes — the time delta is zero so the cumulative
        // accumulators would not change. Caller may call us speculatively.
        if (last.blockTimestamp == blockTimestamp) {
            return (index, cardinality);
        }

        // If the buffer can grow this block, do so.
        if (cardinalityNext > cardinality && index == (cardinality - 1)) {
            cardinalityUpdated = cardinalityNext;
        } else {
            cardinalityUpdated = cardinality;
        }

        // Ring advance.
        indexUpdated = uint16((uint256(index) + 1) % cardinalityUpdated);
        self[indexUpdated] = transform(last, blockTimestamp, sumX, sumXSq);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Transform — extrapolate cumulative values from `last` to `blockTimestamp`
    // ─────────────────────────────────────────────────────────────────────

    /// @dev Returns a synthetic observation at `blockTimestamp`, computed by
    ///      extending `last` with constant (sumX, sumXSq) over the elapsed
    ///      seconds. Used both by `write` (to materialise) and by `observe`
    ///      (to interpolate after the most recent observation).
    function transform(
        Observation memory last,
        uint32 blockTimestamp,
        uint256 sumX,
        uint256 sumXSq
    ) internal pure returns (Observation memory) {
        uint32 delta;
        unchecked {
            // Subtraction wraps cleanly under uint32 ring time, matching the
            // semantics of `_lte`. `blockTimestamp` is always "after" `last`
            // by construction at every call site.
            delta = blockTimestamp - last.blockTimestamp;
        }

        return Observation({
            blockTimestamp:   blockTimestamp,
            // Cumulatives are allowed to wrap — consumers always read deltas.
            cumulativeSumX:   last.cumulativeSumX   + sumX   * delta,
            cumulativeSumXSq: last.cumulativeSumXSq + sumXSq * delta,
            initialized:      true
        });
    }

    // ─────────────────────────────────────────────────────────────────────
    // Grow — expand the ring buffer's target cardinality
    // ─────────────────────────────────────────────────────────────────────

    /// @notice Pre-initialise observation slots so future writes are cheap.
    /// @dev    Only the *target* cardinality grows here. The actual populated
    ///         `cardinality` advances inside `write` once the index wraps past
    ///         the previous boundary.
    function grow(
        Observation[65535] storage self,
        uint16 current,
        uint16 next
    ) internal returns (uint16) {
        require(current > 0, "OrbitalOracle: not initialized");
        if (next <= current) return current;

        // Touch each new slot so the SSTORE cost is paid up front rather than
        // hitting the unlucky writer who first wraps into the new region.
        for (uint16 i = current; i < next; ++i) {
            self[i].blockTimestamp = 1;
        }
        return next;
    }

    // ─────────────────────────────────────────────────────────────────────
    // Observe — query historical TWAVs
    // ─────────────────────────────────────────────────────────────────────

    /// @notice Resolve cumulative (sumX, sumXSq) at one historical timestamp.
    function observeSingle(
        Observation[65535] storage self,
        uint32 time,
        uint32 secondsAgo,
        uint256 sumX,
        uint256 sumXSq,
        uint16 index,
        uint16 cardinality
    ) internal view returns (uint256 cumulativeSumX, uint256 cumulativeSumXSq) {
        if (secondsAgo == 0) {
            // "Right now" — extrapolate the most recent observation forward
            // to `time` if necessary.
            Observation memory last = self[index];
            if (last.blockTimestamp != time) {
                last = transform(last, time, sumX, sumXSq);
            }
            return (last.cumulativeSumX, last.cumulativeSumXSq);
        }

        uint32 target;
        unchecked { target = time - secondsAgo; }

        (Observation memory beforeOrAt, Observation memory atOrAfter) =
            _getSurroundingObservations(self, time, target, sumX, sumXSq, index, cardinality);

        if (target == beforeOrAt.blockTimestamp) {
            return (beforeOrAt.cumulativeSumX, beforeOrAt.cumulativeSumXSq);
        } else if (target == atOrAfter.blockTimestamp) {
            return (atOrAfter.cumulativeSumX, atOrAfter.cumulativeSumXSq);
        } else {
            // Linear interpolation between the two surrounding observations.
            uint32 observationTimeDelta;
            uint32 targetDelta;
            unchecked {
                observationTimeDelta = atOrAfter.blockTimestamp - beforeOrAt.blockTimestamp;
                targetDelta          = target - beforeOrAt.blockTimestamp;
            }

            uint256 dCumX   = atOrAfter.cumulativeSumX   - beforeOrAt.cumulativeSumX;
            uint256 dCumXSq = atOrAfter.cumulativeSumXSq - beforeOrAt.cumulativeSumXSq;

            cumulativeSumX   = beforeOrAt.cumulativeSumX   + (dCumX   * targetDelta) / observationTimeDelta;
            cumulativeSumXSq = beforeOrAt.cumulativeSumXSq + (dCumXSq * targetDelta) / observationTimeDelta;
        }
    }

    /// @notice Resolve cumulative arrays at multiple historical timestamps.
    function observe(
        Observation[65535] storage self,
        uint32 time,
        uint32[] memory secondsAgos,
        uint256 sumX,
        uint256 sumXSq,
        uint16 index,
        uint16 cardinality
    )
        internal
        view
        returns (
            uint256[] memory cumulativeSumXs,
            uint256[] memory cumulativeSumXSqs
        )
    {
        require(cardinality > 0, "OrbitalOracle: not initialized");

        cumulativeSumXs   = new uint256[](secondsAgos.length);
        cumulativeSumXSqs = new uint256[](secondsAgos.length);
        for (uint256 i; i < secondsAgos.length; ++i) {
            (cumulativeSumXs[i], cumulativeSumXSqs[i]) = observeSingle(
                self, time, secondsAgos[i], sumX, sumXSq, index, cardinality
            );
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Internals — binary search and ordering helpers
    // ─────────────────────────────────────────────────────────────────────

    /// @dev `a <= b` under uint32 ring time, with `time` as the reference for
    ///      "now". Direct comparison is wrong if either value sits on the far
    ///      side of an overflow boundary from `time`.
    function _lte(uint32 time, uint32 a, uint32 b) private pure returns (bool) {
        // Both before or both after the wrap point — direct compare is fine.
        if (a <= time && b <= time) return a <= b;

        // Lift values that are "ahead" of `time` (i.e. wrapped) into the
        // higher half of a uint256 number line so the compare stays monotonic.
        uint256 aAdjusted = a > time ? uint256(a) : uint256(a) + 2**32;
        uint256 bAdjusted = b > time ? uint256(b) : uint256(b) + 2**32;
        return aAdjusted <= bAdjusted;
    }

    /// @dev Locate the two observations that bracket `target`. Pre: the
    ///      ring buffer is initialised and `target` lies between the oldest
    ///      observation and `time`.
    function _binarySearch(
        Observation[65535] storage self,
        uint32 time,
        uint32 target,
        uint16 index,
        uint16 cardinality
    ) private view returns (Observation memory beforeOrAt, Observation memory atOrAfter) {
        uint256 l = (uint256(index) + 1) % cardinality;       // oldest slot
        uint256 r = l + cardinality - 1;                       // newest slot, lifted
        uint256 i;

        while (true) {
            i = (l + r) / 2;

            beforeOrAt = self[i % cardinality];

            // Skip uninitialised slots — only happens before the buffer has
            // wrapped through `cardinality` writes.
            if (!beforeOrAt.initialized) {
                l = i + 1;
                continue;
            }

            atOrAfter = self[(i + 1) % cardinality];

            bool targetAtOrAfter = _lte(time, beforeOrAt.blockTimestamp, target);

            if (targetAtOrAfter && _lte(time, target, atOrAfter.blockTimestamp)) break;

            if (!targetAtOrAfter) {
                r = i - 1;
            } else {
                l = i + 1;
            }
        }
    }

    /// @dev Returns the (beforeOrAt, atOrAfter) pair surrounding `target`,
    ///      handling the four edge cases:
    ///        1. target == latest      → (latest, latest)
    ///        2. target > latest       → (latest, transform(latest, target))
    ///        3. target < oldest       → revert ("OLD")
    ///        4. otherwise             → binary search
    function _getSurroundingObservations(
        Observation[65535] storage self,
        uint32 time,
        uint32 target,
        uint256 sumX,
        uint256 sumXSq,
        uint16 index,
        uint16 cardinality
    ) private view returns (Observation memory beforeOrAt, Observation memory atOrAfter) {
        // Optimistically check the most recent observation first.
        beforeOrAt = self[index];
        if (_lte(time, beforeOrAt.blockTimestamp, target)) {
            if (beforeOrAt.blockTimestamp == target) {
                // Exact hit on the latest observation.
                return (beforeOrAt, beforeOrAt);
            } else {
                // Target is in the future of the latest write — extrapolate.
                return (beforeOrAt, transform(beforeOrAt, target, sumX, sumXSq));
            }
        }

        // Target is older than the latest write — must search.
        beforeOrAt = self[(uint256(index) + 1) % cardinality];
        if (!beforeOrAt.initialized) beforeOrAt = self[0];

        require(_lte(time, beforeOrAt.blockTimestamp, target), "OrbitalOracle: OLD");
        return _binarySearch(self, time, target, index, cardinality);
    }
}
