import { PrismaClient } from '@prisma/client';
import { applyJobCatalog } from './job-catalog';

const prisma = new PrismaClient();

async function main() {
  const result = await applyJobCatalog(prisma);
  console.log(
    JSON.stringify({
      categories: result.categories,
      catalogJobs: result.catalogJobs,
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
