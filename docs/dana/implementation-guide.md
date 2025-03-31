# DANA Payment Gateway Implementation Guide

This document outlines the steps required to implement and configure DANA payment gateway integration.

## Security Requirements

DANA requires proper RSA key pairs for secure signature generation and verification. This is a **mandatory** requirement for both sandbox and production environments.

### Generating RSA Keys

Follow these steps to generate the required RSA key pair:

1. Create the RSA Private Key (PKCS#1):
   ```bash
   openssl genrsa -out rsa_private_key.pem 2048
   ```

2. Convert the Private Key to PKCS#8 format (required by DANA):
   ```bash
   openssl pkcs8 -topk8 -in rsa_private_key.pem -out pkcs8_rsa_private_key.pem -nocrypt
   ```

3. Generate the Public Key:
   ```bash
   openssl rsa -in rsa_private_key.pem -out rsa_public_key.pem -pubout
   ```

4. Share the public key (`rsa_public_key.pem`) with DANA through their Merchant Portal.

5. Securely store your private key (`pkcs8_rsa_private_key.pem`) and never share it with anyone.

## Environment Variables

Add the following environment variables to your `.env.local` file:

```
# DANA Payment Gateway Configuration
DANA_ENABLED=true
DANA_ENVIRONMENT=sandbox  # or 'production' for live environment

# API Credentials provided by DANA
DANA_CLIENT_ID=your_client_id
DANA_MERCHANT_ID=your_merchant_id
DANA_API_KEY=your_api_key
DANA_API_SECRET=your_api_secret

# Your RSA Private Key - must be in PKCS#8 format with proper PEM formatting
DANA_PRIVATE_KEY='-----BEGIN PRIVATE KEY-----
MIIEvg...your_private_key_here...
...
...
-----END PRIVATE KEY-----'
```

**Important Notes:**
- The private key should be properly formatted with line breaks every 64 characters
- Include the BEGIN/END PRIVATE KEY markers
- Make sure the private key is in PKCS#8 format
- Be extremely careful with your private key and treat it as a sensitive secret

## Implementation Details

Our integration uses RSA-SHA256 signatures for authentication with DANA:

1. B2B Access Token Acquisition:
   - Uses RSA-based signatures for authentication
   - Caches tokens to prevent excessive authorization requests
   - Required before making any payment API calls

2. Payment Request:
   - Generates a unique reference number for tracking
   - Uses the acquired B2B token for authentication
   - Creates a payment URL for the customer

3. Webhook Handling:
   - Validates incoming webhooks using signature verification
   - Updates transaction status based on webhook notifications

## Testing Your Implementation

1. Make sure all environment variables are properly set
2. Verify RSA key generation and configuration
3. Test a payment flow in the sandbox environment
4. Validate webhook handling

## Troubleshooting

Common issues and solutions:

1. "Failed to generate RSA signature" error:
   - Ensure your private key is properly formatted in PKCS#8 format
   - Check that line breaks are preserved in the environment variable
   - Verify the BEGIN/END markers are included

2. "Invalid Client" error:
   - Verify your Client ID is correct
   - Ensure your public key has been properly registered with DANA

3. Authentication failures:
   - Double-check timestamp formatting (must be GMT+7)
   - Verify signature base string formatting

## Migration to Production

Before going to production:

1. Generate new RSA key pairs for the production environment
2. Update all environment variables with production credentials
3. Share the production public key with DANA
4. Test thoroughly in the sandbox environment first 