export type AdminDocument = Admin;

export class Admin {
  id?: string;
  email: string;
  name: string;
  imageUrl?: string;
  phone?: string;
  address?: string;
  country?: string;
  state?: string;
  emergencyPhone?: string;
  passwordHash: string;
  passwordVersion?: number;
  roles?: string[];
  refreshTokenHash?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
