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

// Helper function to format currency
const formatCurrency = (value: number) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ProtectionVisualization() {
  const theme = useTheme(); // Access Chakra theme colors
  
  // Neumorphic styles (same as BitcoinPriceCard)
  const neumorphicBg = "#E8EAE9"; 
  const neumorphicShadowLight = "-10px -10px 20px rgba(255, 255, 255, 0.8)"; 
  const neumorphicShadowDark = "10px 10px 20px rgba(163, 177, 198, 0.6)";
  const neumorphicBoxShadow = `${neumorphicShadowLight}, ${neumorphicShadowDark}`;
  const neumorphicBorderRadius = "xl"; 

  // Mock data
  const triggerPrice = 94270.88;
  const breakEven = 89871.69;
  const btcAmount = 0.25;
  
  // Derived calculations
  const premiumPerBTC = triggerPrice - breakEven;
  const totalPremium = premiumPerBTC * btcAmount;
  const protectedValueAtTrigger = triggerPrice * btcAmount; // Max recovery is essentially this value

  // Generate data for the chart
  const generateChartData = () => {
    const data = [];
    const currentPrice = triggerPrice; // Assuming protection bought at trigger price for simplicity
    const rangeMultiplier = 0.5; // Show 50% above and below current price
    const lowerBound = currentPrice * (1 - rangeMultiplier);
    const upperBound = currentPrice * (1 + rangeMultiplier);
    const steps = 20; // Number of data points

    for (let i = 0; i <= steps; i++) {
      const btcPrice = lowerBound + (upperBound - lowerBound) * (i / steps);
      const unprotectedValue = btcPrice * btcAmount;
      let protectedValue;

      if (btcPrice >= triggerPrice) {
        // Above trigger: Value is BTC value minus premium
        protectedValue = unprotectedValue - totalPremium;
      } else {
        // Below trigger: Value is capped at trigger value minus premium
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

  // Define the shape of our chart data points
  type ChartDataPoint = {
    btcPrice: number;
    unprotectedValue: number;
    protectedValue: number;
  };

  // Define type for CustomTooltip props using ChartDataPoint
  type CustomTooltipProps = {
    active?: boolean;
    payload?: Array<{ 
      payload: ChartDataPoint; // Use the specific data point type
      value: number; 
      name: string; 
      color: string; 
    }>;
    label?: number; // The X-axis value (btcPrice)
  };

  // Custom Tooltip with defined types
  const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (active && payload && payload.length && label !== undefined) {
      return (
        <Box 
          bg="rgba(255, 255, 255, 0.9)" // Slightly transparent white background
          p={3} 
          borderRadius="md" 
          boxShadow="md" 
          borderWidth="1px" 
          borderColor="gray.300" // Slightly darker border
        >
          <Text fontWeight="bold" mb={1} color="gray.800">BTC Price: {formatCurrency(label)}</Text>
          {/* Ensure payload has expected structure before accessing */}
          {payload[0] && <Text fontSize="sm" color={theme.colors.orange[600]}>{payload[0].name}: {formatCurrency(payload[0].value)}</Text>} {/* Darker orange */} 
          {payload[1] && <Text fontSize="sm" color={theme.colors.blue[600]}>{payload[1].name}: {formatCurrency(payload[1].value)}</Text>} {/* Darker blue */} 
        </Box>
      );
    }
    return null;
  };
  
  return (
    <Box borderRadius={neumorphicBorderRadius} bg={neumorphicBg} p={4} boxShadow={neumorphicBoxShadow}> {/* Applied neumorphic style */}
      <Flex justify="space-between" align="center" mb={4}>
        <Flex align="center">
          <Icon as={IoStatsChart} color="blue.500" mr={2} />
          <Heading as="h2" fontSize="xl" fontWeight="bold" color="gray.800"> {/* Adjusted text color */}
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
          borderColor="blue.400" // Adjusted border color
          color="blue.700" // Adjusted text color
        >
          BTC Price Scenarios
        </Badge>
      </Flex>
      
      {/* --- Recharts Payoff Chart --- */}
      <Box height="300px" mb={8} borderRadius="md" p={2} bg="rgba(255, 255, 255, 0.4)" boxShadow="inner"> {/* Subtle inner container for chart */}
        <ResponsiveContainer width="100%" height="100%">
          <LineChart 
            data={chartData}
            margin={{ top: 5, right: 20, left: 30, bottom: 5 }} 
          >
            <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.gray[300]} /> {/* Lighter grid */}
            <XAxis 
              dataKey="btcPrice" 
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(value) => `$${Math.round(value / 1000)}k`} // Format ticks as $XXk
              stroke={theme.colors.gray[500]}
              tick={{ fontSize: '11px', fill: theme.colors.gray[700] }} // Darker ticks
              label={{ value: 'BTC Price at Expiry', position: 'insideBottom', offset: -5, dy: 10, fontSize: '12px', fill: theme.colors.gray[700] }} // Darker label
            />
            <YAxis 
              tickFormatter={(value) => `$${Math.round(value / 1000)}k`} // Format ticks as $Xk
              stroke={theme.colors.gray[500]}
              tick={{ fontSize: '11px', fill: theme.colors.gray[700] }} // Darker ticks
              label={{ value: 'Portfolio Value', angle: -90, position: 'insideLeft', offset: -20, dx: -10, fontSize: '12px', fill: theme.colors.gray[700] }} // Darker label
              width={80} // Give YAxis more space
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px', color: theme.colors.gray[700] }} /> {/* Adjusted legend text color */} 
            <Line 
              type="monotone" 
              dataKey="unprotectedValue" 
              name="Unprotected Value" 
              stroke={theme.colors.orange[500]} // Slightly darker orange
              strokeWidth={2}
              dot={false} 
            />
            <Line 
              type="monotone" 
              dataKey="protectedValue" 
              name="Protected Value" 
              stroke={theme.colors.blue[600]} // Slightly darker blue
              strokeWidth={2}
              dot={false} 
            />
            {/* Reference Lines for Key Metrics */}
            <ReferenceLine 
              x={triggerPrice} 
              stroke={theme.colors.red[500]} // Slightly darker red
              strokeDasharray="3 3" 
              label={{ value: 'Trigger', position: 'insideTopLeft', fill: theme.colors.red[600], fontSize: '10px', dy: -5 }} 
            />
            <ReferenceLine 
              x={breakEven} 
              stroke={theme.colors.green[600]} // Slightly darker green
              strokeDasharray="3 3" 
              label={{ value: 'Break-even', position: 'insideTopRight', fill: theme.colors.green[700], fontSize: '10px', dy: -5 }} 
            />
          </LineChart>
        </ResponsiveContainer>
      </Box>
      
      {/* Key Metrics - Apply Blue Gradient Style */}
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6} mb={8}> 
        {/* Protection Trigger */}
        <Box 
          p={5} 
          borderRadius="lg" // Standard border radius for these cards
          bg="blue.600"
          bgGradient="linear(to-b, blue.600, blue.700)"
          color="white"
          shadow="md"
        >
          <Flex align="center" mb={1}>
            <Icon as={IoShieldCheckmarkOutline} color="white" /> {/* Icon color to white */}
            <Text fontWeight="semibold" fontSize="sm" ml={1} color="blue.100"> {/* Lighter text color */}
              Protection Trigger
            </Text>
          </Flex>
          
          <Heading as="h3" fontSize="xl" fontWeight="bold" color="white"> {/* Heading color to white */}
            {formatCurrency(triggerPrice)}
          </Heading>
          
          <Text fontSize="xs" color="blue.200"> {/* Lighter text color */}
            100% of current price (estimate)
          </Text>
        </Box>
        
        {/* Protected Value */} 
        <Box 
           p={5} 
          borderRadius="lg" // Standard border radius for these cards
          bg="blue.600"
          bgGradient="linear(to-b, blue.600, blue.700)"
          color="white"
          shadow="md"
        >
          <Flex align="center" mb={1}>
            <Icon as={IoWalletOutline} color="white" /> {/* Icon color to white */}
            <Text fontWeight="semibold" fontSize="sm" ml={1} color="blue.100"> {/* Lighter text color */}
              Protected Value
            </Text>
          </Flex>
          
          <Heading as="h3" fontSize="xl" fontWeight="bold" color="white"> {/* Heading color to white */}
            {formatCurrency(protectedValueAtTrigger)}
          </Heading>
          
          <Text fontSize="xs" color="blue.200"> {/* Lighter text color */}
            Value protected below trigger for {btcAmount} BTC
          </Text>
        </Box>
        
        {/* Break-even */}
        <Box 
           p={5} 
          borderRadius="lg" // Standard border radius for these cards
          bg="blue.600"
          bgGradient="linear(to-b, blue.600, blue.700)"
          color="white"
          shadow="md"
        >
          <Flex align="center" mb={1}>
            <Icon as={IoSwapHorizontalOutline} color="white" /> {/* Icon color to white */} 
            <Text fontWeight="semibold" fontSize="sm" ml={1} color="blue.100"> {/* Lighter text color */}
              Break-even Price
            </Text>
          </Flex>
          
          <Heading as="h3" fontSize="xl" fontWeight="bold" color="white"> {/* Heading color to white */}
            {formatCurrency(breakEven)}
          </Heading>
          
          <Text fontSize="xs" color="blue.200"> {/* Lighter text color */}
            Price needed to cover premium
          </Text>
        </Box>
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