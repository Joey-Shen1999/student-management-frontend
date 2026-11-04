import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Calendar, CalendarOptions, EventInput } from '@fullcalendar/core';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { LucideChevronLeft, LucideChevronRight, LucidePlus, LucideX, LucideTriangleAlert } from '@lucide/angular';
import { finalize, timeout } from 'rxjs/operators';
import { GraduationApplicationStageService, InterviewCoursePlan, InterviewTeacherOption } from '../../services/graduation-application-stage.service';
import { TranslatePipe } from '../../shared/i18n/translate.pipe';
import { uiText } from '../../shared/i18n/ui-translations';
import { conflictingBookings, lessonStart } from './interview-schedule.utils';

export interface InterviewBooking {
  studentId: number;
  lessonId: number;
  date: string;
  hour: string;
  minute: string;
  confirmed: boolean;
}

@Component({
  selector: 'app-interview-timetable',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe,
    LucideChevronLeft, LucideChevronRight, LucidePlus, LucideX, LucideTriangleAlert],
  templateUrl: './interview-timetable.component.html',
  styleUrl: './interview-timetable.component.scss',
})
export class InterviewTimetableComponent implements OnChanges, OnInit, OnDestroy, AfterViewInit {
  @Input() rows: InterviewCoursePlan[] = [];
  @Input() search = '';
  @Input() teachers: InterviewTeacherOption[] = [];
  @Output() planUpdated = new EventEmitter<InterviewCoursePlan>();
  @ViewChild('calendarHost', { static: true }) calendarHost!: ElementRef<HTMLDivElement>;
  private calendar?: Calendar;
  @ViewChild('editor', { static: true }) editor!: ElementRef<HTMLDialogElement>;
  @ViewChild('conflictIcon', { static: true, read: ElementRef }) conflictIcon!: ElementRef<SVGElement>;
  teacherFilter = '';
  teacherOptions: {id: number; name: string}[] = [];
  calendarView: 'timeGridWeek' | 'timeGridDay' = 'timeGridWeek';
  title = '';
  saving = false;
  error = '';
  booking: InterviewBooking | null = null;
  private clock?: ReturnType<typeof setInterval>;
  private destroyed = false;
  readonly hours = Array.from({length: 24}, (_, i) => String(i).padStart(2, '0'));
  readonly minutes = ['00', '15', '30', '45'];
  readonly ui = {
    previous: uiText('上一周', 'Previous week'), next: uiText('下一周', 'Next week'),
    today: uiText('本周', 'This week'), week: uiText('周', 'Week'), day: uiText('日', 'Day'),
    teacher: uiText('老师', 'Teacher'),
    unassigned: uiText('未分配老师', 'Unassigned'), book: uiText('排课', 'Schedule'),
    student: uiText('学生', 'Student'), lesson: uiText('课次', 'Lesson'), date: uiText('日期', 'Date'),
    hour: uiText('小时', 'Hour'), minute: uiText('分钟', 'Minute'), end: uiText('结束时间', 'End time'),
    edit: uiText('面试课预约', 'Interview booking'), close: uiText('关闭', 'Close'),
    save: uiText('保存预约', 'Save booking'), saving: uiText('保存中...', 'Saving...'),
    clear: uiText('取消本次预约', 'Clear booking'), confirmed: uiText('已确认', 'Confirmed'),
    tentative: uiText('待确认', 'Unconfirmed'), past: uiText('已过时间', 'Past'),
    conflict: uiText('时间冲突', 'Schedule conflict'),
    conflictWarning: uiText('该时段已有重叠预约，请核对；仍可保存。', 'This time overlaps another booking. Review it; saving is still allowed.'),
    invalid: uiText('请选择学生、课次和有效时间。', 'Select a student, lesson and valid time.'),
    failed: uiText('保存失败，请重试。', 'Could not save. Please retry.'),
    duration: uiText('1.5 小时 / 节', '1.5 hours / lesson'),
  };
  options: CalendarOptions = {
    plugins: [timeGridPlugin, interactionPlugin], initialView: 'timeGridWeek', firstDay: 1,
    headerToolbar: false, allDaySlot: false, height: 650, expandRows: true,
    slotDuration: '00:15:00', slotLabelInterval: '01:00:00', scrollTime: '09:00:00',
    slotMinTime: '00:00:00', slotMaxTime: '24:00:00', nowIndicator: true,
    defaultTimedEventDuration: '01:30:00', forceEventDuration: true, editable: false,
    displayEventEnd: true, eventTimeFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
    slotLabelFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
    dayHeaderFormat: {weekday: 'short', month: 'numeric', day: 'numeric'},
    datesSet: info => {
      const title = info.view.title;
      if (title !== this.title) queueMicrotask(() => {
        if (!this.destroyed && title !== this.title) { this.title = title; this.cdr.markForCheck(); }
      });
    },
    dateClick: info => this.openSlot(info.date),
    eventClick: info => this.openLesson(Number(info.event.extendedProps['studentId']), Number(info.event.id)),
    eventContent: info => {
      const container = document.createElement('div');
      container.title = info.event.extendedProps['conflictDetails'] || info.event.title;
      const time = document.createElement('div');
      time.className = 'fc-event-time';
      if (info.event.extendedProps['conflict']) {
        const icon = this.conflictIcon.nativeElement.cloneNode(true) as SVGElement;
        icon.classList.add('timetable-conflict');
        icon.removeAttribute('aria-hidden');
        icon.setAttribute('role', 'img');
        icon.setAttribute('aria-label', this.ui.conflict.zh);
        time.appendChild(icon);
      }
      time.appendChild(document.createTextNode(info.timeText));
      const title = document.createElement('div');
      title.className = 'fc-event-title'; title.textContent = info.event.title;
      container.append(time, title);
      return {domNodes: [container]};
    },
    eventDidMount: info => {
      info.el.setAttribute('tabindex', '0');
      info.el.setAttribute('role', 'button');
      info.el.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          this.openLesson(Number(info.event.extendedProps['studentId']), Number(info.event.id));
        }
      });
    },
  };

  constructor(private api: GraduationApplicationStageService, private cdr: ChangeDetectorRef) {}

  ngOnChanges(): void { this.refreshEvents(); }
  ngAfterViewInit(): void {
    this.calendar = new Calendar(this.calendarHost.nativeElement, this.options);
    this.calendar.render();
  }
  ngOnInit(): void { this.clock = setInterval(() => { this.refreshEvents(); this.cdr.markForCheck(); }, 30000); }
  ngOnDestroy(): void { this.destroyed = true; clearInterval(this.clock); this.calendar?.destroy(); }

  private refreshTeachers(): void {
    const map = new Map<number, string>(this.teachers.map(teacher => [teacher.teacherId, teacher.name]));
    for (const row of this.rows) if (row.teacherId != null) map.set(row.teacherId, row.teacherName || row.teacherUsername || String(row.teacherId));
    this.teacherOptions = Array.from(map, ([id, name]) => ({id, name})).sort((a, b) => a.name.localeCompare(b.name));
    if (!this.teacherOptions.some(teacher => String(teacher.id) === this.teacherFilter) && this.teacherFilter !== 'none') {
      this.teacherFilter = String(this.rows.find(row => row.teacherId != null)?.teacherId ?? this.teacherOptions[0]?.id ?? 'none');
    }
  }

  get teacherRows(): InterviewCoursePlan[] {
    return this.rows.filter(row => this.teacherFilter === 'none' ? row.teacherId == null : String(row.teacherId) === this.teacherFilter);
  }
  get selectedTeacherName(): string { return this.teacherOptions.find(teacher => String(teacher.id) === this.teacherFilter)?.name || this.ui.unassigned.zh; }
  selectTeacher(id: string): void { this.teacherFilter = id; this.refreshEvents(); }
  get bookingWarnings(): string[] {
    const start = this.bookingStart();
    if (!this.booking || !start) return [];
    return conflictingBookings(this.rows, this.booking.studentId, this.booking.lessonId, start)
      .map(item => `${item.student.studentName} · ${item.lesson.lessonNumber} · ${item.lesson.lessonDate} ${item.lesson.lessonTime?.slice(0, 5)}`);
  }

  get selectedStudent(): InterviewCoursePlan | undefined { return this.rows.find(row => row.studentId === this.booking?.studentId); }
  get endTime(): string {
    const start = this.bookingStart();
    if (!start) return '';
    const end = new Date(start.getTime() + 90 * 60000);
    return `${this.dateString(end)} ${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
  }

  refreshEvents(): void {
    this.refreshTeachers();
    const query = this.search.trim().toLocaleLowerCase();
    const events: EventInput[] = [];
    for (const row of this.teacherRows) {
      if (query && ![row.studentName, row.username, ...(row.engineeringApplications || []).flatMap(a => [a.universityName, a.programName])]
        .some(value => value.toLocaleLowerCase().includes(query))) continue;
      for (const lesson of row.lessons) {
        const start = lessonStart(lesson);
        if (!start) continue;
        const past = start.getTime() <= Date.now();
        const color = past ? '#dff1e5' : lesson.confirmed ? '#deecff' : '#fff1b8';
        const conflicts = conflictingBookings(this.rows, row.studentId, lesson.id, start);
        events.push({id: String(lesson.id), title: `${row.studentName} · ${lesson.lessonNumber}\n${row.teacherName || this.ui.unassigned.zh}`,
          start, end: new Date(start.getTime() + 90 * 60000), backgroundColor: color,
          borderColor: past ? '#36845a' : lesson.confirmed ? '#326cb0' : '#b08712', textColor: '#172033',
          extendedProps: {studentId: row.studentId, conflict: conflicts.length > 0,
            conflictDetails: conflicts.length ? `${this.ui.conflict.zh}: ${conflicts.map(item => `${item.student.studentName} · ${item.lesson.lessonNumber}`).join(', ')}` : ''},});
      }
    }
    const earliestHour = events.length ? Math.min(...events.map(event => (event.start as Date).getHours())) : 10;
    this.options = {...this.options, events, scrollTime: `${String(Math.max(0, earliestHour - 1)).padStart(2, '0')}:00:00`};
    this.calendar?.setOption('events', events);
  }

  navigate(direction: -1 | 0 | 1): void {
    const api = this.calendar;
    if (direction < 0) api?.prev(); else if (direction > 0) api?.next(); else api?.today();
  }
  changeView(view: 'timeGridWeek' | 'timeGridDay'): void { this.calendarView = view; this.calendar?.changeView(view); }

  openSlot(date: Date = new Date()): void {
    const row = this.teacherRows[0];
    if (!row) return;
    const lesson = row.lessons.find(lesson => !lessonStart(lesson)) || row.lessons[0];
    if (!lesson) return;
    this.booking = { studentId: row.studentId, lessonId: lesson.id, date: this.dateString(date),
      hour: String(date.getHours()).padStart(2, '0'), minute: String(Math.floor(date.getMinutes() / 15) * 15).padStart(2, '0'), confirmed: false };
    this.error = '';
    this.editor.nativeElement.showModal();
    this.cdr.markForCheck();
  }

  openLesson(studentId: number, lessonId: number): void {
    const row = this.rows.find(row => row.studentId === studentId);
    const lesson = row?.lessons.find(lesson => lesson.id === lessonId);
    if (!row || !lesson) return;
    const date = lessonStart(lesson) || new Date();
    this.booking = {studentId, lessonId, date: this.dateString(date), hour: String(date.getHours()).padStart(2, '0'),
      minute: String(date.getMinutes()).padStart(2, '0'), confirmed: lesson.confirmed ?? false};
    this.error = '';
    if (!this.editor.nativeElement.open) this.editor.nativeElement.showModal();
    this.cdr.markForCheck();
  }

  selectStudent(id: number): void {
    if (!this.booking) return;
    const row = this.rows.find(row => row.studentId === id);
    const lesson = row?.lessons.find(lesson => !lessonStart(lesson)) || row?.lessons[0];
    if (lesson) { this.booking.studentId = id; this.booking.lessonId = lesson.id; this.booking.confirmed = false; }
  }
  selectLesson(id: number): void {
    if (!this.booking) return;
    const lesson = this.selectedStudent?.lessons.find(item => item.id === id);
    if (!lesson) return;
    if (lessonStart(lesson)) this.openLesson(this.booking.studentId, id);
    else { this.booking.lessonId = id; this.booking.confirmed = false; }
  }
  timeChanged(): void { if (this.booking) this.booking.confirmed = false; this.error = ''; }
  close(): void { if (!this.saving) { this.editor.nativeElement.close(); this.booking = null; this.error = ''; } }

  save(clear = false): void {
    if (this.saving || !this.booking) return;
    const start = this.bookingStart();
    const row = this.selectedStudent;
    if (!row || !row.lessons.some(lesson => lesson.id === this.booking!.lessonId) || (!clear && !start)) {
      this.error = this.ui.invalid.zh; return;
    }
    this.saving = true;
    this.error = '';
    this.api.updateInterviewCourseLesson(row.studentId, this.booking.lessonId,
      clear ? null : this.booking.date, clear ? null : `${this.booking.hour}:${this.booking.minute}`,
      clear ? false : this.booking.confirmed).pipe(timeout(15000), finalize(() => {
        this.saving = false; this.cdr.markForCheck();
      })).subscribe({ next: plan => {
        this.planUpdated.emit(plan); this.editor.nativeElement.close(); this.booking = null;
      }, error: () => this.error = this.ui.failed.zh });
  }

  private bookingStart(): Date | null {
    const b = this.booking;
    if (!b || !this.hours.includes(b.hour) || !this.minutes.includes(b.minute)) return null;
    return lessonStart({id: b.lessonId, lessonNumber: 0, lessonDate: b.date, lessonTime: `${b.hour}:${b.minute}`});
  }
  private dateString(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}
