import { MiaoshouConfig } from "@/lib/miaoshou/types";

export interface MiaoshouTokenState {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
}

export class MiaoshouAuthManager {
  private state: MiaoshouTokenState;

  constructor(private readonly config: MiaoshouConfig) {
    this.state = {
      accessToken: config.accessToken,
      refreshToken: config.refreshToken
    };
  }

  async getAccessToken(): Promise<string | undefined> {
    if (this.state.expiresAt && Date.now() > this.state.expiresAt - 60_000) {
      await this.refreshAccessToken();
    }
    return this.state.accessToken;
  }

  async refreshAccessToken(): Promise<MiaoshouTokenState> {
    // TODO: Replace with the official Miaoshou token refresh endpoint and fields.
    if (!this.state.refreshToken) return this.state;
    this.state = {
      ...this.state,
      expiresAt: Date.now() + 60 * 60 * 1000
    };
    return this.state;
  }
}
