ALTER TABLE "User"
ADD COLUMN "canWorkAllSchools" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "nfcCardNumber" TEXT;

CREATE TABLE "StaffSchoolAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffSchoolAccess_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StaffAttendance" (
    "id" TEXT NOT NULL,
    "staffUserId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "clockInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clockOutAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffAttendance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StaffSchoolAccess_schoolId_idx"
ON "StaffSchoolAccess"("schoolId");

CREATE UNIQUE INDEX "StaffSchoolAccess_userId_schoolId_key"
ON "StaffSchoolAccess"("userId", "schoolId");

CREATE INDEX "StaffAttendance_staffUserId_clockInAt_idx"
ON "StaffAttendance"("staffUserId", "clockInAt");

CREATE INDEX "StaffAttendance_schoolId_clockInAt_idx"
ON "StaffAttendance"("schoolId", "clockInAt");

CREATE INDEX "StaffAttendance_clockOutAt_idx"
ON "StaffAttendance"("clockOutAt");

CREATE UNIQUE INDEX "User_nfcCardNumber_key"
ON "User"("nfcCardNumber");

ALTER TABLE "StaffSchoolAccess"
ADD CONSTRAINT "StaffSchoolAccess_userId_fkey"
FOREIGN KEY ("userId")
REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "StaffSchoolAccess"
ADD CONSTRAINT "StaffSchoolAccess_schoolId_fkey"
FOREIGN KEY ("schoolId")
REFERENCES "School"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "StaffAttendance"
ADD CONSTRAINT "StaffAttendance_staffUserId_fkey"
FOREIGN KEY ("staffUserId")
REFERENCES "User"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "StaffAttendance"
ADD CONSTRAINT "StaffAttendance_schoolId_fkey"
FOREIGN KEY ("schoolId")
REFERENCES "School"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;
