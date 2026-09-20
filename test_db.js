const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, schoolId: true },
  });
  console.log('USERS count:', users.length);
  console.log('USERS sample:', users.slice(0, 10));

  const staff = await prisma.staffProfile.findMany({
    select: { id: true, name: true, email: true, employeeCode: true, userId: true, role: true },
  });
  console.log('STAFF count:', staff.length);
  console.log('STAFF list:', staff);

  const drivers = await prisma.driver.findMany({
    select: { id: true, name: true, phone: true, userId: true, licenseNumber: true },
  });
  console.log('DRIVERS count:', drivers.length);
  console.log('DRIVERS list:', drivers);

  const classes = await prisma.gradeClass.findMany({
    select: { id: true, name: true, classTeacherId: true, sections: { select: { id: true, name: true, classTeacherId: true } } },
  });
  console.log('CLASSES list:', classes);
}

main().catch(console.error).finally(() => prisma.$disconnect());
