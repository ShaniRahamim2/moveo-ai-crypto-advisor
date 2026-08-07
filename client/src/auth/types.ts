export interface AuthUser {
  id: string;
  name: string;
  email: string;
  onboardingCompleted: boolean;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}
