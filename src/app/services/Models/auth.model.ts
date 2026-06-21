export interface UserProfile {
  user_id: string;
  email?: string;
  full_name?: string;
  avatar_url?: string;
  is_paid?: boolean;
  plan_type?: 'basic' | 'advanced' | null;
  membership_type?: 'monthly' | 'yearly' | null;
  membership_start?: string;
  membership_end?: string;
  next_billing_date?: string;
  is_trial?: boolean;
  trial_start?: string;
  trial_end?: string;
  payment_customer_id?: string;
  payment_subscription_id?: string;
  payment_provider?: string;
  payment_price_id?: string;
  created_at?: string;
  updated_at?: string;
  is_lifetime?: boolean; 
}

export interface SelectPlanPayload {
  plan_type: 'basic' | 'advanced';
  isAnnual: boolean;
}

export interface DriveStorage {
  used_gb: number;
  total_gb: number;
  percent: number;
}