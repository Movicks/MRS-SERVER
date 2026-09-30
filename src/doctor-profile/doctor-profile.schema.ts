export type DoctorProfileDocument = DoctorProfile;

class PersonalInfo {
  id: string;
  fullName: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  state: string;
  phone: string;
  email: string;
  address: string;
  idDocument: string;
  emergencyContact: string;
  imageUrl: string;
  hospital: string;
  status: string;
}

class Qualifications {
  medicalDegree: string;
  specialization: string;
  licenses: string;
  boardCertifications: string;
  additionalCertifications: string;
  medicalSchool: string;
  graduationYear: string;
}

class Experience {
  employers: string;
  jobTitles: string;
  responsibilities: string;
  references: string;
  specializedExperience: string;
}

class Cme {
  workshops: string;
  research: string;
  fellowships: string;
}

class Skills {
  clinicalSkills: string;
  surgicalExperience: string;
  equipment: string;
  leadership: string;
}

class Health {
  medicalHistory: string;
  vaccinations: string;
  screenings: string;
}

class Legal {
  licenseProof: string;
  backgroundCheck: string;
  insurance: string;
}

class Statement {
  motivation: string;
  careerGoals: string;
  hospitalReason: string;
}

class Documents {
  cv: string;
  photo: string;
  contract: string;
  availability: string;
}

export class DoctorProfile {
  id?: string;
  userId: string;
  passwordHash?: string;
  passwordVersion?: number;
  refreshTokenHash?: string;
  personalInfo: PersonalInfo;
  qualifications: Qualifications;
  experience: Experience;
  cme: Cme;
  skills: Skills;
  health: Health;
  legal: Legal;
  statement: Statement;
  documents: Documents;
  stepsCompleted: number;
  createdAt?: Date;
  updatedAt?: Date;
}
