export interface ChatResponse {
  response: string;
  usedGmail?: boolean;
}

export interface AuthStatusResponse {
  authenticated: boolean;
}

export interface ApiError {
  error: string;
}
