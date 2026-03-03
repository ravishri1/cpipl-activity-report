/**
 * Broadcast a notification to multiple users.
 * @param {PrismaClient} prisma
 * @param {{ userIds: number[], type: string, title: string, message?: string, link?: string }} opts
 */
async function notifyUsers(prisma, { userIds, type, title, message, link }) {
  if (!userIds.length) return;
  await prisma.notification.createMany({
    data: userIds.map(userId => ({ userId, type, title, message: message || null, link: link || null })),
  });
}

/**
 * Notify ALL active users (except the actor).
 */
async function notifyAllExcept(prisma, actorId, { type, title, message, link }) {
  const users = await prisma.user.findMany({
    where: { isActive: true, id: { not: actorId } },
    select: { id: true },
  });
  await notifyUsers(prisma, { userIds: users.map(u => u.id), type, title, message, link });
}

module.exports = { notifyUsers, notifyAllExcept };
