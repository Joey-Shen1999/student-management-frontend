export type AppLanguage = 'zh' | 'en';

interface TranslationEntry {
  zh: string;
  en: string;
  fragmentEn?: string;
  fragmentZh?: string;
}

const EXACT_TRANSLATIONS: readonly TranslationEntry[] = [
  { zh: '登录', en: 'Log In', fragmentEn: 'log in' },
  { zh: '登录中...', en: 'Signing in...' },
  { zh: '登录失败。', en: 'Log in failed.' },
  { zh: '用户名', en: 'Username', fragmentEn: 'username' },
  { zh: '密码', en: 'Password', fragmentEn: 'password' },
  { zh: '记住用户名（30天）', en: 'Remember Username (30 days)' },
  { zh: '记住密码（30天）', en: 'Remember Password (30 days)' },
  { zh: '请求处理中...', en: 'Processing request...' },
  { zh: '退出登录', en: 'Sign Out', fragmentEn: 'sign out' },
  { zh: '退出中...', en: 'Signing out...' },
  { zh: '刷新', en: 'Refresh', fragmentEn: 'refresh' },
  { zh: '刷新中...', en: 'Refreshing...' },
  { zh: '刷新列表', en: 'Refresh List' },
  { zh: '加载中...', en: 'Loading...' },
  { zh: '保存', en: 'Save', fragmentEn: 'save' },
  { zh: '保存中...', en: 'Saving...' },
  { zh: '重试', en: 'Retry', fragmentEn: 'retry' },
  { zh: '返回', en: 'Back', fragmentEn: 'back' },
  { zh: '返回列表', en: 'Back to List' },
  { zh: '返回工作台', en: 'Back to Dashboard' },
  { zh: '返回教师工作台', en: 'Back to Teacher Dashboard' },
  { zh: '复制链接', en: 'Copy Link' },
  { zh: '已复制', en: 'Copied' },
  { zh: '生成中...', en: 'Generating...' },
  { zh: '生成学生邀请链接', en: 'Generate Student Invite Link' },
  { zh: '总数', en: 'Total', fragmentEn: 'total' },
  { zh: '过期时间', en: 'Expires', fragmentEn: 'expires' },
  { zh: '截止', en: 'Due', fragmentEn: 'due' },
  { zh: '更新', en: 'Updated', fragmentEn: 'updated' },
  { zh: '发布时间', en: 'Published', fragmentEn: 'published' },
  { zh: '发布老师', en: 'Published by', fragmentEn: 'published by' },
  { zh: '覆盖学生', en: 'Students covered', fragmentEn: 'students covered' },
  { zh: '登录用户名', en: 'Username', fragmentEn: 'username' },
  { zh: '创建时间', en: 'Created', fragmentEn: 'created' },
  { zh: '学生工作台', en: 'Student Dashboard' },
  { zh: '教师工作台', en: 'Teacher Dashboard' },
  { zh: '当前工作区与快捷入口', en: 'Current workspace and shortcuts' },
  { zh: '快捷操作', en: 'Quick Actions' },
  { zh: '近期任务', en: 'Recent Tasks' },
  { zh: '通知信息', en: 'Notices' },
  { zh: '当前没有任务。', en: 'No tasks right now.' },
  { zh: '当前没有符合筛选条件的信息。', en: 'No notices match the current filters.' },
  { zh: '正在加载目标任务...', en: 'Loading tasks...' },
  { zh: '正在加载信息...', en: 'Loading notices...' },
  { zh: '学生', en: 'Student', fragmentEn: 'student' },
  { zh: '老师', en: 'Teacher', fragmentEn: 'teacher' },
  { zh: '教师', en: 'Teacher', fragmentEn: 'teacher' },
  { zh: '管理员', en: 'Admin', fragmentEn: 'admin' },
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
  { zh: '全部分类', en: 'All Categories' },
  { zh: '活动', en: 'Activity', fragmentEn: 'activity' },
  { zh: '义工', en: 'Volunteer', fragmentEn: 'volunteer' },
  { zh: '仅未读', en: 'Unread Only' },
  { zh: '全部', en: 'All', fragmentEn: 'all' },
  { zh: '全部学生', en: 'All Students' },
  { zh: '已读', en: 'Read', fragmentEn: 'read' },
  { zh: '标记已读', en: 'Mark as Read' },
  { zh: '标记完成', en: 'Mark Complete' },
  { zh: '重新打开', en: 'Reopen' },
  { zh: '开始任务', en: 'Start Task' },
  { zh: '未开始', en: 'Not Started' },
  { zh: '进行中', en: 'In Progress' },
  { zh: '已完成', en: 'Completed' },
  { zh: '已逾期', en: 'Overdue' },
  { zh: '无截止日期', en: 'No due date' },
  { zh: '姓名', en: 'Name', fragmentEn: 'name' },
  { zh: '邮箱', en: 'Email', fragmentEn: 'email' },
  { zh: '电话', en: 'Phone', fragmentEn: 'phone' },
  { zh: '毕业时间', en: 'Graduation Date' },
  { zh: '学校名', en: 'School' },
  { zh: '在加拿大的身份', en: 'Status in Canada' },
  { zh: '性别', en: 'Gender', fragmentEn: 'gender' },
  { zh: '国籍', en: 'Nationality', fragmentEn: 'nationality' },
  { zh: '第一语言', en: 'First Language' },
  { zh: '母语', en: 'Mother Tongue' },
  { zh: '所属教育局（在读学校）', en: 'School Board (Current School)' },
  { zh: '国家', en: 'Country', fragmentEn: 'country' },
  { zh: '省份', en: 'Province', fragmentEn: 'province' },
  { zh: '城市', en: 'City', fragmentEn: 'city' },
  { zh: '城市（在读学校）', en: 'City (Current School)' },
  { zh: '服务项目', en: 'Service Items', fragmentEn: 'service items' },
  { zh: '教师备注（学生不可见）', en: 'Teacher Notes (Hidden from students)' },
  { zh: '档案', en: 'Profile', fragmentEn: 'profile' },
  { zh: '语言成绩', en: 'Language Scores', fragmentEn: 'language scores' },
  { zh: '跟进状态', en: 'Tracking Status' },
  { zh: '语言报课情况', en: 'Language Course Status' },
  { zh: 'OSSLT 成绩', en: 'OSSLT Result', fragmentEn: 'OSSLT result' },
  { zh: 'OSSLT 跟进状态', en: 'OSSLT Tracking Status' },
  { zh: '重置密码', en: 'Reset Password' },
  { zh: '归档', en: 'Archive', fragmentEn: 'archive' },
  { zh: '归档状态', en: 'Archive Status' },
  { zh: '可选择', en: 'Selectable' },
  { zh: '点击选择服务项目', en: 'Select service items' },
  { zh: '已审核通过', en: 'Teacher Approved' },
  { zh: '已通过，适配全部学校', en: 'Passed for all schools' },
  { zh: '已通过，适配部分学校', en: 'Passed for some schools' },
  { zh: '需要跟踪', en: 'Needs Tracking' },
  { zh: '无需语言成绩', en: 'No language score required' },
  { zh: '可能需要语言成绩', en: 'Language score may be required' },
  { zh: '已满足语言成绩', en: 'Language score requirement met' },
  { zh: '已满足语言成绩(大部分本科)', en: "Language score requirement met (most bachelor's programs)" },
  { zh: '已通过', en: 'Passed' },
  { zh: '等待更新', en: 'Awaiting Update' },
  { zh: '不可用', en: 'Unavailable' },
  { zh: '补充说明（可选）', en: 'Additional Notes (Optional)' },
  { zh: '通知内容', en: 'Notice Content' },
  { zh: '标签', en: 'Tags', fragmentEn: 'tags' },
  { zh: '不包含空格', en: 'No spaces' },
  { zh: '不能包含用户名', en: 'Must not contain username' },
  { zh: '包含小写字母（a-z）', en: 'Include a lowercase letter (a-z)' },
  { zh: '包含大写字母（A-Z）', en: 'Include an uppercase letter (A-Z)' },
  { zh: '包含数字（0-9）', en: 'Include a number (0-9)' },
  { zh: '包含特殊字符（如 !@#$%）', en: 'Include a special character (e.g. !@#$%)' },
  { zh: '至少 8 个字符', en: 'At least 8 characters' },
  { zh: '一对一辅导', en: 'One-on-One Tutoring' },
  { zh: '显示当前姓名，并快速更新名字/姓氏。', en: 'Display your current name and update first/last name quickly.' },
  { zh: '正在加载当前姓名...', en: 'Loading current name...' },
  { zh: '重新加载当前姓名', en: 'Reload Current Name' },
  { zh: '当前姓名', en: 'Current Name' },
  { zh: '法定姓名', en: 'Legal Name' },
  { zh: '新名字', en: 'New First Name' },
  { zh: '请输入名字', en: 'Enter your first name' },
  { zh: '新姓氏', en: 'New Last Name' },
  { zh: '请输入姓氏', en: 'Enter your last name' },
  { zh: '更新姓名', en: 'Update Name' },
  { zh: '登录会话已过期，请重新登录。', en: 'Login session expired. Please sign in again.' },
  { zh: '请输入新的名字或姓氏。', en: 'Please enter a new first name or last name.' },
  { zh: '名字不能只包含数字。', en: 'First name cannot be numbers only.' },
  { zh: '姓氏不能只包含数字。', en: 'Last name cannot be numbers only.' },
  { zh: '新姓名与当前姓名相同。', en: 'New name is the same as current name.' },
  { zh: '加载当前姓名失败。', en: 'Failed to load current name.' },
  { zh: '姓名已更新。', en: 'Name updated.' },
  { zh: '姓名更新失败。', en: 'Name update failed.' },
  { zh: '设置新密码', en: 'Set New Password' },
  { zh: '出于安全原因，首次登录后需要先设置新密码。', en: 'For security reasons, your first sign-in requires setting a new password before continuing.' },
  { zh: '使用此页面安全地更新账号密码。', en: 'Use this page to securely update your account password.' },
  { zh: '当前密码', en: 'Current Password' },
  { zh: '新密码', en: 'New Password' },
  { zh: '确认新密码', en: 'Confirm New Password' },
  { zh: '密码规则', en: 'Password Policy' },
  { zh: '设置密码', en: 'Set Password' },
  { zh: '修改密码', en: 'Change Password' },
  { zh: '请填写所有必填项。', en: 'Please complete all required fields.' },
  { zh: '请输入当前密码。', en: 'Current password is required.' },
  { zh: '新密码确认不匹配。', en: 'The new password confirmation does not match.' },
  { zh: '新密码必须与当前密码不同。', en: 'New password must be different from current password.' },
  { zh: '密码更新失败。', en: 'Password update failed.' },
  { zh: '密码设置成功。', en: 'Password set successfully.' },
  { zh: '密码已更新。', en: 'Password updated.' },
];

const EXACT_LOOKUP = new Map<string, TranslationEntry>();
for (const entry of EXACT_TRANSLATIONS) {
  EXACT_LOOKUP.set(entry.zh, entry);
  EXACT_LOOKUP.set(entry.en, entry);
}

const ENGLISH_MONTHS = [
  '',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export function translateUiText(value: string, language: AppLanguage): string {
  const source = String(value ?? '');
  if (!source) return '';

  const leading = source.match(/^\s*/)?.[0] ?? '';
  const trailing = source.match(/\s*$/)?.[0] ?? '';
  const core = source.slice(leading.length, source.length - trailing.length);
  if (!core) return source;

  const translated =
    translateExact(core, language) ??
    translateByPattern(core, language) ??
    translateStructuredText(core, language) ??
    translateByFragments(core, language);

  return translated ? `${leading}${translated}${trailing}` : source;
}

export function translateUiFragment(value: string, language: AppLanguage): string {
  const source = String(value ?? '').trim();
  if (!source) return '';

  const exact = translateExact(source, language);
  if (exact) {
    if (language === 'en') {
      const entry = EXACT_LOOKUP.get(source) ?? EXACT_LOOKUP.get(exact);
      return entry?.fragmentEn ?? exact.toLowerCase();
    }
    const entry = EXACT_LOOKUP.get(source) ?? EXACT_LOOKUP.get(exact);
    return entry?.fragmentZh ?? exact;
  }

  const structured = translateStructuredText(source, language);
  if (structured) return structured;

  return translateByFragments(source, language) ?? source;
}

function translateExact(value: string, language: AppLanguage): string | null {
  const entry = EXACT_LOOKUP.get(value);
  if (!entry) return null;
  return language === 'en' ? entry.en : entry.zh;
}

function translateByPattern(value: string, language: AppLanguage): string | null {
  if (language === 'zh') {
    const teacherModeMatch = value.match(/^Teacher mode\s*-\s*Student\s*#(.+)$/i);
    if (teacherModeMatch) return `老师模式 - 学生 #${teacherModeMatch[1]}`;

    const welcomeMatch = value.match(/^Welcome,\s*(.+)$/i);
    if (welcomeMatch) return `欢迎，${welcomeMatch[1]}`;

    const selectedMatch = value.match(/^(\d+)\s+selected$/i);
    if (selectedMatch) return `已选 ${selectedMatch[1]} 项`;

    const hoursMatch = value.match(/^(\d+(?:\.\d+)?)\s+hrs$/i);
    if (hoursMatch) return `${hoursMatch[1]} 小时`;

    return null;
  }

  const selectedCountMatch = value.match(/^已选\s*(\d+)\s*项$/);
  if (selectedCountMatch) return `${selectedCountMatch[1]} selected`;

  const compactSelectedCountMatch = value.match(/^(\d+)\s*项$/);
  if (compactSelectedCountMatch) return `${compactSelectedCountMatch[1]} selected`;

  const hoursMatch = value.match(/^(\d+(?:\.\d+)?)\s*小时$/);
  if (hoursMatch) return `${hoursMatch[1]} hrs`;

  const itemsMatch = value.match(/^(\d+)\s*条$/);
  if (itemsMatch) return `${itemsMatch[1]} items`;

  const yearMonthMatch = value.match(/^(\d{4})年(\d{1,2})月$/);
  if (yearMonthMatch) {
    const year = Number(yearMonthMatch[1]);
    const month = Number(yearMonthMatch[2]);
    const monthName = ENGLISH_MONTHS[month] ?? '';
    if (monthName) return `${monthName} ${year}`;
  }

  const seasonMatch = value.match(/^(\d{4})\s*(秋季|冬季)$/);
  if (seasonMatch) return `${seasonMatch[2] === '秋季' ? 'Fall' : 'Winter'} ${seasonMatch[1]}`;

  const saveFailedMatch = value.match(/^保存(.+)失败。$/);
  if (saveFailedMatch) return `Failed to save ${translateUiFragment(saveFailedMatch[1], 'en')}.`;

  const loadFailedMatch = value.match(/^加载(.+)失败。$/);
  if (loadFailedMatch) return `Failed to load ${translateUiFragment(loadFailedMatch[1], 'en')}.`;

  const updateFailedMatch = value.match(/^更新(.+)失败。$/);
  if (updateFailedMatch) return `Failed to update ${translateUiFragment(updateFailedMatch[1], 'en')}.`;

  const createFailedMatch = value.match(/^创建(.+)失败。$/);
  if (createFailedMatch) return `Failed to create ${translateUiFragment(createFailedMatch[1], 'en')}.`;

  const publishFailedMatch = value.match(/^发布(.+)失败。$/);
  if (publishFailedMatch) return `Failed to publish ${translateUiFragment(publishFailedMatch[1], 'en')}.`;

  const loadingMatch = value.match(/^正在加载(.+)\.\.\.$/);
  if (loadingMatch) return `Loading ${translateUiFragment(loadingMatch[1], 'en')}...`;

  const minimumStudentMatch = value.match(/^请至少选择\s*(\d+)\s*位学生。$/);
  if (minimumStudentMatch) return `Please select at least ${minimumStudentMatch[1]} student(s).`;

  const welcomeMatch = value.match(/^欢迎，(.+)$/);
  if (welcomeMatch) return `Welcome, ${welcomeMatch[1]}`;

  const teacherModeMatch = value.match(/^老师模式\s*-\s*学生\s*#(.+)$/);
  if (teacherModeMatch) return `Teacher mode - Student #${teacherModeMatch[1]}`;

  return null;
}

function translateStructuredText(value: string, language: AppLanguage): string | null {
  const pipeParts = value.split(' | ');
  if (pipeParts.length > 1) {
    const translatedParts = pipeParts.map((part) => translateUiText(part, language));
    if (translatedParts.some((part, index) => part !== pipeParts[index])) {
      return translatedParts.join(' | ');
    }
  }

  const rangeParts = value.split(' 至 ');
  if (rangeParts.length === 2 && language === 'en') {
    const from = translateUiText(rangeParts[0], language);
    const to = translateUiText(rangeParts[1], language);
    if (from !== rangeParts[0] || to !== rangeParts[1]) {
      return `${from} to ${to}`;
    }
  }

  const labelWithValueMatch = value.match(/^(.+?)：\s*(.+)$/);
  if (labelWithValueMatch) {
    const translatedLabel = translateUiFragment(labelWithValueMatch[1], language);
    const translatedValue = translateStructuredValue(labelWithValueMatch[2], language);
    if (translatedLabel !== labelWithValueMatch[1] || translatedValue !== labelWithValueMatch[2]) {
      return language === 'en'
        ? `${toSentenceStart(translatedLabel)}: ${translatedValue}`
        : `${translatedLabel}：${translatedValue}`;
    }
  }

  const suffixColonMatch = value.match(/^(.+?)：$/);
  if (suffixColonMatch) {
    const translatedLabel = translateUiFragment(suffixColonMatch[1], language);
    if (translatedLabel !== suffixColonMatch[1]) {
      return language === 'en' ? `${toSentenceStart(translatedLabel)}:` : `${translatedLabel}：`;
    }
  }

  const bracketMatch = value.match(/^(.+?)（(.+?)）$/);
  if (bracketMatch) {
    const left = translateUiFragment(bracketMatch[1], language);
    const right = translateUiFragment(bracketMatch[2], language);
    if (left !== bracketMatch[1] || right !== bracketMatch[2]) {
      return language === 'en' ? `${toSentenceStart(left)} (${right})` : `${left}（${right}）`;
    }
  }

  return null;
}

function translateByFragments(value: string, language: AppLanguage): string | null {
  const replacements = [...EXACT_TRANSLATIONS].sort((left, right) =>
    language === 'en' ? right.zh.length - left.zh.length : right.en.length - left.en.length
  );

  let translated = value;
  let changed = false;

  for (const entry of replacements) {
    const from = language === 'en' ? entry.zh : entry.en;
    const to = language === 'en' ? entry.fragmentEn ?? entry.en : entry.fragmentZh ?? entry.zh;

    if (!from || translated.indexOf(from) < 0) continue;

    translated = translated.split(from).join(to);
    changed = true;
  }

  if (!changed) return null;

  if (language === 'en') {
    return translated
      .replace(/（/g, ' (')
      .replace(/）/g, ')')
      .replace(/：/g, ': ')
      .replace(/\s{2,}/g, ' ')
      .replace(/\(\s+/g, '(')
      .replace(/\s+\)/g, ')')
      .replace(/\s+,/g, ',')
      .replace(/\s+\./g, '.')
      .trim();
  }

  return translated
    .replace(/\s+\(/g, '（')
    .replace(/\)\s*/g, '）')
    .replace(/:\s*/g, '：')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function translateStructuredValue(value: string, language: AppLanguage): string {
  return (
    translateExact(value, language) ??
    translateByPattern(value, language) ??
    translateStructuredText(value, language) ??
    value
  );
}

function toSentenceStart(value: string): string {
  const source = String(value ?? '').trim();
  if (!source) return '';
  return source.charAt(0).toUpperCase() + source.slice(1);
}
