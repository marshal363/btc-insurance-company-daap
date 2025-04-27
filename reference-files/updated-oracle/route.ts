import { NextRequest, NextResponse } from 'next/server';
import { getBitcoinPriceData } from '../../../lib/bitcoin-api';

export async function GET(request: NextRequest) {
  try {
    const data = await getBitcoinPriceData();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching Bitcoin price:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Bitcoin price data' },
      { status: 500 }
    );
  }
}

// Force refresh of price data
export async function POST(request: NextRequest) {
  try {
    // Get days parameter from query or use default
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '30', 10);
    
    const refreshedData = await getBitcoinPriceData(true);
    return NextResponse.json(refreshedData);
  } catch (error) {
    console.error('Error refreshing Bitcoin price:', error);
    return NextResponse.json(
      { error: 'Failed to refresh Bitcoin price data' },
      { status: 500 }
    );
  }
}