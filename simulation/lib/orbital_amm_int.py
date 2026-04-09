"""
orbital_amm_int.py
------------------
Full multi-tick Orbital AMM in integer WAD math.
Mirrors orbital_amm.py exactly but uses no floats.
All values stored as WAD integers (real * 10^18).
"""

from typing import List, Tuple, Optional
from .tick_int import TickInt
from .fixed_math import WAD, sqrt_wad2, sqrt_n_wad, from_wad, torus_lhs_wad2


# ------------------------------------------------------------------
# Consolidation helpers (WAD)
# ------------------------------------------------------------------

def _r_int(ticks: List[TickInt]) -> int:
    return sum(t.r_wad for t in ticks if t.is_interior)


def _s_bound(ticks: List[TickInt]) -> int:
    return sum(t.boundary_radius_s_wad() for t in ticks if not t.is_interior)


def _k_bound(ticks: List[TickInt]) -> int:
    return sum(t.k_wad for t in ticks if not t.is_interior)


def _sum_x(reserves: List[int]) -> int:
    return sum(reserves)


def _sum_x_sq(reserves: List[int]) -> int:
    return sum(x * x for x in reserves)


# ------------------------------------------------------------------
# OrbitalAMMInt
# ------------------------------------------------------------------

class OrbitalAMMInt:
    def __init__(self, ticks: List[Tuple[int, int]], n: int):
        """
        Parameters
        ----------
        ticks : list of (k_wad, r_wad) tuples
        n     : number of assets
        """
        if n < 2:
            raise ValueError("Need at least 2 assets")

        self.n = n
        self.ticks: List[TickInt] = [TickInt(k, r, n) for k, r in ticks]
        self._update_consolidated_params()

        sqn = sqrt_n_wad(n)
        q = self.r_int_wad - self.r_int_wad * WAD // sqn   # r*(1 - 1/sqrt(n)) in WAD
        self.reserves: List[int] = [q] * n
        self.sum_x_wad: int = _sum_x(self.reserves)
        self.sum_x_sq_wad2: int = _sum_x_sq(self.reserves)

    # ------------------------------------------------------------------
    # Consolidated state
    # ------------------------------------------------------------------

    def _update_consolidated_params(self) -> None:
        self.r_int_wad = _r_int(self.ticks)
        self.s_bound_wad = _s_bound(self.ticks)
        self.k_bound_wad = _k_bound(self.ticks)

    def _alpha_int_wad(self, sum_x_wad: Optional[int] = None) -> int:
        sx = sum_x_wad if sum_x_wad is not None else self.sum_x_wad
        sqn = sqrt_n_wad(self.n)
        return sx * WAD // sqn - self.k_bound_wad

    def _alpha_int_norm_wad(self, sum_x_wad: Optional[int] = None) -> int:
        if self.r_int_wad == 0:
            return 10 ** 36
        return self._alpha_int_wad(sum_x_wad) * WAD // self.r_int_wad

    # ------------------------------------------------------------------
    # Newton's method: solve torus invariant for amount_out
    # ------------------------------------------------------------------

    def _solve_swap_newton_wad(
        self,
        asset_in: int,
        asset_out: int,
        amount_in_wad: int,
        sum_x_wad: int,
        sum_x_sq_wad2: int,
    ) -> int:
        """
        Find delta (amount_out in WAD) such that the torus invariant is
        preserved after adding amount_in to asset_in and removing delta
        from asset_out.

        All arithmetic is WAD integer:
          fval  = t1² + t2² - r_int²      (WAD²)
          dfval = d(fval)/d(delta)         (WAD)
          step  = fval // dfval            (WAD)
        """
        sqn = sqrt_n_wad(self.n)
        r_int = self.r_int_wad
        k_bound = self.k_bound_wad
        s_bound = self.s_bound_wad
        n = self.n

        x_i = self.reserves[asset_in]
        x_j = self.reserves[asset_out]

        # Pre-compute fixed terms after adding amount_in to asset_in
        A = sum_x_wad + amount_in_wad                          # new sum_x (WAD)
        B = sum_x_sq_wad2 + (x_i + amount_in_wad) ** 2 - x_i ** 2  # new sum_x_sq (WAD²)
        r_int_sqn = r_int * sqn // WAD                         # r_int·√n (WAD)

        delta = 0
        for _ in range(100):
            sum_x_new = A - delta
            sum_x_sq_new = B - 2 * x_j * delta + delta ** 2

            alpha = sum_x_new * WAD // sqn                     # WAD
            w_norm_sq = max(sum_x_sq_new - sum_x_new ** 2 // n, 0)  # WAD²
            w_norm = sqrt_wad2(w_norm_sq)                      # WAD

            t1 = alpha - k_bound - r_int_sqn                   # WAD
            t2 = w_norm - s_bound                              # WAD

            fval = t1 ** 2 + t2 ** 2 - r_int ** 2             # WAD²

            # --- derivative df/d(delta) in WAD ---
            # t1 contribution: 2·t1·d(alpha)/d(delta) = 2·t1·(-1/√n)
            #   = -2·t1·WAD // sqn    (WAD·WAD//WAD = WAD)
            term_d1 = -2 * t1 * WAD // sqn

            # t2 contribution: t2·d(w_norm_sq)/d(delta) / w_norm
            #   d(w_norm_sq)/d(delta) = -2·xj + 2·delta + 2·sum_x_new//n  (WAD)
            d_w_norm_sq = -2 * x_j + 2 * delta + 2 * sum_x_new // n
            if w_norm > 10 ** 9:
                term_d2 = t2 * d_w_norm_sq // w_norm           # WAD
            else:
                term_d2 = 0

            dfval = term_d1 + term_d2                          # WAD
            if dfval == 0:
                break

            step = fval // dfval                               # WAD
            delta -= step
            if delta < 0:
                delta = 0

            if abs(step) < 1_000:   # < 1e-15 real precision
                break

        return delta

    # ------------------------------------------------------------------
    # Tick crossing detection
    # ------------------------------------------------------------------

    def _crossing_tick(self, alpha_int_norm_new_wad: int) -> Optional[TickInt]:
        current = self._alpha_int_norm_wad()
        candidates = [
            t for t in self.ticks
            if t.is_interior and current < t.k_norm_wad() <= alpha_int_norm_new_wad
        ]
        if not candidates:
            return None
        return min(candidates, key=lambda t: t.k_norm_wad())

    def _solve_amount_in_for_alpha_int_norm_wad(
        self, asset_in: int, asset_out: int, target_alpha_int_norm_wad: int
    ) -> Tuple[int, int]:
        """
        Find (partial_in, partial_out) that moves alpha_int_norm exactly to
        target_alpha_int_norm_wad.

        Closed-form quadratic (Section 13 of the paper):
        ------------------------------------------------
        At the crossing point, sum_x_new = target_sum_x is fixed, so:
          partial_in - partial_out = D  (where D = target_sum_x - sum_x_old)

        Let p = partial_out, partial_in = D + p. Expand sum_x_sq_new:
          sum_x_sq_new = sum_x_sq_old + 2·xi·D + D² + 2·(xi+D-xj)·p + 2·p²

        From the torus invariant, sum_x_sq_new must equal:
          target_sum_x_sq = w_norm_target² + target_sum_x²/n

        where w_norm_target = s_bound + sqrt(r_int² - term1_target²)
        and   term1_target  = alpha_target - k_bound - r_int·√n.

        Rearranging gives the quadratic:
          2·p² + b·p + c = 0
        with:
          b = 2·(xi + D - xj)
          c = sum_x_sq_old + 2·xi·D + D² - target_sum_x_sq

        Solved exactly via the quadratic formula; the physically meaningful
        root is the one with 0 ≤ partial_out < xj and partial_in ≥ 0.
        """
        sqn = sqrt_n_wad(self.n)

        # ── target sum_x at the crossing boundary ──────────────────────
        alpha_int_wad    = target_alpha_int_norm_wad * self.r_int_wad // WAD
        alpha_total_wad  = alpha_int_wad + self.k_bound_wad
        target_sum_x     = sqn * alpha_total_wad // WAD            # WAD

        D  = target_sum_x - self.sum_x_wad                         # WAD (signed)
        xi = self.reserves[asset_in]
        xj = self.reserves[asset_out]

        # ── target ||w|| from torus invariant at the crossing point ────
        r_int_sqn      = self.r_int_wad * sqn // WAD               # WAD
        alpha_target   = target_sum_x * WAD // sqn                 # WAD
        t1_target      = alpha_target - self.k_bound_wad - r_int_sqn  # WAD
        C              = self.r_int_wad ** 2 - t1_target ** 2      # WAD²
        if C < 0:
            C = 0
        w_norm_target  = self.s_bound_wad + sqrt_wad2(C)           # WAD

        # ── target sum_x_sq (||w||² + alpha²  ≡  sum(xi²)) ───────────
        target_sum_x_sq = w_norm_target ** 2 + target_sum_x ** 2 // self.n  # WAD²

        # ── quadratic coefficients ──────────────────────────────────────
        # 2·p² + b·p + c = 0
        b_coef = 2 * (xi + D - xj)                                 # WAD
        c_coef = (self.sum_x_sq_wad2
                  + 2 * xi * D
                  + D * D
                  - target_sum_x_sq)                                # WAD²

        disc = b_coef ** 2 - 8 * c_coef                            # WAD²

        # When disc < 0 (rounding: isqrt rounds down, making c_coef slightly
        # too large), the vertex of the parabola 2p²+bp+c is a good seed.
        if disc >= 0:
            sq    = sqrt_wad2(disc)                                 # WAD
            root1 = (-b_coef - sq) // 4
            root2 = (-b_coef + sq) // 4
            # Pick the smallest non-negative root with partial_in ≥ 0
            p_init = None
            for candidate in sorted([root1, root2]):
                if candidate >= 0 and D + candidate >= 0:
                    p_init = candidate
                    break
            if p_init is None:
                p_init = max(root1, root2, 0)
        else:
            # Vertex of parabola: p* = -b / 4  (closest real point to root)
            p_init = max(-b_coef // 4, 0)

        # Newton refinement on f(p) = 2p² + b·p + c  (WAD² / WAD = WAD)
        # Handles the isqrt rounding error that can make disc slightly negative.
        p = p_init
        for _ in range(30):
            fp  = 2 * p * p + b_coef * p + c_coef                  # WAD²
            dfp = 4 * p + b_coef                                    # WAD
            if dfp == 0:
                break
            step = fp // dfp                                        # WAD
            p -= step
            if p < 0:
                p = 0
            if abs(step) < 1_000:                                   # < 1e-15 real
                break

        partial_out = max(p, 0)
        partial_in  = D + partial_out
        if partial_in < 0:
            partial_in  = 0
            partial_out = 0

        return partial_in, partial_out

    # ------------------------------------------------------------------
    # Public swap
    # ------------------------------------------------------------------

    def swap(
        self, asset_in: int, asset_out: int, amount_in_wad: int, _depth: int = 0
    ) -> int:
        """
        Swap amount_in_wad of asset_in for asset_out.
        Returns amount_out_wad.
        """
        if amount_in_wad <= 0:
            raise ValueError("amount_in must be positive")
        if _depth > 20:
            raise RuntimeError("Too many tick crossings in one swap")
        if self.r_int_wad == 0:
            raise RuntimeError("No interior liquidity available")

        amount_out = self._solve_swap_newton_wad(
            asset_in, asset_out, amount_in_wad, self.sum_x_wad, self.sum_x_sq_wad2
        )

        sum_x_new = self.sum_x_wad + amount_in_wad - amount_out
        alpha_int_norm_new = self._alpha_int_norm_wad(sum_x_new)

        crossing = self._crossing_tick(alpha_int_norm_new)

        if crossing is None:
            self._apply_swap(asset_in, asset_out, amount_in_wad, amount_out)
            return amount_out

        partial_in, partial_out = self._solve_amount_in_for_alpha_int_norm_wad(
            asset_in, asset_out, crossing.k_norm_wad()
        )

        self._apply_swap(asset_in, asset_out, partial_in, partial_out)

        crossing.is_interior = False
        x_int = list(self.reserves)
        for t in self.ticks:
            if not t.is_interior and t is not crossing and t.x_bound is not None:
                x_int = [x_int[i] - t.x_bound[i] for i in range(self.n)]
        r_int_old = self.r_int_wad
        crossing.x_bound = [crossing.r_wad * x // r_int_old for x in x_int]

        self._update_consolidated_params()

        remaining = amount_in_wad - partial_in
        if remaining < 1_000:
            return partial_out

        return partial_out + self.swap(asset_in, asset_out, remaining, _depth + 1)

    def _apply_swap(
        self, asset_in: int, asset_out: int, amount_in_wad: int, amount_out_wad: int
    ) -> None:
        self.reserves[asset_in] += amount_in_wad
        self.reserves[asset_out] -= amount_out_wad
        self.sum_x_wad += amount_in_wad - amount_out_wad
        self.sum_x_sq_wad2 = _sum_x_sq(self.reserves)

    # ------------------------------------------------------------------
    # Liquidity management
    # ------------------------------------------------------------------

    def add_tick(self, k_wad: int, r_wad: int) -> None:
        t = TickInt(k_wad, r_wad, self.n)
        self.ticks.append(t)
        self._update_consolidated_params()

    def remove_tick(self, k_wad: int) -> None:
        self.ticks = [t for t in self.ticks if abs(t.k_wad - k_wad) > 10 ** 12]
        self._update_consolidated_params()

    # ------------------------------------------------------------------
    # Queries
    # ------------------------------------------------------------------

    def get_spot_price_wad(self, i: int, j: int) -> int:
        num = self.r_int_wad - self.reserves[j]
        den = self.r_int_wad - self.reserves[i]
        return num * WAD // den

    def check_torus_invariant(self, tol_wad2: int = 10 ** 27) -> bool:
        lhs = torus_lhs_wad2(
            self.sum_x_wad, self.sum_x_sq_wad2,
            self.r_int_wad, self.k_bound_wad, self.s_bound_wad, self.n
        )
        return abs(lhs - self.r_int_wad ** 2) <= tol_wad2

    def __repr__(self) -> str:
        return (
            f"OrbitalAMMInt(n={self.n}, ticks={len(self.ticks)}, "
            f"r_int={from_wad(self.r_int_wad):.4f}, "
            f"reserves={[from_wad(x) for x in self.reserves]})"
        )
