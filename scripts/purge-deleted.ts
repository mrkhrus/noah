import { prisma } from "../src/lib/db";

/**
 * Permanently deletes accounts that were soft-deleted more than 7 days ago (FR-01).
 * Run manually (`npm run db:purge`) or from a scheduled job.
 */
async function main() {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const stale = await prisma.user.findMany({
    where: { deletedAt: { not: null, lte: cutoff } },
    select: { id: true, email: true, deletedAt: true },
  });
  for (const u of stale) {
    await prisma.user.delete({ where: { id: u.id } });
    console.log(`Purged ${u.email} (deleted ${u.deletedAt?.toISOString()}).`);
  }
  console.log(`Done. Purged ${stale.length} account(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
