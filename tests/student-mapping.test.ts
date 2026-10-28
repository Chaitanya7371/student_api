import { describe, expect, it } from 'vitest';
import { toAverageResponse } from '../src/modules/mark/mark.service.js';
import { toDomain as markToDomain, toPersistence as markToPersistence } from '../src/modules/mark/mark.repository.js';
import type { MarkRow } from '../src/modules/mark/mark.interface.js';
import { toDomain, toPersistence } from '../src/modules/student/student.repository.js';
import type { Student, StudentRow } from '../src/modules/student/student.interface.js';

const createdAt = new Date('2026-10-01T00:00:00.000Z');
const updatedAt = new Date('2026-10-02T00:00:00.000Z');

const studentRow: StudentRow = {
  id: 4,
  roll_no: '2026-10A-017',
  first_name: 'Asha',
  last_name: 'Sharma',
  date_of_birth: new Date('2012-04-15T00:00:00.000Z'),
  class_name: '10',
  section: 'A',
  guardian_name: 'Ravi Sharma',
  guardian_phone: '+919876543210',
  guardian_relation: 'father',
  created_at: createdAt,
  updated_at: updatedAt,
};

const markRow = (score: string, maxScore: string): MarkRow => ({
  id: 9,
  student_id: 4,
  exam: 'final',
  subject: 'maths',
  score,
  max_score: maxScore,
  created_at: createdAt,
  updated_at: updatedAt,
});

describe('student mapping', () => {
  it('turns a flat row into a student with a nested guardian', () => {
    expect(toDomain(studentRow).guardian).toEqual({
      name: 'Ravi Sharma',
      phone: '+919876543210',
      relation: 'father',
    });
    expect(toDomain(studentRow).dateOfBirth).toEqual(studentRow.date_of_birth);
  });

  it('turns a nested guardian into three columns', () => {
    const columns = toPersistence({
      guardian: { name: 'Meera Sharma', phone: '+919876543210', relation: 'mother' },
    });
    expect(columns).toEqual({
      guardian_name: 'Meera Sharma',
      guardian_phone: '+919876543210',
      guardian_relation: 'mother',
    });
  });

  it('maps only the fields present on a partial update', () => {
    expect(toPersistence({ firstName: 'Asha' })).toEqual({ first_name: 'Asha' });
  });

  it('throws when guardian_relation is not one the domain knows', () => {
    expect(() => toDomain({ ...studentRow, guardian_relation: 'uncle' })).toThrow(/Unknown guardian_relation/);
  });

  it('round-trips a student from domain to columns and back', () => {
    const domain = toDomain(studentRow);
    const columns = toPersistence(domain);
    const again = toDomain({
      ...studentRow,
      roll_no: columns.roll_no ?? studentRow.roll_no,
      first_name: columns.first_name ?? studentRow.first_name,
      last_name: columns.last_name ?? studentRow.last_name,
      date_of_birth: new Date(`${columns.date_of_birth}T00:00:00.000Z`),
      class_name: columns.class_name ?? studentRow.class_name,
      section: columns.section ?? studentRow.section,
      guardian_name: columns.guardian_name ?? studentRow.guardian_name,
      guardian_phone: columns.guardian_phone ?? studentRow.guardian_phone,
      guardian_relation: columns.guardian_relation ?? studentRow.guardian_relation,
    });

    expect(again.rollNo).toBe(domain.rollNo);
    expect(again.guardian).toEqual(domain.guardian);
    expect(again.dateOfBirth.toISOString()).toBe(domain.dateOfBirth.toISOString());
    expect(again).toMatchObject({
      firstName: domain.firstName,
      lastName: domain.lastName,
      className: domain.className,
      section: domain.section,
    } satisfies Partial<Student>);
  });
});

describe('mark mapping', () => {
  it('turns NUMERIC strings into numbers', () => {
    const mark = markToDomain(markRow('78.50', '100.00'));
    expect(mark.score).toBe(78.5);
    expect(mark.maxScore).toBe(100);
  });

  it('throws when a NUMERIC string is not a number', () => {
    expect(() => markToDomain(markRow('nope', '100.00'))).toThrow(/Invalid NUMERIC/);
  });

  it('writes score and maxScore as numbers', () => {
    expect(markToPersistence({ score: 78.5, maxScore: 100 })).toEqual({ score: 78.5, max_score: 100 });
  });

  it('maps only the mark fields present on a partial update', () => {
    expect(markToPersistence({ score: 10 })).toEqual({ score: 10 });
  });

  it('round-trips a mark from domain to columns and back', () => {
    const domain = markToDomain(markRow('78.50', '100.00'));
    const columns = markToPersistence(domain);
    const again = markToDomain({
      ...markRow(String(columns.score), String(columns.max_score)),
      student_id: columns.student_id ?? domain.studentId,
      exam: columns.exam ?? domain.exam,
      subject: columns.subject ?? domain.subject,
    });
    expect(again.score).toBe(domain.score);
    expect(again.maxScore).toBe(domain.maxScore);
    expect(again.subject).toBe(domain.subject);
    expect(again.exam).toBe(domain.exam);
  });
});

describe('pass or fail', () => {
  it('uses PASS_PERCENTAGE from config (40 in tests)', () => {
    expect(toAverageResponse({ subject: 'maths', averagePercentage: 72.35, students: 31 })).toEqual({
      subject: 'maths',
      averagePercentage: 72.35,
      students: 31,
      passed: true,
    });
    expect(toAverageResponse({ subject: 'english', averagePercentage: 39.99, students: 10 }).passed).toBe(false);
  });
});
