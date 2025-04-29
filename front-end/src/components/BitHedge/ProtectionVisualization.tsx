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
  IoWalletOutline,
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

// Helper function to format currency
const formatCurrency = (value: number) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ProtectionVisualization() {
  const theme = useTheme();
  
  // --- Consume Context --- 
  const { 
    currentUserRole,
  } = usePremiumData();
  const isProvider = currentUserRole === 'provider';

  // Neumorphic styles (same as BitcoinPriceCard)
  const neumorphicBg = "#E8EAE9"; 
  const neumorphicShadowLight = "-10px -10px 20px rgba(255, 255, 255, 0.8)"; 
  const neumorphicShadowDark = "10px 10px 20px rgba(163, 177, 198, 0.6)";
  const neumorphicBoxShadow = `${neumorphicShadowLight}, ${neumorphicShadowDark}`;
  const neumorphicBorderRadius = "xl"; 

  // --- Conditional Data & Logic --- 
  // TODO: Replace mock data with data from context (providerInputs, calculationResults)
  const triggerPrice = 94270.88; // Mock Buyer Data
  const breakEven = 89871.69;    // Mock Buyer Data
  const btcAmount = 0.25;       // Mock Buyer Data (Needs lifting or context)

  // TODO: Define provider-specific mock data or derive from context
  // Example placeholder data:
  const potentialYield = 0.15; // 15% APY (Mock Provider Data)
  const strikePriceProvided = 90000; // Mock Provider Data
  const providerBreakEven = 85000; // Below this BTC price, provider starts losing (Mock Provider Data)

  // Calculations (Currently Buyer Specific)
  const premiumPerBTC = triggerPrice - breakEven;
  const totalPremium = premiumPerBTC * btcAmount;
  const protectedValueAtTrigger = triggerPrice * btcAmount;

  // Generate data for the chart (Currently Buyer Specific)
  // TODO: Adapt this function based on currentUserRole (DCU-207)
  const generateChartData = () => {
    // ... (existing buyer chart logic) ...
    // Placeholder for provider chart data generation
    if (isProvider) {
        // Return data structure suitable for provider income/loss scenarios
        // e.g., [{ btcPrice: ..., income: ..., capitalAtRisk: ... }, ...]
        return []; // Return empty array for now
    }

    const data = [];
    const currentPrice = triggerPrice; 
    const rangeMultiplier = 0.5; 
    const lowerBound = currentPrice * (1 - rangeMultiplier);
    const upperBound = currentPrice * (1 + rangeMultiplier);
    const steps = 20; 

    for (let i = 0; i <= steps; i++) {
      const btcPrice = lowerBound + (upperBound - lowerBound) * (i / steps);
      const unprotectedValue = btcPrice * btcAmount;
      let protectedValue;
      if (btcPrice >= triggerPrice) {
        protectedValue = unprotectedValue - totalPremium;
      } else {
        protectedValue = protectedValueAtTrigger - totalPremium;
      }
      data.push({
        btcPrice: btcPrice,
        unprotectedValue: unprotectedValue,
        protectedValue: protectedValue,
      });
    }
    return data;
  };

  const chartData = generateChartData();

  // Define the shape of chart data points (Potentially needs conditional types)
  type ChartDataPoint = {
    btcPrice: number;
    unprotectedValue?: number; // Optional for provider
    protectedValue?: number;   // Optional for provider
    income?: number;           // Optional for buyer
    capitalAtRisk?: number;    // Optional for buyer
  };

  // Define type for CustomTooltip props (Needs adaptation for provider)
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

  // Custom Tooltip (Needs adaptation for provider)
  const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (active && payload && payload.length && label !== undefined) {
      // TODO: Conditionally render tooltip content based on isProvider
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
          {/* Buyer View (Example) */} 
          {!isProvider && payload[0] && <Text fontSize="sm" color={theme.colors.orange[600]}>{payload[0].name}: {formatCurrency(payload[0].value)}</Text>} 
          {!isProvider && payload[1] && <Text fontSize="sm" color={theme.colors.blue[600]}>{payload[1].name}: {formatCurrency(payload[1].value)}</Text>} 
          {/* Provider View (Placeholder) */} 
          {isProvider && payload[0] && <Text fontSize="sm" color={theme.colors.green[600]}>Potential Income: {formatCurrency(payload[0].value)}</Text>} 
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
          <Text textAlign="center" p={10} color="gray.500">Provider chart rendering (DCU-207) needed here.</Text>
        ) : (
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
                label={{ value: 'Portfolio Value', angle: -90, position: 'insideLeft', offset: -20, dx: -10, fontSize: '12px', fill: theme.colors.gray[700] }}
                width={80}
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
                x={triggerPrice} 
                stroke={theme.colors.red[500]}
                strokeDasharray="3 3" 
                label={{ value: 'Trigger', position: 'insideTopLeft', fill: theme.colors.red[600], fontSize: '10px', dy: -5 }} 
              />
              <ReferenceLine 
                x={breakEven} 
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
            {/* Provider Metric Box 1 (Placeholder) */}
            <Box p={5} borderRadius="lg" bgGradient="linear(to-b, green.500, green.600)" color="white" shadow="md">
              <Flex align="center" mb={1}><Icon as={IoTrendingUpOutline} /><Text fontWeight="semibold" fontSize="sm" ml={1} color="green.100">Max Potential Yield (APY)</Text></Flex>
              <Heading as="h3" fontSize="xl" fontWeight="bold">{(potentialYield * 100).toFixed(1)}%</Heading>
              <Text fontSize="xs" color="green.200">Based on selected Tier & Period</Text>
            </Box>
            {/* Provider Metric Box 2 (Placeholder) */}
            <Box p={5} borderRadius="lg" bgGradient="linear(to-b, green.500, green.600)" color="white" shadow="md">
              <Flex align="center" mb={1}><Icon as={IoSwapHorizontalOutline} /><Text fontWeight="semibold" fontSize="sm" ml={1} color="green.100">Strike Price Provided</Text></Flex>
              <Heading as="h3" fontSize="xl" fontWeight="bold">{formatCurrency(strikePriceProvided)}</Heading>
              <Text fontSize="xs" color="green.200">Protection activates below this</Text>
            </Box>
            {/* Provider Metric Box 3 (Placeholder) */}
            <Box p={5} borderRadius="lg" bgGradient="linear(to-b, green.500, green.600)" color="white" shadow="md">
              <Flex align="center" mb={1}><Icon as={IoReceiptOutline} /><Text fontWeight="semibold" fontSize="sm" ml={1} color="green.100">Break-even (Provider)</Text></Flex>
              <Heading as="h3" fontSize="xl" fontWeight="bold">{formatCurrency(providerBreakEven)}</Heading>
              <Text fontSize="xs" color="green.200">BTC price where income equals loss</Text>
            </Box>
          </>
        ) : (
          <> 
            {/* Buyer Metric Box 1 (Original) */}
            <Box p={5} borderRadius="lg" bgGradient="linear(to-b, blue.600, blue.700)" color="white" shadow="md">
              <Flex align="center" mb={1}><Icon as={IoShieldCheckmarkOutline} /><Text fontWeight="semibold" fontSize="sm" ml={1} color="blue.100">Protection Trigger</Text></Flex>
              <Heading as="h3" fontSize="xl" fontWeight="bold">{formatCurrency(triggerPrice)}</Heading>
              <Text fontSize="xs" color="blue.200">100% of current price (estimate)</Text>
            </Box>
            {/* Buyer Metric Box 2 (Original - Max Recovery) */} 
            <Box p={5} borderRadius="lg" bgGradient="linear(to-b, blue.600, blue.700)" color="white" shadow="md">
              <Flex align="center" mb={1}><Icon as={IoWalletOutline} /><Text fontWeight="semibold" fontSize="sm" ml={1} color="blue.100">Max Recovery Value</Text></Flex>
              <Heading as="h3" fontSize="xl" fontWeight="bold">{formatCurrency(protectedValueAtTrigger)}</Heading>
              <Text fontSize="xs" color="blue.200">Equivalent value if triggered</Text>
            </Box>
            {/* Buyer Metric Box 3 (Original) */}
            <Box p={5} borderRadius="lg" bgGradient="linear(to-b, blue.600, blue.700)" color="white" shadow="md">
              <Flex align="center" mb={1}><Icon as={IoSwapHorizontalOutline} /><Text fontWeight="semibold" fontSize="sm" ml={1} color="blue.100">Break-even Point</Text></Flex>
              <Heading as="h3" fontSize="xl" fontWeight="bold">{formatCurrency(breakEven)}</Heading>
              <Text fontSize="xs" color="blue.200">BTC price where protection pays off</Text>
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