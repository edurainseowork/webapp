import { useState } from 'react';
import { MentorsView } from './MentorsView';
import { BookMentorView } from './BookMentorView';
import type { Mentor } from './mentorData';

interface MentorshipHubProps {
  /** Shown on the confirmation screen ("Meet link will be sent to …") */
  studentEmail: string;
  /** Student's goal (CMS category): mentors come from that goal's courses */
  goalId: number | null;
  goalName: string | null;
  /** Opens the goal popup */
  onChangeGoal: () => void;
  /** Close mentorship and go back to the home page */
  onExit: () => void;
}

/**
 * 1-on-1 Mentorship flow:
 *   MentorsView     → course mentors for the student's goal (from the backend)
 *   BookMentorView  → the mentor's real open slots, then a booking
 */
export function MentorshipHub({ studentEmail, goalId, goalName, onChangeGoal, onExit }: MentorshipHubProps) {
  const [selected, setSelected] = useState<Mentor | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <>
      {/* Mentors list stays mounted so search / filters are kept when coming back */}
      <div className={selected ? 'hidden' : ''}>
        <MentorsView goalId={goalId} goalName={goalName} onChangeGoal={onChangeGoal} onBack={onExit} onOpenMentor={setSelected} refreshKey={refreshKey} />
      </div>

      {selected && (
        <BookMentorView
          key={selected.id}
          mentorId={selected.id}
          initial={selected}
          studentEmail={studentEmail}
          onBack={() => setSelected(null)}
          onExit={onExit}
          onBooked={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </>
  );
}

export default MentorshipHub;