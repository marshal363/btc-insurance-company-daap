"use client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

// Add debug logs
console.log("Environment variables:", {
  NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
  CONVEX_URL: process.env.CONVEX_URL,
});

// Initialize the Convex client with the deployment URL from environment
// Add fallback for the URL
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || 'https://hallowed-jellyfish-500.convex.cloud';
console.log("Using Convex URL:", convexUrl);

const convex = new ConvexReactClient(convexUrl);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
} 