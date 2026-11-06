import { InterviewCoursePlan } from '../../services/graduation-application-stage.service';
const key = (s: string | null | undefined) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const cities: Record<string, {province: string; zone: string; permanent?: string}> = {};
function add(province: string, zone: string, names: string[], permanent?: string) {
  names.forEach(name=>cities[key(name)]={province,zone,permanent});
}
add('ontario','America/Toronto',['Toronto','Ottawa','Waterloo','Kitchener','Cambridge','London','Hamilton','Mississauga','Markham','Richmond Hill','Vaughan','Oakville','Burlington','Brampton','Windsor','Kingston','Guelph','Barrie','Oshawa','Whitby','Ajax','Pickering','Newmarket','Aurora','St Catharines','Niagara Falls','Sudbury','North Bay','Peterborough']);
add('britishcolumbia','America/Vancouver',['Vancouver','Victoria','Burnaby','Richmond','Surrey','Coquitlam','Port Coquitlam','West Vancouver','North Vancouver','New Westminster','Langley','Abbotsford','Kelowna','Kamloops','Nanaimo','Prince George'], 'Etc/GMT+7');
add('alberta','America/Edmonton',['Edmonton','Calgary','Red Deer','Lethbridge','Medicine Hat','Fort McMurray','St Albert'], 'Etc/GMT+6');
add('manitoba','America/Winnipeg',['Winnipeg','Brandon','Steinbach','Thompson'], 'Etc/GMT+5');
add('saskatchewan','America/Regina',['Regina','Saskatoon','Moose Jaw','Prince Albert']);
add('quebec','America/Toronto',['Montreal','Quebec City','Quebec','Laval','Gatineau','Sherbrooke']);
add('novascotia','America/Halifax',['Halifax','Dartmouth','Sydney']);
add('newbrunswick','America/Moncton',['Moncton','Fredericton','Saint John']);
add('princeedwardisland','America/Halifax',['Charlottetown','Summerside']);
add('newfoundlandandlabrador','America/St_Johns',["St. John's","St Johns",'Mount Pearl','Corner Brook']);
add('yukon','America/Whitehorse',['Whitehorse']);
const aliases:Record<string,string>={on:'ontario',bc:'britishcolumbia',ab:'alberta',mb:'manitoba',sk:'saskatchewan',qc:'quebec',ns:'novascotia',nb:'newbrunswick',pe:'princeedwardisland',pei:'princeedwardisland',nl:'newfoundlandandlabrador',yt:'yukon'};
function offset(zone:string, at:Date):number {
  const parts = new Intl.DateTimeFormat('en-US',{timeZone:zone,timeZoneName:'longOffset'}).formatToParts(at);
  const value=parts.find(p=>p.type==='timeZoneName')?.value || '';
  if(value==='GMT') return 0;
  const match=/GMT([+-])(\d{2}):(\d{2})/.exec(value);
  if(!match) throw new Error('Unknown offset');
  return (Number(match[2])*60+Number(match[3]))*(match[1]==='-'?-1:1);
}
export function schoolTimeDifference(row:InterviewCoursePlan, at=new Date()):string {
  const province=key(row.schoolProvince); const city=cities[key(row.schoolCity)];
  const country=key(row.schoolCountry);
  if(country && country!=='canada' && country!=='ca') return '时区待确认';
  if(!city || city.province!==(aliases[province]||province)) return '时区待确认';
  // Provincial permanent-time changes effective November 2026 are explicit so older browser ICU data stays correct.
  const zone=city.permanent && at.getTime()>=Date.parse('2026-11-01T12:00:00Z')?city.permanent:city.zone;
  try {
    const hours=(offset(zone,at)-offset('America/Toronto',at))/60;
    return hours===0?'当前与安省（多伦多）同一时间':`当前相对安省（多伦多）：${hours>0?'+':''}${hours} 小时`;
  } catch { return '时区待确认'; }
}
