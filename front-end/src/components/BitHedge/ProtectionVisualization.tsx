"use client";

import {
  Box,
  Flex,
  Text,
  Heading,
  Badge,
  Icon,
  SimpleGrid,
  useTheme,
} from "@chakra-ui/react";
import {
  IoStatsChart,
  IoInformationCircle,
  IoShieldCheckmarkOutline,
  IoSwapHorizontalOutline,
  IoReceiptOutline,
} from "react-icons/io5";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine
} from 'recharts';
// Import Buyer specific context and hooks
import { useBuyerContext } from '@/contexts/BuyerContext';
import { useBuyerQuote } from '@/hooks/useBuyerQuote';
// Import chart utility (will need update later - UI-312)
import { generateChartData, ChartDataPoint } from './utils/chartUtils';
import type { BuyerPremiumQuoteResult } from "@/../../convex/types";

// Helper function to format currency (keep or move to shared utils)
const formatCurrency = (value: number | null | undefined, placeholder: string = '$--.--') => {
  if (value === null || value === undefined || isNaN(value)) {
    return placeholder;
  }
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Component focused only on Buyer Visualization
export default function BuyerProtectionVisualization() {
  const theme = useTheme();

  // --- Consume Buyer Context & Hook --- 
  const { accurateQuote: buyerQuoteResult } = useBuyerContext();
  // Get loading/error states if needed for visual feedback here
  const { isLoading, error } = useBuyerQuote(); 

  // Neumorphic styles (keep)
  const neumorphicBg = "#E8EAE9";
  const neumorphicShadowLight = "-10px -10px 20px rgba(255, 255, 255, 0.8)";
  const neumorphicShadowDark = "10px 10px 20px rgba(163, 177, 198, 0.6)";
  const neumorphicBoxShadow = `${neumorphicShadowLight}, ${neumorphicShadowDark}`;
  const neumorphicBorderRadius = "xl";

  // --- Data Extraction from Buyer Quote --- 
  const buyerQuoteData = buyerQuoteResult as BuyerPremiumQuoteResult | null;

  const triggerPrice = buyerQuoteData?.inputs?.protectedValueUSD; // Use correct field
  const breakEvenBuyer = buyerQuoteData?.breakEvenPrice;
  const btcAmount = buyerQuoteData?.inputs?.protectionAmount;
  const premiumPaid = (triggerPrice && breakEvenBuyer && btcAmount)
    ? (triggerPrice - breakEvenBuyer) * btcAmount
    : undefined;

  // Generate chart data using buyer quote data (needs chartUtils update - UI-312)
  // For now, adapt mock call structure, passing relevant buyer fields
  const chartData = buyerQuoteData ? generateChartData({
    role: 'buyer',
    triggerPrice: triggerPrice, // Pass real data
    breakEvenBuyer: breakEvenBuyer, // Pass real data
    btcAmount: btcAmount, // Pass real data
    // Provider fields not needed for buyer chart
    strikePrice: 0,
    premiumReceivedPerBtc: 0,
    commitmentAmountBtc: 0,
  }) : []; // Empty array if no quote data

  // Custom Tooltip Props (remains mostly the same)
  type CustomTooltipProps = {
    active?: boolean;
    payload?: Array<{ 
      payload: ChartDataPoint; 
      value: number; 
      name: string; 
      color: string; 
    }>;
    label?: number; // The X-axis value (btcPrice)
  };

  // Custom Tooltip (Simplified for Buyer)
  const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (active && payload && payload.length && label !== undefined) {
      return (
        <Box
          bg="rgba(255, 255, 255, 0.9)"
          p={3}
          borderRadius="md"
          boxShadow="md"
          borderWidth="1px"
          borderColor="gray.300"
        >
          <Text fontWeight="bold" mb={1} color="gray.800">BTC Price: {formatCurrency(label)}</Text>
          {payload.map((item, index) => (
            <Text key={index} fontSize="sm" color={item.color || theme.colors.blue[600]}>
              {item.name}: {formatCurrency(item.value)}
            </Text>
          ))}
        </Box>
      );
    }
    return null;
  };

  // Handle loading/error/initial states
  if (isLoading) {
    // Optional: Add a specific loader here or rely on parent context loader
    return <Box p={6} textAlign="center" color="gray.500">Loading Visualization...</Box>;
  }

  if (error && !buyerQuoteData) {
     // Optional: Add specific error display
     return <Box p={6} textAlign="center" color="red.500">Error loading visualization data.</Box>;
   }

  if (!buyerQuoteData || chartData.length === 0) {
    // Optional: Display placeholder or message
    return <Box p={6} textAlign="center" color="gray.500">Enter parameters to see visualization.</Box>;
  }

  return (
    <Box borderRadius={neumorphicBorderRadius} bg={neumorphicBg} p={4} boxShadow={neumorphicBoxShadow}>
      {/* --- Buyer Header --- */} 
      <Flex justify="space-between" align="center" mb={4}>
        <Flex align="center">
          <Icon as={IoStatsChart} color="blue.500" mr={2} />
          <Heading as="h2" fontSize="xl" fontWeight="bold" color="gray.800">
            Protection Visualization
          </Heading>
        </Flex>
        <Badge
          colorScheme="blue"
          variant="outline"
          fontSize="sm"
          px={3}
          py={1}
          borderRadius="lg"
          borderColor="blue.400"
          color="blue.700"
        >
          BTC Price Scenarios
        </Badge>
      </Flex>

      {/* --- Buyer Chart --- */} 
      <Box height="300px" mb={8} borderRadius="md" p={2} bg="rgba(255, 255, 255, 0.4)" boxShadow="inner">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 20, left: 30, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.gray[300]} />
            <XAxis
              dataKey="btcPrice"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(value) => `$${Math.round(value / 1000)}k`}
              stroke={theme.colors.gray[500]}
              tick={{ fontSize: '11px', fill: theme.colors.gray[700] }}
              label={{ value: 'BTC Price at Expiry', position: 'insideBottom', offset: -5, dy: 10, fontSize: '12px', fill: theme.colors.gray[700] }}
            />
            <YAxis
              tickFormatter={(value) => `$${Math.round(value / 1000)}k`}
              stroke={theme.colors.gray[500]}
              tick={{ fontSize: '11px', fill: theme.colors.gray[700] }}
              label={{
                value: 'Portfolio Value',
                angle: -90,
                position: 'insideLeft',
                offset: -20,
                dx: -10,
                fontSize: '12px',
                fill: theme.colors.gray[700]
              }}
              width={80}
              domain={['auto', 'auto']}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px', color: theme.colors.gray[700] }} />
            <Line
              type="monotone"
              dataKey="unprotectedValue"
              name="Unprotected Value"
              stroke={theme.colors.orange[500]}
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="protectedValue"
              name="Protected Value"
              stroke={theme.colors.blue[600]}
              strokeWidth={2}
              dot={false}
            />
            {/* Use data from context */}
            {triggerPrice !== undefined && (
              <ReferenceLine
                x={triggerPrice}
                stroke={theme.colors.red[500]}
                strokeDasharray="3 3"
                label={{ value: 'Trigger', position: 'insideTopLeft', fill: theme.colors.red[600], fontSize: '10px', dy: -5 }}
              />
            )}
            {breakEvenBuyer !== undefined && (
              <ReferenceLine
                x={breakEvenBuyer}
                stroke={theme.colors.green[600]}
                strokeDasharray="3 3"
                label={{ value: 'Break-even', position: 'insideTopRight', fill: theme.colors.green[700], fontSize: '10px', dy: -5 }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </Box>

      {/* --- Buyer Key Metrics --- */} 
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6} mb={8}>
        {/* Buyer Metric Box 1: Trigger Price */}
        <Box p={5} borderRadius="lg" bgGradient="linear(to-br, red.400, orange.500)" color="white" shadow="md">
          <Flex align="center" mb={2}>
            <Icon as={IoShieldCheckmarkOutline} mr={2} boxSize={5}/>
            <Text fontWeight="bold" fontSize="md">Trigger Price</Text>
          </Flex>
          {/* Use data from context */}
          <Text fontSize="3xl" fontWeight="bold">{formatCurrency(triggerPrice)}</Text>
          <Text fontSize="xs" opacity={0.8}>Price below which protection activates.</Text>
        </Box>

        {/* Buyer Metric Box 2: Break-even Price */}
         <Box p={5} borderRadius="lg" bgGradient="linear(to-br, green.400, teal.500)" color="white" shadow="md">
          <Flex align="center" mb={2}>
            <Icon as={IoSwapHorizontalOutline} mr={2} boxSize={5}/>
            <Text fontWeight="bold" fontSize="md">Break-even Price (Buyer)</Text>
          </Flex>
          {/* Use data from context */}
          <Text fontSize="3xl" fontWeight="bold">{formatCurrency(breakEvenBuyer)}</Text>
          <Text fontSize="xs" opacity={0.8}>Effective purchase price after premium.</Text>
        </Box>

        {/* Buyer Metric Box 3: Total Premium */}
        <Box p={5} borderRadius="lg" bgGradient="linear(to-br, blue.400, cyan.500)" color="white" shadow="md">
          <Flex align="center" mb={2}>
            <Icon as={IoReceiptOutline} mr={2} boxSize={5}/>
            <Text fontWeight="bold" fontSize="md">Total Premium Paid</Text>
          </Flex>
          {/* Use calculated premium */}
          <Text fontSize="3xl" fontWeight="bold">{formatCurrency(premiumPaid)}</Text>
          <Text fontSize="xs" opacity={0.8}>Cost for the selected protection.</Text>
        </Box>
      </SimpleGrid>

      {/* Explanation Boxes */}
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
        <Box
          p={4}
          borderRadius={neumorphicBorderRadius}
          bg="rgba(255, 255, 255, 0.5)"
          boxShadow="inner"
        >
          <Flex gap={2}>
            <Icon as={IoInformationCircle} color="blue.600" mt={0.5} />
            <Box>
              <Text fontSize="sm" fontWeight="medium" color="blue.800" mb={1}>
                What happens if Bitcoin drops?
              </Text>
              <Text fontSize="sm" color="blue.700">
                If Bitcoin drops below your protection level, you&apos;ll be compensated for the difference, offsetting your losses.
              </Text>
            </Box>
          </Flex>
        </Box>

        <Box
          p={4}
          borderRadius={neumorphicBorderRadius}
          bg="rgba(255, 255, 255, 0.5)"
          boxShadow="inner"
        >
          <Flex gap={2}>
            <Icon as={IoInformationCircle} color="blue.600" mt={0.5} />
            <Box>
              <Text fontSize="sm" fontWeight="medium" color="blue.800" mb={1}>
                What if it rises?
              </Text>
              <Text fontSize="sm" color="blue.700">
                If Bitcoin rises, you&apos;ll benefit from the upside while having paid a small premium for peace of mind.
              </Text>
            </Box>
          </Flex>
        </Box>
      </SimpleGrid>
    </Box>
  );
} 