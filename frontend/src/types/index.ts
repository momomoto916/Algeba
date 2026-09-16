export interface UserStakingInfo {
  amount: bigint;
  rewardDebt: bigint;
  rewards: bigint;
}

export interface GenesisStatus {
  open: boolean;
  done: boolean;
  remaining: bigint;
  participants: bigint;
}

export interface ContractStats {
  totalSupply: bigint;
  emittedSupply: bigint;
  totalStaked: bigint;
  stakingMinted: bigint;
  remainingEmission: bigint;
  genesisParticipants: bigint;
  currentEpoch: bigint;
  emissionPerSecond: bigint;
  nextHalvingTime: bigint;
}

export interface UserData {
  stakingInfo: UserStakingInfo | null;
  pendingReward: bigint;
  genesisAllocation: bigint;
  genesisEligible: boolean;
  genesisClaimed: boolean;
  genesisClaimable: bigint;
}
