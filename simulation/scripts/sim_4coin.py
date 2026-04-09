"""
sim_4coin.py
------------
4-coin pool: USDC / USDT / DAI / FRAX
Full state logging at every event using integer WAD math.
All pool values are WAD integers (real * 10^18).
Display converts to float via from_wad() for readability.
"""

from decimal import Decimal, getcontext

getcontext().prec = 78

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lib.orbital_amm_int import OrbitalAMMInt, _sum_x, _sum_x_sq
from lib.tick_int import TickInt
from lib.fixed_math import WAD, to_wad, from_wad

COINS   = ["USDC", "USDT", "DAI", "FRAX"]
USDC, USDT, DAI, FRAX = 0, 1, 2, 3
FEE_BPS = 5      # 0.05%
n       = 4

WARN_THRESHOLD     = Decimal('5')    # %
EXTREME_THRESHOLD  = Decimal('20')   # %
DANGER_THRESHOLD   = Decimal('80')   # %

SEP  = "═" * 72
SEP2 = "─" * 72
SEP3 = "·" * 72

# ── For n=4: k_min_norm=1.0, k_max_norm=1.5 in real; same in WAD/WAD
t_ref         = TickInt(0, WAD, n)   # k=0, r=1.0 (WAD) reference tick
K_MIN_NORM_WAD = t_ref.k_min_wad()  # = WAD        (1.0 in real)
K_MAX_NORM_WAD = t_ref.k_max_wad()  # = 3*WAD//2   (1.5 in real)


def make_k_wad(r_wad: int, position_pct_wad: int) -> int:
    """k at position_pct% of the valid k-norm range [k_min, k_max]."""
    k_norm = K_MIN_NORM_WAD + position_pct_wad * (K_MAX_NORM_WAD - K_MIN_NORM_WAD) // WAD
    return k_norm * r_wad // WAD


# ── LP position registry ───────────────────────────────────────────
lp_registry = []
pool_state   = {"ticks": [], "pool": None}
swap_count   = [0]


def register_lp(name, r, k_norm):
    """
    r      : real radius (e.g. 400_000)
    k_norm : k/r ratio (e.g. 1.050 — must be in [k_min_norm, k_max_norm])
    """
    r_wad   = to_wad(r)
    k_wad   = to_wad(k_norm) * r_wad // WAD    # k = k_norm * r

    t         = TickInt(k_wad, r_wad, n)
    xmin_wad  = t.x_min_wad()
    xb_wad    = t.x_base_wad()                 # r*(1-1/sqrt(n)) = deposit/asset at parity
    real_wad  = xb_wad - xmin_wad

    pos = {
        "name":              name,
        "deposit_wad":       xb_wad,
        "real_deposit_wad":  real_wad,
        "virtual_wad":       xmin_wad,
        "r_wad":             r_wad,
        "k_wad":             k_wad,
        "k_norm_wad":        t.k_norm_wad(),
        "k_norm":            k_norm,
        "efficiency_wad":    t.capital_efficiency_wad(),
        "fees_earned_wad":   0,
        "added_at":          swap_count[0],
    }
    lp_registry.append(pos)
    pool_state["ticks"].append((k_wad, r_wad))
    return pos


def rebuild_pool():
    if not pool_state["ticks"]:
        return None
    p = OrbitalAMMInt(ticks=pool_state["ticks"], n=n)
    pool_state["pool"] = p
    return p


def add_lp_to_existing(pool, pos):
    r_int_old = pool.r_int_wad          # capture before tick is added
    pool.add_tick(pos["k_wad"], pos["r_wad"])
    r_int_new = pool.r_int_wad          # r_int after tick added

    # Scale every reserve by r_int_new / r_int_old.
    # This keeps alpha and w_norm proportional to r_int, preserving the
    # torus invariant:  (alpha - r_int*√n)² + w_norm² = r_int²
    # LP deposits the difference: x_i * (r_int_new - r_int_old) / r_int_old
    # i.e. at the current (possibly imbalanced) reserve ratios, not equal amounts.
    for i in range(n):
        pool.reserves[i] = pool.reserves[i] * r_int_new // r_int_old
    pool.sum_x_wad      = _sum_x(pool.reserves)
    pool.sum_x_sq_wad2  = _sum_x_sq(pool.reserves)


def distribute_fees(pool, amount_in_wad):
    fee_wad = amount_in_wad * FEE_BPS // 10000
    if pool.r_int_wad <= 0:
        return fee_wad
    for pos in lp_registry:
        for t in pool.ticks:
            if abs(t.k_wad - pos["k_wad"]) < 10 ** 12 and t.is_interior:
                pos["fees_earned_wad"] += fee_wad * pos["r_wad"] // pool.r_int_wad
    return fee_wad


def lp_withdrawal(pool, pos):
    for t in pool.ticks:
        if abs(t.k_wad - pos["k_wad"]) < 10 ** 12:
            if t.is_interior and pool.r_int_wad > 0:
                x_int = list(pool.reserves)
                for bt in pool.ticks:
                    if not bt.is_interior and bt.x_bound is not None:
                        x_int = [x_int[i] - bt.x_bound[i] for i in range(n)]
                raw    = [pos["r_wad"] * x // pool.r_int_wad for x in x_int]
                actual = [max(raw[i] - pos["virtual_wad"], 0) for i in range(n)]
                return actual, "interior"
            elif not t.is_interior and t.x_bound is not None:
                actual = [max(t.x_bound[i] - pos["virtual_wad"], 0) for i in range(n)]
                return actual, "boundary"
    return [0] * n, "unknown"


# ── Logging ────────────────────────────────────────────────────────

def hdr(title):
    print(f"\n{SEP}\n  {title}\n{SEP}")


def _pool_floats(pool):
    """Convert pool WAD state to floats for display."""
    res_f   = [from_wad(x) for x in pool.reserves]
    sum_x   = sum(res_f)
    sum_x_sq = sum(x ** 2 for x in res_f)
    sqrt_n  = Decimal(n).sqrt()
    alpha_t = sum_x / sqrt_n
    w_norm_sq = max(sum_x_sq - sum_x ** 2 / n, 0)
    w_norm  = w_norm_sq.sqrt()
    r_int_f = from_wad(pool.r_int_wad)
    k_bound_f = from_wad(pool.k_bound_wad)
    s_bound_f = from_wad(pool.s_bound_wad)
    return res_f, sum_x, sum_x_sq, alpha_t, w_norm, r_int_f, k_bound_f, s_bound_f


def log_state(pool, label=""):
    if label:
        print(f"\n  [{label}]")

    res_f, sum_x, sum_x_sq, alpha_t, w_norm, r_int_f, k_bound_f, s_bound_f = _pool_floats(pool)

    for i, c in enumerate(COINS):
        print(f"    {c:>6s}        = {res_f[i]:.8f}")

    print(f"    {'─'*48}")
    print(f"    sum_x          = {sum_x:.8f}")
    print(f"    sum_x_sq       = {sum_x_sq:.8f}")

    print(f"    alpha_total    = {alpha_t:.8f}   (sum_x / √n)")
    print(f"    ||w||          = {w_norm:.8f}   (perpendicular component)")

    print(f"    {'─'*48}")
    print(f"    r_int          = {r_int_f:.8f}")
    print(f"    k_bound        = {k_bound_f:.8f}   (Σ k_i of boundary ticks)")
    print(f"    s_bound        = {s_bound_f:.8f}   (Σ s_i of boundary ticks)")

    sqrt_n    = Decimal(n).sqrt()
    alpha_int = alpha_t - k_bound_f
    r_int_sqn = r_int_f * sqrt_n
    term1     = alpha_int - r_int_sqn
    term2     = w_norm - s_bound_f
    lhs       = term1 ** 2 + term2 ** 2
    rhs       = r_int_f ** 2

    print(f"    {'─'*48}")
    print(f"    Torus invariant breakdown:")
    print(f"      alpha_int    = alpha_total - k_bound = {alpha_int:.8f}")
    print(f"      r_int·√n     = {r_int_sqn:.8f}")
    print(f"      term1        = (alpha_int - r_int·√n) = {term1:.8f}")
    print(f"      term2        = (||w|| - s_bound)       = {term2:.8f}")
    print(f"      LHS          = term1² + term2²  = {lhs:.8f}")
    print(f"      RHS          = r_int²            = {rhs:.8f}")
    rel_drift = (lhs - rhs) / rhs if rhs != 0 else Decimal('Inf')
    print(f"      drift        = LHS - RHS         = {lhs-rhs:.8E}")
    print(f"      rel_drift    = drift / RHS        = {rel_drift:.8E}")
    print(f"      invariant OK = {abs(rel_drift) < Decimal('1e-9')}")

    alpha_norm = from_wad(pool._alpha_int_norm_wad())
    print(f"    {'─'*48}")
    print(f"    alpha_int_norm = {alpha_norm:.8f}   (alpha_int / r_int)")


def log_prices(pool):
    print(f"  Prices:")
    for i in range(n):
        for j in range(i + 1, n):
            if pool.r_int_wad > 0:
                p = from_wad(pool.get_spot_price_wad(i, j))
                print(f"    {COINS[i]:>4s}/{COINS[j]:<4s} = {p:.8f}")


def log_ticks(pool):
    print(f"  Ticks ({len(pool.ticks)} total):")
    alpha_norm = pool._alpha_int_norm_wad() if pool.r_int_wad > 0 else 0
    for idx, t in enumerate(sorted(pool.ticks, key=lambda x: x.k_norm_wad())):
        s   = "INTERIOR ✓" if t.is_interior else "BOUNDARY ✗"
        gap = from_wad(t.k_norm_wad() - alpha_norm) if pool.r_int_wad > 0 else Decimal(0)
        print(f"    [{idx+1}] k_norm={from_wad(t.k_norm_wad()):.8f}  r={from_wad(t.r_wad):.8f}  gap={gap:.8f}  {s}")


def log_lps(pool):
    print(f"  LP Positions:")
    print(f"    {'LP':>5s}  {'Deposit/asset':>13s}  {'Real dep':>10s}  {'Virtual':>10s}  {'Eff':>6s}  {'Fees':>10s}  {'Added':>6s}  {'Status'}")
    print(f"    {SEP3[:80]}")
    for pos in lp_registry:
        st = "interior"
        for t in pool.ticks:
            if abs(t.k_wad - pos["k_wad"]) < 10 ** 12:
                st = "interior" if t.is_interior else "BOUNDARY"
        print(
            f"    {pos['name']:>5s}  {from_wad(pos['deposit_wad']):.8f}"
            f"  {from_wad(pos['real_deposit_wad']):.8f}"
            f"  {from_wad(pos['virtual_wad']):.8f}"
            f"  {from_wad(pos['efficiency_wad']):.8f}x"
            f"  {from_wad(pos['fees_earned_wad']):.8f}"
            f"  swap#{pos['added_at']:>2d}  {st}"
        )


def log_withdrawals(pool):
    print(f"  If each LP exits NOW:")
    print(f"    {'LP':>5s}  {'USDC':>9s}  {'USDT':>9s}  {'DAI':>9s}  {'FRAX':>9s}  {'Fees':>9s}  {'Status'}")
    print(f"    {SEP3[:72]}")
    for pos in lp_registry:
        assets, status = lp_withdrawal(pool, pos)
        print(
            f"    {pos['name']:>5s}"
            f"  {from_wad(assets[0]):.8f}  {from_wad(assets[1]):.8f}"
            f"  {from_wad(assets[2]):.8f}  {from_wad(assets[3]):.8f}"
            f"  {from_wad(pos['fees_earned_wad']):.8f}  {status}"
        )


def log_swap_result(pool, num, ai, ao, amt_wad, out_wad, fee_wad, crossed):
    amt = from_wad(amt_wad)
    out = from_wad(out_wad)
    fee = from_wad(fee_wad)

    res_f, sum_x, sum_x_sq, alpha_t, w_norm, r_int_f, k_bound_f, s_bound_f = _pool_floats(pool)

    sqrt_n    = Decimal(n).sqrt()
    alpha_int = alpha_t - k_bound_f
    term1     = alpha_int - r_int_f * sqrt_n
    term2     = w_norm - s_bound_f
    lhs       = term1 ** 2 + term2 ** 2
    rhs       = r_int_f ** 2
    drift     = lhs - rhs

    eff_price    = amt / out if out > 0 else Decimal('Inf')
    fair_price   = Decimal(1)
    price_impact = (eff_price - fair_price) / fair_price * 100

    if price_impact > DANGER_THRESHOLD:
        slippage_warn = "  💀  DO NOT TRADE"
    elif price_impact > EXTREME_THRESHOLD:
        slippage_warn = "  🔴  EXTREME SLIPPAGE"
    elif price_impact > WARN_THRESHOLD:
        slippage_warn = "  ⚠️  HIGH SLIPPAGE"
    else:
        slippage_warn = ""

    cross_msg = f"  !! {crossed} TICK(S) CROSSED BOUNDARY" if crossed else ""
    print(
        f"\n  SWAP #{num:02d}: {amt:.8f} {COINS[ai]} → {out:.8f} {COINS[ao]}"
        f"  |  fee={fee:.8f}  |  eff_price={eff_price:.8f}"
        f"  |  impact={price_impact:+.2f}%{slippage_warn}{cross_msg}"
    )
    print(f"    Reserves   : ", end="")
    for i, c in enumerate(COINS):
        print(f"{c}={res_f[i]:.8f}", end="  ")
    print()
    print(f"    sum_x      = {sum_x:.8f}   sum_x_sq = {sum_x_sq:.8f}")
    print(f"    alpha_total= {alpha_t:.8f}   ||w|| = {w_norm:.8f}")
    print(f"    r_int      = {r_int_f:.8f}   k_bound = {k_bound_f:.8f}   s_bound = {s_bound_f:.8f}")
    print(f"    term1      = {term1:.8f}   term2 = {term2:.8f}")
    print(f"    LHS        = {lhs:.8f}   RHS(r_int²) = {rhs:.8f}   drift = {drift:.8E}")
    interior   = sum(1 for t in pool.ticks if t.is_interior)
    alpha_norm = from_wad(pool._alpha_int_norm_wad())
    rel_drift = drift / rhs if rhs != 0 else Decimal('Inf')
    print(f"    alpha_norm = {alpha_norm:.8f}   interior = {interior}/{len(pool.ticks)}   torus_ok = {abs(rel_drift)<Decimal('1e-9')}")


# ══════════════════════════════════════════════════════════════════
# SIMULATION
# ══════════════════════════════════════════════════════════════════

# ── LP schedule ───────────────────────────────────────────────────
# r_int = 400k + 350k + 200k + 50k = 1,000,000
lps_cfg = [
    {'name': 'LP1', 'r': 400_000, 'k_norm': 1.050},  # tight
    {'name': 'LP2', 'r': 350_000, 'k_norm': 1.150},  # medium
    {'name': 'LP3', 'r': 200_000, 'k_norm': 1.275},  # wide
    {'name': 'LP4', 'r':  50_000, 'k_norm': 1.375},  # backstop
]

# ── Swap schedules ────────────────────────────────────────────────
batch_1 = [   # normal trading
    (USDC, USDT,   500),   # 0.05%
    (USDC, DAI,    300),   # 0.03%
    (USDT, FRAX,   800),   # 0.08%
    (DAI,  USDC,   200),   # 0.02%
    (USDC, FRAX,  1000),   # 0.10%
    (FRAX, USDT,   600),   # 0.06%
    (USDC, USDT,  2000),   # 0.20%
    (USDC, DAI,   1500),   # 0.15%
    (USDT, FRAX,  1200),   # 0.12%
    (USDC, USDT,  5000),   # 0.50%
]

batch_2 = [   # stress — forces tick crossings
    (USDC, USDT,  8000),   # 0.80%
    (USDC, DAI,   7000),   # 0.70%
    (USDC, FRAX, 10000),   # 1.00%  ← expect 1 crossing here
    (USDC, USDT, 12000),   # 1.20%
    (USDC, FRAX, 15000),   # 1.50%  ← expect 1-2 crossings
    (DAI,  USDT,  3000),   # 0.30%  ← relief swap
    (USDC, USDT, 20000),   # 2.00%  ← expect pool nearly exhausted
]


hdr("STEP 0 — POOL CREATED")
print(f"  Coins : {COINS}  |  n={n}  |  fee={FEE_BPS}bps")
print(f"  n=4 geometry:  k_min_norm={from_wad(K_MIN_NORM_WAD):.4f}  k_max_norm={from_wad(K_MAX_NORM_WAD):.4f}")
print(f"  r_int target = 1,000,000  (LP1:400k + LP2:350k + LP3:200k + LP4:50k)")
print(f"  Empty. No ticks. No reserves.")


# ── LP1: tight ────────────────────────────────────────────────────
hdr("STEP 1 — LP1 ADDS LIQUIDITY  (tight, k_norm=1.050, r=400,000)")
p1 = register_lp("LP1", r=400_000, k_norm=1.050)
pool = rebuild_pool()
print(f"  Deposit/asset: {from_wad(p1['deposit_wad']):.8f}  r={from_wad(p1['r_wad']):.8f}  k_norm={p1['k_norm']}")
print(f"  Real deposit : {from_wad(p1['real_deposit_wad']):.8f}/asset  virtual={from_wad(p1['virtual_wad']):.8f}/asset  eff={from_wad(p1['efficiency_wad']):.8f}x")
log_state(pool, "After LP1")
log_prices(pool)
log_ticks(pool)
log_lps(pool)


# ── LP2: medium ───────────────────────────────────────────────────
hdr("STEP 2 — LP2 ADDS LIQUIDITY  (medium, k_norm=1.150, r=350,000)")
p2 = register_lp("LP2", r=350_000, k_norm=1.150)
pool = rebuild_pool()
print(f"  Deposit/asset: {from_wad(p2['deposit_wad']):.8f}  r={from_wad(p2['r_wad']):.8f}  k_norm={p2['k_norm']}")
print(f"  Real deposit : {from_wad(p2['real_deposit_wad']):.8f}/asset  eff={from_wad(p2['efficiency_wad']):.8f}x")
log_state(pool, "After LP2")
log_prices(pool)
log_ticks(pool)
log_lps(pool)


# ── LP3: wide ─────────────────────────────────────────────────────
hdr("STEP 3 — LP3 ADDS LIQUIDITY  (wide, k_norm=1.275, r=200,000)")
p3 = register_lp("LP3", r=200_000, k_norm=1.275)
pool = rebuild_pool()
print(f"  Deposit/asset: {from_wad(p3['deposit_wad']):.8f}  r={from_wad(p3['r_wad']):.8f}  k_norm={p3['k_norm']}")
print(f"  Real deposit : {from_wad(p3['real_deposit_wad']):.8f}/asset  eff={from_wad(p3['efficiency_wad']):.8f}x")
log_state(pool, "After LP3")
log_prices(pool)
log_ticks(pool)
log_lps(pool)
print()
log_withdrawals(pool)


# ── LP4: backstop ─────────────────────────────────────────────────
hdr("STEP 4 — LP4 ADDS LIQUIDITY  (backstop, k_norm=1.375, r=50,000)")
p4 = register_lp("LP4", r=50_000, k_norm=1.375)
pool = rebuild_pool()
print(f"  Deposit/asset: {from_wad(p4['deposit_wad']):.8f}  r={from_wad(p4['r_wad']):.8f}  k_norm={p4['k_norm']}")
print(f"  Real deposit : {from_wad(p4['real_deposit_wad']):.8f}/asset  eff={from_wad(p4['efficiency_wad']):.8f}x")
print(f"  r_int now    = {from_wad(pool.r_int_wad):.8f}  (target: 1,000,000)")
log_state(pool, "After LP4")
log_prices(pool)
log_ticks(pool)
log_lps(pool)
print()
log_withdrawals(pool)


# ── SWAP BATCH 1 — normal trading ────────────────────────────────
hdr("STEP 5 — SWAP BATCH 1  (normal trading)")
print(SEP3)

prev_int = sum(1 for t in pool.ticks if t.is_interior)
for ai, ao, amt in batch_1:
    try:
        amt_wad  = to_wad(amt)
        fee_wad  = distribute_fees(pool, amt_wad)
        out_wad  = pool.swap(ai, ao, amt_wad)
        swap_count[0] += 1
        curr_int = sum(1 for t in pool.ticks if t.is_interior)
        crossed  = prev_int - curr_int
        log_swap_result(pool, swap_count[0], ai, ao, amt_wad, out_wad, fee_wad, crossed)
        prev_int = curr_int
    except Exception as e:
        print(f"\n  SWAP FAILED: {COINS[ai]}→{COINS[ao]} {amt}  ({e})")

print(f"\n{SEP2}")
print("  After batch 1:")
log_state(pool)
log_ticks(pool)
log_lps(pool)
print()
log_withdrawals(pool)


# ── SWAP BATCH 2 — stress / tick crossings ────────────────────────
hdr("STEP 6 — SWAP BATCH 2  (stress — forces tick crossings)")
print(SEP3)

prev_int = sum(1 for t in pool.ticks if t.is_interior)
for ai, ao, amt in batch_2:
    try:
        amt_wad  = to_wad(amt)
        fee_wad  = distribute_fees(pool, amt_wad)
        out_wad  = pool.swap(ai, ao, amt_wad)
        swap_count[0] += 1
        curr_int = sum(1 for t in pool.ticks if t.is_interior)
        crossed  = prev_int - curr_int
        log_swap_result(pool, swap_count[0], ai, ao, amt_wad, out_wad, fee_wad, crossed)
        prev_int = curr_int
    except Exception as e:
        print(f"\n  SWAP FAILED: {COINS[ai]}→{COINS[ao]} {amt}  ({e})")
        break

print(f"\n{SEP2}")
print("  After batch 2:")
log_state(pool)
log_ticks(pool)
log_lps(pool)
print()
log_withdrawals(pool)


# ── FINAL ─────────────────────────────────────────────────────────
hdr("FINAL STATE")
log_state(pool)
log_prices(pool)
print()
log_ticks(pool)
print(f"\n{SEP2}")
log_lps(pool)
print(f"\n{SEP2}")
log_withdrawals(pool)

print(f"\n{SEP2}")
total_fees_wad = sum(p["fees_earned_wad"] for p in lp_registry)
print(f"  Fee summary:")
for pos in lp_registry:
    pct = pos["fees_earned_wad"] / total_fees_wad * 100 if total_fees_wad > 0 else 0
    print(f"    {pos['name']:>5s}: {from_wad(pos['fees_earned_wad']):.8f}  ({pct:.1f}%)")
print(f"    {'TOT':>5s}: {from_wad(total_fees_wad):.8f}")

print(f"\n{SEP}")
print(
    f"  Swaps: {swap_count[0]}  |  LPs: {len(lp_registry)}"
    f"  |  Interior: {sum(1 for t in pool.ticks if t.is_interior)}/{len(pool.ticks)}"
)
print(SEP)
