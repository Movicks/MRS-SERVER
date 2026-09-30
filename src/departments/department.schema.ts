export type DepartmentDocument = Department;

export class Department {
  id?: string;
  name: string;
  description?: string;
  bedCapacity?: number;
  createdAt?: Date;
  updatedAt?: Date;
}
