export interface UserProfile {
  id: string;
  nim: string;
  name: string;
  email: string;
  phone: string;
  faculty: string;
  studyProgram: string;
  role: 'MAHASISWA' | 'PANITIA' | 'DPK_ADMIN';
  avatarUrl?: string;
}
