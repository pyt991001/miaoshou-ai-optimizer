export class MiaoshouApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable = false,
    public readonly raw?: unknown
  ) {
    super(message);
    this.name = "MiaoshouApiError";
  }
}

export function mapMiaoshouError(code?: string, message?: string, raw?: unknown): MiaoshouApiError {
  switch (code) {
    case "TOKEN_EXPIRED":
    case "401":
      return new MiaoshouApiError("Miaoshou access token expired", "TOKEN_EXPIRED", true, raw);
    case "SIGNATURE_ERROR":
    case "INVALID_SIGNATURE":
    case "signInvalid":
    case "signMissing":
    case "signExpired":
      return new MiaoshouApiError("Miaoshou signature error. Check app key, app secret and signing algorithm.", "SIGNATURE_ERROR", false, raw);
    case "IP_NOT_ALLOWED":
    case "IP_WHITE_LIST_ERROR":
    case "ipNotInWhitelist":
      return new MiaoshouApiError("Miaoshou rejected this server IP. Add the server IP to the Miaoshou API whitelist.", "IP_WHITE_LIST_ERROR", false, raw);
    case "RATE_LIMIT":
    case "accountQpsRateLimit":
    case "accountQpmRateLimit":
    case "accountQpdRateLimit":
    case "appQpsRateLimit":
    case "appQpmRateLimit":
    case "appQpdRateLimit":
    case "apiQpsRateLimit":
    case "apiQpmRateLimit":
    case "apiQpdRateLimit":
    case "platformQpsRateLimit":
    case "platformQpmRateLimit":
    case "platformQpdRateLimit":
    case "429":
      return new MiaoshouApiError("Miaoshou API rate limit reached", "RATE_LIMIT", true, raw);
    case "PRODUCT_NOT_FOUND":
      return new MiaoshouApiError("Miaoshou product not found", "PRODUCT_NOT_FOUND", false, raw);
    default:
      return new MiaoshouApiError(message ?? "Unknown Miaoshou API error", code ?? "UNKNOWN", false, raw);
  }
}
