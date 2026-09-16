// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IALGEBAReward {
    function mintStakingReward(address to, uint256 amount) external;
    function remainingStakingEmission() external view returns (uint256);
}

interface IGenesisFinalized {
    function finalized() external view returns (bool);
}

/// @notice Permissionless ALGEBA staking with a global accretion index.
/// Emission starts at the first successful stake after Genesis is finalized.
/// No emission is minted while there are no stakers.
/// @dev The emission schedule is measured in seconds (block.timestamp), not block
/// numbers, so each halving lands a fixed wall-clock period apart regardless of
/// changes to Ethereum's block time or missed slots. On Ethereum mainnet a block's
/// timestamp is fixed by its slot, so proposers cannot shift it.
contract Staking is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant PRECISION = 1e36;
    uint256 public constant GENESIS_ALLOCATION = 50 ether;
    // Halving series (FIRST_EPOCH_EMISSION * 2) asymptotically sums to MAX_SUPPLY / 2
    // = 210,000,000, slightly above TOTAL_EMISSION (209,999,950 — reserves 50 AGB for
    // Genesis). emissionBetween()'s `remaining` clamp caps the tail of the schedule at
    // TOTAL_EMISSION regardless, so the cap is always respected either way.
    uint256 public constant FIRST_EPOCH_EMISSION = 105_000_000 ether;
    uint256 public constant TOTAL_EMISSION = 209_999_950 ether;
    uint256 public constant MAX_EPOCHS = 256;
    // Every position is either 0 or >= MIN_STAKE, so totalStaked is either 0 or
    // >= MIN_STAKE whenever _update() divides by it. That bounds accRewardPerShare
    // for the contract's whole life at TOTAL_EMISSION * PRECISION / MIN_STAKE
    // (~2.1e44), and any position (<= 2.1e26) times that index stays ~2.6 million
    // times below 2^256. Without it, a 1-wei sole staker could inflate the index
    // until normal-sized stakes overflow and revert forever.
    uint256 public constant MIN_STAKE = 1 ether;

    IERC20 public immutable token;
    IALGEBAReward public immutable rewardToken;
    IGenesisFinalized public immutable genesis;
    /// @notice Length of each halving epoch, in seconds.
    uint256 public immutable halvingPeriod;

    // Never 0 once emission has started: Genesis can only finalize at a timestamp
    // >= its (nonzero) duration, and staking requires Genesis to be finalized.
    uint256 public startTime;
    uint256 public totalStaked;
    uint256 public accRewardPerShare;
    uint256 public lastUpdateTime;
    uint256 public totalEmitted;

    struct UserInfo {
        uint256 amount;
        uint256 rewardDebt;
        uint256 rewards;
    }

    mapping(address => UserInfo) public users;

    event Staked(address indexed user, uint256 amount);
    event Claimed(address indexed user, uint256 reward);
    event Compounded(address indexed user, uint256 reward, uint256 newStake);
    event Unstaked(address indexed user, uint256 principal, uint256 reward);
    event EmergencyWithdrawn(address indexed user, uint256 principal, uint256 forfeitedRewards);
    event EmissionStarted(uint256 indexed startTime);
    event IndexUpdated(uint256 fromTime, uint256 toTime, uint256 emission, uint256 index);

    error ZeroAmount();
    error InsufficientStake();
    error BelowMinimumStake();
    error NoReward();
    error InvalidHalvingPeriod();
    error GenesisNotFinalized();

    /// @param halvingPeriod_ Seconds per halving epoch (4 years = 126_230_400).
    constructor(address token_, address genesis_, uint256 halvingPeriod_) {
        require(token_ != address(0) && genesis_ != address(0), "zero address");
        if (halvingPeriod_ == 0) revert InvalidHalvingPeriod();
        token = IERC20(token_);
        rewardToken = IALGEBAReward(token_);
        genesis = IGenesisFinalized(genesis_);
        halvingPeriod = halvingPeriod_;
    }

    function stake(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        UserInfo storage u = users[msg.sender];
        if (u.amount + amount < MIN_STAKE) revert BelowMinimumStake();

        if (startTime == 0) {
            if (!genesis.finalized()) revert GenesisNotFinalized();
            startTime = block.timestamp;
            lastUpdateTime = block.timestamp;
            emit EmissionStarted(block.timestamp);
        } else {
            _update();
        }

        _settle(u);
        token.safeTransferFrom(msg.sender, address(this), amount);
        u.amount += amount;
        totalStaked += amount;
        u.rewardDebt = u.amount * accRewardPerShare / PRECISION;
        emit Staked(msg.sender, amount);
    }

    function claim() external nonReentrant returns (uint256 reward) {
        _update();
        UserInfo storage u = users[msg.sender];
        _settle(u);
        reward = u.rewards;
        if (reward == 0) revert NoReward();
        u.rewards = 0;
        reward = _capToMintable(reward);
        if (reward > 0) rewardToken.mintStakingReward(msg.sender, reward);
        emit Claimed(msg.sender, reward);
    }

    function compound() external nonReentrant returns (uint256 reward) {
        _update();
        UserInfo storage u = users[msg.sender];
        _settle(u);
        reward = u.rewards;
        if (reward == 0) revert NoReward();
        u.rewards = 0;
        reward = _capToMintable(reward);
        u.amount += reward;
        totalStaked += reward;
        u.rewardDebt = u.amount * accRewardPerShare / PRECISION;
        if (reward > 0) rewardToken.mintStakingReward(address(this), reward);
        emit Compounded(msg.sender, reward, u.amount);
    }

    function unstake(uint256 amount) external nonReentrant returns (uint256 reward) {
        if (amount == 0) revert ZeroAmount();
        _update();
        UserInfo storage u = users[msg.sender];
        if (amount > u.amount) revert InsufficientStake();
        uint256 remainingStake = u.amount - amount;
        if (remainingStake != 0 && remainingStake < MIN_STAKE) revert BelowMinimumStake();
        _settle(u);

        reward = u.rewards * amount / u.amount;
        u.rewards -= reward;
        u.amount = remainingStake;
        totalStaked -= amount;
        u.rewardDebt = u.amount * accRewardPerShare / PRECISION;

        reward = _capToMintable(reward);
        if (reward > 0) rewardToken.mintStakingReward(address(this), reward);
        token.safeTransfer(msg.sender, amount + reward);
        emit Unstaked(msg.sender, amount, reward);
    }

    /// @notice Principal-only exit. Never touches emission or reward minting, so
    /// it cannot be blocked by anything on the reward path. Forfeits all
    /// unclaimed rewards; the forfeited share of the not-yet-indexed window is
    /// distributed to the remaining stakers on the next update.
    function emergencyWithdraw() external nonReentrant {
        UserInfo storage u = users[msg.sender];
        uint256 amount = u.amount;
        if (amount == 0) revert InsufficientStake();
        uint256 forfeited = u.rewards;

        u.amount = 0;
        u.rewards = 0;
        u.rewardDebt = 0;
        totalStaked -= amount;

        token.safeTransfer(msg.sender, amount);
        emit EmergencyWithdrawn(msg.sender, amount, forfeited);
    }

    function pendingReward(address account) external view returns (uint256) {
        UserInfo memory u = users[account];
        uint256 index = previewIndex();
        uint256 accumulated = u.amount * index / PRECISION;
        uint256 pending = accumulated > u.rewardDebt ? accumulated - u.rewardDebt : 0;
        return u.rewards + pending;
    }

    function previewIndex() public view returns (uint256) {
        if (startTime == 0 || totalStaked == 0 || block.timestamp <= lastUpdateTime) return accRewardPerShare;
        uint256 emission = emissionBetween(lastUpdateTime, block.timestamp);
        if (emission == 0) return accRewardPerShare;
        return accRewardPerShare + emission * PRECISION / totalStaked;
    }

    /// @notice Read-only supply projection: genesis allocation + everything the
    /// halving schedule says has emitted so far, free to read. The real ERC20
    /// totalSupply() on ALGEBA always remains the actual minted supply — this is
    /// only ever a schedule-based projection.
    function emittedSupply() external view returns (uint256) {
        uint256 preview = (startTime != 0 && totalStaked != 0)
            ? emissionBetween(lastUpdateTime, block.timestamp)
            : 0;
        return GENESIS_ALLOCATION + totalEmitted + preview;
    }

    function currentEpoch() public view returns (uint256) {
        if (startTime == 0 || block.timestamp < startTime) return 0;
        return (block.timestamp - startTime) / halvingPeriod;
    }

    function currentEmissionPerSecond() public view returns (uint256) {
        if (startTime == 0) return 0;
        uint256 epoch = currentEpoch();
        if (epoch >= MAX_EPOCHS) return 0;
        return (FIRST_EPOCH_EMISSION >> epoch) / halvingPeriod;
    }

    function nextHalvingTime() public view returns (uint256) {
        if (startTime == 0) return 0;
        return startTime + (currentEpoch() + 1) * halvingPeriod;
    }

    function emissionBetween(uint256 fromTime, uint256 toTime) public view returns (uint256 total) {
        if (startTime == 0 || toTime <= fromTime || totalEmitted >= TOTAL_EMISSION || toTime <= startTime) return 0;
        if (fromTime < startTime) fromTime = startTime;

        uint256 cursor = fromTime;
        uint256 remaining = TOTAL_EMISSION - totalEmitted;

        // Bounded by the number of halvings, never by elapsed time or number of users.
        for (uint256 i = 0; i < MAX_EPOCHS && cursor < toTime; ++i) {
            uint256 epoch = (cursor - startTime) / halvingPeriod;
            if (epoch >= MAX_EPOCHS) break;

            uint256 epochEmission = FIRST_EPOCH_EMISSION >> epoch;
            if (epochEmission == 0) break;

            uint256 epochEnd = startTime + (epoch + 1) * halvingPeriod;
            uint256 end = toTime < epochEnd ? toTime : epochEnd;
            uint256 portion = epochEmission * (end - cursor) / halvingPeriod;
            total += portion;
            cursor = end;

            if (total >= remaining) return remaining;
        }

        return total > remaining ? remaining : total;
    }

    function _update() internal {
        if (startTime == 0 || block.timestamp <= lastUpdateTime) return;

        if (totalStaked == 0) {
            // Idle periods are permanently missed. They are not assigned to later stakers.
            lastUpdateTime = block.timestamp;
            return;
        }

        uint256 emission = emissionBetween(lastUpdateTime, block.timestamp);
        if (emission > 0) {
            totalEmitted += emission;
            accRewardPerShare += emission * PRECISION / totalStaked;
            emit IndexUpdated(lastUpdateTime, block.timestamp, emission, accRewardPerShare);
        }
        lastUpdateTime = block.timestamp;
    }

    /// @dev Floor rounding in per-user accounting can leave total owed rewards a
    /// few wei above what ALGEBA can still mint once emission is exhausted.
    /// Paying the excess would revert in mintStakingReward and, inside
    /// unstake(), trap principal. The unmintable dust is forfeited instead.
    function _capToMintable(uint256 reward) internal view returns (uint256) {
        uint256 mintable = rewardToken.remainingStakingEmission();
        return reward > mintable ? mintable : reward;
    }

    function _settle(UserInfo storage u) internal {
        uint256 accumulated = u.amount * accRewardPerShare / PRECISION;
        if (accumulated > u.rewardDebt) {
            u.rewards += accumulated - u.rewardDebt;
        }
        u.rewardDebt = accumulated;
    }
}
