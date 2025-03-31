// Payment Integration Constants
export const IS_PAYMENT_ENABLED = true;
export const PAYMENT_PROVIDER = 'stripe';
export const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

export type TokenPackage = {
  id: string;
  name: string;
  tokens: number;
  price: number;
  tier: 'Pioneer' | 'Voyager' | 'Dominator' | 'Overlord';
  priceId: string;
};

// Token package configuration
export const TOKEN_PACKAGES = {
  basic: {
    id: 'basic',
    name: 'Pioneer Package',
    tokens: 100000,
    price: 5,
    tier: 'Pioneer' as const,
    priceId: 'price_1R8eFVBfSVCq5UYnr5Aaxfex'
  },
  value: {
    id: 'value',
    name: 'Voyager Package',
    tokens: 250000,
    price: 10,
    tier: 'Voyager' as const,
    priceId: 'price_1R8eFaBfSVCq5UYnYPhE1KZG'
  },
  pro: {
    id: 'pro',
    name: 'Dominator Package',
    tokens: 600000,
    price: 20,
    tier: 'Dominator' as const,
    priceId: 'price_1R8eFdBfSVCq5UYnDerAMBOK'
  },
  max: {
    id: 'max',
    name: 'Overlord Package',
    tokens: 1000000,
    price: 25,
    tier: 'Overlord' as const,
    priceId: 'price_1R8eFgBfSVCq5UYnbCgskl2Y'
  }
} as const; 