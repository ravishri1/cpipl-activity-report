-- User table with all required columns from schema.prisma
CREATE TABLE "User" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "password" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'member',
  "department" TEXT NOT NULL DEFAULT 'General',
  "isActive" BOOLEAN NOT NULL DEFAULT 1,
  "employmentStatus" TEXT NOT NULL DEFAULT 'active',
  "isHibernated" BOOLEAN NOT NULL DEFAULT 0,
  "lastActivityAt" DATETIME,
  "selfReactivationCount" INTEGER NOT NULL DEFAULT 0,
  "selfReactivationMonth" TEXT,
  "googleId" TEXT UNIQUE,
  "importedFromGoogle" BOOLEAN NOT NULL DEFAULT 0,
  "totalPoints" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "employeeId" TEXT UNIQUE,
  "designation" TEXT,
  "dateOfJoining" TEXT,
  "dateOfBirth" TEXT,
  "employmentType" TEXT NOT NULL DEFAULT 'full_time',
  "phone" TEXT,
  "phoneVerified" BOOLEAN NOT NULL DEFAULT 0,
  "personalEmail" TEXT,
  "address" TEXT,
  "emergencyContact" TEXT,
  "emergencyContact2" TEXT,
  "gender" TEXT,
  "bloodGroup" TEXT,
  "profilePhotoUrl" TEXT,
  "driveProfilePhotoUrl" TEXT,
  "driveFolderId" TEXT,
  "reportingManagerId" INTEGER,
  "maritalStatus" TEXT,
  "nationality" TEXT DEFAULT 'Indian',
  "fatherName" TEXT,
  "spouseName" TEXT,
  "religion" TEXT,
  "placeOfBirth" TEXT,
  "permanentAddress" TEXT,
  "aadhaarNumber" TEXT,
  "panNumber" TEXT,
  "passportNumber" TEXT,
  "passportExpiry" TEXT,
  "drivingLicense" TEXT,
  "uanNumber" TEXT,
  "bankName" TEXT,
  "bankAccountNumber" TEXT,
  "bankBranch" TEXT,
  "bankIfscCode" TEXT,
  "confirmationDate" TEXT,
  "probationEndDate" TEXT,
  "noticePeriodDays" INTEGER DEFAULT 30,
  "previousExperience" REAL DEFAULT 0,
  "location" TEXT,
  "grade" TEXT,
  "shift" TEXT DEFAULT 'General',
  "shiftId" INTEGER,
  "companyId" INTEGER
);

-- Create an index on email for faster lookups
CREATE INDEX "User_email_idx" ON "User"("email");

-- Insert admin user
INSERT INTO "User" ("name", "email", "password", "role", "createdAt", "updatedAt") 
VALUES ('Admin', 'admin@cpipl.com', 'password123', 'admin', datetime('now'), datetime('now'));

INSERT INTO "User" ("name", "email", "password", "role", "createdAt", "updatedAt") 
VALUES ('Team Lead', 'teamlead@cpipl.com', 'password123', 'team_lead', datetime('now'), datetime('now'));

INSERT INTO "User" ("name", "email", "password", "role", "employeeId", "createdAt", "updatedAt") 
VALUES ('Rahul Sharma', 'rahul@cpipl.com', 'password123', 'member', 'CPIPL-001', datetime('now'), datetime('now'));
