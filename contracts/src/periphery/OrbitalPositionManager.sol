// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

import {IOrbitalMintCallback} from "../interfaces/IOrbitalMintCallback.sol";
import {IOrbitalPoolActions}  from "../interfaces/IOrbitalPoolActions.sol";
import {IOrbitalPool}         from "../interfaces/IOrbitalPool.sol";
import {IOrbitalFactory}      from "../interfaces/IOrbitalFactory.sol";
import {IERC20Minimal}        from "../interfaces/IERC20Minimal.sol";
import {PositionLib}          from "../lib/PositionLib.sol";

contract OrbitalPositionManager is ERC721, IOrbitalMintCallback {

    address public immutable factory;

    struct PositionData {
        address pool;
        uint256 tickIndex;
        uint256 kWad;
        uint256 rWad;
    }

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

    uint256 private _nextTokenId = 1;

    mapping(uint256 => PositionData) private _positions;

    /// @dev Tokens credited to a tokenId by decreaseLiquidity, pending collect.
    mapping(uint256 => mapping(uint256 => uint256)) private _tokensHeld;

    uint256 private _reentrancyStatus = 1;

    constructor(address _factory) ERC721("Orbital Position", "ORB-LP") {
        factory = _factory;
    }

    modifier checkDeadline(uint256 deadline) {
        require(block.timestamp <= deadline, "OPM: expired");
        _;
    }

    modifier onlyTokenOwner(uint256 tokenId) {
        require(ownerOf(tokenId) == msg.sender, "OPM: not owner");
        _;
    }

    modifier nonReentrant() {
        require(_reentrancyStatus == 1, "OPM: reentrant");
        _reentrancyStatus = 2;
        _;
        _reentrancyStatus = 1;
    }

    function mint(MintParams calldata params)
        external
        nonReentrant
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

        uint256 tickIndex = _findTickIndex(params.pool, params.kWad);

        _positions[tokenId] = PositionData({
            pool:      params.pool,
            tickIndex: tickIndex,
            kWad:      params.kWad,
            rWad:      params.rWad
        });

        _safeMint(params.recipient, tokenId);
    }

    function increaseLiquidity(IncreaseLiquidityParams calldata params)
        external
        nonReentrant
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

    function decreaseLiquidity(DecreaseLiquidityParams calldata params)
        external
        nonReentrant
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

    function collect(CollectParams calldata params)
        external
        nonReentrant
        onlyTokenOwner(params.tokenId)
        returns (uint256[] memory total)
    {
        PositionData storage pos = _positions[params.tokenId];
        uint256 n = IOrbitalPool(pos.pool).n();

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

    function burn(uint256 tokenId) external nonReentrant onlyTokenOwner(tokenId) {
        PositionData storage pos = _positions[tokenId];
        require(pos.rWad == 0, "OPM: position not empty");

        uint256 n = IOrbitalPool(pos.pool).n();
        for (uint256 i; i < n; ++i) {
            require(_tokensHeld[tokenId][i] == 0, "OPM: tokens not collected");
        }

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

    function tokenURI(uint256 /* tokenId */) public pure override returns (string memory) {
        return "";
    }

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
