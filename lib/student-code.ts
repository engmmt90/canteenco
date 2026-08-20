export function normalizeClassCode(grade: string, classSection?: string | null) {
  const raw = `${grade}${classSection ?? ""}`.replace(/\s+/g, "").toUpperCase();
  const classCode = raw.replace(/[^A-Z0-9]/g, "");

  if (!classCode) {
    throw new Error("A valid class is required to create a student code.");
  }

  return classCode;
}

export function buildStudentDisplayCode(classCode: string, sequenceNumber: number) {
  if (!Number.isInteger(sequenceNumber) || sequenceNumber < 1) {
    throw new Error("Student sequence number must be a positive integer.");
  }

  return `${classCode}-${String(sequenceNumber).padStart(3, "0")}`;
}
