// Shared types and utilities for Ctxl

export const VERSION = '0.1.0';

// Plan definitions
export const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    memories: 1_000,
    apiCalls: 10_000,
    projects: 1,
  },
  indie: {
    name: 'Indie',
    price: 29,
    memories: 50_000,
    apiCalls: 100_000,
    projects: 5,
  },
  pro: {
    name: 'Pro',
    price: 79,
    memories: 500_000,
    apiCalls: 1_000_000,
    projects: -1,
  },
  scale: {
    name: 'Scale',
    price: 199,
    memories: 5_000_000,
    apiCalls: 10_000_000,
    projects: -1,
  },
  enterprise: {
    name: 'Enterprise',
    price: -1,
    memories: -1,
    apiCalls: -1,
    projects: -1,
  },
} as const;

export type PlanId = keyof typeof PLANS;
