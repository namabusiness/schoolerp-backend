import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FastCacheService } from '../../common/cache/fast-cache.service';

@Injectable()
export class CommunicationService {
  constructor(
    private prisma: PrismaService,
    private fastCache: FastCacheService,
  ) {}

  public clearCommCache(schoolId?: string) {
    this.fastCache.delByPrefix('comm:');
  }

  async getAnnouncements(schoolId: string, audience?: string) {
    const resolvedId = await this.resolveSchoolId(schoolId);
    const cacheKey = `comm:announcements:${resolvedId}:${audience || 'ALL'}`;
    return this.fastCache.getOrSet(cacheKey, async () => {
      const where: any = { OR: [{ schoolId: resolvedId }, { schoolId }] };
      if (audience && audience !== 'ALL') where.audience = audience;
      return this.prisma.announcement.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
      });
    }, 60);
  }

  async createAnnouncement(schoolId: string, data: any) {
    const resolvedId = await this.resolveSchoolId(schoolId);
    const channels = data.channels || ['IN_APP', 'EMAIL'];
    const res = await this.prisma.announcement.create({
      data: {
        schoolId: resolvedId,
        title: data.title,
        content: data.content,
        audience: data.audience || 'ALL',
        targetGrade: data.targetGrade,
        channels: JSON.stringify(channels),
        authorName: data.authorName || 'School Administration',
      },
    });
    this.clearCommCache(resolvedId);
    return res;
  }

  private async resolveSchoolId(schoolId: string): Promise<string> {
    if (!schoolId) return 'school-greenwood-high';
    return this.fastCache.getOrSet(`school_id:${schoolId}`, async () => {
      const byId = await this.prisma.school.findUnique({ where: { id: schoolId } });
      if (byId) return byId.id;

      const bySlug = await this.prisma.school.findUnique({ where: { slug: schoolId } });
      if (bySlug) return bySlug.id;

      const byPrefix = await this.prisma.school.findUnique({ where: { id: `school-${schoolId}` } });
      if (byPrefix) return byPrefix.id;

      const fallback = await this.prisma.school.findFirst();
      return fallback?.id || 'school-greenwood-high';
    }, 3600);
  }

  // -------------------------------------------------------------
  // PARENT-TEACHER DIRECT TWO-WAY MESSAGING
  // -------------------------------------------------------------
  async getMessages(schoolId: string, params: { studentId?: string; parentId?: string; teacherId?: string }) {
    const resolvedId = await this.resolveSchoolId(schoolId);
    const cacheKey = `comm:messages:${resolvedId}:${params.studentId || ''}:${params.parentId || ''}:${params.teacherId || ''}`;
    return this.fastCache.getOrSet(cacheKey, async () => {
      const where: any = {
        OR: [{ schoolId: resolvedId }, { schoolId }],
      };
      if (params.studentId) where.studentId = params.studentId;
      if (params.parentId) {
        const pProfile = await this.prisma.parentGuardian.findFirst({
          where: { OR: [{ id: params.parentId }, { userId: params.parentId }] },
        });
        if (pProfile) where.parentId = pProfile.id;
      }
      if (params.teacherId) {
        const tProfile = await this.prisma.staffProfile.findFirst({
          where: { OR: [{ id: params.teacherId }, { userId: params.teacherId }] },
        });
        if (tProfile) where.teacherId = tProfile.id;
      }

      return this.prisma.parentTeacherMessage.findMany({
        where,
        include: {
          student: {
            include: { gradeClass: true, section: true },
          },
          parent: true,
          teacher: {
            select: { id: true, name: true, employeeCode: true, designation: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      });
    }, 15);
  }

  async sendMessage(schoolId: string, data: {
    studentId: string;
    parentId?: string;
    teacherId?: string;
    senderRole: 'TEACHER' | 'PARENT';
    senderName: string;
    subject?: string;
    message: string;
  }) {
    const resolvedSchoolId = await this.resolveSchoolId(schoolId);

    // 1. Fetch student details with assigned class teacher and parent
    const student = await this.prisma.student.findUnique({
      where: { id: data.studentId },
      include: {
        gradeClass: { include: { classTeacher: true } },
        section: { include: { classTeacher: true } },
        parent: true,
      },
    });

    // 2. Safely resolve parentId (ParentGuardian.id foreign key)
    let resolvedParentId: string | null = null;
    if (data.parentId) {
      const pById = await this.prisma.parentGuardian.findUnique({ where: { id: data.parentId } });
      if (pById) {
        resolvedParentId = pById.id;
      } else {
        const pByUser = await this.prisma.parentGuardian.findFirst({ where: { userId: data.parentId } });
        if (pByUser) {
          resolvedParentId = pByUser.id;
        }
      }
    }
    if (!resolvedParentId && student?.parentId) {
      resolvedParentId = student.parentId;
    }
    if (!resolvedParentId) {
      const defaultParent = await this.prisma.parentGuardian.findFirst({
        where: { OR: [{ schoolId: resolvedSchoolId }, { schoolId }] },
      });
      resolvedParentId = defaultParent?.id || null;
    }

    // 3. Safely resolve teacherId (StaffProfile.id foreign key)
    let resolvedTeacherId: string | null = null;
    if (data.teacherId && data.teacherId !== 'teacher-default') {
      const tById = await this.prisma.staffProfile.findUnique({ where: { id: data.teacherId } });
      if (tById) {
        resolvedTeacherId = tById.id;
      } else {
        const tByUser = await this.prisma.staffProfile.findFirst({ where: { userId: data.teacherId } });
        if (tByUser) {
          resolvedTeacherId = tByUser.id;
        }
      }
    }
    if (!resolvedTeacherId && student?.section?.classTeacherId) {
      resolvedTeacherId = student.section.classTeacherId;
    }
    if (!resolvedTeacherId && student?.gradeClass?.classTeacherId) {
      resolvedTeacherId = student.gradeClass.classTeacherId;
    }
    if (!resolvedTeacherId) {
      const defaultTeacher = await this.prisma.staffProfile.findFirst({
        where: {
          OR: [{ schoolId: resolvedSchoolId }, { schoolId }],
          role: { in: ['TEACHER', 'STAFF'] } as any,
        },
      });
      resolvedTeacherId = defaultTeacher?.id || null;
    }

    if (!resolvedTeacherId) {
      // Fallback to any active staff member
      const anyStaff = await this.prisma.staffProfile.findFirst({
        where: { OR: [{ schoolId: resolvedSchoolId }, { schoolId }] },
      });
      resolvedTeacherId = anyStaff?.id || null;
    }

    if (!resolvedParentId || !resolvedTeacherId) {
      throw new Error('Unable to resolve parent or teacher profile in this school.');
    }

    const res = await this.prisma.parentTeacherMessage.create({
      data: {
        schoolId: resolvedSchoolId,
        studentId: data.studentId,
        parentId: resolvedParentId,
        teacherId: resolvedTeacherId,
        senderRole: data.senderRole,
        senderName: data.senderName,
        subject: data.subject || 'Direct Communication',
        message: data.message,
        isRead: false,
      },
      include: {
        student: true,
        parent: true,
        teacher: true,
      },
    });

    this.clearCommCache(resolvedSchoolId);
    return res;
  }

  async markMessageRead(schoolId: string, messageId: string) {
    const res = await this.prisma.parentTeacherMessage.update({
      where: { id: messageId },
      data: { isRead: true },
    });
    this.clearCommCache(schoolId);
    return res;
  }
}

