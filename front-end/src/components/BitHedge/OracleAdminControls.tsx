import { useContext, useState } from "react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  NumberInput,
  NumberInputField,
  useToast
} from "@chakra-ui/react";
import HiroWalletContext from "../HiroWalletProvider";
import { useDevnetWallet } from "@/lib/devnet-wallet-context";
import {
  isDevnetEnvironment,
  isTestnetEnvironment
} from "@/lib/contract-utils";
import useTransactionExecuter from "@/hooks/useTransactionExecuter";
import { getSetAggregatedPriceTx } from "@/lib/oracle-utils";
import { getStacksNetworkString } from "@/lib/stacks-api";

interface OracleAdminControlsProps {
  isAuthorizedSubmitter: boolean;
  onPriceUpdate: () => void;
}

export default function OracleAdminControls({
  isAuthorizedSubmitter,
  onPriceUpdate
}: OracleAdminControlsProps) {
  const { mainnetAddress, testnetAddress } = useContext(HiroWalletContext);
  const { currentWallet: devnetWallet } = useDevnetWallet();
  const currentWalletAddress = isDevnetEnvironment()
    ? devnetWallet?.stxAddress
    : isTestnetEnvironment()
    ? testnetAddress
    : mainnetAddress;

  const executeTx = useTransactionExecuter();
  const toast = useToast();

  const [price, setPrice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUpdatePrice = async () => {
    if (!price) {
      toast({
        title: "Error",
        description: "Please enter a price",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    if (!currentWalletAddress) {
      toast({
        title: "Error",
        description: "Wallet not connected",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Convert USD price to scaled integer (e.g., using 10^8)
      const priceScaled = Math.round(parseFloat(price) * 100000000);

      const txOptions = getSetAggregatedPriceTx(
        getStacksNetworkString(),
        currentWalletAddress,
        priceScaled
      );

      await executeTx(
        txOptions,
        devnetWallet,
        "Price update was submitted",
        "Price update failed"
      );

      // Clear form and trigger refresh
      setPrice("");
      onPriceUpdate();
    } catch (error) {
      console.error("Error submitting price:", error);
      toast({
        title: "Error",
        description: "Failed to submit price update",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAuthorizedSubmitter) {
    return null;
  }

  return (
    <Alert mb="4" colorScheme="blue">
      <Box w="100%">
        <AlertTitle mb="2">Oracle Administration</AlertTitle>
        <AlertDescription>
          <Flex direction="column" gap="2">
            <Box mb="2">
              As an authorized submitter, you can update the Bitcoin price data on-chain.
            </Box>
            
            <FormControl>
              <FormLabel>Current BTC Price (USD)</FormLabel>
              <NumberInput
                bg="white"
                min={1}
                value={price}
                onChange={setPrice}
                mb="3"
              >
                <NumberInputField
                  placeholder="Enter current BTC price"
                  textAlign="left"
                  fontSize="lg"
                />
              </NumberInput>

              <Button
                colorScheme="blue"
                onClick={handleUpdatePrice}
                isDisabled={!price || isSubmitting}
                isLoading={isSubmitting}
                mb="2"
              >
                Submit Price Update
              </Button>
            </FormControl>
          </Flex>
        </AlertDescription>
      </Box>
    </Alert>
  );
} 