// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

import {IOrbitalPool}   from "../interfaces/IOrbitalPool.sol";
import {PositionLib}    from "../lib/PositionLib.sol";

/// @title OrbitalDescriptor
/// @notice Generates on-chain JSON metadata for OrbitalPositionManager token URIs.
///         For the prototype this returns a minimal JSON stub; the SVG / rich
///         metadata path is left as an extension point.
contract OrbitalDescriptor {
    using Strings for uint256;
    using Strings for address;

    /// @notice Generate a data-URI tokenURI for a given position.
    /// @param pool     The pool the position belongs to.
    /// @param tokenId  The NFT token ID (used in the JSON name field).
    /// @param pos      The position struct from OrbitalPositionManager.
    /// @return uri     A data:application/json;base64,... URI.
    function tokenURI(
        address pool,
        uint256 tokenId,
        PositionLib.Position memory pos
    ) external view returns (string memory uri) {
        string memory name = string(abi.encodePacked(
            "Orbital LP #", tokenId.toString()
        ));

        string memory description = _buildDescription(pool);
        string memory attributes  = _buildAttributes(pool, pos);

        string memory json = string(abi.encodePacked(
            '{"name":"', name,
            '","description":"', description,
            '","attributes":', attributes,
            '}'
        ));

        uri = string(abi.encodePacked(
            "data:application/json;base64,",
            Base64.encode(bytes(json))
        ));
    }

    // Internal builders

    function _buildDescription(address pool) private view returns (string memory) {
        uint256 n = IOrbitalPool(pool).n();
        string memory assets = "";
        for (uint256 i; i < n; ++i) {
            if (i > 0) assets = string(abi.encodePacked(assets, "/"));
            assets = string(abi.encodePacked(
                assets,
                IOrbitalPool(pool).tokens(i).toHexString()
            ));
        }
        return string(abi.encodePacked("Orbital AMM LP position. Assets: ", assets));
    }

    function _buildAttributes(address pool, PositionLib.Position memory pos)
        private
        view
        returns (string memory)
    {
        // Determine boundary vs interior by checking the tick's k value against
        // pool slot0.kBound. A tick is a boundary tick when its k >= kBound.
        (,, uint256 rInt, uint256 kBound,,) = IOrbitalPool(pool).slot0();

        bool isBoundary = false;
        if (pos.tickIndex < IOrbitalPool(pool).numTicks()) {
            uint256 tickK = IOrbitalPool(pool).ticks(pos.tickIndex).k;
            isBoundary = tickK >= kBound;
        }

        string memory boundaryStr = isBoundary ? "boundary" : "interior";

        // Capital efficiency: r / rInt as a percentage (WAD-scaled).
        string memory effStr = "0";
        if (rInt > 0) {
            uint256 effBps = (pos.r * 10000) / rInt; // basis points
            effStr = effBps.toString();
        }

        return string(abi.encodePacked(
            '[',
            '{"trait_type":"Tick Index","value":', pos.tickIndex.toString(), '},',
            '{"trait_type":"Liquidity (r WAD)","value":', pos.r.toString(), '},',
            '{"trait_type":"Type","value":"', boundaryStr, '"},',
            '{"trait_type":"Capital Efficiency (bps)","value":', effStr, '}',
            ']'
        ));
    }
}
