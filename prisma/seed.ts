import { PrismaClient, Role, SchoolStatus, AttendanceStatus, InvoiceStatus, LoanStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding School ERP database...');

  const passwordHash = await bcrypt.hash('Admin@123', 10);

  // 1. Super Admin Account
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@schoolerp.com' },
    update: {},
    create: {
      email: 'superadmin@schoolerp.com',
      passwordHash,
      name: 'Platform Super Admin',
      role: Role.SUPER_ADMIN,
    },
  });

  // 2. Subscription Plans
  const basicPlan = await prisma.subscriptionPlan.upsert({
    where: { id: 'plan-basic' },
    update: {},
    create: {
      id: 'plan-basic',
      name: 'Basic',
      description: 'Core school operations for small academies',
      monthlyPrice: 99,
      annualPrice: 990,
      studentLimit: 300,
      staffLimit: 30,
      features: JSON.stringify(['ACADEMICS', 'ATTENDANCE', 'FEES', 'COMMUNICATION']),
    },
  });

  const enterprisePlan = await prisma.subscriptionPlan.upsert({
    where: { id: 'plan-enterprise' },
    update: {},
    create: {
      id: 'plan-enterprise',
      name: 'Enterprise',
      description: 'Full suite with all 30 flows unlocked for premier institutions',
      monthlyPrice: 399,
      annualPrice: 3990,
      studentLimit: 5000,
      staffLimit: 500,
      features: JSON.stringify([
        'ADMISSION', 'ACADEMICS', 'ATTENDANCE', 'FEES', 'EXAMS',
        'TRANSPORT', 'LIBRARY', 'COMMUNICATION', 'HR', 'INVENTORY',
        'EVENTS', 'HEALTH', 'CERTIFICATES', 'PROMOTION',
      ]),
    },
  });

  // 3. Demo School: Greenwood High International
  const school = await prisma.school.upsert({
    where: { slug: 'greenwood-high' },
    update: {},
    create: {
      id: 'school-greenwood-high',
      name: 'Greenwood High International',
      code: 'GWH-2026',
      slug: 'greenwood-high',
      address: '42 Academic Boulevard, Metro West',
      phone: '+1 (555) 019-2834',
      email: 'office@greenwoodhigh.edu',
      status: SchoolStatus.ACTIVE,
      planId: enterprisePlan.id,
      studentLimit: 2500,
      staffLimit: 200,
      enabledModules: {
        create: [
          'ADMISSION', 'ACADEMICS', 'ATTENDANCE', 'FEES', 'EXAMS',
          'TRANSPORT', 'LIBRARY', 'COMMUNICATION', 'HR', 'INVENTORY',
          'EVENTS', 'HEALTH', 'CERTIFICATES', 'PROMOTION',
        ].map((m) => ({ moduleKey: m, isEnabled: true })),
      },
    },
  });

  // 4. School Administrator User & Principal
  const schoolAdminUser = await prisma.user.upsert({
    where: { email: 'admin@greenwoodhigh.edu' },
    update: {},
    create: {
      email: 'admin@greenwoodhigh.edu',
      passwordHash,
      name: 'Dr. Eleanor Vance',
      role: Role.SCHOOL_ADMIN,
      schoolId: school.id,
    },
  });

  await prisma.schoolAdmin.upsert({
    where: { userId: schoolAdminUser.id },
    update: {},
    create: {
      schoolId: school.id,
      userId: schoolAdminUser.id,
      adminRole: Role.SCHOOL_ADMIN,
      permissions: JSON.stringify(['ALL']),
      isInvited: true,
      invitationAccepted: true,
    },
  });

  // 5. Academic Year & Terms
  const academicYear = await prisma.academicYear.upsert({
    where: { id: 'ay-2026-2027' },
    update: {},
    create: {
      id: 'ay-2026-2027',
      schoolId: school.id,
      name: '2026-2027 Academic Session',
      startDate: new Date('2026-06-01'),
      endDate: new Date('2027-05-31'),
      isCurrent: true,
      terms: {
        create: [
          {
            schoolId: school.id,
            name: 'Term 1 (Fall)',
            startDate: new Date('2026-06-01'),
            endDate: new Date('2026-11-30'),
          },
          {
            schoolId: school.id,
            name: 'Term 2 (Spring)',
            startDate: new Date('2026-12-01'),
            endDate: new Date('2027-05-31'),
          },
        ],
      },
    },
  });

  // 6. Classes & Sections
  const grade10 = await prisma.gradeClass.upsert({
    where: { id: 'class-g10' },
    update: {},
    create: {
      id: 'class-g10',
      schoolId: school.id,
      name: 'Grade 10',
      code: 'G10',
    },
  });

  const sectionA = await prisma.section.upsert({
    where: { id: 'sec-g10-a' },
    update: {},
    create: {
      id: 'sec-g10-a',
      schoolId: school.id,
      classId: grade10.id,
      name: 'Section A',
      capacity: 35,
    },
  });

  // 7. Subjects
  const mathSubject = await prisma.subject.upsert({
    where: { id: 'sub-math-10' },
    update: {},
    create: {
      id: 'sub-math-10',
      schoolId: school.id,
      classId: grade10.id,
      name: 'Advanced Mathematics',
      code: 'MATH101',
    },
  });

  const physicsSubject = await prisma.subject.upsert({
    where: { id: 'sub-phy-10' },
    update: {},
    create: {
      id: 'sub-phy-10',
      schoolId: school.id,
      classId: grade10.id,
      name: 'Physics & Lab Mechanics',
      code: 'PHY101',
    },
  });

  // 8. Demo Student 360 Profile
  const student = await prisma.student.upsert({
    where: { admissionNumber: 'ADM-2026-1001' },
    update: {},
    create: {
      id: 'student-alex-chen',
      schoolId: school.id,
      admissionNumber: 'ADM-2026-1001',
      rollNumber: '10-A-01',
      firstName: 'Alexander',
      lastName: 'Chen',
      dob: new Date('2010-04-15'),
      gender: 'Male',
      bloodGroup: 'O+',
      classId: grade10.id,
      sectionId: sectionA.id,
      academicYearId: academicYear.id,
      status: 'ACTIVE',
      address: '742 Evergreen Terrace, West Hills',
      healthRecord: {
        create: {
          schoolId: school.id,
          bloodGroup: 'O+',
          allergies: 'Peanuts, Penicillin',
          conditions: 'Mild seasonal asthma',
          emergencyPhone: '+1 (555) 482-9901',
        },
      },
    },
  });

  // 9. Fee Invoice
  await prisma.studentFeeInvoice.upsert({
    where: { invoiceNo: 'INV-2026-001' },
    update: {},
    create: {
      schoolId: school.id,
      invoiceNo: 'INV-2026-001',
      studentId: student.id,
      title: 'Term 1 Tuition & Laboratory Fee',
      totalAmount: 1850,
      paidAmount: 1850,
      balanceAmount: 0,
      dueDate: new Date('2026-09-30'),
      status: InvoiceStatus.PAID,
      payments: {
        create: {
          schoolId: school.id,
          receiptNo: 'RCP-2026-001',
          amountPaid: 1850,
          paymentMode: 'ONLINE',
          transactionRef: 'TXN-SPB-8839201',
          collectedBy: 'Finance Portal',
        },
      },
    },
  });

  // 10. Fleet & Transport
  const vehicle = await prisma.vehicle.upsert({
    where: { registrationNo: 'BUS-GWH-01' },
    update: {},
    create: {
      schoolId: school.id,
      registrationNo: 'BUS-GWH-01',
      model: 'Volvo 9700 School Edition (45 Seater)',
      capacity: 45,
      status: 'ACTIVE',
    },
  });

  const route = await prisma.route.upsert({
    where: { id: 'route-north-101' },
    update: {},
    create: {
      id: 'route-north-101',
      schoolId: school.id,
      name: 'Route 101 - North Valley Express',
      vehicleId: vehicle.id,
      driverName: 'Robert Martinez',
      driverPhone: '+1 (555) 839-1122',
    },
  });

  const stop = await prisma.routeStop.upsert({
    where: { id: 'stop-evergreen' },
    update: {},
    create: {
      id: 'stop-evergreen',
      schoolId: school.id,
      routeId: route.id,
      stopName: 'Evergreen Terrace Square',
      pickupTime: '07:20',
      dropTime: '15:40',
      stopOrder: 1,
    },
  });

  await prisma.studentTransportAssignment.upsert({
    where: { studentId: student.id },
    update: {},
    create: {
      schoolId: school.id,
      studentId: student.id,
      routeId: route.id,
      stopId: stop.id,
    },
  });

  // 11. Library Book
  const book = await prisma.bookCatalogue.upsert({
    where: { id: 'book-phys-feynman' },
    update: {},
    create: {
      id: 'book-phys-feynman',
      schoolId: school.id,
      title: 'The Feynman Lectures on Physics - Vol 1',
      author: 'Richard P. Feynman',
      isbn: '978-0465024933',
      category: 'Science & Physics',
      copiesCount: 8,
      availableCount: 7,
    },
  });

  await prisma.bookLoan.upsert({
    where: { id: 'loan-001' },
    update: {},
    create: {
      id: 'loan-001',
      schoolId: school.id,
      bookId: book.id,
      borrowerId: student.id,
      borrowerName: 'Alexander Chen',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: LoanStatus.ISSUED,
    },
  });

  // 12. Staff & HR
  const academicsDept = await prisma.department.upsert({
    where: { id: 'dept-academics' },
    update: {},
    create: {
      id: 'dept-academics',
      schoolId: school.id,
      name: 'Academics & STEM Faculty',
    },
  });

  await prisma.staffProfile.upsert({
    where: { employeeCode: 'EMP-1001' },
    update: {},
    create: {
      schoolId: school.id,
      employeeCode: 'EMP-1001',
      name: 'Prof. Marcus Sterling',
      designation: 'Head of Mathematics',
      departmentId: academicsDept.id,
      phone: '+1 (555) 772-0044',
      email: 'm.sterling@greenwoodhigh.edu',
      joiningDate: new Date('2021-08-15'),
      salary: 5800,
      status: 'ACTIVE',
    },
  });

  console.log('Database seeded successfully with multi-tenant data!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
