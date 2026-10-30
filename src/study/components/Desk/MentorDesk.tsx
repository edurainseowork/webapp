import { CalendarClock, MessagesSquare, Users } from 'lucide-react';
import { DeskLayout } from './DeskLayout';

/** /mentorDesk — the only page a Mentor account can open on the study website. */
export function MentorDesk() {
  return (
    <DeskLayout
      apiPrefix="/mentor-desk"
      deskName="Mentor Desk"
      subtitle="Welcome to the Mentor Desk."
      description="This is where you will guide your students: see the students assigned to you, run mentorship sessions and answer their questions. These tools are being built and will appear here soon."
      cards={[
        { icon: Users, title: 'My Students', text: 'The students assigned to you and their progress.' },
        { icon: CalendarClock, title: 'Mentorship Sessions', text: 'Your upcoming and past one-to-one sessions.' },
        { icon: MessagesSquare, title: 'Student Messages', text: 'Questions and messages from your students.' },
      ]}
    />
  );
}

export default MentorDesk;