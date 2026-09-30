import { randomBytes } from 'crypto';

export type InvitationDocument = Invitation;

type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export class Invitation {
  id?: string;
  email: string;
  role: string;
  token: string;
  status: InvitationStatus;
  invitedBy?: string;
  acceptedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export function generateInvitationToken() {
  return randomBytes(16).toString('hex');
}
