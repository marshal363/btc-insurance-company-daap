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
        <Box bg="white" p={3} borderRadius="md" boxShadow="md" borderWidth="1px" borderColor="gray.200">
          <Text fontWeight="bold" mb={1}>BTC Price: {formatCurrency(label)}</Text>
          {/* Ensure payload has expected structure before accessing */}
          {payload[0] && <Text fontSize="sm" color={theme.colors.orange[500]}>{payload[0].name}: {formatCurrency(payload[0].value)}</Text>}
          {payload[1] && <Text fontSize="sm" color={theme.colors.blue[500]}>{payload[1].name}: {formatCurrency(payload[1].value)}</Text>}
        </Box>
      );
    }
    return null;
  };
  
  return (
    <Box>
      <Flex justify="space-between" align="center" mb={4}>
        <Flex align="center">
          <Icon as={IoStatsChart} color="blue.500" mr={2} />
          <Heading as="h2" fontSize="xl" fontWeight="bold">
            Protection Visualization
          </Heading>
        </Flex>
        
        <Badge 
          colorScheme="blue" 
          variant="outline"
          fontSize="sm"
          px={3}
          py={1}
          borderRadius="md"
        >
          BTC Price Scenarios
        </Badge>
      </Flex>
      
      {/* --- Recharts Payoff Chart --- */}
      <Box height="300px" mb={8}> 
        <ResponsiveContainer width="100%" height="100%">
          <LineChart 
            data={chartData}
            margin={{ top: 5, right: 20, left: 30, bottom: 5 }} // Adjusted margins for labels
          >
            <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.gray[200]} />
            <XAxis 
              dataKey="btcPrice" 
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(value) => `$${Math.round(value / 1000)}k`} // Format ticks as $XXk
              label={{ value: 'BTC Price at Expiry', position: 'insideBottom', offset: -5, dy: 10, fontSize: '12px', fill: theme.colors.gray[600] }}
              stroke={theme.colors.gray[400]}
              tick={{ fontSize: '11px', fill: theme.colors.gray[600] }}
            />
            <YAxis 
              tickFormatter={(value) => `$${Math.round(value / 1000)}k`} // Format ticks as $Xk
              label={{ value: 'Portfolio Value', angle: -90, position: 'insideLeft', offset: -20, dx: -10, fontSize: '12px', fill: theme.colors.gray[600] }}
              stroke={theme.colors.gray[400]}
              tick={{ fontSize: '11px', fill: theme.colors.gray[600] }}
              width={80} // Give YAxis more space
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px' }} />
            <Line 
              type="monotone" 
              dataKey="unprotectedValue" 
              name="Unprotected Value" 
              stroke={theme.colors.orange[400]} // Use theme color
              strokeWidth={2}
              dot={false} 
            />
            <Line 
              type="monotone" 
              dataKey="protectedValue" 
              name="Protected Value" 
              stroke={theme.colors.blue[500]} // Use theme color
              strokeWidth={2}
              dot={false} 
            />
            {/* Reference Lines for Key Metrics */}
            <ReferenceLine 
              x={triggerPrice} 
              stroke={theme.colors.red[400]} 
              strokeDasharray="3 3" 
              label={{ value: 'Trigger', position: 'insideTopLeft', fill: theme.colors.red[500], fontSize: '10px', dy: -5 }} 
            />
            <ReferenceLine 
              x={breakEven} 
              stroke={theme.colors.green[500]} 
              strokeDasharray="3 3" 
              label={{ value: 'Break-even', position: 'insideTopRight', fill: theme.colors.green[600], fontSize: '10px', dy: -5 }} 
            />
          </LineChart>
        </ResponsiveContainer>
      </Box>
      
      {/* Key Metrics - Icons Updated */}
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4} mb={8}>
        {/* Protection Trigger */}
        <Box 
          p={4} 
          borderRadius="md" 
          borderWidth="1px" 
          borderColor="gray.200"
          bg="blue.50"
        >
          <Flex align="center" mb={1}>
            <Icon as={IoShieldCheckmarkOutline} color="blue.500" /> 
            <Text fontWeight="semibold" fontSize="sm" ml={1}>
              Protection Trigger
            </Text>
          </Flex>
          
          <Heading as="h3" fontSize="xl" fontWeight="bold" color="blue.700">
            {formatCurrency(triggerPrice)}
          </Heading>
          
          <Text fontSize="xs" color="gray.500">
            100% of current price (estimate)
          </Text>
        </Box>
        
        {/* Max Recovery */}
        <Box 
          p={4} 
          borderRadius="md" 
          borderWidth="1px" 
          borderColor="gray.200"
          bg="blue.50"
        >
          <Flex align="center" mb={1}>
            <Icon as={IoWalletOutline} color="green.500" />
            <Text fontWeight="semibold" fontSize="sm" ml={1}>
              Protected Value
            </Text>
          </Flex>
          
          <Heading as="h3" fontSize="xl" fontWeight="bold" color="blue.700">
            {formatCurrency(protectedValueAtTrigger)}
          </Heading>
          
          <Text fontSize="xs" color="gray.500">
            Value protected below trigger for {btcAmount} BTC
          </Text>
        </Box>
        
        {/* Break-even */}
        <Box 
          p={4} 
          borderRadius="md" 
          borderWidth="1px" 
          borderColor="gray.200"
          bg="blue.50"
        >
          <Flex align="center" mb={1}>
            <Icon as={IoSwapHorizontalOutline} color="blue.500" /> 
            <Text fontWeight="semibold" fontSize="sm" ml={1}>
              Break-even Price
            </Text>
          </Flex>
          
          <Heading as="h3" fontSize="xl" fontWeight="bold" color="blue.700">
            {formatCurrency(breakEven)}
          </Heading>
          
          <Text fontSize="xs" color="gray.500">
            Price needed to cover premium
          </Text>
        </Box>
      </SimpleGrid>
      
      {/* Explanation Boxes */}
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
        <Box p={4} borderRadius="md" bg="blue.50">
          <Flex gap={2}>
            <Icon as={IoInformationCircle} color="blue.500" mt={0.5} />
            <Box>
              <Text fontSize="sm" fontWeight="medium" color="blue.700" mb={1}>
                What happens if Bitcoin drops?
              </Text>
              <Text fontSize="sm" color="blue.600">
                If Bitcoin drops below your protection level, you&apos;ll be compensated for the difference, offsetting your losses.
              </Text>
            </Box>
          </Flex>
        </Box>
        
        <Box p={4} borderRadius="md" bg="blue.50">
          <Flex gap={2}>
            <Icon as={IoInformationCircle} color="blue.500" mt={0.5} />
            <Box>
              <Text fontSize="sm" fontWeight="medium" color="blue.700" mb={1}>
                What if it rises?
              </Text>
              <Text fontSize="sm" color="blue.600">
                If Bitcoin rises, you&apos;ll benefit from the upside while having paid a small premium for peace of mind.
              </Text>
            </Box>
          </Flex>
        </Box>
      </SimpleGrid>
    </Box>
  );
} 