export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  email_notifications: boolean;
  created_at: string;
  updated_at: string;
}

export interface UpdateProfileDto {
  full_name?: string;
  email_notifications?: boolean;
}
