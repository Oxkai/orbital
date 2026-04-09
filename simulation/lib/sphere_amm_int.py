"""
sphere_amm_int.py
-----------------
Single-sphere AMM in integer WAD math.
Mirrors sphere_amm.py exactly but uses no floats.

All values stored as WAD integers (real * 10^18).
"""

from math import isqrt
from .fixed_math import (
    WAD, wad_mul, wad_div, wad_sqrt, sqrt_wad2, sqrt_n_wad,
    to_wad, from_wad, sphere_invariant_wad2, check_sphere_invariant,
)


class SphereAMMInt:
    def __init__(self, n: int, r_wad: int):
        """
        n     : number of assets
        r_wad : radius in WAD (e.g. to_wad(341.42) for r=341.42)
        """
        self.n = n
        self.r_wad = r_wad
        self.reserves = list(self.equal_price_point())  # list of WAD ints

    # ------------------------------------------------------------------
    # Core
    # ------------------------------------------------------------------

    def equal_price_point(self) -> list[int]:
        """
        q = r * (1 - 1/sqrt(n))
        In WAD: q_wad = r_wad - r_wad * WAD // sqrt_n_wad
        """
        sqn = sqrt_n_wad(self.n)
        # q = r * (1 - 1/sqrt(n)) = r - r/sqrt(n)
        r_over_sqn = self.r_wad * WAD // sqn   # r/sqrt(n) in WAD
        q_wad = self.r_wad - r_over_sqn
        return [q_wad] * self.n

    def check_invariant(self, tol: int = 10 ** 9) -> bool:
        return check_sphere_invariant(self.reserves, self.r_wad, tol)

    def get_price_wad(self, i: int, j: int) -> int:
        """
        price(i,j) = (r - xj) / (r - xi)  in WAD
        """
        num = self.r_wad - self.reserves[j]
        den = self.r_wad - self.reserves[i]
        return num * WAD // den

    # ------------------------------------------------------------------
    # Swap (integer closed-form)
    # ------------------------------------------------------------------

    def swap(self, asset_in: int, asset_out: int, amount_in_wad: int) -> int:
        """
        Swap amount_in_wad of asset_in for asset_out.
        Returns amount_out_wad.

        Formula (same as float version, all in WAD²):
          C = (r - xi)² + (r - xj)² - (r - xi - d)²
          xj_new = r - isqrt(C)
          amount_out = xj - xj_new
        """
        if amount_in_wad <= 0:
            raise ValueError("amount_in must be positive")

        xi = self.reserves[asset_in]
        xj = self.reserves[asset_out]
        r  = self.r_wad

        # All terms in WAD²
        term_before = (r - xi) ** 2
        term_after  = (r - xi - amount_in_wad) ** 2
        term_out    = (r - xj) ** 2

        C = term_before + term_out - term_after   # WAD²

        if C <= 0:
            raise ValueError("Swap infeasible: C <= 0")

        xj_new = r - sqrt_wad2(C)                 # WAD
        amount_out = xj - xj_new

        if amount_out < 0:
            raise ValueError("Negative output")

        self.reserves[asset_in]  = xi + amount_in_wad
        self.reserves[asset_out] = xj_new

        return amount_out

    # ------------------------------------------------------------------
    # Polar decomposition
    # ------------------------------------------------------------------

    def alpha_wad(self) -> int:
        """alpha = sum(xi) / sqrt(n)  in WAD."""
        sum_x = sum(self.reserves)
        sqn   = sqrt_n_wad(self.n)
        return sum_x * WAD // sqn

    def w_norm_sq_wad2(self) -> int:
        """||w||² = sum(xi²) - (sum xi)²/n  in WAD²."""
        sum_x    = sum(self.reserves)
        sum_x_sq = sum(x ** 2 for x in self.reserves)
        return sum_x_sq - sum_x ** 2 // self.n

    def w_norm_wad(self) -> int:
        """||w|| in WAD."""
        return sqrt_wad2(max(self.w_norm_sq_wad2(), 0))
