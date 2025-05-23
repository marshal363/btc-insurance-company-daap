"use client";

import {
  Box,
  Flex,
  Text,
  Heading,
  Button,
  Badge,
  Icon,
  SimpleGrid,
  HStack,
  List,
  ListItem,
  ListIcon,
  Divider,
  Grid,
  GridItem,
  VStack,
  useToast,
  Collapse,
} from "@chakra-ui/react";
import {
  IoLockClosed,
  IoCheckmarkCircle,
  IoInformationCircleOutline,
  IoShieldCheckmark,
  IoCashOutline,
  IoSaveOutline,
  IoWarningOutline,
  IoAlertCircleOutline,
} from "react-icons/io5";
import { useBuyerContext } from "@/contexts/BuyerContext";
import { useMutation, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useState, useContext } from "react";
import { ValidationError } from "@/components/common/ValidationError";
import CalculationLoader from "@/components/common/CalculationLoader";
import { useBuyerQuote } from "@/hooks/useBuyerQuote";
import type { BuyerPremiumQuoteResult } from "@/../../convex/types";

// --- Wallet and Stacks Imports (BF-103) ---
import HiroWalletContext from "@/components/HiroWalletProvider";
import { useDevnetWallet } from "@/lib/devnet-wallet-context";
import {
  isDevnetEnvironment,
  isTestnetEnvironment,
  executeContractCall,
  openContractCall,
} from "@/lib/contract-utils"; 
import type { ContractCallRegularOptions, FinishedTxData } from "@stacks/connect";
import { STACKS_MAINNET, STACKS_TESTNET, STACKS_DEVNET, StacksNetwork } from "@stacks/network";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { api as ApiType } from "@/../../convex/_generated/api";

// Mock functions removed

// --- Import TransactionContext ---
import { useTransactionContext, TransactionUiStatus } from "@/contexts/TransactionContext";

const formatCurrency = (value: number | null | undefined, placeholder: string = '$--.--') => {
  if (value === null || value === undefined || isNaN(value)) {
    return placeholder;
  }
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatPercentage = (value: number | null | undefined, placeholder: string = '--.--%') => {
  if (value === null || value === undefined || isNaN(value)) {
    return placeholder;
  }
  return `${(value * 100).toFixed(2)}%`;
};

export default function BuyerPolicySummary() {
  const { accurateQuote: buyerQuoteResult } = useBuyerContext();
  const { isLoading: isBuyerLoading, error: buyerError } = useBuyerQuote();

  const toast = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [savedQuoteId, setSavedQuoteId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // --- Use TransactionContext ---
  const {
    activeConvexId,
    blockchainTxId,
    uiStatus: transactionUiStatus,
    errorDetails: transactionErrorDetails,
    initiateTransaction,
    handleWalletSubmission,
    handleBackendError,
    handleWalletError,
    handleSuccess,
    setUiStatus,
  } = useTransactionContext();

  const isActivatingProtection = 
    transactionUiStatus === TransactionUiStatus.PREPARING_BACKEND ||
    transactionUiStatus === TransactionUiStatus.AWAITING_WALLET_ACTION ||
    transactionUiStatus === TransactionUiStatus.SUBMITTING_TO_CHAIN ||
    transactionUiStatus === TransactionUiStatus.PENDING_CONFIRMATION;

  const isLoading = isBuyerLoading;
  const quoteData = buyerQuoteResult;
  const error = buyerError;

  const buyerQuoteData = quoteData as BuyerPremiumQuoteResult | null;

  const premiumUSD = buyerQuoteData?.premium;
  const premiumSTX = premiumUSD ? premiumUSD / 0.45 : undefined;
  const percentRate = buyerQuoteData?.premiumPercentage;
  const apyEquivalent = percentRate && buyerQuoteData?.inputs?.expirationDays
    ? percentRate * (365 / buyerQuoteData.inputs.expirationDays)
    : undefined;
  const protectionAmountBTC = buyerQuoteData?.inputs?.protectionAmount;
  const protectedValueUSD = buyerQuoteData?.inputs?.protectedValueUSD;
  const protectionPeriod = buyerQuoteData?.inputs?.expirationDays;
  const protectionPercentage = buyerQuoteData?.inputs?.protectedValuePercentage;
  const btcAmount = protectionAmountBTC;
  const breakEvenPrice = buyerQuoteData?.breakEvenPrice;
  const marketPriceAtQuote = buyerQuoteData?.marketDataSnapshot?.btcPrice;

  const currentDate = new Date();
  const expiryDate = protectionPeriod ? new Date(currentDate.getTime() + protectionPeriod * 24 * 60 * 60 * 1000) : undefined;

  const neumorphicBg = "#E8EAE9";
  const neumorphicShadowLight = "-10px -10px 20px rgba(255, 255, 255, 0.8)";
  const neumorphicShadowDark = "10px 10px 20px rgba(163, 177, 198, 0.6)";
  const neumorphicBoxShadow = `${neumorphicShadowLight}, ${neumorphicShadowDark}`;
  const neumorphicBorderRadius = "xl";

  const saveQuoteMutation = useMutation(api.quotes.saveQuote);
  const finalizeQuoteMutation = useMutation(api.quotes.finalizeQuote);
  const preparePolicyCreationPackageAction = useAction(api.policyRegistry.transactionPreparation.preparePolicyCreationPackage);
  const updateTransactionStatusMutation = useMutation(api.transactions.updateTransactionStatus);

  // Wallet Contexts (BF-103)
  const { mainnetAddress, testnetAddress, isWalletConnected: isHiroWalletConnected } = useContext(HiroWalletContext);
  const { currentWallet: devnetWallet } = useDevnetWallet();

  const handleSaveQuote = async () => {
    if (!buyerQuoteData) {
      toast({
        title: "Cannot Save Quote",
        description: "No valid buyer quote data available to save.",
        status: "warning",
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSavedQuoteId(null);

    try {
      const displayName = `BTC Protection ${protectionAmountBTC ?? 'N/A'} BTC / ${protectionPeriod ?? 'N/A'} Days`;

      const result = await saveQuoteMutation({
        quoteType: "buyer",
        asset: "BTC",
        calculationResult: buyerQuoteData,
        metadata: {
          displayName: displayName,
          notes: "",
          tags: ["protection", "btc", `period-${protectionPeriod ?? 'unknown'}`],
        },
      });

      setSavedQuoteId(result.id);
      toast({
        title: "Quote Saved",
        description: `Your protection quote (${displayName}) has been saved.`,
        status: "success",
        duration: 5000,
        isClosable: true,
      });
    } catch (err) {
      console.error("Error saving quote:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to save quote. Please try again.";
      setSaveError(errorMessage);
      toast({
        title: "Save Failed",
        description: errorMessage,
        status: "error",
        duration: 7000,
        isClosable: true,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleActivateProtection = async () => {
    if (!buyerQuoteData) {
      toast({
        title: "Cannot Activate Protection",
        description: "No valid buyer quote data available.",
        status: "warning",
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    if (!savedQuoteId) {
      toast({
        title: "Quote Not Saved",
        description: "Please save the quote before activating protection. The saved quote details will be used for the transaction.",
        status: "warning",
        duration: 7000,
        isClosable: true,
      });
      return;
    }

    const currentStacksNetwork = isDevnetEnvironment() ? "devnet" : isTestnetEnvironment() ? "testnet" : "mainnet";
    let currentWalletAddress: string | undefined | null = null;

    if (currentStacksNetwork === "devnet") {
      currentWalletAddress = devnetWallet?.stxAddress;
    } else {
      currentWalletAddress = isTestnetEnvironment() ? testnetAddress : mainnetAddress;
      if (!isHiroWalletConnected) {
         toast({
          title: "Wallet Not Connected",
          description: "Please connect your Hiro wallet to activate protection.",
          status: "warning",
          duration: 5000,
          isClosable: true,
        });
        return;
      }
    }
    if (!currentWalletAddress) {
      toast({
        title: "Wallet Address Not Found",
        description: "Could not determine your wallet address. Please ensure your wallet is connected correctly.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    let actualConvexTransactionId: Id<"transactions"> | null = null;
    let actualContractCallParams: ContractCallRegularOptions | null = null;

    toast({
      title: "Activation Initiated",
      description: "Preparing your policy activation...",
      status: "info",
      duration: null, 
      id: "activation-process", 
    });

    try {
      toast.update("activation-process", {
        title: "Step 1/5: Finalizing Quote",
        description: "Locking in your quote details with the server...",
        status: "loading",
      });
      
      const finalizeResult = await finalizeQuoteMutation({ quoteId: savedQuoteId as Id<"quotes">, lockForTransaction: true });
      if (!finalizeResult || (finalizeResult as any).error) {
        const errorMsg = (finalizeResult as any)?.error || "Failed to finalize quote on the backend.";
        throw new Error(errorMsg);
      }
      
      toast.update("activation-process", {
          title: "Step 1/5: Quote Finalized",
          status: "success",
          duration: 2000,
      });

      toast.update("activation-process", {
        title: "Step 2/5: Preparing Transaction",
        description: "Requesting transaction details from the server... (This may take a moment)",
        status: "loading",
      });

      const preparationResult = await preparePolicyCreationPackageAction({ 
        quoteId: savedQuoteId as Id<"quotes">,
        userStxAddress: currentWalletAddress,
        networkUsed: currentStacksNetwork,
      });

      if (!preparationResult || (preparationResult as any).error || !preparationResult.newTransactionId || !preparationResult.contractCallParameters) {
        const errorMsg = (preparationResult as any)?.error || "Failed to prepare transaction package from backend.";
        console.error("Transaction preparation error details:", preparationResult);
        throw new Error(errorMsg);
      }
      
      actualConvexTransactionId = preparationResult.newTransactionId;
      actualContractCallParams = preparationResult.contractCallParameters as ContractCallRegularOptions; 
      
      if (actualConvexTransactionId) {
        initiateTransaction(actualConvexTransactionId); 
        setUiStatus(TransactionUiStatus.AWAITING_WALLET_ACTION);
      } else {
        throw new Error("Failed to retrieve a valid transaction ID from backend preparation.");
      }

      toast.update("activation-process", {
          title: "Step 2/5: Transaction Prepared",
          description: `Backend prepared transaction. Ready for wallet.`,
          status: "success",
          duration: 2000,
      }); 

      if (actualContractCallParams && typeof actualContractCallParams.network === 'string') {
        const networkString = (actualContractCallParams.network as string).toLowerCase();
        if (networkString === 'mainnet') actualContractCallParams.network = STACKS_MAINNET;
        else if (networkString === 'testnet') actualContractCallParams.network = STACKS_TESTNET;
        else if (networkString === 'devnet') actualContractCallParams.network = STACKS_DEVNET;
        else {
            console.warn(`Unknown network string '${actualContractCallParams.network}' from backend. Defaulting to STACKS_DEVNET as per currentStacksNetwork variable.`);
            actualContractCallParams.network = STACKS_DEVNET;
        }
      }

      toast.update("activation-process", {
        title: "Step 3/5: Awaiting Wallet Signature",
        description: "Please check your Stacks wallet to approve the transaction.",
        status: "loading", 
      });

      let submittedTxId: string | null = null;
      try {
        if (!actualContractCallParams) {
          throw new Error("Contract call parameters are missing or invalid after preparation and network conversion.");
        }
        
        const contractCallOptionsForWallet: ContractCallRegularOptions = actualContractCallParams;

        if (currentStacksNetwork === "devnet") {
          if (!devnetWallet) throw new Error("Devnet wallet not found for signing.");
          const devnetResult = await executeContractCall(contractCallOptionsForWallet, devnetWallet);
          submittedTxId = devnetResult.txid;
        } else {
          const result = await openContractCall({
            ...contractCallOptionsForWallet,
            onFinish: (data: FinishedTxData) => {
            },
            onCancel: () => {
            },
          });
          submittedTxId = result.txid;
        }

        if (!submittedTxId) {
          throw new Error("Transaction ID not received after wallet interaction.");
        }
        handleWalletSubmission(submittedTxId); 
        
        toast.update("activation-process", {
          title: "Step 3/5: Transaction Signed & Submitted!",
          description: `Blockchain TxID: ${submittedTxId.substring(0, 15)}...`, 
          status: "success",
          duration: 3000,
        });

      } catch (walletError) {
        console.error("Wallet interaction error:", walletError);
        const message = walletError instanceof Error ? walletError.message : "Wallet interaction failed.";
        handleWalletError(message);
        toast.update("activation-process", {
          title: "Step 3/5: Wallet Interaction Failed",
          description: message,
          status: "error",
          duration: 7000,
          isClosable: true,
        });
        throw walletError; 
      }
      
      toast.update("activation-process", {
        title: "Step 4/5: Syncing with Backend", 
        description: `Submitting TxID ${blockchainTxId || submittedTxId?.substring(0,15)}... to backend.`, 
        status: "loading", 
      });
      
      if (actualConvexTransactionId && (blockchainTxId || submittedTxId)) {
        try {
          const backendTxIdToUpdateWith = blockchainTxId || submittedTxId;
          if (!backendTxIdToUpdateWith) {
            throw new Error("Blockchain transaction ID is missing for backend update.");
          }

          console.log(`Calling updateTransactionStatus: convexTxId=${actualConvexTransactionId}, blockchainTxHash=${backendTxIdToUpdateWith}`);
          await updateTransactionStatusMutation({
            transactionId: actualConvexTransactionId,
            newStatus: "SUBMITTED",
            txHash: backendTxIdToUpdateWith,
          });

          toast.update("activation-process", {
            title: "Step 4/5: Backend Synced",
            description: "Backend updated with blockchain transaction. Waiting for on-chain confirmation.",
            status: "loading",
          });

        } catch (backendUpdateError) {
          console.error("Backend update failed after wallet submission:", backendUpdateError);
          const errorMsg = backendUpdateError instanceof Error ? backendUpdateError.message : "Failed to update backend with transaction hash.";
          handleBackendError(`Backend sync error: ${errorMsg}`);
          throw new Error(`Backend sync error: ${errorMsg}`);
        }
      } else {
        console.warn("Cannot update backend: Missing Convex transaction ID or blockchain transaction ID.");
      }

      console.log(`BF-105: TransactionContext is now polling for Convex ID: ${actualConvexTransactionId}. Current UI status from context: ${transactionUiStatus}`);

    } catch (err) {
      console.error("Error activating protection:", err);
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred during activation.";
      if (transactionUiStatus !== TransactionUiStatus.ERROR_WALLET) { 
        handleBackendError(errorMessage); 
      }
      
      toast.update("activation-process", {
          title: "Activation Failed",
          description: errorMessage,
          status: "error",
          duration: 7000,
          isClosable: true,
      });
    }
  };

  if (isLoading) {
    return <CalculationLoader isLoading={true} text="Fetching latest quote..." />;
  }

  if (error && !quoteData) {
    return (
       <Box p={6} borderRadius={neumorphicBorderRadius} bg={neumorphicBg} boxShadow={neumorphicBoxShadow} textAlign="center">
         <Icon as={IoWarningOutline} w={10} h={10} color="orange.500" mb={3} />
         <Heading as="h3" size="md" color="orange.700" mb={2}>Calculation Error</Heading>
         <Text color="gray.600" mb={4}>Could not fetch the latest quote details.</Text>
         <ValidationError message={error} showAsAlert={true} />
       </Box>
     );
  }

  if (!quoteData && !isLoading && !error) {
     return (
       <Box p={6} borderRadius={neumorphicBorderRadius} bg={neumorphicBg} boxShadow={neumorphicBoxShadow} textAlign="center">
         <Icon as={IoInformationCircleOutline} w={10} h={10} color="blue.500" mb={3} />
         <Heading as="h3" size="md" color="blue.700" mb={2}>Enter Parameters</Heading>
         <Text color="gray.600">Adjust the parameters above to generate a protection quote.</Text>
       </Box>
     );
   }

  return (
    <Box>
      <Heading as="h2" fontSize="2xl" fontWeight="bold" mb={4} color="gray.800">
        Policy Review
      </Heading>
      <Text mb={6} color="gray.700">
        Review your protection policy details before confirmation.
      </Text>
      
      <Box 
        bg={neumorphicBg}
        borderRadius={neumorphicBorderRadius}
        boxShadow={neumorphicBoxShadow}
        overflow="hidden"
        mb={6}
        p={6}
      >
        <Heading as="h3" fontSize="lg" fontWeight="bold" mb={6} color="gray.800">
          Protection Summary
        </Heading>
        
        <Grid templateColumns={{ base: "1fr", md: "3fr 2fr" }} gap={8}>
          <GridItem>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={5} mb={6}>
              <Box p={4} bg="transparent" borderRadius={neumorphicBorderRadius} boxShadow="inner" borderWidth="1px" borderColor="rgba(0,0,0,0.05)">
                <Text color="gray.600" fontSize="sm" mb={1}>Protection Amount</Text>
                <Heading as="h4" size="md" fontWeight="semibold" color="gray.800">
                  {btcAmount ?? '--.--'} BTC
                </Heading>
                <Text fontSize="xs" color="gray.500" mt={1}>
                   {formatCurrency(marketPriceAtQuote ? (btcAmount ?? 0) * marketPriceAtQuote : undefined, '$--.--')} Estimated Value
                 </Text>
              </Box>
              <Box p={4} bg="transparent" borderRadius={neumorphicBorderRadius} boxShadow="inner" borderWidth="1px" borderColor="rgba(0,0,0,0.05)">
                <Text color="gray.600" fontSize="sm" mb={1}>Protected Value (Strike)</Text>
                <Heading as="h4" size="md" fontWeight="semibold" color="gray.800">
                  {formatCurrency(protectedValueUSD)}
                </Heading>
                 <Text fontSize="xs" color="gray.500" mt={1}>
                   ({protectionPercentage ?? '--'}% of market price at quote)
                 </Text>
              </Box>
              <Box p={4} bg="transparent" borderRadius={neumorphicBorderRadius} boxShadow="inner" borderWidth="1px" borderColor="rgba(0,0,0,0.05)">
                <Text color="gray.600" fontSize="sm" mb={1}>Protection Period</Text>
                <Heading as="h4" size="md" fontWeight="semibold" color="gray.800">
                  {protectionPeriod ?? '--'} days
                </Heading>
                 <Text fontSize="xs" color="gray.500" mt={1}>
                   Expires ~{expiryDate ? expiryDate.toLocaleDateString() : 'N/A'}
                 </Text>
              </Box>
              <Box p={4} bg="transparent" borderRadius={neumorphicBorderRadius} boxShadow="inner" borderWidth="1px" borderColor="rgba(0,0,0,0.05)">
                <Text color="gray.600" fontSize="sm" mb={1}>Est. Annualized Rate</Text>
                <Heading as="h4" size="md" fontWeight="semibold" color="gray.800">
                   {formatPercentage(apyEquivalent)}
                </Heading>
                 <Text fontSize="xs" color="gray.500" mt={1}>Based on premium</Text>
              </Box>
            </SimpleGrid>

            <List spacing={3} color="gray.700">
              <ListItem>
                <Flex>
                  <ListIcon as={IoCheckmarkCircle} color="green.500" mt={1} />
                   <Text fontSize="sm">Protection activates if BTC price drops below {formatCurrency(protectedValueUSD)}.</Text>
                </Flex>
              </ListItem>
               <ListItem>
                 <Flex>
                   <ListIcon as={IoInformationCircleOutline} color="blue.500" mt={1} />
                    <Text fontSize="sm">Break-even price: {formatCurrency(breakEvenPrice)} (strike price minus premium).</Text>
                 </Flex>
               </ListItem>
               <ListItem>
                 <Flex>
                   <ListIcon as={IoAlertCircleOutline} color="orange.500" mt={1} />
                   <Text fontSize="sm">This quote is valid for a limited time and based on market data from {buyerQuoteData?.marketDataSnapshot?.timestamp ? new Date(buyerQuoteData.marketDataSnapshot.timestamp).toLocaleTimeString() : 'N/A'}.</Text>
                 </Flex>
               </ListItem>
            </List>
          </GridItem>

          <GridItem>
            <Box
              bg="blue.600"
              bgGradient="linear(to-b, blue.600, blue.700)"
              color="white"
              borderRadius="lg"
              overflow="hidden"
              h="100%"
              display="flex"
              flexDirection="column"
              shadow="md"
            >
              <Flex 
                align="center" 
                justify="space-between" 
                borderBottomWidth="1px" 
                borderColor="blue.500"
                px={4} 
                py={3}
                bg="rgba(0,0,0,0.1)"
              >
                <Flex align="center" gap={2}>
                  <Icon as={IoShieldCheckmark} />
                  <Heading as="h3" size="sm" fontWeight="semibold">
                    Protection Premium
                  </Heading>
                </Flex>
                <Badge colorScheme="whiteAlpha" variant="subtle" px={2} py={0.5} fontSize="xs">
                  Cost
                </Badge>
              </Flex>
              
              <VStack p={4} flex="1" spacing={4} align="stretch">
                <VStack spacing={1} align="center">
                  <HStack justify="center" align="baseline" spacing={2}>
                    <Heading as="h3" size="xl" fontWeight="bold">
                      {formatCurrency(premiumUSD)}
                    </Heading>
                     <Badge
                       bg="yellow.400"
                       color="black"
                       px={3} py={1}
                       borderRadius="full"
                       fontSize="xs"
                       alignSelf="center"
                     >
                       YOU PAY
                     </Badge>
                  </HStack>
                  <Text fontSize="sm" color="blue.200" lineHeight="tight">
                     (~{formatCurrency(premiumSTX, '---.-- STX')}) / {formatPercentage(percentRate)} rate
                  </Text>
                </VStack>
                
                <Flex 
                  align="center" 
                  justify="center" 
                  py={2} px={3} 
                  bg="rgba(0,0,0,0.1)" 
                  borderRadius="lg"
                >
                  <Icon as={IoCashOutline} mr={2} />
                  <Text fontSize="xs" fontWeight="medium">
                    Protects {btcAmount ?? '--'} BTC for {protectionPeriod ?? '--'} days
                  </Text>
                </Flex>
                
                <Divider borderColor="blue.500" opacity={0.5} />
                
                <Box textAlign="center">
                   <Text fontSize="xs" color="blue.200">
                     Premium Breakdown (Example)
                   </Text>
                   <Text fontSize="sm" fontStyle="italic" mt={1}>
                      (Breakdown visualization coming soon)
                   </Text>
                 </Box>
              </VStack>
            </Box>
          </GridItem>
        </Grid>
      </Box>

      <Flex justify="space-between" align="center" gap={4} mt={8}>
         <Flex direction="column" align="start">
            <Button
              leftIcon={<Icon as={IoSaveOutline} />}
              onClick={handleSaveQuote}
              isLoading={isSaving}
              isDisabled={!buyerQuoteData || isSaving || !!savedQuoteId}
              colorScheme="gray"
              variant="outline"
              size="sm"
            >
               {savedQuoteId ? "Quote Saved" : "Save Quote"}
             </Button>
             <Collapse in={!!saveError} animateOpacity>
               <Text fontSize="xs" color="red.500" mt={1}>{saveError}</Text>
             </Collapse>
                <Collapse in={!!savedQuoteId} animateOpacity>
                 <Text fontSize="xs" color="green.600" mt={1}>Saved ID: {savedQuoteId?.substring(0, 8)}...</Text>
               </Collapse>
            </Flex>

         <Button
           leftIcon={<Icon as={IoLockClosed} />}
           colorScheme="blue"
           size="lg"
           onClick={handleActivateProtection}
           isLoading={isActivatingProtection}
           isDisabled={isLoading || !!error || !quoteData || isSaving || isActivatingProtection 
            }
           minWidth="200px"
         >
           {isActivatingProtection ? "Activating..." : "Activate Protection"}
         </Button>
       </Flex>
       <Collapse in={!!transactionErrorDetails} animateOpacity>
        <Flex justify="flex-end" mt={1}>
            <Text fontSize="xs" color="red.500" textAlign="right">
                {transactionErrorDetails}
            </Text>
        </Flex>
        </Collapse>
    </Box>
  );
} 