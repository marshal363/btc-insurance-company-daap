# BitHedge Off-Chain Data Model: Technical Specification

## Overview

This document details the off-chain data model for the BitHedge DeFi platform, implemented using TypeScript. The off-chain components handle user interface, data aggregation, risk modeling, and the middleware layer that interacts with on-chain smart contracts.

## Core Components

### 1. User Management System

**Purpose:** Manages user accounts, authentication, preferences, and activity tracking.

#### Data Structures

```typescript
// User account information
interface User {
  id: string;                      // UUID for user
  walletAddress: string;           // Blockchain wallet address
  email?: string;                  // Optional email for notifications
  username?: string;               // Optional username
  kycStatus: KYCStatus;            // KYC verification status
  createdAt: Date;                 // Account creation timestamp
  lastLoginAt: Date;               // Last login timestamp
  userType: UserType;              // User role/type in the system
  notificationPreferences: NotificationPreferences;
  riskProfile: UserRiskProfile;    // User risk tolerance and preferences
  apiKeys: ApiKey[];               // API keys for programmatic access
}

// KYC verification status
enum KYCStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  VERIFIED = 'verified',
  REJECTED = 'rejected'
}

// User types/roles
enum UserType {
  POLICY_HOLDER = 'policy_holder',
  UNDERWRITER = 'underwriter',
  ORACLE_PROVIDER = 'oracle_provider',
  ADMINISTRATOR = 'administrator'
}

// Notification preferences
interface NotificationPreferences {
  email: boolean;
  push: boolean;
  sms: boolean;
  emailFrequency: 'immediate' | 'daily' | 'weekly';
  notifyOnPolicyCreation: boolean;
  notifyOnPolicyClaim: boolean;
  notifyOnMarginCall: boolean;
  notifyOnGovernanceProposal: boolean;
}

// User risk profile
interface UserRiskProfile {
  riskTolerance: number;           // 1-10 scale of risk tolerance
  preferredAssets: string[];       // Asset tickers preferred by user
  preferredPolicyTypes: string[];  // Policy types preferred by user
  maxExposurePerPolicy: number;    // Maximum exposure for a single policy
  maxTotalExposure: number;        // Maximum total exposure
}

// API key for programmatic access
interface ApiKey {
  id: string;
  name: string;
  key: string;                     // Hashed API key
  permissions: string[];           // What this key can access/do
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
  status: 'active' | 'revoked';
}

// User activity log
interface UserActivity {
  id: string;
  userId: string;
  activityType: ActivityType;
  details: any;                    // JSON of activity-specific details
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}

enum ActivityType {
  LOGIN = 'login',
  LOGOUT = 'logout',
  CREATE_POLICY = 'create_policy',
  FILE_CLAIM = 'file_claim',
  DEPOSIT_COLLATERAL = 'deposit_collateral',
  WITHDRAW_COLLATERAL = 'withdraw_collateral',
  UPDATE_PREFERENCES = 'update_preferences',
  VOTE = 'vote',
  CREATE_PROPOSAL = 'create_proposal'
}
```

#### Key Service Methods

```typescript
class UserService {
  // Create a new user account
  async createUser(userData: Partial<User>): Promise<User>;
  
  // Update user profile information
  async updateUser(userId: string, updates: Partial<User>): Promise<User>;
  
  // Get user by ID
  async getUserById(userId: string): Promise<User | null>;
  
  // Get user by wallet address
  async getUserByWalletAddress(address: string): Promise<User | null>;
  
  // Update KYC status
  async updateKycStatus(userId: string, status: KYCStatus, verificationData?: any): Promise<User>;
  
  // Generate a new API key for user
  async generateApiKey(userId: string, name: string, permissions: string[]): Promise<ApiKey>;
  
  // Revoke an API key
  async revokeApiKey(userId: string, keyId: string): Promise<boolean>;
  
  // Log user activity
  async logActivity(activity: Omit<UserActivity, 'id' | 'timestamp'>): Promise<UserActivity>;
  
  // Get user activity history
  async getUserActivityHistory(userId: string, options?: PaginationOptions): Promise<{ activities: UserActivity[], total: number }>;
}
```

### 2. Policy Management System

**Purpose:** Handles off-chain policy data, analytics, and interactions with on-chain policy contracts.

#### Data Structures

```typescript
// Policy information (synced from on-chain)
interface Policy {
  id: string;                       // UUID for off-chain reference
  policyId: number;                 // On-chain policy ID
  owner: string;                    // Owner wallet address
  userId: string;                   // Off-chain user ID
  policyType: string;               // Type of policy
  assetCovered: string;             // Asset ticker covered by policy
  coverageAmount: number;           // Amount of coverage
  premiumAmount: number;            // Premium paid
  startBlock: number;               // Start block number
  endBlock: number;                 // End block number
  startDate: Date;                  // Calculated start date
  endDate: Date;                    // Calculated end date
  status: PolicyStatus;             // Current policy status
  riskTier: number;                 // Risk tier assignment
  collateralRequired: number;       // Total collateral required
  collateralLocked: number;         // Amount currently locked
  oracleReference?: string;         // Oracle used for this policy
  transactions: Transaction[];      // Related blockchain transactions
  claims: PolicyClaim[];            // Claims filed against this policy
  metadata: Record<string, any>;    // Additional policy metadata
}

enum PolicyStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  EXPIRED = 'expired',
  CLAIMED = 'claimed',
  SETTLED = 'settled',
  LIQUIDATED = 'liquidated'
}

// Policy claim information
interface PolicyClaim {
  id: string;                       // UUID for off-chain reference
  claimId: number;                  // On-chain claim ID
  policyId: string;                 // Reference to policy
  claimant: string;                 // Claimant wallet address
  userId: string;                   // Off-chain user ID
  claimAmount: number;              // Amount claimed
  claimEvidence: string;            // Evidence URL or hash
  claimStatus: ClaimStatus;         // Current claim status
  claimTimestamp: Date;             // When claim was filed
  settlementAmount?: number;        // Amount settled (if approved)
  settlementTimestamp?: Date;       // When claim was settled
  verificationResults: VerificationResult[]; // Oracle verification results
  reviewNotes?: string;             // Notes from claim reviewers
  disputeDetails?: DisputeDetails;  // Details if claim is disputed
}

enum ClaimStatus {
  PENDING = 'pending',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  DISPUTED = 'disputed',
  SETTLED = 'settled'
}

// Oracle verification result
interface VerificationResult {
  oracleId: string;
  oracleName: string;
  result: boolean;
  confidence: number;
  data: any;                        // Verification data provided
  timestamp: Date;
  signature: string;                // Cryptographic signature
}

// Dispute information for contested claims
interface DisputeDetails {
  disputeId: string;
  disputedBy: string;               // Who opened the dispute
  disputeReason: string;
  evidenceProvided: string[];       // URLs to evidence files
  arbitratorId?: string;            // Assigned arbitrator
  resolution?: string;
  resolutionTimestamp?: Date;
  status: 'open' | 'under_review' | 'resolved';
}

// Policy type template
interface PolicyType {
  id: string;
  typeId: string;                   // On-chain type ID
  name: string;
  description: string;
  basePremiumRate: number;
  minCoverageAmount: number;
  maxCoverageAmount: number;
  minDurationBlocks: number;
  maxDurationBlocks: number;
  collateralRatio: number;
  oracleReference: string;
  riskModelId: string;              // Reference to risk model used
  termsTemplate: string;            // Template for terms & conditions
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Transaction record
interface Transaction {
  id: string;
  txHash: string;                   // Blockchain transaction hash
  type: TransactionType;            // Type of transaction
  status: 'pending' | 'confirmed' | 'failed';
  blockHeight?: number;             // Block height when confirmed
  timestamp: Date;
  from: string;                     // Sender address
  to: string;                       // Recipient address
  value: number;                    // Transaction value
  fee: number;                      // Transaction fee
  relatedEntityId?: string;         // ID of related entity (policy, claim, etc.)
  relatedEntityType?: string;       // Type of related entity
  data?: any;                       // Additional transaction data
}

enum TransactionType {
  POLICY_CREATION = 'policy_creation',
  PREMIUM_PAYMENT = 'premium_payment',
  CLAIM_FILING = 'claim_filing',
  CLAIM_SETTLEMENT = 'claim_settlement',
  COLLATERAL_DEPOSIT = 'collateral_deposit',
  COLLATERAL_WITHDRAWAL = 'collateral_withdrawal',
  GOVERNANCE_VOTE = 'governance_vote'
}

#### Key Service Methods

```typescript
class PolicyService {
  // Create a new policy (will trigger on-chain transaction)
  async createPolicy(userId: string, policyData: Partial<Policy>): Promise<Policy>;
  
  // Get policy by ID
  async getPolicyById(policyId: string): Promise<Policy | null>;
  
  // Get policies by user ID
  async getUserPolicies(userId: string, options?: PaginationOptions): Promise<{ policies: Policy[], total: number }>;
  
  // Update policy status (usually triggered by blockchain events)
  async updatePolicyStatus(policyId: string, status: PolicyStatus, metadata?: any): Promise<Policy>;
  
  // File a claim against a policy
  async fileClaim(userId: string, policyId: string, claimData: Partial<PolicyClaim>): Promise<PolicyClaim>;
  
  // Get claim by ID
  async getClaimById(claimId: string): Promise<PolicyClaim | null>;
  
  // Update claim status
  async updateClaimStatus(claimId: string, status: ClaimStatus, updateData?: any): Promise<PolicyClaim>;
  
  // Record verification result for a claim
  async recordVerificationResult(claimId: string, result: VerificationResult): Promise<PolicyClaim>;
  
  // Calculate premium for a potential policy
  async calculatePremium(policyType: string, assetCovered: string, coverageAmount: number, durationBlocks: number): Promise<number>;
  
  // Get policy analytics for a user
  async getUserPolicyAnalytics(userId: string): Promise<PolicyAnalytics>;
  
  // Create a policy type template
  async createPolicyType(policyTypeData: Partial<PolicyType>): Promise<PolicyType>;
  
  // Get available policy types
  async getPolicyTypes(filters?: Record<string, any>): Promise<PolicyType[]>;
}

interface PolicyAnalytics {
  totalActivePolicies: number;
  totalCoverageAmount: number;
  totalPremiumPaid: number;
  assetDistribution: Record<string, number>; // Asset ticker to coverage amount
  claimHistory: {
    totalClaims: number;
    approvedClaims: number;
    rejectedClaims: number;
    pendingClaims: number;
    totalClaimAmount: number;
    totalSettlementAmount: number;
  };
  policyStatusDistribution: Record<PolicyStatus, number>;
}
```

### 3. Collateral Management System

**Purpose:** Tracks and manages underwriter collateral, pool allocations, and margin call monitoring.

#### Data Structures

```typescript
// Collateral pool information
interface CollateralPool {
  id: string;                       // UUID for off-chain reference
  poolId: number;                   // On-chain pool ID
  riskTier: number;                 // Risk tier of this pool
  assetType: string;                // Asset used as collateral
  totalCollateral: number;          // Total collateral in pool
  allocatedCollateral: number;      // Amount allocated to policies
  minimumCollateralRatio: number;   // Required minimum ratio
  currentCollateralRatio: number;   // Current collateral ratio
  liquidationThreshold: number;     // Threshold for liquidation
  participants: PoolParticipant[];  // Underwriters in this pool
  healthFactor: number;             // Current health factor (derived)
  createdAt: Date;
  updatedAt: Date;
  healthHistory: HealthCheckRecord[]; // Historical health records
  marginCalls: MarginCall[];        // Margin calls for this pool
}

// Pool participant (underwriter)
interface PoolParticipant {
  id: string;
  userId: string;                   // Off-chain user ID
  walletAddress: string;            // Underwriter wallet address
  depositedAmount: number;          // Total deposited
  allocatedAmount: number;          // Amount allocated to policies
  rewardsEarned: number;            // Rewards earned
  joinedAt: Date;
  lastUpdateAt: Date;
  allocationPercentage: number;     // Percentage of pool
}

// Health check record
interface HealthCheckRecord {
  id: string;
  poolId: string;                   // Reference to pool
  timestamp: Date;
  healthFactor: number;             // Health factor at time of check
  collateralRatio: number;          // Collateral ratio at time of check
  totalExposure: number;            // Total exposure at time of check
}

// Margin call record
interface MarginCall {
  id: string;                       // UUID for off-chain reference
  callId: number;                   // On-chain call ID
  poolId: string;                   // Reference to affected pool
  callTimestamp: Date;              // When margin call was triggered
  requiredCollateral: number;       // Collateral needed to resolve
  currentCollateral: number;        // Current collateral amount
  collateralDeficit: number;        // Deficit amount
  gracePeriodBlocks: number;        // Grace period in blocks
  gracePeriodEnd: Date;             // When grace period ends
  status: MarginCallStatus;         // Current status
  notifications: MarginCallNotification[]; // Notification records
  responses: MarginCallResponse[];  // Responses to this call
}

enum MarginCallStatus {
  ACTIVE = 'active',
  PARTIALLY_RESOLVED = 'partially_resolved',
  RESOLVED = 'resolved',
  LIQUIDATED = 'liquidated',
  EXPIRED = 'expired'
}

// Margin call notification
interface MarginCallNotification {
  id: string;
  marginCallId: string;             // Reference to margin call
  userId: string;                   // User notified
  notificationType: string;         // How they were notified
  timestamp: Date;
  successful: boolean;              // If notification was delivered
  responseTimestamp?: Date;         // When user responded
}

// Response to margin call
interface MarginCallResponse {
  id: string;
  marginCallId: string;             // Reference to margin call
  userId: string;                   // User who responded
  walletAddress: string;            // Wallet address
  responseType: 'deposit' | 'withdrawal' | 'no_action';
  amount: number;                   // Amount deposited if any
  timestamp: Date;
  transactionHash?: string;         // Transaction hash if applicable
}

// Underwriter allocation to policies
interface PolicyAllocation {
  id: string;
  policyId: string;                 // Reference to policy
  poolId: string;                   // Reference to pool
  allocationPercentage: number;     // Percentage of policy allocated to this pool
  allocatedAmount: number;          // Amount allocated
  premiumShare: number;             // Share of premium
  potentialLiability: number;       // Maximum payout liability
  allocatedAt: Date;
}

#### Key Service Methods

```typescript
class CollateralService {
  // Create a new collateral pool
  async createCollateralPool(poolData: Partial<CollateralPool>): Promise<CollateralPool>;
  
  // Get pool by ID
  async getPoolById(poolId: string): Promise<CollateralPool | null>;
  
  // Deposit collateral to a pool
  async depositCollateral(userId: string, poolId: string, amount: number): Promise<PoolParticipant>;
  
  // Withdraw available collateral
  async withdrawCollateral(userId: string, poolId: string, amount: number): Promise<PoolParticipant>;
  
  // Get user's participation across all pools
  async getUserPoolParticipation(userId: string): Promise<PoolParticipant[]>;
  
  // Calculate user's collateral metrics
  async getUserCollateralMetrics(userId: string): Promise<CollateralMetrics>;
  
  // Trigger a margin call for a pool
  async triggerMarginCall(poolId: string, requiredCollateral: number): Promise<MarginCall>;
  
  // Respond to a margin call
  async respondToMarginCall(userId: string, marginCallId: string, amount: number): Promise<MarginCallResponse>;
  
  // Get active margin calls for a user
  async getUserActiveMarginCalls(userId: string): Promise<MarginCall[]>;
  
  // Allocate policy across pools
  async allocatePolicy(policyId: string, poolAllocations: { poolId: string, percentage: number }[]): Promise<PolicyAllocation[]>;
  
  // Get policy allocations
  async getPolicyAllocations(policyId: string): Promise<PolicyAllocation[]>;
  
  // Check health of all pools and trigger margin calls if needed
  async performHealthChecks(): Promise<HealthCheckSummary>;
  
  // Process expired margin calls for liquidation
  async processExpiredMarginCalls(): Promise<ProcessedMarginCalls>;
}

interface CollateralMetrics {
  totalDeposited: number;
  totalAllocated: number;
  availableCollateral: number;
  totalRewards: number;
  averageUtilization: number;
  activePools: number;
  activeMarginCalls: number;
  riskExposure: {
    byAsset: Record<string, number>;
    byRiskTier: Record<number, number>;
  };
}

interface HealthCheckSummary {
  poolsChecked: number;
  healthyPools: number;
  warningPools: number;
  criticalPools: number;
  marginCallsTriggered: number;
  totalCollateralDeficit: number;
}

interface ProcessedMarginCalls {
  processed: number;
  resolved: number;
  liquidated: number;
  affectedPolicies: number;
  totalLiquidated: number;
}
```

### 4. Risk Modeling and Analytics System

**Purpose:** Handles risk assessment, pricing models, and analytics for the platform.

#### Data Structures

```typescript
// Risk model configuration
interface RiskModel {
  id: string;
  name: string;
  description: string;
  modelType: string;                // Type of statistical model
  parameters: Record<string, any>;  // Model parameters
  assetTypes: string[];             // Asset types this model applies to
  policyTypes: string[];            // Policy types this model applies to
  version: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  status: 'active' | 'deprecated' | 'draft';
  validationResults: ModelValidation[];
  performanceMetrics: ModelPerformanceMetric[];
}

// Model validation result
interface ModelValidation {
  id: string;
  modelId: string;                  // Reference to risk model
  validationType: string;           // Type of validation performed
  datasetUsed: string;              // Dataset used for validation
  validationDate: Date;
  results: Record<string, any>;     // Validation metrics
  validatedBy: string;
  status: 'passed' | 'failed' | 'warning';
  notes: string;
}

// Model performance metric
interface ModelPerformanceMetric {
  id: string;
  modelId: string;                  // Reference to risk model
  metricName: string;               // Name of metric
  metricValue: number;              // Value of metric
  timestamp: Date;
  comparisonValue?: number;         // Previous or benchmark value
  trend: 'improving' | 'stable' | 'declining';
}

// Asset risk profile
interface AssetRiskProfile {
  id: string;
  assetTicker: string;              // Asset ticker
  currentTier: number;              // Current risk tier
  volatilityScore: number;          // Volatility metric
  liquidityScore: number;           // Liquidity metric
  marketCapScore: number;           // Market cap metric
  correlationScores: Record<string, number>; // Correlation with other assets
  historicalTiers: {                // History of tier assignments
    timestamp: Date;
    tier: number;
  }[];
  lastUpdated: Date;
  dataSource: string;               // Source of risk data
  confidenceLevel: number;          // Confidence in assessment
}

// Risk assessment for a specific policy
interface PolicyRiskAssessment {
  id: string;
  policyId: string;                 // Reference to policy
  modelId: string;                  // Model used for assessment
  riskScore: number;                // Overall risk score (0-100)
  confidenceInterval: number;       // Confidence interval
  componentScores: {                // Breakdown of risk components
    assetRisk: number;
    durationRisk: number;
    marketConditionRisk: number;
    coverageAmountRisk: number;
  };
  premiumCalculation: {             // Premium calculation breakdown
    basePremium: number;
    riskAdjustment: number;
    durationAdjustment: number;
    marketAdjustment: number;
    finalPremium: number;
  };
  timestamp: Date;
  recommendations: string[];
}

// Platform analytics
interface PlatformAnalytics {
  id: string;
  timestamp: Date;
  period: 'hourly' | 'daily' | 'weekly' | 'monthly';
  userMetrics: {
    totalUsers: number;
    activeUsers: number;
    newUsers: number;
    userRetention: number;
    usersByType: Record<UserType, number>;
  };
  policyMetrics: {
    totalPolicies: number;
    activePolicies: number;
    newPolicies: number;
    expiringPolicies: number;
    totalCoverage: number;
    totalPremium: number;
    conversionRate: number;
    policyDistribution: Record<string, number>; // By policy type
  };
  claimMetrics: {
    totalClaims: number;
    newClaims: number;
    approvalRate: number;
    averageSettlementTime: number;
    claimsByStatus: Record<ClaimStatus, number>;
    fraudDetectionRate: number;
  };
  financialMetrics: {
    totalTVL: number;
    collateralUtilization: number;
    platformRevenue: number;
    averageROI: number;
    liquidityMetrics: Record<string, number>;
  };
  riskMetrics: {
    systemHealthScore: number;
    averageCollateralRatio: number;
    marginCallFrequency: number;
    liquidationRate: number;
    riskTierDistribution: Record<number, number>;
  };
}

#### Key Service Methods

```typescript
class RiskModelingService {
  // Create a new risk model
  async createRiskModel(modelData: Partial<RiskModel>): Promise<RiskModel>;
  
  // Get risk model by ID
  async getRiskModelById(modelId: string): Promise<RiskModel | null>;
  
  // Update a risk model
  async updateRiskModel(modelId: string, updates: Partial<RiskModel>): Promise<RiskModel>;
  
  // Validate a risk model
  async validateModel(modelId: string, validationData: Partial<ModelValidation>): Promise<ModelValidation>;
  
  // Assess risk for a potential policy
  async assessPolicyRisk(
    policyType: string, 
    assetCovered: string, 
    coverageAmount: number, 
    durationBlocks: number
  ): Promise<PolicyRiskAssessment>;
  
  // Update asset risk profile
  async updateAssetRiskProfile(assetTicker: string, profileData: Partial<AssetRiskProfile>): Promise<AssetRiskProfile>;
  
  // Get asset risk profile
  async getAssetRiskProfile(assetTicker: string): Promise<AssetRiskProfile | null>;
  
  // Calculate premium for a policy
  async calculatePolicyPremium(
    policyType: string, 
    assetCovered: string, 
    coverageAmount: number, 
    durationBlocks: number
  ): Promise<number>;
  
  // Generate platform analytics
  async generatePlatformAnalytics(period: 'hourly' | 'daily' | 'weekly' | 'monthly'): Promise<PlatformAnalytics>;
  
  // Get historical platform analytics
  async getHistoricalAnalytics(
    startDate: Date, 
    endDate: Date, 
    period: 'hourly' | 'daily' | 'weekly' | 'monthly'
  ): Promise<PlatformAnalytics[]>;
  
  // Get risk metrics for a specific user
  async getUserRiskMetrics(userId: string): Promise<UserRiskMetrics>;
  
  // Calculate system health score
  async calculateSystemHealthScore(): Promise<number>;
  
  // Generate risk reports
  async generateRiskReport(parameters: RiskReportParameters): Promise<RiskReport>;
}

interface UserRiskMetrics {
  userId: string;
  exposureByAsset: Record<string, number>;
  exposureByRiskTier: Record<number, number>;
  portfolioConcentration: number;
  collateralizationRatio: number;
  historicalClaimRate: number;
  estimatedAnnualReturn: number;
  riskAdjustedReturn: number;
  recommendations: string[];
}

interface RiskReportParameters {
  reportType: 'system' | 'asset' | 'user' | 'policy';
  entityId?: string;
  startDate: Date;
  endDate: Date;
  includeMetrics: string[];
}

interface RiskReport {
  id: string;
  reportType: string;
  generatedAt: Date;
  parameters: RiskReportParameters;
  data: any;
  visualizations: ReportVisualization[];
  summary: string;
  recommendations: string[];
}

interface ReportVisualization {
  type: 'chart' | 'table' | 'heatmap' | 'gauge';
  title: string;
  description: string;
  data: any;
  config: Record<string, any>;
}
```

### 5. Oracle Integration System

**Purpose:** Manages interactions with external oracles, data validation, and verification for claims.

#### Data Structures

```typescript
// Oracle provider information
interface OracleProvider {
  id: string;
  name: string;
  walletAddress: string;           // On-chain address
  oracleContractAddress: string;   // Oracle smart contract address
  supportedDataTypes: string[];    // Types of data provided
  trustScore: number;              // Trust rating (0-100)
  responseTimeout: number;         // Timeout in blocks
  lastActiveTime: Date;
  verified: boolean;               // If provider is verified
  apiEndpoints: OracleEndpoint[];  // API endpoints for data
  performanceMetrics: OraclePerformanceMetrics;
  status: 'active' | 'suspended' | 'inactive';
}

// Oracle API endpoint
interface OracleEndpoint {
  id: string;
  oracleId: string;                // Reference to oracle provider
  endpointUrl: string;             // API endpoint URL
  dataType: string;                // Type of data provided
  requestFormat: any;              // Expected request format
  responseFormat: any;             // Expected response format
  authMethod: string;              // Authentication method
  rateLimits: {                    // Rate limiting info
    requestsPerMinute: number;
    requestsPerHour: number;
    concurrentRequests: number;
  };
  cost: number;                    // Cost per request (if any)
}

// Oracle performance metrics
interface OraclePerformanceMetrics {
  totalRequests: number;
  successfulResponses: number;
  failedResponses: number;
  averageResponseTime: number;     // In milliseconds
  uptime: number;                  // Percentage uptime
  accuracyScore: number;           // Accuracy rating
  disputeRate: number;             // Percentage of disputed results
  lastUpdated: Date;
}

// Price feed data
interface PriceFeed {
  id: string;
  asset: string;                   // Asset ticker
  currentPrice: number;            // Current price
  priceTimestamp: Date;            // Timestamp of price
  sourceOracle: string;            // Oracle provider ID
  updateFrequency: number;         // Update frequency in seconds
  historicalPrices: PricePoint[];  // Historical price data
  stats: {                         // Price statistics
    h24High: number;
    h24Low: number;
    h24Change: number;
    h24ChangePercentage: number;
    h24Volume: number;
    volatility: number;
  };
  marketData: {                    // Additional market data
    marketCap: number;
    circulatingSupply: number;
    totalSupply: number;
    lastTradeVolume: number;
  };
}

// Price data point
interface PricePoint {
  timestamp: Date;
  price: number;
  volume?: number;
}

// Oracle request
interface OracleRequest {
  id: string;
  requestId: number;               // On-chain request ID
  requester: string;               // Requester ID (user or system)
  oracleId: string;                // Oracle provider ID
  requestType: string;             // Type of request
  requestData: any;                // Request parameters
  responseData?: any;              // Response data if fulfilled
  requestTimestamp: Date;
  responseTimestamp?: Date;
  status: 'pending' | 'fulfilled' | 'expired' | 'failed';
  transactionHash?: string;        // Transaction hash if applicable
  retries: number;                 // Number of retry attempts
  cost: number;                    // Cost of this request
}

// Claim verification request
interface ClaimVerificationRequest {
  id: string;
  claimId: string;                 // Reference to claim
  oracleRequestId: string;         // Reference to oracle request
  verificationParameters: any;     // Parameters for verification
  requiredConfirmations: number;   // Number of confirmations needed
  currentConfirmations: number;    // Current confirmation count
  status: 'pending' | 'confirmed' | 'rejected' | 'disputed';
  createdAt: Date;
  completedAt?: Date;
  results: VerificationResult[];   // Verification results
}

#### Key Service Methods

```typescript
class OracleService {
  // Register a new oracle provider
  async registerOracleProvider(providerData: Partial<OracleProvider>): Promise<OracleProvider>;
  
  // Get oracle provider by ID
  async getOracleProviderById(providerId: string): Promise<OracleProvider | null>;
  
  // Update oracle provider details
  async updateOracleProvider(providerId: string, updates: Partial<OracleProvider>): Promise<OracleProvider>;
  
  // Add API endpoint to oracle
  async addOracleEndpoint(providerId: string, endpointData: Partial<OracleEndpoint>): Promise<OracleEndpoint>;
  
  // Get price feed for asset
  async getPriceFeed(asset: string): Promise<PriceFeed | null>;
  
  // Update price feed
  async updatePriceFeed(asset: string, price: number, timestamp: Date, sourceOracle: string): Promise<PriceFeed>;
  
  // Get historical prices
  async getHistoricalPrices(asset: string, startDate: Date, endDate: Date, interval: string): Promise<PricePoint[]>;
  
  // Create oracle request
  async createOracleRequest(
    requesterId: string,
    oracleId: string,
    requestType: string,
    requestData: any
  ): Promise<OracleRequest>;
  
  // Process oracle response
  async processOracleResponse(requestId: string, responseData: any): Promise<OracleRequest>;
  
  // Create claim verification request
  async createClaimVerificationRequest(
    claimId: string,
    verificationParameters: any,
    requiredConfirmations: number
  ): Promise<ClaimVerificationRequest>;
  
  // Record verification result
  async recordVerificationResult(
    verificationRequestId: string,
    oracleId: string,
    result: boolean,
    confidence: number,
    data: any
  ): Promise<ClaimVerificationRequest>;
  
  // Get verification status
  async getVerificationStatus(verificationRequestId: string): Promise<ClaimVerificationRequest>;
  
  // Calculate oracle performance metrics
  async calculateOraclePerformance(oracleId: string): Promise<OraclePerformanceMetrics>;
  
  // Find suitable oracles for verification
  async findSuitableOracles(dataType: string, minTrustScore: number): Promise<OracleProvider[]>;
}
```

### 6. Governance and Protocol Parameters System

**Purpose:** Manages governance proposals, voting, and protocol parameter updates.

#### Data Structures

```typescript
// Protocol parameter definition
interface ProtocolParameter {
  id: string;
  paramId: string;                 // On-chain parameter ID
  name: string;
  description: string;
  value: number | string | boolean;
  dataType: 'number' | 'string' | 'boolean';
  minValue?: number;
  maxValue?: number;
  updateRequiresVote: boolean;
  lastUpdatedBlock: number;
  lastUpdatedAt: Date;
  updatedBy: string;
  history: ParameterChange[];      // History of parameter changes
}

// Parameter change record
interface ParameterChange {
  timestamp: Date;
  previousValue: number | string | boolean;
  newValue: number | string | boolean;
  changedBy: string;
  proposalId?: string;            // If changed via proposal
  transactionHash?: string;       // Transaction hash if on-chain
}

// Governance proposal
interface GovernanceProposal {
  id: string;
  proposalId: number;             // On-chain proposal ID
  proposer: string;               // Proposer wallet address
  userId: string;                 // Off-chain user ID
  title: string;
  description: string;
  paramChanges: ParameterChange[];
  codeChanges?: CodeChange[];     // For protocol upgrades
  status: ProposalStatus;
  startBlock: number;
  endBlock: number;
  startDate: Date;
  endDate: Date;
  votesFor: number;
  votesAgainst: number;
  quorum: number;               // Required participation
  threshold: number;            // Required approval percentage
  executionBlock?: number;
  executionDate?: Date;
  discussions: ProposalDiscussion[];
}

// Code change for protocol upgrade
interface CodeChange {
  contractName: string;
  contractAddress: string;
  changeDescription: string;
  codeHash: string;               // Hash of code changes
  codeUrl: string;                // Link to view code changes
  securityAudit?: string;         // Security audit report URL
}

enum ProposalStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  ACTIVE = 'active',
  PASSED = 'passed',
  REJECTED = 'rejected',
  EXECUTED = 'executed',
  FAILED = 'failed'
}

// Discussion on proposal
interface ProposalDiscussion {
  id: string;
  proposalId: string;             // Reference to proposal
  userId: string;                 // User who posted
  content: string;
  timestamp: Date;
  parentId?: string;              // For threaded discussions
  reactions: {                    // Reaction counts
    like: number;
    dislike: number;
    insightful: number;
  };
}

// Voting power
interface VotingPower {
  id: string;
  userId: string;                 // Off-chain user ID
  walletAddress: string;          // Wallet address
  basePower: number;              // Base voting power
  delegatedPower: number;         // Power delegated from others
  delegationTarget?: string;      // Who they delegated to
  lastVoteBlock?: number;
  lastVoteDate?: Date;
  votingHistory: Vote[];
}

// Vote record
interface Vote {
  id: string;
  proposalId: string;             // Reference to proposal
  userId: string;                 // Voter's user ID
  walletAddress: string;          // Voter's wallet address
  voteAmount: number;             // Amount of voting power used
  voteDirection: boolean;         // True for yes, false for no
  voteBlock: number;
  voteDate: Date;
  transactionHash: string;
}
```

#### Key Service Methods

```typescript
class GovernanceService {
  // Create a new protocol parameter
  async createProtocolParameter(paramData: Partial<ProtocolParameter>): Promise<ProtocolParameter>;
  
  // Get parameter by ID
  async getParameterById(paramId: string): Promise<ProtocolParameter | null>;
  
  // Update protocol parameter (admin only)
  async updateProtocolParameter(
    paramId: string, 
    newValue: number | string | boolean, 
    updatedBy: string
  ): Promise<ProtocolParameter>;
  
  // Create governance proposal
  async createProposal(proposalData: Partial<GovernanceProposal>): Promise<GovernanceProposal>;
  
  // Get proposal by ID
  async getProposalById(proposalId: string): Promise<GovernanceProposal | null>;
  
  // Get active proposals
  async getActiveProposals(): Promise<GovernanceProposal[]>;
  
  // Cast vote on proposal
  async castVote(userId: string, proposalId: string, voteDirection: boolean): Promise<Vote>;
  
  // Get voting power for user
  async getUserVotingPower(userId: string): Promise<VotingPower>;
  
  // Delegate voting power
  async delegateVotingPower(userId: string, delegateId: string): Promise<VotingPower>;
  
  // Add discussion comment to proposal
  async addProposalDiscussion(
    userId: string, 
    proposalId: string, 
    content: string, 
    parentId?: string
  ): Promise<ProposalDiscussion>;
  
  // Execute passed proposal
  async executeProposal(proposalId: string): Promise<GovernanceProposal>;
  
  // Check proposal status and update if needed
  async updateProposalStatus(proposalId: string): Promise<GovernanceProposal>;
  
  // Get governance statistics
  async getGovernanceStats(): Promise<GovernanceStats>;
}

interface GovernanceStats {
  totalProposals: number;
  activeProposals: number;
  passedProposals: number;
  rejectedProposals: number;
  executedProposals: number;
  averageParticipation: number;
  topVoters: {
    userId: string;
    votingPower: number;
    participationRate: number;
  }[];
  parameterChangeFrequency: Record<string, number>;
}
```

### 7. Notification and Communication System

**Purpose:** Manages user notifications, alerts, and communication channels.

#### Data Structures

```typescript
// Notification
interface Notification {
  id: string;
  userId: string;                  // Recipient user ID
  type: NotificationType;          // Type of notification
  title: string;
  message: string;
  data: any;                       // Additional notification data
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'unread' | 'read' | 'archived';
  createdAt: Date;
  readAt?: Date;
  expiresAt?: Date;
  actions: NotificationAction[];    // Possible actions user can take
}

enum NotificationType {
  POLICY_CREATED = 'policy_created',
  POLICY_EXPIRING = 'policy_expiring',
  POLICY_EXPIRED = 'policy_expired',
  CLAIM_FILED = 'claim_filed',
  CLAIM_UPDATED = 'claim_updated',
  MARGIN_CALL = 'margin_call',
  COLLATERAL_LOW = 'collateral_low',
  GOVERNANCE_PROPOSAL = 'governance_proposal',
  VOTING_STARTED = 'voting_started',
  VOTING_ENDED = 'voting_ended',
  REWARD_EARNED = 'reward_earned',
  PRICE_ALERT = 'price_alert',
  SYSTEM_ANNOUNCEMENT = 'system_announcement'
}

// Notification action
interface NotificationAction {
  id: string;
  label: string;                   // Button/link text
  action: string;                  // Action identifier
  url?: string;                    // URL to navigate to
  data?: any;                      // Data for action
}

// Communication channel
interface CommunicationChannel {
  id: string;
  userId: string;                  // User ID
  type: 'email' | 'push' | 'sms' | 'in_app';
  value: string;                   // Email, device token, phone number
  verified: boolean;
  status: 'active' | 'disabled';
  lastUsed?: Date;
  lastVerified?: Date;
}

// Notification template
interface NotificationTemplate {
  id: string;
  type: NotificationType;
  title: string;
  messageTemplate: string;         // Template with placeholders
  defaultPriority: 'low' | 'medium' | 'high' | 'critical';
  availableChannels: string[];     // Channels this can be sent on
  defaultActions: Partial<NotificationAction>[];
  metadata: Record<string, any>;
}

// Notification delivery record
interface NotificationDelivery {
  id: string;
  notificationId: string;          // Reference to notification
  channelId: string;               // Reference to communication channel
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  deliveryAttempts: number;
  lastAttemptAt?: Date;
  deliveredAt?: Date;
  failureReason?: string;
  metadata: Record<string, any>;
}
```

#### Key Service Methods

```typescript
class NotificationService {
  // Create a new notification
  async createNotification(
    userId: string,
    type: NotificationType,
    data: any,
    options?: Partial<Notification>
  ): Promise<Notification>;
  
  // Get user notifications
  async getUserNotifications(
    userId: string, 
    options?: { status?: string, limit?: number, offset?: number }
  ): Promise<{ notifications: Notification[], total: number }>;
  
  // Mark notification as read
  async markNotificationRead(notificationId: string): Promise<Notification>;
  
  // Archive notification
  async archiveNotification(notificationId: string): Promise<Notification>;
  
  // Add communication channel
  async addCommunicationChannel(
    userId: string,
    type: string,
    value: string
  ): Promise<CommunicationChannel>;
  
  // Verify communication channel
  async verifyCommunicationChannel(
    channelId: string,
    verificationCode: string
  ): Promise<CommunicationChannel>;
  
  // Update user notification preferences
  async updateNotificationPreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences>;
  
  // Create notification template
  async createNotificationTemplate(
    templateData: Partial<NotificationTemplate>
  ): Promise<NotificationTemplate>;
  
  // Send notification via specific channels
  async sendNotification(
    notificationId: string,
    channelTypes: string[]
  ): Promise<NotificationDelivery[]>;
  
  // Get notification delivery status
  async getDeliveryStatus(notificationId: string): Promise<Record<string, string>>;
}
```

### 8. Blockchain Interaction and Transaction Management System

**Purpose:** Handles blockchain interactions, transaction submissions, and event monitoring.

#### Data Structures

```typescript
// Blockchain network configuration
interface BlockchainNetwork {
  id: string;
  name: string;
  networkType: 'mainnet' | 'testnet' | 'devnet';
  chainId: string;
  explorerUrl: string;
  rpcEndpoints: string[];
  websocketEndpoints: string[];
  apiEndpoints: string[];
  defaultGasPrice?: number;
  defaultGasLimit?: number;
  confirmationBlocks: number;
  status: 'active' | 'maintenance' | 'inactive';
}

// Smart contract configuration
interface SmartContract {
  id: string;
  name: string;
  address: string;
  networkId: string;               // Reference to blockchain network
  abi: any;                        // Contract ABI
  bytecode: string;
  version: string;
  deployedAt: Date;
  deploymentTxHash: string;
  owner: string;
  upgradeable: boolean;
  implementationAddress?: string;  // For proxy contracts
  sourceCodeUrl?: string;
  verifiedOnExplorer: boolean;
  status: 'active' | 'deprecated' | 'inactive';
}

// Transaction queue
interface TransactionQueue {
  id: string;
  userId?: string;                 // User ID if applicable
  systemInitiated: boolean;        // If system initiated this tx
  transactionType: string;
  contractId: string;              // Reference to contract
  methodName: string;
  methodParams: any[];
  nonce?: number;
  gasPrice?: number;
  gasLimit?: number;
  value?: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: TransactionStatus;
  submittedAt?: Date;
  minedAt?: Date;
  finalizedAt?: Date;
  txHash?: string;
  blockNumber?: number;
  receipt?: any;
  error?: string;
  retries: number;
  maxRetries: number;
}

enum TransactionStatus {
  PENDING = 'pending',
  SUBMITTED = 'submitted',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
  DROPPED = 'dropped',
  CANCELED = 'canceled'
}

// Blockchain event subscription
interface EventSubscription {
  id: string;
  contractId: string;              // Reference to contract
  eventName: string;
  filterParams: any;
  handlerType: 'webhook' | 'queue' | 'internal';
  handlerConfig: any;
  startBlock: number;
  lastProcessedBlock: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Processed blockchain event
interface ProcessedEvent {
  id: string;
  subscriptionId: string;          // Reference to subscription
  eventName: string;
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
  returnValues: any;
  processedAt: Date;
  handlerResponse?: any;
}
```

#### Key Service Methods

```typescript
class BlockchainService {
  // Initialize blockchain connection
  async initializeBlockchain(networkId: string): Promise<BlockchainNetwork>;
  
  // Add smart contract
  async addSmartContract(contractData: Partial<SmartContract>): Promise<SmartContract>;
  
  // Get contract by ID
  async getContractById(contractId: string): Promise<SmartContract | null>;
  
  // Call contract read method
  async callContractMethod(
    contractId: string,
    methodName: string,
    params: any[]
  ): Promise<any>;
  
  // Queue contract transaction
  async queueTransaction(
    contractId: string,
    methodName: string,
    params: any[],
    options?: TransactionOptions
  ): Promise<TransactionQueue>;
  
  // Get transaction status
  async getTransactionStatus(queueId: string): Promise<TransactionQueue>;
  
  // Submit pending transactions
  async submitPendingTransactions(): Promise<ProcessedTransactions>;
  
  // Add event subscription
  async addEventSubscription(
    contractId: string,
    eventName: string,
    filterParams: any,
    handlerConfig: any
  ): Promise<EventSubscription>;
  
  // Get processed events
  async getProcessedEvents(
    subscriptionId: string,
    options?: { startBlock: number, endBlock: number, limit: number }
  ): Promise<ProcessedEvent[]>;
  
  // Process blockchain events
  async processEvents(): Promise<ProcessedEvents>;
  
  // Retry failed transaction
  async retryTransaction(queueId: string): Promise<TransactionQueue>;
  
  // Cancel pending transaction
  async cancelTransaction(queueId: string): Promise<TransactionQueue>;
  
  // Get transaction history
  async getTransactionHistory(
    userId?: string,
    options?: { status: string, type: string, limit: number, offset: number }
  ): Promise<{ transactions: TransactionQueue[], total: number }>;
  
  // Estimate gas for transaction
  async estimateGas(
    contractId: string,
    methodName: string,
    params: any[]
  ): Promise<number>;
}

interface TransactionOptions {
  userId?: string;
  systemInitiated?: boolean;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  gasPrice?: number;
  gasLimit?: number;
  value?: number;
  nonce?: number;
  maxRetries?: number;
}

interface ProcessedTransactions {
  processed: number;
  submitted: number;
  confirmed: number;
  failed: number;
}

interface ProcessedEvents {
  processed: number;
  subscriptions: number;
  errors: number;
}
```

## Entity Relationships and Data Flow

### User Interaction Flow

1. **User Registration and Authentication**:
   - User creates account in `UserService`
   - Authentication handled via wallet connection or email/password
   - KYC verification processed if required

2. **Policy Creation**:
   - User selects policy type and parameters
   - `RiskModelingService` calculates premium and risk assessment
   - `PolicyService` creates off-chain policy record
   - `BlockchainService` submits transaction to create on-chain policy
   - System monitors transaction via `EventSubscription`
   - Once confirmed, `PolicyService` updates policy status

3. **Claim Processing**:
   - User files claim via `PolicyService`
   - `BlockchainService` submits on-chain claim transaction
   - `OracleService` creates verification request
   - Oracle providers submit verification results
   - Once verification threshold met, `BlockchainService` submits settlement transaction
   - `NotificationService` notifies user of claim status changes

4. **Underwriter Operations**:
   - Underwriter deposits collateral via `CollateralService`
   - `BlockchainService` submits collateral deposit transaction
   - `CollateralService` tracks pool participation and metrics
   - System monitors health factors and triggers margin calls if needed
   - `NotificationService` alerts underwriters of margin calls

5. **Governance Participation**:
   - User creates or votes on proposal via `GovernanceService`
   - `BlockchainService` submits on-chain vote transaction
   - System tracks proposal status and execution
   - Parameter changes applied after successful proposals

## Integration Points

### External API Integrations

1. **Market Data Providers**:
   ```typescript
   interface MarketDataProvider {
     id: string;
     name: string;
     apiEndpoint: string;
     apiKey: string;
     supportedAssets: string[];
     dataTypes: string[];
     updateFrequency: number;
     lastUpdate: Date;
     status: 'active' | 'inactive';
   }
   ```

2. **Analytics and Reporting Tools**:
   ```typescript
   interface AnalyticsIntegration {
     id: string;
     provider: string;
     apiKey: string;
     trackingId: string;
     dataShared: string[];
     status: 'active' | 'inactive';
   }
   ```

3. **Notification Providers**:
   ```typescript
   interface NotificationProvider {
     id: string;
     providerType: 'email' | 'push' | 'sms';
     apiEndpoint: string;
     apiKey: string;
     configOptions: Record<string, any>;
     status: 'active' | 'inactive';
   }
   ```

### Blockchain Event Handling

1. **Event Mapping**:
   ```typescript
   const eventHandlerMap = {
     PolicyCreated: handlePolicyCreated,
     PolicyUpdated: handlePolicyUpdated,
     ClaimFiled: handleClaimFiled,
     ClaimSettled: handleClaimSettled,
     CollateralDeposited: handleCollateralDeposited,
     MarginCallTriggered: handleMarginCallTriggered,
     // ...additional events
   };
   ```

2. **Event Processors**:
   ```typescript
   async function handlePolicyCreated(event: ProcessedEvent): Promise<void> {
     const { policyId, owner, policyType, coverageAmount } = event.returnValues;
     
     // Create off-chain policy record
     await policyService.createOrUpdatePolicyFromEvent(policyId, {
       owner,
       policyType,
       coverageAmount,
       status: PolicyStatus.ACTIVE
     });
     
     // Create notifications
     await notificationService.createNotification(
       getUserIdByWallet(owner),
       NotificationType.POLICY_CREATED,
       { policyId }
     );
     
     // Update analytics
     await analyticsService.trackEvent('policy_created', {
       policyId,
       policyType,
       coverageAmount
     });
   }
   ```

## Data Security and Access Control

1. **Role-Based Access Control**:
   ```typescript
   enum UserRole {
     USER = 'user',
     UNDERWRITER = 'underwriter',
     ORACLE_PROVIDER = 'oracle_provider',
     ADMIN = 'admin',
     SUPER_ADMIN = 'super_admin'
   }
   
   interface Permission {
     id: string;
     name: string;
     description: string;
     resources: string[];
     actions: string[];
   }
   
   interface RolePermission {
     roleId: UserRole;
     permissionId: string;
   }
   ```

2. **Data Encryption**:
   ```typescript
   interface EncryptedField {
     iv: string;        // Initialization vector
     data: string;      // Encrypted data
     tag?: string;      // Authentication tag
     algorithm: string; // Encryption algorithm used
   }
   
   // Example user with encrypted fields
   interface SecureUser extends User {
     email: EncryptedField;
     kycData: EncryptedField;
   }
   ```

3. **Audit Logging**:
   ```typescript
   interface AuditLog {
     id: string;
     userId: string;
     action: string;
     resource: string;
     resourceId: string;
     oldValue?: any;
     newValue?: any;
     ipAddress: string;
     userAgent: string;
     timestamp: Date;
   }
   ```

## Conclusion

This off-chain data model specification provides a comprehensive blueprint for implementing the BitHedge DeFi platform using TypeScript. The model defines all necessary data structures, relationships, and services required to support the platform's operations, user interactions, and integration with on-chain smart contracts.

The off-chain components handle the user interface, business logic, risk modeling, and administrative functions while seamlessly interfacing with the on-chain components for core financial operations. This hybrid approach allows for the best of both worlds: the security and trustlessness of blockchain technology combined with the flexibility and performance of traditional web applications.




