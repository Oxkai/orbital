"""
fixed_math.py
-------------
Integer fixed-point math (WAD = 1e18) mirroring what Solidity will do.

All values are stored as integers where:
  real_value = stored_integer / WAD

Operations:
  wad_mul(a, b)  = a * b / WAD     (multiply two WAD numbers → WAD)
  wad_div(a, b)  = a * WAD / b     (divide two WAD numbers → WAD)
  wad_sqrt(a)    = sqrt(a * WAD)   (sqrt of WAD number → WAD)
  sqrt_wad2(a)   = isqrt(a)        (sqrt of WAD² number → WAD)
"""

from math import isqrt
from decimal import Decimal, getcontext

getcontext().prec = 78

WAD = 10 ** 18


# ── Basic WAD ops ──────────────────────────────────────────────────

def wad_mul(a: int, b: int) -> int:
    """Multiply two WAD numbers. Result in WAD."""
    return a * b // WAD


def wad_div(a: int, b: int) -> int:
    """Divide two WAD numbers. Result in WAD."""
    return a * WAD // b


def wad_sqrt(a: int) -> int:
    """
    Square root of a WAD number. Result in WAD.
    sqrt(a_wad) where a is in WAD → result in WAD.
    isqrt(a * WAD) because sqrt(a/WAD) * WAD = sqrt(a * WAD).
    """
    return isqrt(a * WAD)


def sqrt_wad2(a: int) -> int:
    """
    Square root of a WAD² number. Result in WAD.
    Used when a = x² where x is in WAD → a is in WAD².
    isqrt(a) gives x in WAD directly.
    """
    return isqrt(a)


def to_wad(x) -> int:
    """Convert value to WAD integer (for testing/setup)."""
    return int(Decimal(str(x)) * WAD)


def from_wad(x: int) -> Decimal:
    """Convert WAD integer to Decimal (for display)."""
    return Decimal(x) / Decimal(WAD)


# ── sqrt(n) in WAD ─────────────────────────────────────────────────

def sqrt_n_wad(n: int) -> int:
    """
    Returns sqrt(n) in WAD.
    isqrt(n * WAD²) = sqrt(n) * WAD  (integer approximation)
    """
    return isqrt(n * WAD * WAD)


# ── Sphere invariant in WAD² ───────────────────────────────────────

def sphere_invariant_wad2(reserves_wad: list[int], r_wad: int) -> int:
    """
    Computes Σ(r - xi)²  in WAD² scale.
    Should equal r_wad² at a valid state.
    """
    return sum((r_wad - xi) ** 2 for xi in reserves_wad)


def check_sphere_invariant(reserves_wad: list[int], r_wad: int, tol: int = 10 ** 9) -> bool:
    """Check Σ(r-xi)² == r² within integer tolerance."""
    lhs = sphere_invariant_wad2(reserves_wad, r_wad)
    rhs = r_wad ** 2
    return abs(lhs - rhs) <= tol * WAD


# ── ||w||² (perpendicular component squared) ──────────────────────

def compute_w_norm_sq_wad2(sum_x_wad: int, sum_x_sq_wad2: int, n: int) -> int:
    """
    ||w||² = sum(xi²) - (sum xi)² / n
    In WAD²: w_norm_sq_wad2 = sum_x_sq_wad2 - sum_x_wad² // n
    """
    return sum_x_sq_wad2 - sum_x_wad ** 2 // n


# ── Torus invariant LHS in WAD² ────────────────────────────────────

def torus_lhs_wad2(
    sum_x_wad: int,
    sum_x_sq_wad2: int,
    r_int_wad: int,
    k_bound_wad: int,
    s_bound_wad: int,
    n: int,
) -> int:
    """
    Computes:
      (alpha - k_bound - r_int*sqrt(n))² + (||w|| - s_bound)²
    All in WAD² scale. Should equal r_int_wad² at valid state.
    """
    sqn = sqrt_n_wad(n)

    alpha_wad   = sum_x_wad * WAD // sqn
    r_int_sqn   = r_int_wad * sqn // WAD          # r_int * sqrt(n) in WAD

    term1_wad   = alpha_wad - k_bound_wad - r_int_sqn   # WAD
    term1_wad2  = term1_wad ** 2                          # WAD²

    w_norm_sq   = compute_w_norm_sq_wad2(sum_x_wad, sum_x_sq_wad2, n)
    w_norm_wad  = sqrt_wad2(max(w_norm_sq, 0))            # WAD

    term2_wad   = w_norm_wad - s_bound_wad                # WAD
    term2_wad2  = term2_wad ** 2                          # WAD²

    return term1_wad2 + term2_wad2


def check_torus_invariant(
    sum_x_wad: int,
    sum_x_sq_wad2: int,
    r_int_wad: int,
    k_bound_wad: int,
    s_bound_wad: int,
    n: int,
    tol_wad2: int = 10 ** 27,      # 1e-9 WAD² tolerance
) -> bool:
    lhs = torus_lhs_wad2(sum_x_wad, sum_x_sq_wad2, r_int_wad, k_bound_wad, s_bound_wad, n)
    rhs = r_int_wad ** 2
    return abs(lhs - rhs) <= tol_wad2
