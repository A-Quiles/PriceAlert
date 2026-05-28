export type Plan = 'free' | 'premium';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  email_notifications: boolean;
  plan: Plan;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpdateProfileDto {
  full_name?: string;
  email_notifications?: boolean;
}
