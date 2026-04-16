import { ADDITIONAL_UI_TRANSLATIONS } from './translation-dictionary';

export type AppLanguage = 'zh' | 'en';

export interface LocalizedText {
  zh: string;
  en: string;
}

interface TranslationEntry extends LocalizedText {}

const CORE_UI_TRANSLATIONS: readonly TranslationEntry[] = [
  { zh: '登录', en: 'Log In' },
  { zh: '登录中...', en: 'Signing in...' },
  { zh: '登录失败。', en: 'Log in failed.' },
  { zh: '用户名', en: 'Username' },
  { zh: '密码', en: 'Password' },
  { zh: '记住用户名（30天）', en: 'Remember Username (30 days)' },
  { zh: '记住密码（30天）', en: 'Remember Password (30 days)' },
  { zh: '请求处理中...', en: 'Processing request...' },
  { zh: '退出登录', en: 'Sign Out' },
  { zh: '退出中...', en: 'Signing out...' },
  { zh: '刷新', en: 'Refresh' },
  { zh: '刷新中...', en: 'Refreshing...' },
  { zh: '刷新列表', en: 'Refresh List' },
  { zh: '加载中...', en: 'Loading...' },
  { zh: '保存', en: 'Save' },
  { zh: '保存中...', en: 'Saving...' },
  { zh: '重试', en: 'Retry' },
  { zh: '返回', en: 'Back' },
  { zh: '返回列表', en: 'Back to List' },
  { zh: '返回工作台', en: 'Back to Dashboard' },
  { zh: '返回教师工作台', en: 'Back to Teacher Dashboard' },
  { zh: '复制链接', en: 'Copy Link' },
  { zh: '已复制', en: 'Copied' },
  { zh: '生成中...', en: 'Generating...' },
  { zh: '生成学生邀请链接', en: 'Generate Student Invite Link' },
  { zh: '总数', en: 'Total' },
  { zh: '过期时间', en: 'Expires' },
  { zh: '截止', en: 'Due' },
  { zh: '更新', en: 'Updated' },
  { zh: '发布时间', en: 'Published' },
  { zh: '发布老师', en: 'Published by' },
  { zh: '覆盖学生', en: 'Students covered' },
  { zh: '创建时间', en: 'Created' },
  { zh: '学生工作台', en: 'Student Dashboard' },
  { zh: '教师工作台', en: 'Teacher Dashboard' },
  { zh: '快捷操作', en: 'Quick Actions' },
  { zh: '近期任务', en: 'Recent Tasks' },
  { zh: '通知信息', en: 'Notices' },
  { zh: '学生', en: 'Student' },
  { zh: '老师', en: 'Teacher' },
  { zh: '教师', en: 'Teacher' },
  { zh: '管理员', en: 'Admin' },
  { zh: '教师管理', en: 'Teacher Management' },
  { zh: '任务系统', en: 'Task Center' },
  { zh: '通知管理', en: 'Notice Management' },
  { zh: '学生管理', en: 'Student Management' },
  { zh: '学生账号管理', en: 'Student Account Management' },
  { zh: '学生档案', en: 'Student Profile' },
  { zh: '课程规划', en: 'Course Plan' },
  { zh: '语言成绩跟踪', en: 'Language Score Tracking' },
  { zh: 'OSSLT 跟踪', en: 'OSSLT Tracking' },
  { zh: 'OSSLT 登记', en: 'OSSLT Record' },
  { zh: '义工跟踪', en: 'Volunteer Tracking' },
  { zh: '义工记录', en: 'Volunteer Records' },
  { zh: '姓名设置', en: 'Name Settings' },
  { zh: '账号设置', en: 'Account Settings' },
  { zh: '全部', en: 'All' },
  { zh: '全部学生', en: 'All Students' },
  { zh: '活动', en: 'Activity' },
  { zh: '义工', en: 'Volunteer' },
  { zh: '标记已读', en: 'Mark as Read' },
  { zh: '标记完成', en: 'Mark Complete' },
  { zh: '重新打开', en: 'Reopen' },
  { zh: '开始任务', en: 'Start Task' },
  { zh: '未开始', en: 'Not Started' },
  { zh: '进行中', en: 'In Progress' },
  { zh: '已完成', en: 'Completed' },
  { zh: '已逾期', en: 'Overdue' },
  { zh: '无截止日期', en: 'No due date' },
  { zh: '姓名', en: 'Name' },
  { zh: '邮箱', en: 'Email' },
  { zh: '电话', en: 'Phone' },
  { zh: '毕业时间', en: 'Graduation Date' },
  { zh: '学校', en: 'School' },
  { zh: '在加拿大的身份', en: 'Status in Canada' },
  { zh: '性别', en: 'Gender' },
  { zh: '国籍', en: 'Nationality' },
  { zh: '第一语言', en: 'First Language' },
  { zh: '母语', en: 'Mother Tongue' },
  { zh: '国家', en: 'Country' },
  { zh: '省份', en: 'Province' },
  { zh: '城市', en: 'City' },
  { zh: '服务项目', en: 'Service Items' },
  { zh: '教师备注（学生不可见）', en: 'Teacher Notes (Hidden from students)' },
  { zh: '档案', en: 'Profile' },
  { zh: '语言成绩', en: 'Language Scores' },
  { zh: '跟进状态', en: 'Tracking Status' },
  { zh: '语言报课情况', en: 'Language Course Status' },
  { zh: 'OSSLT 成绩', en: 'OSSLT Result' },
  { zh: 'OSSLT 跟进状态', en: 'OSSLT Tracking Status' },
  { zh: '重置密码', en: 'Reset Password' },
  { zh: '归档', en: 'Archive' },
  { zh: '归档状态', en: 'Archive Status' },
  { zh: '可选择', en: 'Selectable' },
  { zh: '点击选择服务项目', en: 'Select service items' },
  { zh: '密码规则', en: 'Password Policy' },
  { zh: '设置新密码', en: 'Set New Password' },
  { zh: '当前密码', en: 'Current Password' },
  { zh: '新密码', en: 'New Password' },
  { zh: '确认新密码', en: 'Confirm New Password' },
  { zh: '设置密码', en: 'Set Password' },
  { zh: '修改密码', en: 'Change Password' },
  { zh: '登录会话已过期，请重新登录。', en: 'Login session expired. Please sign in again.' },
  { zh: '请填写所有必填项。', en: 'Please complete all required fields.' },
  { zh: '请输入当前密码。', en: 'Current password is required.' },
  { zh: '新密码确认不匹配。', en: 'The new password confirmation does not match.' },
  { zh: '新密码必须与当前密码不同。', en: 'New password must be different from current password.' },
  { zh: '密码更新失败。', en: 'Password update failed.' },
  { zh: '密码设置成功。', en: 'Password set successfully.' },
  { zh: '密码已更新。', en: 'Password updated.' },
];

const ALL_UI_TRANSLATIONS: readonly TranslationEntry[] = [
  ...CORE_UI_TRANSLATIONS,
  ...ADDITIONAL_UI_TRANSLATIONS,
];

const EXACT_LOOKUP = new Map<string, LocalizedText>();
for (const entry of ALL_UI_TRANSLATIONS) {
  const normalized = normalizeLocalizedText(entry);
  const bilingual = formatBilingualText(normalized);

  if (normalized.zh) EXACT_LOOKUP.set(normalized.zh, normalized);
  if (normalized.en) EXACT_LOOKUP.set(normalized.en, normalized);
  if (bilingual && bilingual !== normalized.zh && bilingual !== normalized.en) {
    EXACT_LOOKUP.set(bilingual, normalized);
  }
}

const ZH_TO_EN_REPLACEMENTS = buildReplacementPairs('en');
const EN_TO_ZH_REPLACEMENTS = buildReplacementPairs('zh');

export function uiText(zh: string, en: string): LocalizedText {
  return normalizeLocalizedText({ zh, en });
}

export function translateUiText(
  value: string | LocalizedText | null | undefined,
  language: AppLanguage
): string {
  if (isLocalizedText(value)) {
    return formatByLanguage(value, language);
  }

  const source = String(value ?? '');
  if (!source) return '';

  const leading = source.match(/^\s*/)?.[0] ?? '';
  const trailing = source.match(/\s*$/)?.[0] ?? '';
  const core = source.slice(leading.length, source.length - trailing.length);
  if (!core) return source;

  const entry = EXACT_LOOKUP.get(core);
  if (entry) {
    return `${leading}${formatByLanguage(entry, language)}${trailing}`;
  }

  const fragmentTranslated = translateByFragments(core, language);
  if (!fragmentTranslated) return source;

  return `${leading}${fragmentTranslated}${trailing}`;
}

export function isLocalizedText(value: unknown): value is LocalizedText {
  return !!value && typeof value === 'object' && 'zh' in value && 'en' in value;
}

function normalizeLocalizedText(value: LocalizedText): LocalizedText {
  return {
    zh: String(value.zh ?? '').trim(),
    en: String(value.en ?? '').trim(),
  };
}

function formatByLanguage(value: LocalizedText, language: AppLanguage): string {
  const normalized = normalizeLocalizedText(value);

  if (language === 'zh') {
    return normalized.zh || normalized.en;
  }

  return normalized.en || normalized.zh;
}

function buildReplacementPairs(language: AppLanguage): ReadonlyArray<Readonly<{ from: string; to: string }>> {
  const bySource = new Map<string, string>();

  for (const entry of ALL_UI_TRANSLATIONS) {
    const normalized = normalizeLocalizedText(entry);
    const from = language === 'en' ? normalized.zh : normalized.en;
    const to = language === 'en' ? normalized.en : normalized.zh;
    if (!from || !to || from === to || bySource.has(from)) continue;
    bySource.set(from, to);
  }

  return [...bySource.entries()]
    .sort((left, right) => right[0].length - left[0].length)
    .map(([from, to]) => ({ from, to }));
}

function translateByFragments(source: string, language: AppLanguage): string | null {
  const replacements = language === 'en' ? ZH_TO_EN_REPLACEMENTS : EN_TO_ZH_REPLACEMENTS;
  let translated = source;
  let changed = false;

  for (const item of replacements) {
    if (!item.from || translated.indexOf(item.from) < 0) continue;

    if (language === 'zh' && isAsciiPhrase(item.from)) {
      const nextValue = replaceAsciiPhrase(translated, item.from, item.to);
      if (nextValue !== translated) {
        translated = nextValue;
        changed = true;
      }
      continue;
    }

    translated = translated.split(item.from).join(item.to);
    changed = true;
  }

  return changed ? translated : null;
}

function isAsciiPhrase(value: string): boolean {
  return /^[A-Za-z0-9 ]+$/.test(value);
}

function replaceAsciiPhrase(source: string, from: string, to: string): string {
  const escaped = escapeRegExp(from);
  const pattern = new RegExp(`(^|[^A-Za-z0-9])${escaped}(?=$|[^A-Za-z0-9])`, 'g');
  return source.replace(pattern, (match, prefix: string) => {
    const leading = prefix || '';
    const matchedText = match.slice(leading.length);
    if (matchedText !== from) return match;
    return `${leading}${to}`;
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatBilingualText(value: LocalizedText): string {
  const normalized = normalizeLocalizedText(value);
  if (!normalized.zh) return normalized.en;
  if (!normalized.en) return normalized.zh;
  if (normalized.zh === normalized.en) return normalized.zh;

  return `${normalized.zh} / ${normalized.en}`;
}
