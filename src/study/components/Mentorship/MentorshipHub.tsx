import { useState } from 'react';
import { MentorsView } from './MentorsView';
import { BookMentorView, type MentorBooking } from './BookMentorView';
import { INITIAL_FAVORITES, getMentor } from './mentorData';

interface MentorshipHubProps {
  /** Shown on the confirmation screen ("Meet link will be sent to …") */
  studentEmail: string;
  /** Close mentorship and go back to the home page */
  onExit: () => void;
}

/**
 * 1-on-1 Mentorship flow:
 *   Design 1 → MentorsView (all mentors)
 *   Design 2 → BookMentorView (book a session with the selected mentor)
 */
export function MentorshipHub({ studentEmail, onExit }: MentorshipHubProps) {
  const [favorites, setFavorites] = useState<string[]>(INITIAL_FAVORITES);
  const [selectedMentorId, setSelectedMentorId] = useState<string | null>(null);
  const [, setBookings] = useState<MentorBooking[]>([]);

  const toggleFavorite = (mentorId: string) =>
    setFavorites((prev) => (prev.includes(mentorId) ? prev.filter((id) => id !== mentorId) : [...prev, mentorId]));

  return (
    <>
      {/* Mentors list stays mounted so search / filters are kept when coming back */}
      <div className={selectedMentorId ? 'hidden' : ''}>
        <MentorsView
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          onBack={onExit}
          onOpenMentor={setSelectedMentorId}
        />
      </div>

      {selectedMentorId && (
        <BookMentorView
          key={selectedMentorId}
          mentor={getMentor(selectedMentorId)}
          studentEmail={studentEmail}
          onBack={() => setSelectedMentorId(null)}
          onExit={onExit}
          onBooked={(booking) => setBookings((prev) => [...prev, booking])}
        />
      )}
    </>
  );
}

export default MentorshipHub;
