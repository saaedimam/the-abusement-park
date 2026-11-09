// ── Config (edit here) ──────────────────────────────────────────
export const LEAGUE_ID = '113546';

// Members who have never won — add names not listed as winners in seasons
export const MANAGERS_EXTRA = [
  { name: 'Jawadur Rahman', avatarUrl: '', since: '2008/09' }, // 18 seasons, 0 crowns — the OG sufferer
  { name: 'Wakif Mahmud', avatarUrl: '', since: '2015/16' }, // joined mid-era
];

// Archive screenshots that are referenced by seasons[] but are not in public/images/.
// Do not invent replacements. Remove a path from this list only when the real file is added.
export const MISSING_ARCHIVE_IMAGES = [
  'images/2009.png',
  'images/2010.png',
  'images/2011.png',
  'images/2012.png',
  'images/2013.png',
  'images/2014.png',
  'images/2015.png',
  'images/2017.png',
  'images/2019.png',
  'images/2021.png',
];

export const seasons = [
  { year: "2008/09", winner: "Mac Alvi",              runnerUp: "", img: "images/2009.png" },
  { year: "2009/10", winner: "Mac Alvi",              runnerUp: "", img: "images/2010.png" },
  { year: "2010/11", winner: "Anjishu Bhattacharjee", runnerUp: "", img: "images/2011.png" },
  { year: "2011/12", winner: "Shamjid Siraj",         runnerUp: "", img: "images/2012.png" },
  { year: "2012/13", winner: "Arka Basak",            runnerUp: "", img: "images/2013.png" },
  { year: "2013/14", winner: "Arka Basak",            runnerUp: "", img: "images/2014.png" },
  { year: "2014/15", winner: "Mac Alvi",              runnerUp: "", img: "images/2015.png" },
  { year: "2015/16", winner: "Abrar Siddique",        runnerUp: "Irfan Ahmed",      img: "images/2016.png" },
  { year: "2016/17", winner: "Rainul Islam",          runnerUp: "",                 img: "images/2017.png" },
  { year: "2017/18", winner: "Abrar Siddique",        runnerUp: "Rabez Ahmed",      img: "images/2018.png" },
  { year: "2018/19", winner: "Irfan Ahmed",           runnerUp: "",                 img: "images/2019.png" },
  { year: "2019/20", winner: "Ohidul Islam",          runnerUp: "Motiur Palash",    img: "images/2020.png" },
  { year: "2020/21", winner: "Abrar Siddique",        runnerUp: "",                 img: "images/2021.png" },
  { year: "2021/22", winner: "Abrar Siddique",        runnerUp: "Irfan Ahmed",      img: "images/2022.png" },
  { year: "2022/23", winner: "Mac Alvi",              runnerUp: "Irfan Ahmed",      img: "images/2023.png" },
  { year: "2023/24", winner: "Mac Alvi",              runnerUp: "Shamjid Siraj",    img: "images/2024.png" },
  { year: "2024/25", winner: "Sajid Sadman",          runnerUp: "Abrar Siddique",   img: "images/2025.png" },
  { year: "2025/26", winner: "Abrar Siddique",        runnerUp: "Sabiul Azam",      img: "images/2026.png" },
];

export const FPL_PROFILE_BASE = 'https://fantasy.premierleague.com/entry';
export const OLD_GUARDS = [
  { name: 'Arka Basak', displayName: 'Arka' },
  { name: 'Jawadur Rahman', displayName: 'Jawad' },
  { name: 'Mac Alvi', displayName: 'Alvi' },
  { name: 'Irfan Ahmed', displayName: 'Irfan' },
];
export const CURRENT_LEAGUE_PLAYERS = [
  { entry: 5210060, name: 'Salvi Ali', team: 'Walangas', careerBestPct: '0.6%', careerBestSeason: '2011/12', careerAvgPct: '16.9%', seasons: 14 },
  { entry: 5038971, name: 'Nabid Hassan Kafi', team: 'Alabaster Softshoes', careerBestPct: '7%', careerBestSeason: '2021/22', careerAvgPct: '20.6%', seasons: 16 },
  { entry: 4759536, name: 'Md Tawfiqul Hasan Khan', team: 'sunnynchelsea', careerBestPct: '6%', careerBestSeason: '2017/18', careerAvgPct: '40%', seasons: 20 },
  { entry: 3481222, name: 'Sabiul Azam', team: 'Golazo', careerBestPct: '0.9%', careerBestSeason: '2019/20', careerAvgPct: '11.6%', seasons: 11 },
  { entry: 3232113, name: 'Muzakkir Chowdhury', team: 'Muzakkir', careerBestPct: '11%', careerBestSeason: '2025/26', careerAvgPct: '14.5%', seasons: 2 },
  { entry: 3141367, name: 'Shahedul Alam', team: 'VegaPunk FC', careerBestPct: '7%', careerBestSeason: '2019/20', careerAvgPct: '23.4%', seasons: 7 },
  { entry: 2865865, name: 'Abtahee Majid Ajmain', team: '666 FC', careerBestPct: '22%', careerBestSeason: '2023/24', careerAvgPct: '33.6%', seasons: 5 },
  { entry: 2808481, name: 'Mohammed Jawadur Rahman', team: 'Oishee FC', careerBestPct: '21%', careerBestSeason: '2025/26', careerAvgPct: '47%', seasons: 3, aliases: ['Jawadur Rahman'] },
  { entry: 2297947, name: 'Nameeb Itmaam', team: 'Maguire Machh', careerBestPct: '0.9%', careerBestSeason: '2020/21', careerAvgPct: '22.9%', seasons: 17 },
  { entry: 2279392, name: 'Shamjid Siraj', team: 'Tyrants FC', careerBestPct: '1%', careerBestSeason: '2023/24', careerAvgPct: '10.9%', seasons: 13 },
  { entry: 2127998, name: 'Saifur Rahman Chowdhury', team: 'Average Guys FC', careerBestPct: '4%', careerBestSeason: '2018/19', careerAvgPct: '16.5%', seasons: 11 },
  { entry: 1569009, name: 'Amal Vishak', team: 'Kobbie 11', careerBestPct: '6%', careerBestSeason: '2019/20', careerAvgPct: '26.6%', seasons: 11 },
  { entry: 1512229, name: 'Iori Imasu', team: "Iori's Team", careerBestPct: '89%', careerBestSeason: '2025/26', careerAvgPct: '89%', seasons: 1 },
  { entry: 758562, name: 'Sabbab Hossain', team: 'BUDDHA', careerBestPct: '9%', careerBestSeason: '2021/22', careerAvgPct: '33.5%', seasons: 15 },
  { entry: 358165, name: 'Ali Baba', team: "Ali's Team", careerBestPct: '7%', careerBestSeason: '2024/25', careerAvgPct: '17%', seasons: 2 },
  { entry: 106071, name: 'Abrar Siddiquee', team: 'GoalDiggers ⭐ ⭐ ⭐ ⭐⭐', careerBestPct: '0.6%', careerBestSeason: '2017/18', careerAvgPct: '10.7%', seasons: 10, aliases: ['Abrar Siddique'] },
  { entry: 478867, name: 'Ohidul Islam', team: 'Zoro ⭐️⭐️⭐️', careerBestPct: '1%', careerBestSeason: '2019/20', careerAvgPct: '21.1%', seasons: 11 },
  { entry: 523129, name: 'Irfan Ahmed', team: 'TheatreofMidtable⭐', careerBestPct: '0.6%', careerBestSeason: '2020/21', careerAvgPct: '12.5%', seasons: 18 },
  { entry: 570338, name: 'MAC Alvi', team: '⭐ ⭐ ⭐ ⭐⭐', careerBestPct: '0.3%', careerBestSeason: '2014/15', careerAvgPct: '14.9%', seasons: 16, aliases: ['Mac Alvi'] },
];
