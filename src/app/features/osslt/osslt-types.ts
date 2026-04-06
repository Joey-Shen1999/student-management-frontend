export type OssltResult = 'PASS' | 'FAIL' | 'UNKNOWN';

export type OssltTrackingStatus = 'WAITING_UPDATE' | 'NEEDS_TRACKING' | 'PASSED';

export type OssltTrackingManualStatus = OssltTrackingStatus | null;

export interface StudentOssltModuleState {
  studentId: number;
  graduationYear: number | null;
  latestOssltResult: OssltResult;
  latestOssltDate: string | null;
  hasOsslc: boolean | null;
  ossltTrackingStatus?: OssltTrackingStatus | null;
  ossltTrackingManualStatus: OssltTrackingManualStatus;
  updatedAt: string | null;
}

export interface OssltSummaryViewModel {
  trackingStatus: OssltTrackingStatus;
  trackingTitle: string;
  trackingMessage: string;
  colorToken: string;
  latestOssltResult: OssltResult;
  latestOssltDate: string | null;
  graduationYear: number | null;
}

export interface TeacherStudentOssltSummary {
  studentId: number;
  studentName: string;
  summary: OssltSummaryViewModel;
}

export interface UpdateStudentOssltPayload {
  latestOssltResult?: OssltResult;
  latestOssltDate?: string | null;
  hasOsslc?: boolean | null;
  ossltTrackingManualStatus?: OssltTrackingManualStatus;
}
