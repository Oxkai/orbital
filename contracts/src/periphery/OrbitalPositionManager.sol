// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

import {IOrbitalMintCallback} from "../interfaces/IOrbitalMintCallback.sol";
import {IOrbitalPoolActions}  from "../interfaces/IOrbitalPoolActions.sol";
import {IOrbitalPool}         from "../interfaces/IOrbitalPool.sol";
import {IOrbitalFactory}      from "../interfaces/IOrbitalFactory.sol";
import {IERC20Minimal}        from "../interfaces/IERC20Minimal.sol";
import {PositionLib}          from "../lib/PositionLib.sol";

/// @title OrbitalPositionManager
/// @notice ERC721-wrapped LP position manager for orbital pools.
///         Each token ID represents one LP position (pool + tick + r).
///         Liquidity management (mint / increase / decrease / collect / burn)
///         routes through the pool's callback-based API.
contract OrbitalPositionManager is ERC721, IOrbitalMintCallback {

    address public immutable factory;

    // ─────────────────────────────────────────────────────────────────────
    // Position metadata stored per token
    // ─────────────────────────────────────────────────────────────────────

    struct PositionData {
        address pool;
        uint256 tickIndex;
        uint256 kWad;       // tick plane constant
        uint256 rWad;       // current radius (liquidity) contribution
    }

    // ─────────────────────────────────────────────────────────────────────
    // Params structs
    // ─────────────────────────────────────────────────────────────────────

    struct MintParams {
        address   pool;
        uint256   kWad;
        uint256   rWad;
        uint256[] amountsMin;
        address   recipient;
        uint256   deadline;
    }

    struct IncreaseLiquidityParams {
        uint256   tokenId;
        uint256   rWad;
        uint256[] amountsMin;
        uint256   deadline;
    }

    struct DecreaseLiquidityParams {
        uint256   tokenId;
        uint256   rWad;
        uint256[] amountsMin;
        uint256   deadline;
    }

    struct CollectParams {
        uint256 tokenId;
        address recipient;
    }

    // ─────────────────────────────────────────────────────────────────────
    // Storage
    // ─────────────────────────────────────────────────────────────────────

    uint256 private _nextTokenId = 1;

    /// @notice Position metadata per token ID.
    mapping(uint256 => PositionData) private _positions;

    /// @notice Tokens held in the contract after decreaseLiquidity, pending collect.
    ///         _tokensHeld[tokenId][assetIndex] = raw token amount.
    mapping(uint256 => mapping(uint256 => uint256)) private _tokensHeld;

    // ─────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────

    constructor(address _factory) ERC721("Orbital Position", "ORB-LP") {
        factory = _factory;
    }

    // ─────────────────────────────────────────────────────────────────────
    // Modifiers
    // ─────────────────────────────────────────────────────────────────────

    modifier checkDeadline(uint256 deadline) {
        require(block.timestamp <= deadline, "OPM: expired");
        _;
    }

    modifier onlyTokenOwner(uint256 tokenId) {
        require(ownerOf(tokenId) == msg.sender, "OPM: not owner");
        _;
    }

    // ─────────────────────────────────────────────────────────────────────
    // Liquidity management
    // ─────────────────────────────────────────────────────────────────────

    /// @notice Add liquidity to a pool tick and mint an NFT representing the position.
    /// @return tokenId  The newly minted token ID.
    /// @return amounts  Actual token amounts pulled from the caller.
    function mint(MintParams calldata params)
        external
        checkDeadline(params.deadline)
        returns (uint256 tokenId, uint256[] memory amounts)
    {
        tokenId = _nextTokenId++;

        amounts = IOrbitalPoolActions(params.pool).mint(
            address(this),
            params.kWad,
            params.rWad,
            abi.encode(msg.sender, params.pool)
        );

        uint256 n = IOrbitalPool(params.pool).n();
        for (uint256 i; i < n; ++i) {
            require(amounts[i] >= params.amountsMin[i], "OPM: amount below min");
        }

        // Determine the tick index the pool assigned for this (address(this), kWad) position.
        // The pool keys positions by positionKey(owner=address(this), tickIndex).
        // We must find the tick for kWad by searching the pool's ticks array.
        uint256 tickIndex = _findTickIndex(params.pool, params.kWad);

        _positions[tokenId] = PositionData({
            pool:      params.pool,
            tickIndex: tickIndex,
            kWad:      params.kWad,
            rWad:      params.rWad
        });

        _safeMint(params.recipient, tokenId);
    }

    /// @notice Add more liquidity to an existing position.
    /// @return amounts Actual token amounts pulled from the caller.
    function increaseLiquidity(IncreaseLiquidityParams calldata params)
        external
        onlyTokenOwner(params.tokenId)
        checkDeadline(params.deadline)
        returns (uint256[] memory amounts)
    {
        PositionData storage pos = _positions[params.tokenId];

        amounts = IOrbitalPoolActions(pos.pool).mint(
            address(this),
            pos.kWad,
            params.rWad,
            abi.encode(msg.sender, pos.pool)
        );

        uint256 n = IOrbitalPool(pos.pool).n();
        for (uint256 i; i < n; ++i) {
            require(amounts[i] >= params.amountsMin[i], "OPM: amount below min");
        }

        pos.rWad += params.rWad;
    }

    /// @notice Remove liquidity from a position. Tokens are held in the contract
    ///         until `collect` is called.
    /// @return amounts Token amounts credited (held until collect).
    function decreaseLiquidity(DecreaseLiquidityParams calldata params)
        external
        onlyTokenOwner(params.tokenId)
        checkDeadline(params.deadline)
        returns (uint256[] memory amounts)
    {
        PositionData storage pos = _positions[params.tokenId];

        amounts = IOrbitalPoolActions(pos.pool).burn(pos.tickIndex, params.rWad);

        uint256 n = IOrbitalPool(pos.pool).n();
        for (uint256 i; i < n; ++i) {
            require(amounts[i] >= params.amountsMin[i], "OPM: amount below min");
            _tokensHeld[params.tokenId][i] += amounts[i];
        }

        pos.rWad -= params.rWad;
    }

    /// @notice Collect accrued fees and any tokens held from decreaseLiquidity.
    /// @return total Token amounts sent to recipient, one per asset.
    function collect(CollectParams calldata params)
        external
        onlyTokenOwner(params.tokenId)
        returns (uint256[] memory total)
    {
        PositionData storage pos = _positions[params.tokenId];
        uint256 n = IOrbitalPool(pos.pool).n();

        // Collect fees from the pool (transfers to address(this)).
        uint256[] memory fees = IOrbitalPoolActions(pos.pool).collect(pos.tickIndex);

        total = new uint256[](n);
        for (uint256 i; i < n; ++i) {
            uint256 held = _tokensHeld[params.tokenId][i];
            total[i] = fees[i] + held;
            if (_tokensHeld[params.tokenId][i] > 0) {
                delete _tokensHeld[params.tokenId][i];
            }
            if (total[i] > 0) {
                address token = IOrbitalPool(pos.pool).tokens(i);
                _safeERC20Transfer(token, params.recipient, total[i]);
            }
        }
    }

    /// @notice Burn the NFT once the position is fully withdrawn and fees collected.
    function burn(uint256 tokenId) external onlyTokenOwner(tokenId) {
        PositionData storage pos = _positions[tokenId];
        require(pos.rWad == 0, "OPM: position not empty");

        uint256 n = IOrbitalPool(pos.pool).n();
        for (uint256 i; i < n; ++i) {
            require(_tokensHeld[tokenId][i] == 0, "OPM: tokens not collected");
        }

        // Check pool-level tokensOwed for any uncollected fee dust.
        bytes32 key = PositionLib.positionKey(address(this), pos.tickIndex);
        for (uint256 i; i < n; ++i) {
            require(
                IOrbitalPool(pos.pool).tokensOwed(key, i) == 0,
                "OPM: fees not collected"
            );
        }

        delete _positions[tokenId];
        _burn(tokenId);
    }

    // ─────────────────────────────────────────────────────────────────────
    // View
    // ─────────────────────────────────────────────────────────────────────

    /// @notice Return all position data for a token ID.
    function positions(uint256 tokenId)
        external
        view
        returns (
            address pool,
            uint256 tickIndex,
            uint256 kWad,
            uint256 rWad
        )
    {
        PositionData storage pos = _positions[tokenId];
        return (pos.pool, pos.tickIndex, pos.kWad, pos.rWad);
    }

    // ─────────────────────────────────────────────────────────────────────
    // ERC721
    // ─────────────────────────────────────────────────────────────────────

    /// @notice Returns an empty string. On-chain SVG via OrbitalDescriptor is optional.
    function tokenURI(uint256 /* tokenId */) public pure override returns (string memory) {
        return "";
    }

    // ─────────────────────────────────────────────────────────────────────
    // Mint callback
    // ─────────────────────────────────────────────────────────────────────

    /// @inheritdoc IOrbitalMintCallback
    function orbitalMintCallback(
        uint256[] calldata amounts,
        bytes calldata data
    ) external override {
        (address payer, address pool) = abi.decode(data, (address, address));
        _verifyPool(pool);
        require(msg.sender == pool, "OPM: callback from wrong pool");

        uint256 n = IOrbitalPool(pool).n();
        for (uint256 i; i < n; ++i) {
            if (amounts[i] == 0) continue;
            address token = IOrbitalPool(pool).tokens(i);
            _safeTransferFrom(token, payer, pool, amounts[i]);
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────────────

    /// @dev Scan the pool's ticks array for the tick whose k == kWad.
    ///      Pool ticks are created during mint; the tick for (address(this), kWad)
    ///      will exist by the time this is called.
    function _findTickIndex(address pool, uint256 kWad)
        private
        view
        returns (uint256)
    {
        uint256 len = IOrbitalPool(pool).numTicks();
        for (uint256 i; i < len; ++i) {
            if (IOrbitalPool(pool).ticks(i).k == kWad) {
                return i;
            }
        }
        revert("OPM: tick not found");
    }

    /// @dev Verify pool is registered with this factory.
    function _verifyPool(address pool) private view {
        uint256 numAssets = IOrbitalPool(pool).n();
        uint24  poolFee   = IOrbitalPool(pool).fee();
        address[] memory tokenArr = new address[](numAssets);
        for (uint256 i; i < numAssets; ++i) {
            tokenArr[i] = IOrbitalPool(pool).tokens(i);
        }
        bytes32 hash = keccak256(abi.encode(tokenArr, poolFee));
        require(IOrbitalFactory(factory).getPool(hash) == pool, "OPM: unknown pool");
    }

    /// @dev ERC20 transferFrom with return-value check.
    function _safeTransferFrom(
        address token,
        address from,
        address to,
        uint256 amount
    ) private {
        (bool success, bytes memory ret) = token.call(
            abi.encodeWithSelector(IERC20Minimal.transferFrom.selector, from, to, amount)
        );
        require(
            success && (ret.length == 0 || abi.decode(ret, (bool))),
            "OPM: TF"
        );
    }

    /// @dev ERC20 transfer with return-value check.
    function _safeERC20Transfer(address token, address to, uint256 amount) private {
        (bool success, bytes memory ret) = token.call(
            abi.encodeWithSelector(IERC20Minimal.transfer.selector, to, amount)
        );
        require(
            success && (ret.length == 0 || abi.decode(ret, (bool))),
            "OPM: T"
        );
    }
}
