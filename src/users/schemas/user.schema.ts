export type UserDocument = User;

class DoctorQualifications {
  medicalDegree: string;
  specialization: string;
  licenses: string;
  boardCertifications: string;
  additionalCertifications: string;
  medicalSchool: string;
  graduationYear: string;
}

class DoctorMeta {
  status: string;
  hospital: string;
  qualifications: DoctorQualifications;
}

export class User {
  id?: string;
  email: string;
  name: string;
  imageUrl?: string;
  phone?: string;
  address?: string;
  country?: string;
  state?: string;
  department?: string;
  emergencyPhone?: string;
  passwordHash: string;
  passwordVersion?: number;
  roles?: string[];
  refreshTokenHash?: string;
  failedLoginCount?: number;
  lastLoginAt?: Date;
  suspended?: boolean;
  doctor?: DoctorMeta;
  createdAt?: Date;
  updatedAt?: Date;
}
