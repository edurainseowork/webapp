export const DESK_HOME = {
    mentor: '/mentorDesk',
    teacher_assistant: '/teacherAssistantDesk',
  } as const;
  
  export type DeskRole = keyof typeof DESK_HOME;
  
  export const STUDY_HOME = '/study/';
  
  export const isDeskRole = (role: string | null | undefined): role is DeskRole => !!role && role in DESK_HOME;
  
  export const isCmsRole = (role: string | null | undefined) => role === 'admin' || role === 'faculty';
  
  const normalize = (path: string) => path.replace(/\/+$/, '').toLowerCase();
  
  /** True when `path` is the desk home or a page inside it (case-insensitive, trailing slash ignored). */
  export const isWithin = (path: string, home: string) => {
    const p = normalize(path);
    const h = normalize(home);
    return p === h || p.startsWith(`${h}/`);
  };
  
  /** True for any desk URL, whatever the signed-in role. */
  export const isDeskPath = (path: string) => Object.values(DESK_HOME).some((home) => isWithin(path, home));
  
  /** Moves the address bar without reloading (no extra history entry). */
  export const replacePath = (path: string) => {
    if (typeof window !== 'undefined' && window.location.pathname !== path) {
      window.history.replaceState(null, '', path + window.location.search);
    }
  };