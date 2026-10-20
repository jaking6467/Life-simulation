// หลักสูตรที่มหาวิทยาลัย: จ่ายค่าเทอมตอนลงทะเบียน แล้วเข้าเรียนให้ครบจำนวนคาบ
// level = คะแนนการศึกษาที่ได้เมื่อเรียนจบ (รวมกันได้สูงสุด 8 ต่อสัปดาห์)

export const COURSE_LIST = [
  { id: 'highschool', name: 'มัธยมปลาย (กศน.)', icon: '📗', sessions: 3, fee: 1500, level: 1, prereq: null },
  { id: 'culinary', name: 'ประกาศนียบัตรการทำอาหาร', icon: '🍳', sessions: 3, fee: 3000, level: 1, prereq: null },
  { id: 'arts', name: 'ศิลปกรรมศาสตร์', icon: '🎨', sessions: 4, fee: 4000, level: 2, prereq: 'highschool' },
  { id: 'business', name: 'บริหารธุรกิจ', icon: '📊', sessions: 5, fee: 6000, level: 2, prereq: 'highschool' },
  { id: 'computer', name: 'วิทยาการคอมพิวเตอร์', icon: '💻', sessions: 5, fee: 7000, level: 2, prereq: 'highschool' },
  { id: 'engineering', name: 'วิศวกรรมศาสตร์', icon: '⚙️', sessions: 6, fee: 8000, level: 2, prereq: 'highschool' },
  { id: 'nursing', name: 'พยาบาลศาสตร์', icon: '🩺', sessions: 5, fee: 6500, level: 2, prereq: 'highschool' },
  { id: 'mba', name: 'ปริญญาโท MBA', icon: '🎓', sessions: 5, fee: 15000, level: 3, prereq: 'business' },
  { id: 'medicine', name: 'แพทยศาสตร์', icon: '⚕️', sessions: 7, fee: 20000, level: 4, prereq: 'nursing' },
];

export const COURSES = Object.freeze(Object.fromEntries(COURSE_LIST.map((c) => [c.id, c])));
