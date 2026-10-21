// Error types shared by the API layer. Kept in their own module so the HTTP error handler
// doesn't import the PayPal client or the AI client (see tests/boundary.test.ts).

export class PayPalError extends Error {
  constructor(
    message: string,
    public status: number,
    public issue?: string,
    public debugId?: string,
  ) {
    super(message);
  }
}

export class AIError extends Error {}
