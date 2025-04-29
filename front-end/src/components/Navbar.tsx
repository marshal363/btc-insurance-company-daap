"use client";

import { Box, Container, Flex, Link, Image, Button } from "@chakra-ui/react";
import { isDevnetEnvironment } from "@/lib/contract-utils";
import { useDevnetWallet } from "@/lib/devnet-wallet-context";
import { DevnetWalletButton } from "./DevnetWalletButton";
import { ConnectWalletButton } from "./ConnectWallet";

export const Navbar = () => {
  const { currentWallet, wallets, setCurrentWallet } = useDevnetWallet();

  return (
    <Box
      as="nav"
      boxShadow="sm"
      position="sticky"
      top="0"
      zIndex="sticky"
      sx={{
        backdropFilter: 'blur(10px)',
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
      }}
    >
      <Container maxW="5xl">
        <Flex justify="space-between" h={16} align="center">
          <Flex align="center">
            <Image
              src="/Bitcoin_Écusson_Élégant-removebg-preview.png"
              alt="BitHedge Logo"
              boxSize="52px"
              objectFit="contain"
              mr={2}
            />
            <Link href="/" textDecoration="none" _hover={{ textDecoration: 'none' }}>
              <Box fontSize="lg" fontWeight="bold" color="gray.900" ml={2}>
                Bithedge
              </Box>
            </Link>
          </Flex>
          <Flex align="center" gap={4}>
            {/* Dashboard Link */}
            <Link href="/dashboard" _hover={{ textDecoration: 'none' }}>
              <Button variant="ghost" colorScheme="gray" size="sm">
                Dashboard
              </Button>
            </Link>
            {isDevnetEnvironment() ? (
              <DevnetWalletButton
                currentWallet={currentWallet}
                wallets={wallets}
                onWalletSelect={setCurrentWallet}
              />
            ) : (
              <ConnectWalletButton />
            )}
          </Flex>
        </Flex>
      </Container>
    </Box>
  );
};
