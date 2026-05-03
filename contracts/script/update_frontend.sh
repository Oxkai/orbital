#!/usr/bin/env bash
# update_frontend.sh
# Reads deployments/sepolia_4pool.json and patches frontend/lib/contracts.ts
# Run after: forge script script/FullDeploy4Pool.s.sol --broadcast
set -e

DEPLOY_JSON="$(dirname "$0")/../deployments/sepolia_4pool.json"
CONTRACTS_TS="$(dirname "$0")/../../frontend/lib/contracts.ts"

if [ ! -f "$DEPLOY_JSON" ]; then
  echo "ERROR: $DEPLOY_JSON not found. Run the deployment first."
  exit 1
fi

# Parse addresses (lowercase for consistency)
factory=$(jq -r '.factory'         "$DEPLOY_JSON" | tr '[:upper:]' '[:lower:]')
pool=$(jq    -r '.pool'            "$DEPLOY_JSON" | tr '[:upper:]' '[:lower:]')
router=$(jq  -r '.router'         "$DEPLOY_JSON" | tr '[:upper:]' '[:lower:]')
pm=$(jq      -r '.positionManager' "$DEPLOY_JSON" | tr '[:upper:]' '[:lower:]')
quoter=$(jq  -r '.quoter'         "$DEPLOY_JSON" | tr '[:upper:]' '[:lower:]')
usdc=$(jq    -r '.usdc'           "$DEPLOY_JSON" | tr '[:upper:]' '[:lower:]')
usdt=$(jq    -r '.usdt'           "$DEPLOY_JSON" | tr '[:upper:]' '[:lower:]')
dai=$(jq     -r '.dai'            "$DEPLOY_JSON" | tr '[:upper:]' '[:lower:]')
frax=$(jq    -r '.frax'           "$DEPLOY_JSON" | tr '[:upper:]' '[:lower:]')

echo "Updating frontend/lib/contracts.ts with new addresses..."
echo "  FACTORY_ADDRESS  = $factory"
echo "  POOL_ADDRESS     = $pool"
echo "  ROUTER_ADDRESS   = $router"
echo "  PM_ADDRESS       = $pm"
echo "  QUOTER_ADDRESS   = $quoter"
echo "  USDC             = $usdc"
echo "  USDT             = $usdt"
echo "  DAI              = $dai"
echo "  FRAX             = $frax"

# Patch each address line using sed (macOS-compatible with '')
sed -i '' "s|export const POOL_ADDRESS       = \"[^\"]*\"|export const POOL_ADDRESS       = \"$pool\"|g"    "$CONTRACTS_TS"
sed -i '' "s|export const ROUTER_ADDRESS     = \"[^\"]*\"|export const ROUTER_ADDRESS     = \"$router\"|g"  "$CONTRACTS_TS"
sed -i '' "s|export const PM_ADDRESS         = \"[^\"]*\"|export const PM_ADDRESS         = \"$pm\"|g"      "$CONTRACTS_TS"
sed -i '' "s|export const QUOTER_ADDRESS     = \"[^\"]*\"|export const QUOTER_ADDRESS     = \"$quoter\"|g"  "$CONTRACTS_TS"
sed -i '' "s|export const FACTORY_ADDRESS    = \"[^\"]*\"|export const FACTORY_ADDRESS    = \"$factory\"|g" "$CONTRACTS_TS"

# Patch token addresses (match by key name in the object)
sed -i '' "s|USDC:   \"[^\"]*\"|USDC:   \"$usdc\"|g"   "$CONTRACTS_TS"
sed -i '' "s|USDT:   \"[^\"]*\"|USDT:   \"$usdt\"|g"   "$CONTRACTS_TS"
sed -i '' "s|DAI:    \"[^\"]*\"|DAI:    \"$dai\"|g"     "$CONTRACTS_TS"
sed -i '' "s|FRAX:   \"[^\"]*\"|FRAX:   \"$frax\"|g"   "$CONTRACTS_TS"

# Patch TOKEN_META keys (lowercase address -> metadata)
# Remove old USDC/USDT/DAI/FRAX meta entries and insert fresh ones
python3 - <<PYEOF
import re, sys

with open("$CONTRACTS_TS", "r") as f:
    content = f.read()

# Replace each old token address key in TOKEN_META with new one
replacements = {
    "usdc": ("$usdc", "USDC", "USD Coin",   "#4A8FBF"),
    "usdt": ("$usdt", "USDT", "Tether USD", "#3A8F6E"),
    "dai":  ("$dai",  "DAI",  "Dai",        "#B07E2A"),
    "frax": ("$frax", "FRAX", "Frax",       "#555555"),
}

for key, (addr, sym, name, clr) in replacements.items():
    # Match any existing hex address (42 chars) line for this symbol
    pattern = rf'"0x[0-9a-f]{{40}}": \{{ symbol: "{sym}"[^}}]+\}}'
    replacement = f'"{addr}": {{ symbol: "{sym}", name: "{name}", color: "{clr}", decimals: 18 }}'
    content = re.sub(pattern, replacement, content)

with open("$CONTRACTS_TS", "w") as f:
    f.write(content)

print("TOKEN_META addresses patched.")
PYEOF

echo ""
echo "Done. frontend/lib/contracts.ts updated."
echo "Restart the Next.js dev server to pick up the new addresses."
