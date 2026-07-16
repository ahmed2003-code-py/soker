-- Add TRANSFER value to TxnKind enum (does not affect treasury balance)
ALTER TYPE "TxnKind" ADD VALUE IF NOT EXISTS 'TRANSFER';
