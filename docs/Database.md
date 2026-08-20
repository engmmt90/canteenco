# CanteenCo Database Notes

## Family wallet
`ParentProfile -> Wallet` is one-to-one. `ParentProfile -> Student` is one-to-many. A wallet transaction may reference a specific student so statements can show which child made each purchase.

## Student identifiers
- `Student.id`: internal stable database identifier.
- `Student.displayCode`: human-readable school code such as `3C-001`; unique within the school.
- `Student.qrToken`: opaque unique token encoded in the QR. It must not contain sensitive student data.

## Top-up flow
1. Parent creates `TopUpRequest(PENDING)`.
2. No balance change occurs.
3. Admin receives cash and confirms the request.
4. In one database transaction: request becomes `CONFIRMED`, wallet balance increases, immutable `WalletTransaction(TOP_UP)` is created.

## Sale flow
In one database transaction: validate student, wallet, products, server-side prices and balance policy; create `Sale` + `SaleItem`s; create wallet debit transaction; update cached wallet balance. Notification dispatch happens after the financial transaction succeeds.

## Pre-order flow
At confirmation, the wallet is debited and a `PREORDER_DEBIT` ledger entry is created. Cancellation creates a refund transaction; the original debit is never deleted.
