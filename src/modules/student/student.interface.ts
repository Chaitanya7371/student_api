/** What the service works with. camelCase. The guardian is one nested object. */
export interface Guardian {
  name: string;
  phone: string;
  relation: 'father' | 'mother' | 'guardian';
}

export interface Student {
  id: number;
  rollNo: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  className: string;
  section: string;
  guardian: Guardian;
  createdAt: Date;
  updatedAt: Date;
}

/** One database row. snake_case. The guardian is stored as three columns. */
export interface StudentRow {
  id: number;
  roll_no: string;
  first_name: string;
  last_name: string;
  date_of_birth: Date;
  class_name: string;
  section: string;
  guardian_name: string;
  guardian_phone: string;
  guardian_relation: string;
  created_at: Date;
  updated_at: Date;
}

/** Fields a caller may change. Absent fields are left alone. */
export type StudentChanges = Partial<Omit<Student, 'id' | 'createdAt' | 'updatedAt'>>;

/** Flat columns ready for an INSERT or UPDATE. Only present fields are included. */
export interface StudentWritableColumns {
  roll_no?: string;
  first_name?: string;
  last_name?: string;
  date_of_birth?: string;
  class_name?: string;
  section?: string;
  guardian_name?: string;
  guardian_phone?: string;
  guardian_relation?: string;
}
