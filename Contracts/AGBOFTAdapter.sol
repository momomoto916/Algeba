// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {OFTAdapter} from "@layerzerolabs/oft-evm/contracts/OFTAdapter.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice LayerZero OFT Adapter for the existing ALGEBA (AGB) ERC-20 on its home
/// chain (Sepolia). Locks AGB here when bridging out; releases it when bridging
/// back in. The mirrored supply on each destination chain lives in an AGBOFT
/// contract (mint/burn), never a second adapter — only one adapter should ever
/// exist for a given token across the whole LayerZero mesh.
contract AGBOFTAdapter is OFTAdapter {
    constructor(
        address _token,
        address _lzEndpoint,
        address _delegate
    ) OFTAdapter(_token, _lzEndpoint, _delegate) Ownable(_delegate) {}
}
