import type { PublicClient, Address } from 'viem';
import { ALGEBA_ABI, GENESIS_ABI, STAKING_ABI } from '../config/contracts';
import type { ContractAddresses } from '../config/networks';
import type { ContractStats, UserStakingInfo, GenesisStatus, UserData } from '../types/index';

export async function getContractStats(publicClient: PublicClient | null, contracts: ContractAddresses): Promise<ContractStats | null> {
  if (!publicClient || !contracts.ALGEBA || !contracts.GENESIS || !contracts.STAKING) {
    return null;
  }

  try {
    const [totalSupply, emittedSupply, stakingMinted, remainingEmission, totalStaked, genesisParticipants, currentEpoch, emissionPerSecond, nextHalvingTime] = await Promise.all([
      publicClient.readContract({
        address: contracts.ALGEBA as Address,
        abi: ALGEBA_ABI,
        functionName: 'totalSupply',
      }) as Promise<bigint>,
      publicClient.readContract({
        address: contracts.ALGEBA as Address,
        abi: ALGEBA_ABI,
        functionName: 'emittedSupply',
      }) as Promise<bigint>,
      publicClient.readContract({
        address: contracts.ALGEBA as Address,
        abi: ALGEBA_ABI,
        functionName: 'stakingMinted',
      }) as Promise<bigint>,
      publicClient.readContract({
        address: contracts.ALGEBA as Address,
        abi: ALGEBA_ABI,
        functionName: 'remainingStakingEmission',
      }) as Promise<bigint>,
      publicClient.readContract({
        address: contracts.STAKING as Address,
        abi: STAKING_ABI,
        functionName: 'totalStaked',
      }) as Promise<bigint>,
      publicClient.readContract({
        address: contracts.GENESIS as Address,
        abi: GENESIS_ABI,
        functionName: 'participantCount',
      }) as Promise<bigint>,
      publicClient.readContract({
        address: contracts.STAKING as Address,
        abi: STAKING_ABI,
        functionName: 'currentEpoch',
      }) as Promise<bigint>,
      publicClient.readContract({
        address: contracts.STAKING as Address,
        abi: STAKING_ABI,
        functionName: 'currentEmissionPerSecond',
      }) as Promise<bigint>,
      publicClient.readContract({
        address: contracts.STAKING as Address,
        abi: STAKING_ABI,
        functionName: 'nextHalvingTime',
      }) as Promise<bigint>,
    ]);

    return {
      totalSupply,
      emittedSupply,
      totalStaked,
      stakingMinted,
      remainingEmission,
      genesisParticipants,
      currentEpoch,
      emissionPerSecond,
      nextHalvingTime,
    };
  } catch (error) {
    console.error('Error fetching contract stats:', error);
    return null;
  }
}

export async function getUserData(publicClient: PublicClient | null, userAddress: Address, contracts: ContractAddresses): Promise<UserData | null> {
  if (!publicClient || !userAddress || !contracts.ALGEBA || !contracts.GENESIS || !contracts.STAKING) {
    return null;
  }

  try {
    const [stakingInfoResult, pendingReward, genesisAllocation, genesisRegistered, genesisClaimed, genesisClaimable] = await Promise.all([
      publicClient.readContract({
        address: contracts.STAKING as Address,
        abi: STAKING_ABI,
        functionName: 'users',
        args: [userAddress],
      }) as unknown as Promise<[bigint, bigint, bigint]>,
      publicClient.readContract({
        address: contracts.STAKING as Address,
        abi: STAKING_ABI,
        functionName: 'pendingReward',
        args: [userAddress],
      }) as unknown as Promise<bigint>,
      publicClient.readContract({
        address: contracts.GENESIS as Address,
        abi: GENESIS_ABI,
        functionName: 'allocationOf',
        args: [userAddress],
      }) as unknown as Promise<bigint>,
      publicClient.readContract({
        address: contracts.GENESIS as Address,
        abi: GENESIS_ABI,
        functionName: 'eligible',
        args: [userAddress],
      }) as unknown as Promise<boolean>,
      publicClient.readContract({
        address: contracts.GENESIS as Address,
        abi: GENESIS_ABI,
        functionName: 'claimed',
        args: [userAddress],
      }) as unknown as Promise<boolean>,
      publicClient.readContract({
        address: contracts.GENESIS as Address,
        abi: GENESIS_ABI,
        functionName: 'claimable',
        args: [userAddress],
      }) as unknown as Promise<bigint>,
    ]);

    // Convert tuple to UserStakingInfo
    const stakingInfo: UserStakingInfo | null = stakingInfoResult ? {
      amount: stakingInfoResult[0],
      rewardDebt: stakingInfoResult[1],
      rewards: stakingInfoResult[2],
    } : null;

    return {
      stakingInfo,
      pendingReward,
      genesisAllocation,
      genesisEligible: genesisRegistered,
      genesisClaimed: genesisClaimed || false,
      genesisClaimable,
    };
  } catch (error) {
    console.error('Error fetching user data:', error);
    return null;
  }
}

export async function getGenesisStatus(publicClient: PublicClient | null, contracts: ContractAddresses): Promise<GenesisStatus | null> {
  if (!publicClient || !contracts.GENESIS) {
    return null;
  }

  try {
    const status = await publicClient.readContract({
      address: contracts.GENESIS as Address,
      abi: GENESIS_ABI,
      functionName: 'status',
    }) as unknown as [boolean, boolean, bigint, bigint];

    return {
      open: status[0] || false,
      done: status[1] || false,
      remaining: status[2] || 0n,
      participants: status[3] || 0n,
    };
  } catch (error) {
    console.error('Error fetching genesis status:', error);
    return null;
  }
}
