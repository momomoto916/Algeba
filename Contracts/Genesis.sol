// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/// @notice One-wallet-one-portion ALGEBA Genesis, open for a configurable duration
///         set at deploy time. No ETH contribution is required. Each whitelisted
///         wallet may register once.
/// @dev Sybil resistance via a fixed, immutable Merkle allowlist: `merkleRoot` is
///      set once at deploy time from a pre-finalized address list and can never be
///      changed (no owner, no setter) — there is no way to add or remove addresses
///      after deployment. `participate()` requires a valid Merkle proof of
///      membership. Leaves are hashed as
///      keccak256(bytes.concat(keccak256(abi.encode(address)))), matching
///      OpenZeppelin's JavaScript `merkle-tree` library (StandardMerkleTree)
///      convention exactly — the off-chain tree must be built with that library
///      for proofs to verify.
contract Genesis is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant GENESIS_ALLOCATION = 50 ether;

    IERC20 public immutable token;
    uint256 public immutable DURATION;
    uint256 public immutable startTime;
    uint256 public immutable endTime;
    bytes32 public immutable merkleRoot;

    uint256 public participantCount;
    bool public finalized;
    mapping(address => bool) public eligible;
    mapping(address => bool) public claimed;

    error ZeroDuration();
    error ZeroMerkleRoot();
    error NotOpen();
    error AlreadyFinalized();
    error FinalizationNotReady();
    error AlreadyParticipated();
    error NotWhitelisted();
    error NotEligible();
    error AlreadyClaimed();
    error NothingToClaim();

    event Participated(address indexed account, uint256 participantNumber);
    event Finalized(uint256 participantCount, uint256 allocationPerWallet);
    event Claimed(address indexed account, uint256 amount);

    /// @param token_ ALGEBA token address.
    /// @param duration_ How long the Genesis window stays open, in seconds.
    /// @param merkleRoot_ Root of the pre-finalized whitelist tree. Immutable —
    ///        the full whitelist must be decided before deployment.
    constructor(address token_, uint256 duration_, bytes32 merkleRoot_) {
        require(token_ != address(0), "zero token");
        if (duration_ == 0) revert ZeroDuration();
        if (merkleRoot_ == bytes32(0)) revert ZeroMerkleRoot();
        token = IERC20(token_);
        DURATION = duration_;
        startTime = block.timestamp;
        endTime = block.timestamp + duration_;
        merkleRoot = merkleRoot_;
    }

    /// @notice Register this wallet as an eligible Genesis participant.
    ///         The caller pays only the network gas required for this transaction.
    /// @param proof Merkle proof that msg.sender is on the whitelist.
    function participate(bytes32[] calldata proof) external nonReentrant {
        if (finalized || block.timestamp >= endTime || block.timestamp < startTime) revert NotOpen();
        if (eligible[msg.sender]) revert AlreadyParticipated();

        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(msg.sender))));
        if (!MerkleProof.verify(proof, merkleRoot, leaf)) revert NotWhitelisted();

        eligible[msg.sender] = true;
        participantCount += 1;
        emit Participated(msg.sender, participantCount);
    }

    function finalize() external {
        if (finalized) revert AlreadyFinalized();
        if (block.timestamp < endTime) revert FinalizationNotReady();
        finalized = true;
        emit Finalized(participantCount, allocationPerWallet());
    }

    /// @notice Equal allocation for every eligible wallet after Genesis closes.
    /// @dev Integer division: GENESIS_ALLOCATION % participantCount wei rounds
    /// down and is never distributed or swept. Intentionally left unclaimed
    /// rather than adding a sweep function (no privileged withdrawal path).
    function allocationPerWallet() public view returns (uint256) {
        if (participantCount == 0) return 0;
        return GENESIS_ALLOCATION / participantCount;
    }

    function allocationOf(address account) public view returns (uint256) {
        if (!eligible[account] || !finalized) return 0;
        return allocationPerWallet();
    }

    function claim() external nonReentrant {
        if (!finalized) revert FinalizationNotReady();
        if (!eligible[msg.sender]) revert NotEligible();
        if (claimed[msg.sender]) revert AlreadyClaimed();

        uint256 amount = allocationPerWallet();
        if (amount == 0) revert NothingToClaim();

        claimed[msg.sender] = true;
        token.safeTransfer(msg.sender, amount);
        emit Claimed(msg.sender, amount);
    }

    function claimable(address account) external view returns (uint256) {
        if (!finalized || !eligible[account] || claimed[account]) return 0;
        return allocationPerWallet();
    }

    function status() external view returns (bool open, bool done, uint256 remaining, uint256 participants) {
        open = !finalized && block.timestamp < endTime && block.timestamp >= startTime;
        done = finalized;
        remaining = block.timestamp >= endTime ? 0 : endTime - block.timestamp;
        participants = participantCount;
    }
}
