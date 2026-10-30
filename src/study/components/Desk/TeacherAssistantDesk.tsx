import { BookOpen, ClipboardList, UserRound } from 'lucide-react';
import { DeskLayout } from './DeskLayout';

/** /teacherAssistantDesk — the only page a Teacher Assistance account can open on the study website. */
export function TeacherAssistantDesk() {
  return (
    <DeskLayout
      apiPrefix="/teacher-assistant-desk"
      deskName="Teacher Assistance"
      subtitle="Welcome to the Teacher Assistance Portal."
      description="This area will contain the tools and resources you need to support our teachers and students. New features will be added here soon."
      cards={[
        { icon: UserRound, title: 'My Profile', text: 'Your details and account settings.' },
        { icon: ClipboardList, title: 'Assigned Tasks', text: 'Tasks assigned to you by the teaching team.' },
        { icon: BookOpen, title: 'Learning Resources', text: 'Guides and material to help you assist teachers.' },
      ]}
    />
  );
}

export default TeacherAssistantDesk;