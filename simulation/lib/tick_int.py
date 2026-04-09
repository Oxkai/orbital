"""
tick_int.py
-----------
Tick class in integer WAD math.
Mirrors tick.py exactly but uses no floats.
"""

from math import isqrt
from .fixed_math import WAD, sqrt_wad2, sqrt_n_wad, from_wad


class TickInt:
    def __init__(self, k_wad: int, r_wad: int, n: int):
        self.k_wad = k_wad
        self.r_wad = r_wad
        self.n = n
        self.is_interior = True
        self.x_bound: list[int] | None = None

    # ------------------------------------------------------------------
    # k bounds
    # ------------------------------------------------------------------

    def k_min_wad(self) -> int:
        """k_min = r * (sqrt(n) - 1)  in WAD."""
        sqn = sqrt_n_wad(self.n)
        return self.r_wad * (sqn - WAD) // WAD

    def k_max_wad(self) -> int:
        """k_max = r * (n-1) / sqrt(n)  in WAD."""
        sqn = sqrt_n_wad(self.n)
        return self.r_wad * (self.n - 1) * WAD // sqn

    def is_valid_k(self) -> bool:
        return self.k_min_wad() <= self.k_wad <= self.k_max_wad()

    # ------------------------------------------------------------------
    # Reserve bounds
    # ------------------------------------------------------------------

    def _discriminant_wad2(self) -> int:
        """
        D = k²n - n*((n-1)r - k*sqrt(n))²   in WAD²
        Clamped to 0.
        """
        k, r, n = self.k_wad, self.r_wad, self.n
        sqn = sqrt_n_wad(n)

        # k * sqrt(n) in WAD
        k_sqn = k * sqn // WAD

        # (n-1)*r in WAD
        nr_term = r * (n - 1)

        # inner = (n-1)*r - k*sqrt(n)  in WAD
        inner = nr_term - k_sqn

        # D = k²*n - n*inner²   in WAD²
        D = k ** 2 * n - n * inner ** 2

        return max(D, 0)

    def x_min_wad(self) -> int:
        """x_min = (k*sqrt(n) - sqrt(D)) / n  in WAD."""
        sqn = sqrt_n_wad(self.n)
        D   = self._discriminant_wad2()
        k_sqn = self.k_wad * sqn // WAD      # WAD
        return (k_sqn - sqrt_wad2(D)) // self.n

    def x_max_wad(self) -> int:
        """x_max = min(r, (k*sqrt(n) + sqrt(D)) / n)  in WAD."""
        sqn = sqrt_n_wad(self.n)
        D   = self._discriminant_wad2()
        k_sqn = self.k_wad * sqn // WAD
        return min(self.r_wad, (k_sqn + sqrt_wad2(D)) // self.n)

    # ------------------------------------------------------------------
    # Boundary radius s
    # ------------------------------------------------------------------

    def boundary_radius_s_wad(self) -> int:
        """
        s = sqrt(r² - (k - r*sqrt(n))²)  in WAD.
        """
        sqn = sqrt_n_wad(self.n)
        r_sqn = self.r_wad * sqn // WAD          # r*sqrt(n) in WAD
        inner = self.k_wad - r_sqn               # WAD
        val   = self.r_wad ** 2 - inner ** 2     # WAD²
        if val < 0:
            return 0
        return sqrt_wad2(val)

    # ------------------------------------------------------------------
    # Normalized k
    # ------------------------------------------------------------------

    def k_norm_wad(self) -> int:
        """k/r in WAD."""
        return self.k_wad * WAD // self.r_wad

    # ------------------------------------------------------------------
    # Capital efficiency
    # ------------------------------------------------------------------

    def x_base_wad(self) -> int:
        """x_base = r * (1 - 1/sqrt(n))  in WAD."""
        sqn = sqrt_n_wad(self.n)
        return self.r_wad - self.r_wad * WAD // sqn

    def capital_efficiency_wad(self) -> int:
        """efficiency = x_base / (x_base - x_min)  in WAD."""
        x_b = self.x_base_wad()
        x_m = self.x_min_wad()
        denom = x_b - x_m
        if denom <= 0:
            return 10 ** 36   # effectively infinite
        return x_b * WAD // denom

    @staticmethod
    def k_from_depeg_price_wad(p_wad: int, r_wad: int, n: int) -> int:
        """
        k = r*sqrt(n) - r*(p + n - 1) / sqrt(n*(p² + n - 1))
        All in WAD.
        """
        sqn = sqrt_n_wad(n)

        # r * sqrt(n)  in WAD
        r_sqn = r_wad * sqn // WAD

        # numerator: r * (p + n - 1)  in WAD
        num = r_wad * (p_wad + (n - 1) * WAD) // WAD

        # p² in WAD
        p_sq = p_wad * p_wad // WAD

        # inner = p² + n - 1  in WAD
        inner = p_sq + (n - 1) * WAD

        # denominator = sqrt(n * inner)  in WAD
        # sqrt(n * inner / WAD) * WAD = sqrt(n * inner * WAD)
        denom = isqrt(n * inner * WAD)

        return r_sqn - num * WAD // denom

    def capital_efficiency_from_depeg_wad(self, p_wad: int) -> int:
        k = TickInt.k_from_depeg_price_wad(p_wad, self.r_wad, self.n)
        t = TickInt(k, self.r_wad, self.n)
        x_b = self.x_base_wad()
        x_m = t.x_min_wad()
        denom = x_b - x_m
        if denom <= 0:
            return 10 ** 36
        return x_b * WAD // denom

    def __repr__(self) -> str:
        status = "interior" if self.is_interior else "boundary"
        return f"TickInt(k={from_wad(self.k_wad):.4f}, r={from_wad(self.r_wad):.4f}, n={self.n}, {status})"
