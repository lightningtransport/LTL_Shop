import { PrismaClient } from '@prisma/client';
import { applyInspectionChecklist } from './inspection-checklist';
import { applyJobCatalog } from './job-catalog';

/** Production apply path: Release safety `prisma:apply-catalog` (LTR-24 / LTR-35 / LTR-41; D41 inspection checklist). */

const prisma = new PrismaClient();

async function main() {
  const result = await applyJobCatalog(prisma);
  const checklist = await applyInspectionChecklist(prisma);
  console.log(
    JSON.stringify({
      categories: result.categories,
      catalogJobs: result.catalogJobs,
      inspectionChecks: checklist.checks,
      inspectionChecksCreated: checklist.created,
    }),
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
