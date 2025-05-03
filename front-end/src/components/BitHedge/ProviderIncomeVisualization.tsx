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
  // Tooltip, // Removed unused Chakra UI Tooltip
} from "@chakra-ui/react";
import {
  IoStatsChart,
  IoInformationCircle,
  IoShieldCheckmarkOutline,
  IoSwapHorizontalOutline,
  IoTrendingUpOutline,
} from "react-icons/io5";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip, // Alias Recharts Tooltip to avoid name clash
  Legend,
  ReferenceLine
} from 'recharts';
// Import Provider specific context and hooks
import { useProviderContext } from '@/contexts/ProviderContext';
import { useProviderQuote } from '@/hooks/useProviderQuote';
// Import chart utility (will need update later - UI-312)
import { 
  generateChartData, 
  ChartDataPoint, 
  calculateProviderBreakEven // Keep this utility for provider
} from './utils/chartUtils'; 
import type { ProviderYieldQuoteResult } from "@/../../convex/types";

// Helper function to format currency (keep or move to shared utils)
const formatCurrency = (value: number | null | undefined, placeholder: string = '$--.--') => {
  if (value === null || value === undefined || isNaN(value)) {
    return placeholder;
  }
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Helper function to format percentage
const formatPercentage = (value: number | null | undefined, placeholder: string = '--.--%') => {
  if (value === null || value === undefined || isNaN(value)) {
    return placeholder;
  }
  return `${(value * 100).toFixed(2)}%`;
};

// Component focused only on Provider Visualization
export default function ProviderIncomeVisualization() {
  const theme = useTheme();

  // --- Consume Provider Context & Hook --- 
  const { accurateQuote: providerQuoteResult } = useProviderContext();
  const { isLoading, error } = useProviderQuote();

  // Neumorphic styles (keep)
  const neumorphicBg = "#E8EAE9";
  const neumorphicShadowLight = "-10px -10px 20px rgba(255, 255, 255, 0.8)";
  const neumorphicShadowDark = "10px 10px 20px rgba(163, 177, 198, 0.6)";
  const neumorphicBoxShadow = `${neumorphicShadowLight}, ${neumorphicShadowDark}`;
  const neumorphicBorderRadius = "xl";

  // --- Data Extraction from Provider Quote --- 
  const providerQuoteData = providerQuoteResult as ProviderYieldQuoteResult | null;

  const potentialYield = providerQuoteData?.calculated?.estimatedYieldPercentage;
  const strikePrice = providerQuoteData?.calculated?.yieldComponents?.estimatedBTCAcquisitionPrice; // Acquisition price as strike price
  
  // Need premium received per BTC - derive from data
  const premiumReceivedPerBtc = providerQuoteData?.calculated?.estimatedYieldUSD ?? 500; // Use actual yield or placeholder
  
  // Derive commitment amount in BTC from USD and price
  const commitmentAmountBtc = providerQuoteData?.parameters?.commitmentAmountUSD && providerQuoteData?.marketData?.price
    ? providerQuoteData.parameters.commitmentAmountUSD / providerQuoteData.marketData.price
    : 1; // Fallback placeholder

  // Calculate Provider Break-Even only if inputs are valid numbers
  const providerBreakEven = 
    (typeof strikePrice === 'number' && typeof premiumReceivedPerBtc === 'number')
    ? calculateProviderBreakEven(strikePrice, premiumReceivedPerBtc)
    : undefined; // Set to undefined if inputs are invalid

  // Generate chart data using provider quote data (needs chartUtils update - UI-312)
  const chartData = providerQuoteData ? generateChartData({
    role: 'provider',
    // Provider fields
    strikePrice: strikePrice, 
    premiumReceivedPerBtc: premiumReceivedPerBtc, // Use placeholder for now
    commitmentAmountBtc: commitmentAmountBtc, // Use placeholder for now
    // Buyer fields not needed
    triggerPrice: 0,
    breakEvenBuyer: 0,
    btcAmount: 0,
  }) : [];

  // Custom Tooltip Props
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

  // Custom Tooltip (Provider View)
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
            <Text key={index} fontSize="sm" color={item.color || theme.colors.green[600]}>
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
    return <Box p={6} textAlign="center" color="gray.500">Loading Visualization...</Box>;
  }

  if (error && !providerQuoteData) {
     return <Box p={6} textAlign="center" color="red.500">Error loading visualization data.</Box>;
   }

  if (!providerQuoteData || chartData.length === 0) {
    return <Box p={6} textAlign="center" color="gray.500">Enter parameters to see visualization.</Box>;
  }

  return (
    <Box borderRadius={neumorphicBorderRadius} bg={neumorphicBg} p={4} boxShadow={neumorphicBoxShadow}>
      {/* --- Provider Header --- */} 
      <Flex justify="space-between" align="center" mb={4}>
        <Flex align="center">
          <Icon as={IoStatsChart} color="green.500" mr={2} />
          <Heading as="h2" fontSize="xl" fontWeight="bold" color="gray.800">
            Income Potential Visualization
          </Heading>
        </Flex>
        <Badge
          colorScheme="green"
          variant="outline"
          fontSize="sm"
          px={3}
          py={1}
          borderRadius="lg"
          borderColor="green.400"
          color="green.700"
        >
          BTC Price vs Income
        </Badge>
      </Flex>

      {/* --- Provider Chart --- */} 
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
              tickFormatter={(value) => `$${Math.round(value)}`} // Show smaller increments for PnL
              stroke={theme.colors.gray[500]}
              tick={{ fontSize: '11px', fill: theme.colors.gray[700] }}
              label={{
                value: 'Provider Profit/Loss',
                angle: -90,
                position: 'insideLeft',
                offset: -20,
                dx: -10,
                fontSize: '12px',
                fill: theme.colors.gray[700]
              }}
              width={80}
              domain={['auto', 'auto']} // Allow negative domain for PnL
            />
            <RechartsTooltip content={<CustomTooltip />} />
            <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px', color: theme.colors.gray[700] }} />
            <Line
              type="monotone"
              dataKey="providerPnl" // Use provider PnL data key from chartUtils
              name="Provider Profit/Loss"
              stroke={theme.colors.green[600]}
              strokeWidth={2}
              dot={false}
            />
             {/* Provider-specific reference lines */}
             {/* Ensure providerBreakEven is a valid number before rendering line */}
            {providerBreakEven !== undefined && !isNaN(providerBreakEven) && (
              <ReferenceLine
                x={providerBreakEven}
                stroke={theme.colors.orange[600]}
                strokeDasharray="3 3"
                label={{ value: 'Break-even', position: 'insideTopRight', fill: theme.colors.orange[700], fontSize: '10px', dy: -5 }}
              />
            )}
             {/* Ensure strikePrice is a valid number before rendering line */}
            {strikePrice !== undefined && !isNaN(strikePrice) && (
              <ReferenceLine
                x={strikePrice}
                stroke={theme.colors.purple[500]}
                strokeDasharray="3 3"
                label={{ value: 'Strike Price', position: 'insideTopLeft', fill: theme.colors.purple[600], fontSize: '10px', dy: -5 }}
              />
            )}
            {/* Horizontal line at PnL = 0 */}
            <ReferenceLine y={0} stroke={theme.colors.gray[500]} strokeWidth={1} />
          </LineChart>
        </ResponsiveContainer>
      </Box>

      {/* --- Provider Key Metrics --- */} 
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6} mb={8}>
        {/* Provider Metric Box 1: Max Potential Yield */}
        <Box p={5} borderRadius="lg" bgGradient="linear(to-br, green.400, teal.500)" color="white" shadow="md">
          <Flex align="center" mb={2}>
            <Icon as={IoTrendingUpOutline} mr={2} boxSize={5}/>
            <Text fontWeight="bold" fontSize="md">Max Potential Yield (APY)</Text>
          </Flex>
          {/* Use data from context */}
          <Text fontSize="3xl" fontWeight="bold">{formatPercentage(potentialYield)}</Text>
          <Text fontSize="xs" opacity={0.8}>Estimated annual yield if price stays above strike.</Text>
        </Box>

        {/* Provider Metric Box 2: Strike Price Provided */}
        <Box p={5} borderRadius="lg" bgGradient="linear(to-br, purple.400, pink.500)" color="white" shadow="md">
          <Flex align="center" mb={2}>
            <Icon as={IoShieldCheckmarkOutline} mr={2} boxSize={5}/>
            <Text fontWeight="bold" fontSize="md">Strike Price Provided</Text>
          </Flex>
          {/* Use data from context */}
          <Text fontSize="3xl" fontWeight="bold">{formatCurrency(strikePrice)}</Text>
          <Text fontSize="xs" opacity={0.8}>Price below which provider payout occurs.</Text>
        </Box>

        {/* Provider Metric Box 3: Provider Break-even */}
        <Box p={5} borderRadius="lg" bgGradient="linear(to-br, orange.400, yellow.500)" color="white" shadow="md">
          <Flex align="center" mb={2}>
            <Icon as={IoSwapHorizontalOutline} mr={2} boxSize={5}/>
            <Text fontWeight="bold" fontSize="md">Break-even Price (Provider)</Text>
          </Flex>
          {/* Use calculated break-even */}
          <Text fontSize="3xl" fontWeight="bold">{formatCurrency(providerBreakEven)}</Text>
          <Text fontSize="xs" opacity={0.8}>BTC price where provider PnL is zero.</Text>
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
            <Icon as={IoInformationCircle} color="green.600" mt={0.5} />
            <Box>
              <Text fontSize="sm" fontWeight="medium" color="green.800" mb={1}>
                How is income generated?
              </Text>
              <Text fontSize="sm" color="green.700">
                You receive income (yield) for committing capital. If the BTC price stays above the strike price at expiry, you keep the full income.
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
            <Icon as={IoInformationCircle} color="green.600" mt={0.5} />
            <Box>
              <Text fontSize="sm" fontWeight="medium" color="green.800" mb={1}>
                What if the price drops below strike?
              </Text>
              <Text fontSize="sm" color="green.700">
                If the price is below the strike at expiry, your committed capital may be used to acquire BTC at the strike price, effectively buying the dip.
              </Text>
            </Box>
          </Flex>
        </Box>
      </SimpleGrid>
    </Box>
  );
} 