# DANA QRIS API Documentation

This directory contains reference documentation for DANA's QRIS MPM (Acquirer) API integration.

## Files

- `qris_MPM.txt`: Overview of the QRIS MPM (Acquirer) service
- `qris_generation.txt`: Documentation for the Generate QRIS API
- `qris_query_payment.txt`: Documentation for the Query Payment API
- `qris_finish_notify.txt`: Documentation for the Finish Notify API
- `qris_cancel_order.txt`: Documentation for the Cancel Order API
- `qris_refund.txt`: Documentation for the Refund Order API

## Important Endpoints

- **Generate QRIS**: `/v1.0/qr/qr-mpm-generate.htm`
- **Query Payment**: `/v1.0/qr/query.htm`
- **Finish Notify**: `/v1.0/debit/notify`
- **Cancel Order**: `/v1.0/debit/cancel.htm`
- **Refund Order**: `/v1.0/refund.htm`

## Environment URLs

- **Sandbox**: `https://api.sandbox.dana.id`
- **Production**: `https://api.saas.dana.id`

## Integration Notes

- All API requests must include proper headers (X-TIMESTAMP, X-SIGNATURE, etc.)
- Signature generation uses asymmetric SHA256withRSA
- QR codes expire after a set period (configurable up to 15 minutes)
- Webhook endpoints must be registered for payment notifications

**Note**: These files are for internal reference only and should not be committed to version control. 