# Orbital AMM — Paper Math Reference

Source: https://www.paradigm.xyz/2025/06/orbital

---

## Core Sphere Invariant

```
||r⃗ − x⃗||² = Σ(r − xᵢ)² = r²
```

Equal-price point: `q = r(1 − 1/√n)`

---

## Polar Decomposition

```
x⃗ = α·v⃗ + w⃗       where v⃗ = (1/√n)(1,…,1), v⃗ ⊥ w⃗

α      = Σxᵢ / √n          (scalar projection onto equal-price direction)
αInt   = α − kBound         (interior component)
αNorm  = αInt / rInt        (normalised, WAD)
kNorm  = k / r              (per-tick normalised plane constant)
```

---

## Torus Invariant (§4.11–4.13)

```
LHS = (αInt − rInt·√n)² + (wNorm − sBound)²  =  rInt²

where:
  alphaTot  = sumX / √n
  alphaInt  = alphaTot − kBound
  wNormSq   = sumXSq − sumX² / (n·WAD)      (cancellation-safe)
  wNorm     = √wNormSq
```

---

## Tick States

- **Interior tick**: `αNorm < kNorm`  → contributes r to rInt
- **Boundary tick**: `αNorm ≥ kNorm`  → contributes k to kBound, s to sBound

Boundary radius: `s = √(r² − (k − r·√n)²)`

---

## Crossing Detection

A crossing occurs when a full trade would move `αNormNew` past a tick's `kNorm`:
- Interior tick crosses out when `αNormNew > tick.kNorm`  (price moves away from peg)
- Boundary tick crosses in when `αNormNew < tick.kNorm`   (price moves toward peg)

```
alphaNormNew = alphaIntNew / rInt
alphaIntNew  = (sumX + amountIn − amountOut) / √n − kBound
```

Pick the first tick crossed (smallest kNorm among interior candidates).

---

## Section 13 — Quadratic for Trade-to-Crossover

Goal: find `(partialIn, partialOut)` that moves `αNorm` exactly to `kNorm_crossing`.

### Step 1 — Target sumX at crossing

```
alphaInt_target  = kNorm_crossing * rInt            (WAD)
alphaTot_target  = alphaInt_target + kBound         (WAD)
targetSumX       = alphaTot_target * √n             (WAD)
D                = targetSumX − sumX_old            (signed WAD)
```

### Step 2 — Target wNorm from invariant at crossing

```
rIntSqrtN   = rInt * √n
t1_target   = alphaTot_target / √n * √n − kBound − rIntSqrtN
            = alphaInt_target − rIntSqrtN
C           = rInt² − t1_target²
wNorm_target = sBound + √C
```

### Step 3 — Target sumXSq

```
targetSumXSq = wNorm_target² + targetSumX² / n
```

### Step 4 — Quadratic in partialOut (p)

```
partialIn = D + p       (since partialIn − partialOut = D)

sumXSq_new = sumXSq_old + 2·xi·D + D² + 2·(xi + D − xj)·p + 2·p²

Set sumXSq_new = targetSumXSq:
  2·p² + b·p + c = 0

where:
  b = 2·(xi + D − xj)
  c = sumXSq_old + 2·xi·D + D² − targetSumXSq
```

### Step 5 — Solve

```
disc  = b² − 8·c
sq    = √disc
root1 = (−b − sq) / 4
root2 = (−b + sq) / 4

Pick smallest non-negative root with partialIn = D + p ≥ 0.
Newton-refine on f(p) = 2p² + b·p + c if disc < 0 (rounding).
```

---

## Tick Crossing — State Updates

### Interior → Boundary

```
state.rInt   -= tick.r
state.kBound += tick.k
state.sBound += computeS(tick.r, tick.k, n)
tick.isInterior = false
```

### Boundary → Interior

```
state.rInt   += tick.r
state.kBound -= tick.k
state.sBound -= computeS(tick.r, tick.k, n)
tick.isInterior = true
```

---

## Swap Flow (full)

```
1. Compute feeAmount = amountIn * fee / 1_000_000
2. amountInNet = amountIn − feeAmount
3. _accumulateFee(feeAmount)
4. Loop up to 10 times:
   a. solveSwap(state, amountInNet) → amountOut candidate
   b. alphaNormNew = (sumX + amountInNet − amountOut) / √n / rInt
   c. _detectCrossing(alphaNormNew) → (crossed, tickIdx)
   d. If not crossed: accept amountOut, break
   e. Else: _tradeToXover(tickIdx) → (partialIn, partialOut)
            _crossTick(tickIdx, state)
            amountInNet -= partialIn; accumulate partialOut
5. _updateReserves(assetIn, assetOut, amountInNet_used, totalAmountOut)
6. Transfer out, callback for in, verify balance
7. Write oracle observation
8. Assert invariant
```

---

## Newton Solver (swap, no crossing)

```
Solve for δ (amountOut) such that torus LHS = rInt²

Initial guess: δ₀ = amountIn * 0.999, capped at xj − 1

Newton step:
  f  = torusLHS(state after applying δ) − rInt²
  df = −2·t1/√n  +  t2·(−2·xj + 2·δ + 2·sumX_new/n) / wNorm
  δ  = δ − f/df
```

---

## Key Constants / WAD conventions

- WAD = 1e18
- All reserves, k, r, s, alpha values: WAD-scaled
- sumXSq: WAD-scaled (each term = mulDiv(xi, xi, WAD))
- fee: hundredths of a bip; feeAmount = amountIn * fee / 1_000_000
