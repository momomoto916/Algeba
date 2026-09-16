// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {OFT} from "@layerzerolabs/oft-evm/contracts/OFT.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice LayerZero OFT representing bridged ALGEBA (AGB) on a destination chain
/// (e.g. Base Sepolia Testnet). Mints on receive, burns on send — the minted supply
/// here is always backed 1:1 by AGB locked in AGBOFTAdapter on the home chain.
contract AGBOFT is OFT {
    constructor(
        string memory _name,
        string memory _symbol,
        address _lzEndpoint,
        address _delegate
    ) OFT(_name, _symbol, _lzEndpoint, _delegate) Ownable(_delegate) {}
}
