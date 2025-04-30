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
  IoTrendingUpOutline,
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
import { usePremiumData } from '@/contexts/PremiumDataContext';
import { 
  generateChartData, 
  ChartDataPoint, 
  calculateProviderBreakEven 
} from './utils/chartUtils'; // Import from the new utility file

// Helper function to format currency
const formatCurrency = (value: number | null | undefined, placeholder: string = '$--.--') => {
  if (value === null || value === undefined) {
    return placeholder;
  }
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function ProtectionVisualization() {
  const theme = useTheme();
  
  // --- Consume Context --- 
  const { 
    currentUserRole,
    // TODO: Add providerInputs and calculationResults when context is ready
    // Example:
    // buyerInputs: { btcAmount, triggerPrice }, 
    // providerInputs: { selectedTier, commitmentAmount, selectedPeriod }, // Need strikePrice, premiumReceivedPerBtc from tier/period
    // calculationResults: { /* buyerBreakEven, providerYield, etc. */ } 
  } = usePremiumData();
  const isProvider = currentUserRole === 'provider';

  // Neumorphic styles (same as BitcoinPriceCard)
  const neumorphicBg = "#E8EAE9"; 
  const neumorphicShadowLight = "-10px -10px 20px rgba(255, 255, 255, 0.8)"; 
  const neumorphicShadowDark = "10px 10px 20px rgba(163, 177, 198, 0.6)";
  const neumorphicBoxShadow = `${neumorphicShadowLight}, ${neumorphicShadowDark}`;
  const neumorphicBorderRadius = "xl"; 

  // --- Data for Chart and Metrics --- 
  // TODO: Replace MOCK data with data from context
  // Mock Buyer Data (Eventually from context.buyerInputs & context.calculationResults)
  const mockBuyerTriggerPrice = 94270.88; 
  const mockBuyerBreakEven = 89871.69;    
  const mockBuyerBtcAmount = 0.25;       

  // Mock Provider Data (Eventually from context.providerInputs & context.calculationResults)
  const mockProviderPotentialYield = 0.15; // 15% APY 
  const mockProviderStrikePrice = 90000; 
  const mockProviderPremiumPerBtc = 500; // Needed for chart/break-even
  const mockProviderCommitmentBtc = 1; // Needed for chart PnL scaling

  // Calculate Provider Break-Even (using mock data)
  const providerBreakEven = calculateProviderBreakEven(mockProviderStrikePrice, mockProviderPremiumPerBtc);

  // Generate data for the chart using the utility function
  // Pass role and mock data for now; replace mocks with context values later
  const chartData = generateChartData({ 
    role: currentUserRole,
    // Pass relevant mock data based on role
    triggerPrice: mockBuyerTriggerPrice,
    breakEvenBuyer: mockBuyerBreakEven,
    btcAmount: mockBuyerBtcAmount,
    strikePrice: mockProviderStrikePrice,
    premiumReceivedPerBtc: mockProviderPremiumPerBtc,
    commitmentAmountBtc: mockProviderCommitmentBtc,
  });

  // Define type for CustomTooltip props (using ChartDataPoint from utils)
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

  // Custom Tooltip (Adapted for provider)
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
          {isProvider ? (
            // Provider View
            payload.map((item, index) => (
              <Text key={index} fontSize="sm" color={item.color || theme.colors.green[600]}>
                {item.name}: {formatCurrency(item.value)} 
              </Text>
            ))
          ) : (
            // Buyer View
            payload.map((item, index) => (
              <Text key={index} fontSize="sm" color={item.color || theme.colors.blue[600]}>
                {item.name}: {formatCurrency(item.value)}
              </Text>
            ))
          )}
        </Box>
      );
    }
    return null;
  };
  
  return (
    <Box borderRadius={neumorphicBorderRadius} bg={neumorphicBg} p={4} boxShadow={neumorphicBoxShadow}>
      {/* --- Conditional Header --- */} 
      <Flex justify="space-between" align="center" mb={4}>
        <Flex align="center">
          <Icon as={IoStatsChart} color={isProvider ? "green.500" : "blue.500"} mr={2} />
          <Heading as="h2" fontSize="xl" fontWeight="bold" color="gray.800">
            {isProvider ? 'Income Potential Visualization' : 'Protection Visualization'}
          </Heading>
        </Flex>
        
        <Badge 
          colorScheme={isProvider ? "green" : "blue"}
          variant="outline"
          fontSize="sm"
          px={3}
          py={1}
          borderRadius="lg"
          borderColor={isProvider ? "green.400" : "blue.400"}
          color={isProvider ? "green.700" : "blue.700"}
        >
          {isProvider ? 'BTC Price vs Income' : 'BTC Price Scenarios'}
        </Badge>
      </Flex>
      
      {/* --- Conditional Chart --- */} 
      {/* TODO: Adapt chart component rendering based on role (DCU-207) */} 
      <Box height="300px" mb={8} borderRadius="md" p={2} bg="rgba(255, 255, 255, 0.4)" boxShadow="inner">
        {/* Basic conditional rendering example */} 
        {isProvider ? (
          // --- Provider Chart ---
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
                  value: 'Provider Profit/Loss', // Updated label
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
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px', color: theme.colors.gray[700] }} /> 
              <Line 
                type="monotone" 
                dataKey="providerPnl" // Use provider PnL data
                name="Provider Profit/Loss" 
                stroke={theme.colors.green[600]} // Green for profit/loss line
                strokeWidth={2}
                dot={false} 
              />
               {/* Provider-specific reference lines */}
              {providerBreakEven !== null && (
                <ReferenceLine 
                  x={providerBreakEven} 
                  stroke={theme.colors.orange[600]} // Use orange for provider break-even
                  strokeDasharray="3 3" 
                  label={{ value: 'Break-even', position: 'insideTopRight', fill: theme.colors.orange[700], fontSize: '10px', dy: -5 }} 
                />
              )}
              <ReferenceLine 
                x={mockProviderStrikePrice} 
                stroke={theme.colors.purple[500]} // Use purple for strike price
                strokeDasharray="3 3" 
                label={{ value: 'Strike Price', position: 'insideTopLeft', fill: theme.colors.purple[600], fontSize: '10px', dy: -5 }} 
              />
              {/* Horizontal line at PnL = 0 */}
              <ReferenceLine y={0} stroke={theme.colors.gray[500]} strokeWidth={1} /> 
            </LineChart>
          </ResponsiveContainer>
        ) : (
          // --- Buyer Chart ---
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
              <ReferenceLine 
                x={mockBuyerTriggerPrice} 
                stroke={theme.colors.red[500]}
                strokeDasharray="3 3" 
                label={{ value: 'Trigger', position: 'insideTopLeft', fill: theme.colors.red[600], fontSize: '10px', dy: -5 }} 
              />
              <ReferenceLine 
                x={mockBuyerBreakEven} 
                stroke={theme.colors.green[600]}
                strokeDasharray="3 3" 
                label={{ value: 'Break-even', position: 'insideTopRight', fill: theme.colors.green[700], fontSize: '10px', dy: -5 }} 
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Box>
      
      {/* --- Conditional Key Metrics --- */} 
      {/* TODO: Adapt summary boxes based on role (DCU-208) */} 
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6} mb={8}>
        {isProvider ? (
          <> 
            {/* Provider Metric Box 1: Max Potential Yield */}
            <Box p={5} borderRadius="lg" bgGradient="linear(to-br, green.400, teal.500)" color="white" shadow="md">
              <Flex align="center" mb={2}>
                <Icon as={IoTrendingUpOutline} mr={2} boxSize={5}/>
                <Text fontWeight="bold" fontSize="md">Max Potential Yield (APY)</Text>
              </Flex>
              {/* TODO: Use actual calculated yield from context */}
              <Text fontSize="3xl" fontWeight="bold">{`${(mockProviderPotentialYield * 100).toFixed(1)}%`}</Text> 
              <Text fontSize="xs" opacity={0.8}>Estimated annual yield if price stays above strike.</Text>
            </Box>
            
            {/* Provider Metric Box 2: Strike Price Provided */}
            <Box p={5} borderRadius="lg" bgGradient="linear(to-br, purple.400, pink.500)" color="white" shadow="md">
              <Flex align="center" mb={2}>
                <Icon as={IoShieldCheckmarkOutline} mr={2} boxSize={5}/>
                <Text fontWeight="bold" fontSize="md">Strike Price Provided</Text>
              </Flex>
              {/* TODO: Use actual strike from context.providerInputs */}
              <Text fontSize="3xl" fontWeight="bold">{formatCurrency(mockProviderStrikePrice)}</Text>
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
          </>
        ) : (
          <> 
            {/* Buyer Metric Box 1: Trigger Price */}
            <Box p={5} borderRadius="lg" bgGradient="linear(to-br, red.400, orange.500)" color="white" shadow="md">
              <Flex align="center" mb={2}>
                <Icon as={IoShieldCheckmarkOutline} mr={2} boxSize={5}/>
                <Text fontWeight="bold" fontSize="md">Trigger Price</Text>
              </Flex>
              {/* TODO: Use actual trigger from context */}
              <Text fontSize="3xl" fontWeight="bold">{formatCurrency(mockBuyerTriggerPrice)}</Text>
              <Text fontSize="xs" opacity={0.8}>Price below which protection activates.</Text>
            </Box>
            
            {/* Buyer Metric Box 2: Break-even Price */}
             <Box p={5} borderRadius="lg" bgGradient="linear(to-br, green.400, teal.500)" color="white" shadow="md">
              <Flex align="center" mb={2}>
                <Icon as={IoSwapHorizontalOutline} mr={2} boxSize={5}/>
                <Text fontWeight="bold" fontSize="md">Break-even Price (Buyer)</Text>
              </Flex>
              {/* TODO: Use actual break-even from context */}
              <Text fontSize="3xl" fontWeight="bold">{formatCurrency(mockBuyerBreakEven)}</Text>
              <Text fontSize="xs" opacity={0.8}>Effective purchase price after premium.</Text>
            </Box>

            {/* Buyer Metric Box 3: Total Premium */}
            <Box p={5} borderRadius="lg" bgGradient="linear(to-br, blue.400, cyan.500)" color="white" shadow="md">
              <Flex align="center" mb={2}>
                <Icon as={IoReceiptOutline} mr={2} boxSize={5}/>
                <Text fontWeight="bold" fontSize="md">Total Premium Paid</Text>
              </Flex>
              {/* TODO: Calculate from context */}
              <Text fontSize="3xl" fontWeight="bold">{formatCurrency((mockBuyerTriggerPrice - mockBuyerBreakEven) * mockBuyerBtcAmount)}</Text>
              <Text fontSize="xs" opacity={0.8}>Cost for the selected protection.</Text>
            </Box>
          </>
        )}
      </SimpleGrid>
      
      {/* Explanation Boxes - Keep the subtle inner style */}
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}> 
        <Box 
          p={4} 
          borderRadius={neumorphicBorderRadius} 
          bg="rgba(255, 255, 255, 0.5)" // Slightly whiter, translucent
          boxShadow="inner" 
        >
          <Flex gap={2}>
            <Icon as={IoInformationCircle} color="blue.600" mt={0.5} />
            <Box>
              <Text fontSize="sm" fontWeight="medium" color="blue.800" mb={1}> {/* Adjusted text color */}
                What happens if Bitcoin drops?
              </Text>
              <Text fontSize="sm" color="blue.700"> {/* Adjusted text color */}
                If Bitcoin drops below your protection level, you&apos;ll be compensated for the difference, offsetting your losses.
              </Text>
            </Box>
          </Flex>
        </Box>
        
        <Box 
          p={4} 
          borderRadius={neumorphicBorderRadius} 
          bg="rgba(255, 255, 255, 0.5)" // Slightly whiter, translucent
          boxShadow="inner" 
        >
          <Flex gap={2}>
            <Icon as={IoInformationCircle} color="blue.600" mt={0.5} />
            <Box>
              <Text fontSize="sm" fontWeight="medium" color="blue.800" mb={1}> {/* Adjusted text color */}
                What if it rises?
              </Text>
              <Text fontSize="sm" color="blue.700"> {/* Adjusted text color */}
                If Bitcoin rises, you&apos;ll benefit from the upside while having paid a small premium for peace of mind.
              </Text>
            </Box>
          </Flex>
        </Box>
      </SimpleGrid>
    </Box>
  );
} 