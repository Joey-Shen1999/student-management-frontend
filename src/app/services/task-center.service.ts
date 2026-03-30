import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, delay, of, throwError, timeout } from 'rxjs';

import { AuthService } from './auth.service';

export type GoalTaskStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
export type InfoTaskCategory = 'ACTIVITY' | 'VOLUNTEER';

export interface GoalTaskVm {
  id: number;
  type: 'GOAL';
  title: string;
  description: string;
  status: GoalTaskStatus;
  dueAt: string | null;
  assignedStudentId: number;
  assignedStudentName: string;
  assignedByTeacherId: number;
  assignedByTeacherName: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  progressNote: string;
}

export interface GoalListQueryVm {
  status?: GoalTaskStatus | 'ALL';
  keyword?: string;
  page?: number;
  size?: number;
}

export interface TeacherGoalListQueryVm extends GoalListQueryVm {
  studentId?: number | null;
}

export interface GoalListResponseVm {
  items: GoalTaskVm[];
  total: number;
  page: number;
  size: number;
}

export interface UpdateGoalStatusRequestVm {
  status: GoalTaskStatus;
  progressNote?: string;
}

export interface CreateGoalRequestVm {
  studentId: number;
  title: string;
  description: string;
  dueAt: string | null;
}

export interface AssignableStudentOptionVm {
  studentId: number;
  studentName: string;
  username?: string;
}

export interface InfoTaskVm {
  id: number;
  type: 'INFO';
  title: string;
  content: string;
  category: InfoTaskCategory;
  tags: string[];
  targetStudentCount: number;
  publishedByTeacherId: number;
  publishedByTeacherName: string;
  createdAt: string;
  updatedAt: string;
  read: boolean;
  readAt: string | null;
}

export interface InfoListQueryVm {
  category?: InfoTaskCategory | 'ALL';
  tag?: string;
  keyword?: string;
  unreadOnly?: boolean;
  page?: number;
  size?: number;
}

export interface InfoListResponseVm {
  items: InfoTaskVm[];
  total: number;
  page: number;
  size: number;
}

export interface CreateInfoRequestVm {
  title: string;
  content: string;
  category: InfoTaskCategory;
  tags: string[];
}

const MOCK_GOALS: GoalTaskVm[] = [
  {
    id: 1001,
    type: 'GOAL',
    title: '完成 OUAC 账户注册',
    description: '本周内完成 OUAC 注册并截图上传。',
    status: 'NOT_STARTED',
    dueAt: '2026-03-15',
    assignedStudentId: 20001,
    assignedStudentName: '张三',
    assignedByTeacherId: 9001,
    assignedByTeacherName: 'Ms. Chen',
    createdAt: '2026-03-08T10:00:00Z',
    updatedAt: '2026-03-08T10:00:00Z',
    completedAt: null,
    progressNote: '',
  },
  {
    id: 1002,
    type: 'GOAL',
    title: '提交 2 所目标院校清单',
    description: '包含专业方向和申请理由。',
    status: 'IN_PROGRESS',
    dueAt: '2026-03-18',
    assignedStudentId: 20001,
    assignedStudentName: '张三',
    assignedByTeacherId: 9001,
    assignedByTeacherName: 'Ms. Chen',
    createdAt: '2026-03-07T10:00:00Z',
    updatedAt: '2026-03-09T08:00:00Z',
    completedAt: null,
    progressNote: '已完成第一版草稿',
  },
  {
    id: 1003,
    type: 'GOAL',
    title: '补充志愿者时长证明',
    description: '上传证明文件并填写活动说明。',
    status: 'COMPLETED',
    dueAt: '2026-03-05',
    assignedStudentId: 20002,
    assignedStudentName: '李四',
    assignedByTeacherId: 9002,
    assignedByTeacherName: 'Mr. Wang',
    createdAt: '2026-03-01T10:00:00Z',
    updatedAt: '2026-03-05T12:00:00Z',
    completedAt: '2026-03-05T12:00:00Z',
    progressNote: '已上传并确认',
  },
];

const MOCK_ASSIGNABLE_STUDENTS: AssignableStudentOptionVm[] = [
  {
    studentId: 20001,
    studentName: '张三',
    username: 'zhangsan',
  },
  {
    studentId: 20002,
    studentName: '李四',
    username: 'lisi',
  },
  {
    studentId: 20003,
    studentName: '王五',
    username: 'wangwu',
  },
];

const MOCK_INFOS: InfoTaskVm[] = [
  {
    id: 5001,
    type: 'INFO',
    title: '3 月大学开放日汇总',
    content: '本周末有 3 所学校开放日，请尽快预约并回传行程安排。',
    category: 'ACTIVITY',
    tags: ['University', 'OpenDay', 'Grade12'],
    targetStudentCount: 46,
    publishedByTeacherId: 9001,
    publishedByTeacherName: 'Ms. Chen',
    createdAt: '2026-03-09T09:00:00Z',
    updatedAt: '2026-03-09T09:00:00Z',
    read: false,
    readAt: null,
  },
  {
    id: 5002,
    type: 'INFO',
    title: '义工时长申报流程更新',
    content: '请按新模板提交义工记录，旧模板将在 3 月 20 日停用。',
    category: 'VOLUNTEER',
    tags: ['Volunteer', 'Form', 'Deadline'],
    targetStudentCount: 58,
    publishedByTeacherId: 9002,
    publishedByTeacherName: 'Mr. Wang',
    createdAt: '2026-03-08T13:20:00Z',
    updatedAt: '2026-03-08T13:20:00Z',
    read: true,
    readAt: '2026-03-08T18:00:00Z',
  },
];

@Injectable({ providedIn: 'root' })
export class TaskCenterService {
  private readonly useMock = false;
  private readonly useMockInfo = false;
  private readonly studentBaseUrl = '/api/student/tasks';
  private readonly teacherBaseUrl = '/api/teacher/tasks';
  private readonly requestTimeoutMs = 12000;
  private readonly mockGoals$ = new BehaviorSubject<GoalTaskVm[]>(MOCK_GOALS);
  private readonly mockInfos$ = new BehaviorSubject<InfoTaskVm[]>(MOCK_INFOS);

  constructor(
    private http: HttpClient,
    private auth: AuthService
  ) {}

  listMyGoals(query: GoalListQueryVm = {}): Observable<GoalListResponseVm> {
    if (this.useMock) {
      return this.listMyGoalsFromMock(query);
    }

    let params = new HttpParams().set('type', 'GOAL');
    if (query.status && query.status !== 'ALL') {
      params = params.set('status', query.status);
    }
    if (query.keyword?.trim()) {
      params = params.set('keyword', query.keyword.trim());
    }
    if (typeof query.page === 'number' && Number.isFinite(query.page)) {
      params = params.set('page', String(Math.max(1, Math.trunc(query.page))));
    }
    if (typeof query.size === 'number' && Number.isFinite(query.size)) {
      params = params.set('size', String(Math.max(1, Math.trunc(query.size))));
    }

    return this.withRequestTimeout(
      this.http.get<GoalListResponseVm>(this.studentBaseUrl, {
        params,
        ...this.withAuthHeaderIfAvailable(),
      })
    );
  }

  updateMyGoalStatus(goalId: number, request: UpdateGoalStatusRequestVm): Observable<GoalTaskVm> {
    if (this.useMock) {
      return this.updateGoalStatusFromMock(goalId, request, true);
    }

    return this.withRequestTimeout(
      this.http.patch<GoalTaskVm>(
        `${this.studentBaseUrl}/${Math.trunc(Number(goalId))}/status`,
        request,
        this.withAuthHeaderIfAvailable()
      )
    );
  }

  listTeacherGoals(query: TeacherGoalListQueryVm = {}): Observable<GoalListResponseVm> {
    if (this.useMock) {
      return this.listTeacherGoalsFromMock(query);
    }

    let params = new HttpParams().set('type', 'GOAL');
    if (query.studentId) {
      params = params.set('studentId', String(Math.trunc(Number(query.studentId))));
    }
    if (query.status && query.status !== 'ALL') {
      params = params.set('status', query.status);
    }
    if (query.keyword?.trim()) {
      params = params.set('keyword', query.keyword.trim());
    }
    if (typeof query.page === 'number' && Number.isFinite(query.page)) {
      params = params.set('page', String(Math.max(1, Math.trunc(query.page))));
    }
    if (typeof query.size === 'number' && Number.isFinite(query.size)) {
      params = params.set('size', String(Math.max(1, Math.trunc(query.size))));
    }

    return this.withRequestTimeout(
      this.http.get<GoalListResponseVm>(this.teacherBaseUrl, {
        params,
        ...this.withAuthHeaderIfAvailable(),
      })
    );
  }

  createGoal(request: CreateGoalRequestVm): Observable<GoalTaskVm> {
    if (this.useMock) {
      return this.createGoalFromMock(request);
    }

    return this.withRequestTimeout(
      this.http.post<GoalTaskVm>(
        `${this.teacherBaseUrl}/goals`,
        request,
        this.withAuthHeaderIfAvailable()
      )
    );
  }

  updateTeacherGoalStatus(
    goalId: number,
    request: UpdateGoalStatusRequestVm
  ): Observable<GoalTaskVm> {
    if (this.useMock) {
      return this.updateGoalStatusFromMock(goalId, request, false);
    }

    return this.withRequestTimeout(
      this.http.patch<GoalTaskVm>(
        `${this.teacherBaseUrl}/${Math.trunc(Number(goalId))}/status`,
        request,
        this.withAuthHeaderIfAvailable()
      )
    );
  }

  listAssignableStudents(): Observable<AssignableStudentOptionVm[]> {
    if (this.useMock) {
      return this.listAssignableStudentsFromMock();
    }

    return this.withRequestTimeout(
      this.http.get<AssignableStudentOptionVm[]>(
        `${this.teacherBaseUrl}/assignable-students`,
        this.withAuthHeaderIfAvailable()
      )
    );
  }

  listMyInfos(query: InfoListQueryVm = {}): Observable<InfoListResponseVm> {
    if (this.useMock || this.useMockInfo) {
      return this.listMyInfosFromMock(query);
    }

    let params = new HttpParams().set('type', 'INFO');
    if (query.category && query.category !== 'ALL') {
      params = params.set('category', query.category);
    }
    if (query.tag?.trim()) {
      params = params.set('tag', query.tag.trim());
    }
    if (query.keyword?.trim()) {
      params = params.set('keyword', query.keyword.trim());
    }
    if (query.unreadOnly) {
      params = params.set('unreadOnly', 'true');
    }
    if (typeof query.page === 'number' && Number.isFinite(query.page)) {
      params = params.set('page', String(Math.max(1, Math.trunc(query.page))));
    }
    if (typeof query.size === 'number' && Number.isFinite(query.size)) {
      params = params.set('size', String(Math.max(1, Math.trunc(query.size))));
    }

    return this.withRequestTimeout(
      this.http.get<InfoListResponseVm>(this.studentBaseUrl, {
        params,
        ...this.withAuthHeaderIfAvailable(),
      })
    );
  }

  listTeacherInfos(query: InfoListQueryVm = {}): Observable<InfoListResponseVm> {
    if (this.useMock || this.useMockInfo) {
      return this.listTeacherInfosFromMock(query);
    }

    let params = new HttpParams().set('type', 'INFO');
    if (query.category && query.category !== 'ALL') {
      params = params.set('category', query.category);
    }
    if (query.tag?.trim()) {
      params = params.set('tag', query.tag.trim());
    }
    if (query.keyword?.trim()) {
      params = params.set('keyword', query.keyword.trim());
    }
    if (typeof query.page === 'number' && Number.isFinite(query.page)) {
      params = params.set('page', String(Math.max(1, Math.trunc(query.page))));
    }
    if (typeof query.size === 'number' && Number.isFinite(query.size)) {
      params = params.set('size', String(Math.max(1, Math.trunc(query.size))));
    }

    return this.withRequestTimeout(
      this.http.get<InfoListResponseVm>(this.teacherBaseUrl, {
        params,
        ...this.withAuthHeaderIfAvailable(),
      })
    );
  }

  createInfo(request: CreateInfoRequestVm): Observable<InfoTaskVm> {
    if (this.useMock || this.useMockInfo) {
      return this.createInfoFromMock(request);
    }

    return this.withRequestTimeout(
      this.http.post<InfoTaskVm>(
        `${this.teacherBaseUrl}/infos`,
        request,
        this.withAuthHeaderIfAvailable()
      )
    );
  }

  markMyInfoAsRead(infoId: number): Observable<InfoTaskVm> {
    if (this.useMock || this.useMockInfo) {
      return this.markMyInfoAsReadFromMock(infoId);
    }

    return this.withRequestTimeout(
      this.http.patch<InfoTaskVm>(
        `${this.studentBaseUrl}/${Math.trunc(Number(infoId))}/read`,
        {},
        this.withAuthHeaderIfAvailable()
      )
    );
  }

  private listMyGoalsFromMock(query: GoalListQueryVm): Observable<GoalListResponseVm> {
    const sessionStudentId = this.resolveSessionStudentId();

    return this.listGoalsFromMock(query, {
      assignedStudentId: sessionStudentId,
      teacherScope: false,
    });
  }

  private listTeacherGoalsFromMock(query: TeacherGoalListQueryVm): Observable<GoalListResponseVm> {
    const normalizedStudentId =
      Number.isFinite(Number(query.studentId)) && Number(query.studentId) > 0
        ? Math.trunc(Number(query.studentId))
        : null;

    return this.listGoalsFromMock(query, {
      assignedStudentId: normalizedStudentId,
      teacherScope: true,
    });
  }

  private listGoalsFromMock(
    query: GoalListQueryVm,
    options: { assignedStudentId: number | null; teacherScope: boolean }
  ): Observable<GoalListResponseVm> {
    const normalizedKeyword = String(query.keyword || '').trim().toLowerCase();
    const normalizedStatus = query.status || 'ALL';
    const page = Number.isFinite(Number(query.page))
      ? Math.max(1, Math.trunc(Number(query.page)))
      : 1;
    const size = Number.isFinite(Number(query.size))
      ? Math.max(1, Math.trunc(Number(query.size)))
      : 20;
    const scopedTeacherId = this.resolveTeacherScopeTeacherId(options.teacherScope);

    const visibleRows = this.mockGoals$.value.filter((goal) => {
      if (options.assignedStudentId && goal.assignedStudentId !== options.assignedStudentId) {
        return false;
      }

      if (scopedTeacherId !== null && goal.assignedByTeacherId !== scopedTeacherId) {
        return false;
      }

      if (normalizedStatus !== 'ALL' && goal.status !== normalizedStatus) {
        return false;
      }

      if (!normalizedKeyword) {
        return true;
      }

      return [goal.title, goal.description, goal.progressNote]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(normalizedKeyword));
    });

    const sortedRows = this.sortGoals(visibleRows);
    const start = (page - 1) * size;
    const pagedRows = sortedRows.slice(start, start + size);

    return of({
      items: pagedRows.map((goal) => ({ ...goal })),
      total: sortedRows.length,
      page,
      size,
    }).pipe(delay(120));
  }

  private updateGoalStatusFromMock(
    goalId: number,
    request: UpdateGoalStatusRequestVm,
    enforceStudentOwnership: boolean
  ): Observable<GoalTaskVm> {
    const normalizedGoalId = Math.trunc(Number(goalId));
    if (!Number.isFinite(normalizedGoalId) || normalizedGoalId <= 0) {
      return throwError(() => new Error('goalId is invalid.'));
    }

    const current = this.mockGoals$.value;
    const index = current.findIndex((goal) => goal.id === normalizedGoalId);
    if (index < 0) {
      return throwError(() => new Error('Goal task not found.'));
    }

    const studentId = this.resolveSessionStudentId();
    if (enforceStudentOwnership && studentId && current[index].assignedStudentId !== studentId) {
      return throwError(() => new Error('Permission denied for this goal task.'));
    }

    const nextStatus = request.status;
    const timestamp = new Date().toISOString();
    const nextGoal: GoalTaskVm = {
      ...current[index],
      status: nextStatus,
      updatedAt: timestamp,
      completedAt: nextStatus === 'COMPLETED' ? timestamp : null,
      progressNote: request.progressNote?.trim() || current[index].progressNote,
    };

    const nextRows = [...current];
    nextRows[index] = nextGoal;
    this.mockGoals$.next(nextRows);

    return of({ ...nextGoal }).pipe(delay(120));
  }

  private createGoalFromMock(request: CreateGoalRequestVm): Observable<GoalTaskVm> {
    const studentId = Math.trunc(Number(request.studentId));
    const title = String(request.title || '').trim();
    const description = String(request.description || '').trim();
    const dueAtText = String(request.dueAt || '').trim();

    if (!Number.isFinite(studentId) || studentId <= 0) {
      return throwError(() => new Error('studentId is required.'));
    }
    if (!title) {
      return throwError(() => new Error('title is required.'));
    }
    if (!description) {
      return throwError(() => new Error('description is required.'));
    }

    const student = this.resolveStudentOption(studentId);
    const timestamp = new Date().toISOString();
    const nextId = this.nextGoalId();

    const nextGoal: GoalTaskVm = {
      id: nextId,
      type: 'GOAL',
      title,
      description,
      status: 'NOT_STARTED',
      dueAt: dueAtText || null,
      assignedStudentId: studentId,
      assignedStudentName: student?.studentName || `学生 #${studentId}`,
      assignedByTeacherId: this.resolveSessionTeacherId() || 0,
      assignedByTeacherName: this.resolveSessionTeacherName(),
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: null,
      progressNote: '',
    };

    const nextRows = [nextGoal, ...this.mockGoals$.value];
    this.mockGoals$.next(nextRows);

    return of({ ...nextGoal }).pipe(delay(120));
  }

  private listAssignableStudentsFromMock(): Observable<AssignableStudentOptionVm[]> {
    const options = new Map<number, AssignableStudentOptionVm>();

    for (const student of MOCK_ASSIGNABLE_STUDENTS) {
      options.set(student.studentId, { ...student });
    }

    for (const goal of this.mockGoals$.value) {
      if (!options.has(goal.assignedStudentId)) {
        options.set(goal.assignedStudentId, {
          studentId: goal.assignedStudentId,
          studentName: goal.assignedStudentName,
        });
      }
    }

    return of(Array.from(options.values()).sort((a, b) => a.studentId - b.studentId)).pipe(delay(120));
  }

  private listMyInfosFromMock(query: InfoListQueryVm): Observable<InfoListResponseVm> {
    return this.listInfosFromMock(query, { teacherScope: false });
  }

  private listTeacherInfosFromMock(query: InfoListQueryVm): Observable<InfoListResponseVm> {
    return this.listInfosFromMock(query, { teacherScope: true });
  }

  private listInfosFromMock(
    query: InfoListQueryVm,
    options: { teacherScope: boolean }
  ): Observable<InfoListResponseVm> {
    const normalizedCategory = query.category || 'ALL';
    const normalizedTag = String(query.tag || '')
      .trim()
      .toLowerCase();
    const normalizedKeyword = String(query.keyword || '')
      .trim()
      .toLowerCase();
    const unreadOnly = !!query.unreadOnly;
    const page = Number.isFinite(Number(query.page))
      ? Math.max(1, Math.trunc(Number(query.page)))
      : 1;
    const size = Number.isFinite(Number(query.size))
      ? Math.max(1, Math.trunc(Number(query.size)))
      : 20;
    const scopedTeacherId = this.resolveTeacherScopeTeacherId(options.teacherScope);

    const visibleRows = this.mockInfos$.value.filter((info) => {
      if (scopedTeacherId !== null && info.publishedByTeacherId !== scopedTeacherId) {
        return false;
      }

      if (normalizedCategory !== 'ALL' && info.category !== normalizedCategory) {
        return false;
      }

      if (normalizedTag && !info.tags.some((tag) => tag.toLowerCase().includes(normalizedTag))) {
        return false;
      }

      if (normalizedKeyword) {
        const contains = [info.title, info.content, ...info.tags].some((field) =>
          field.toLowerCase().includes(normalizedKeyword)
        );
        if (!contains) {
          return false;
        }
      }

      if (!options.teacherScope && unreadOnly && info.read) {
        return false;
      }

      return true;
    });

    const sortedRows = this.sortInfos(visibleRows);
    const start = (page - 1) * size;
    const pagedRows = sortedRows.slice(start, start + size);

    return of({
      items: pagedRows.map((row) => ({ ...row, tags: [...row.tags] })),
      total: sortedRows.length,
      page,
      size,
    }).pipe(delay(120));
  }

  private createInfoFromMock(request: CreateInfoRequestVm): Observable<InfoTaskVm> {
    const title = String(request.title || '').trim();
    const content = String(request.content || '').trim();
    const category = request.category;
    const tags = Array.from(
      new Set(
        (request.tags || [])
          .map((tag) => String(tag || '').trim())
          .filter(Boolean)
      )
    );

    if (!title) {
      return throwError(() => new Error('title is required.'));
    }
    if (!content) {
      return throwError(() => new Error('content is required.'));
    }
    if (category !== 'ACTIVITY' && category !== 'VOLUNTEER') {
      return throwError(() => new Error('category is invalid.'));
    }

    const timestamp = new Date().toISOString();
    const nextInfo: InfoTaskVm = {
      id: this.nextInfoId(),
      type: 'INFO',
      title,
      content,
      category,
      tags,
      targetStudentCount: Math.max(1, Math.min(999, tags.length * 12 || 18)),
      publishedByTeacherId: this.resolveSessionTeacherId() || 0,
      publishedByTeacherName: this.resolveSessionTeacherName(),
      createdAt: timestamp,
      updatedAt: timestamp,
      read: false,
      readAt: null,
    };

    const nextRows = [nextInfo, ...this.mockInfos$.value];
    this.mockInfos$.next(nextRows);

    return of({ ...nextInfo, tags: [...nextInfo.tags] }).pipe(delay(120));
  }

  private markMyInfoAsReadFromMock(infoId: number): Observable<InfoTaskVm> {
    const normalizedId = Math.trunc(Number(infoId));
    if (!Number.isFinite(normalizedId) || normalizedId <= 0) {
      return throwError(() => new Error('infoId is invalid.'));
    }

    const rows = this.mockInfos$.value;
    const index = rows.findIndex((row) => row.id === normalizedId);
    if (index < 0) {
      return throwError(() => new Error('Info task not found.'));
    }

    const timestamp = new Date().toISOString();
    const updatedRow: InfoTaskVm = {
      ...rows[index],
      read: true,
      readAt: rows[index].readAt || timestamp,
      updatedAt: timestamp,
    };

    const nextRows = [...rows];
    nextRows[index] = updatedRow;
    this.mockInfos$.next(nextRows);

    return of({ ...updatedRow, tags: [...updatedRow.tags] }).pipe(delay(120));
  }

  private sortGoals(items: GoalTaskVm[]): GoalTaskVm[] {
    return [...items].sort((a, b) => {
      const statusRankA = a.status === 'COMPLETED' ? 1 : 0;
      const statusRankB = b.status === 'COMPLETED' ? 1 : 0;
      if (statusRankA !== statusRankB) {
        return statusRankA - statusRankB;
      }

      const dueA = this.toSortableTimestamp(a.dueAt, Number.MAX_SAFE_INTEGER);
      const dueB = this.toSortableTimestamp(b.dueAt, Number.MAX_SAFE_INTEGER);
      if (dueA !== dueB) {
        return dueA - dueB;
      }

      const updatedA = this.toSortableTimestamp(a.updatedAt, 0);
      const updatedB = this.toSortableTimestamp(b.updatedAt, 0);
      return updatedB - updatedA;
    });
  }

  private sortInfos(items: InfoTaskVm[]): InfoTaskVm[] {
    return [...items].sort((a, b) => {
      const updatedA = this.toSortableTimestamp(a.updatedAt, 0);
      const updatedB = this.toSortableTimestamp(b.updatedAt, 0);
      if (updatedA !== updatedB) {
        return updatedB - updatedA;
      }

      return b.id - a.id;
    });
  }

  private toSortableTimestamp(value: string | null | undefined, fallback: number): number {
    const timestamp = Date.parse(String(value || ''));
    return Number.isFinite(timestamp) ? timestamp : fallback;
  }

  private resolveSessionStudentId(): number | null {
    const session = this.auth.getSession();
    const studentId = Number(session?.studentId);
    return Number.isFinite(studentId) && studentId > 0 ? Math.trunc(studentId) : null;
  }

  private resolveSessionTeacherId(): number | null {
    const session = this.auth.getSession();
    const teacherId = Number(session?.teacherId);
    return Number.isFinite(teacherId) && teacherId > 0 ? Math.trunc(teacherId) : null;
  }

  private resolveSessionRole(): string {
    return String(this.auth.getSession()?.role || '')
      .trim()
      .toUpperCase();
  }

  private resolveSessionTeacherName(): string {
    const session = this.auth.getSession() as { username?: string; displayName?: string } | null;
    const candidate = String(session?.username || session?.displayName || '').trim();
    if (candidate) {
      return candidate;
    }

    const teacherId = this.resolveSessionTeacherId();
    return teacherId ? `Teacher #${teacherId}` : 'Teacher';
  }

  private resolveTeacherScopeTeacherId(teacherScope: boolean): number | null {
    if (!teacherScope) return null;
    const role = this.resolveSessionRole();
    if (role === 'ADMIN') return null;
    return this.resolveSessionTeacherId();
  }

  private resolveStudentOption(studentId: number): AssignableStudentOptionVm | null {
    const fromMock = MOCK_ASSIGNABLE_STUDENTS.find((student) => student.studentId === studentId);
    if (fromMock) return fromMock;

    const fromGoals = this.mockGoals$.value.find((goal) => goal.assignedStudentId === studentId);
    if (!fromGoals) return null;

    return {
      studentId: fromGoals.assignedStudentId,
      studentName: fromGoals.assignedStudentName,
    };
  }

  private nextGoalId(): number {
    const maxId = this.mockGoals$.value.reduce((max, goal) => (goal.id > max ? goal.id : max), 1000);
    return maxId + 1;
  }

  private nextInfoId(): number {
    const maxId = this.mockInfos$.value.reduce((max, info) => (info.id > max ? info.id : max), 5000);
    return maxId + 1;
  }

  private withRequestTimeout<T>(source$: Observable<T>): Observable<T> {
    return source$.pipe(timeout({ first: this.requestTimeoutMs }));
  }

  private withAuthHeaderIfAvailable() {
    const authorization = this.auth.getAuthorizationHeaderValue();
    if (!authorization) {
      return {};
    }

    return {
      headers: new HttpHeaders({
        Authorization: authorization,
      }),
    };
  }
}
