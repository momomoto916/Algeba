// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IStakingSupply {
    function emittedSupply() external view returns (uint256);
}

/// @notice ALGEBA fixed-cap token.
/// Genesis is pre-funded with 50 AGB (GENESIS_ALLOCATION); staking can mint only
/// its 209,999,950 AGB allocation (STAKING_ALLOCATION). No public mint exists.
contract ALGEBA is ERC20, Ownable {
    uint256 public constant MAX_SUPPLY = 210_000_000 ether;
    uint256 public constant GENESIS_ALLOCATION = 50 ether;
    uint256 public constant STAKING_ALLOCATION = 209_999_950 ether;

    address public staking;
    uint256 public stakingMinted;

    error InvalidAddress();
    error StakingAlreadySet();
    error OnlyStaking();
    error CapExceeded();

    constructor(address initialHolder) ERC20("ALGEBA", "AGB") Ownable(msg.sender) {
        if (initialHolder == address(0)) revert InvalidAddress();
        _mint(initialHolder, GENESIS_ALLOCATION);
    }

    /// @dev One-time, irreversible wiring — there is no way to change `staking`
    /// once set. After calling this, owner retains no further privileged function
    /// in this contract; call renounceOwnership() post-setup to remove the
    /// otherwise-unused admin key as an attack surface.
    function setStaking(address staking_) external onlyOwner {
        if (staking_ == address(0)) revert InvalidAddress();
        if (staking != address(0)) revert StakingAlreadySet();
        staking = staking_;
    }

    function mintStakingReward(address to, uint256 amount) external {
        if (msg.sender != staking) revert OnlyStaking();
        if (stakingMinted + amount > STAKING_ALLOCATION) revert CapExceeded();
        if (totalSupply() + amount > MAX_SUPPLY) revert CapExceeded();
        stakingMinted += amount;
        _mint(to, amount);
    }

    function remainingStakingEmission() external view returns (uint256) {
        return STAKING_ALLOCATION - stakingMinted;
    }

    /// @notice Read-only projection: genesis allocation + everything the halving
    /// schedule says should have emitted by the current block, whether or not
    /// individual stakers have claimed it yet. Free to read (no gas, no state change).
    /// This is NOT totalSupply() — totalSupply() only ever reflects tokens that
    /// have actually been minted via claim/compound/unstake.
    function emittedSupply() external view returns (uint256) {
        if (staking == address(0)) return GENESIS_ALLOCATION;
        return IStakingSupply(staking).emittedSupply();
    }
}
