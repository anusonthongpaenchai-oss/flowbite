import { api } from '../api';
import { authGuard } from '../../guard/auth';

export type MemberData = {
  id: number;
  username: string;
  email: string;
  m_image_url: string;
  m_name: string;
  m_lastname: string;
  m_phone: string;
  m_phone_code: string;
  m_gender: string;
  m_nationality: string;
  m_country: string;
  m_state: string;
  m_identity: string;
  isActive: number;
  isConfirm: number;
  isKYC: number;
  campaign_name: string;
  lastLogin: string;
  createdAt: string;
  updatedAt: string;
  ib: number;
  ibType: number;
  mt5_category: number;
  member_roles: unknown[];
};

export type AddressData = {
  id: number;
  member_id: number;
  address_no: string;
  address_district: string;
  address_city: string;
  address_state: string;
  address_zipcode: string;
  address_stat: number;
  createdAt: string;
  updatedAt: string;
};

export type UserInfoData = {
  member: MemberData;
  address: AddressData | null;
  isTrusted: boolean;
};

export type UserInfoResponse = {
  result: boolean;
  message: string;
  data: UserInfoData;
};

export async function getUserInfo(): Promise<UserInfoResponse> {
  if (!authGuard()) {
    throw new Error('Please sign in to view your profile.');
  }

  const response = await api.get<UserInfoResponse>('/v1/member/profile');
  return response.data;
}
