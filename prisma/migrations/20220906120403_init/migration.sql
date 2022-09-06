-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Dienstplan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "personId" TEXT NOT NULL,
    "dienstId" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    CONSTRAINT "Dienstplan_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Dienstplan_dienstId_fkey" FOREIGN KEY ("dienstId") REFERENCES "Dienst" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Dienst" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shortName" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "active" BOOLEAN NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Person_lastName_key" ON "Person"("lastName");
