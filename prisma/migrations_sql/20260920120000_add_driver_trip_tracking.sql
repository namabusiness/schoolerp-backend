-- Driver App operational trip and location tracking foundation.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE "TripStatus" AS ENUM ('ACTIVE', 'COMPLETED');
CREATE TYPE "TripType" AS ENUM ('MORNING_PICKUP', 'AFTERNOON_DROP');

CREATE TABLE "Trip" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "driverId" TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "routeId" TEXT NOT NULL,
  "tripType" "TripType" NOT NULL,
  "status" "TripStatus" NOT NULL DEFAULT 'ACTIVE',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "latestLatitude" DOUBLE PRECISION,
  "latestLongitude" DOUBLE PRECISION,
  "latestAccuracy" DOUBLE PRECISION,
  "latestSpeed" DOUBLE PRECISION,
  "latestHeading" DOUBLE PRECISION,
  "latestLocationAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Trip_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Trip_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Trip_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Trip_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Trip_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "TripLocation" (
  "id" TEXT NOT NULL,
  "tripId" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "accuracy" DOUBLE PRECISION,
  "speed" DOUBLE PRECISION,
  "heading" DOUBLE PRECISION,
  "recordedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TripLocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TripLocation_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TripLocation_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Trip_schoolId_status_idx" ON "Trip"("schoolId", "status");
CREATE INDEX "Trip_schoolId_driverId_status_idx" ON "Trip"("schoolId", "driverId", "status");
CREATE INDEX "Trip_schoolId_vehicleId_status_idx" ON "Trip"("schoolId", "vehicleId", "status");
CREATE INDEX "TripLocation_tripId_recordedAt_idx" ON "TripLocation"("tripId", "recordedAt");
CREATE INDEX "TripLocation_schoolId_recordedAt_idx" ON "TripLocation"("schoolId", "recordedAt");

-- Prisma's uuid() default is represented by gen_random_uuid() in PostgreSQL.
ALTER TABLE "Trip" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "TripLocation" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
