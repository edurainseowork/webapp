import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { markAsRead, type NotificationDoc } from '../lib/notificationService';

export const useNotifications = (userId?: string, batchIds: string[] = []) => {
  const [notifications, setNotifications] = useState<NotificationDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    const unsubs: (() => void)[] = [];
    const map = new Map<string, NotificationDoc>();

    const updateState = () => {
      const merged = Array.from(map.values()).sort((a, b) => {
        const tA = a.createdAt?.toMillis?.() || 0;
        const tB = b.createdAt?.toMillis?.() || 0;
        return tB - tA;
      });
      setNotifications(merged);
      setLoading(false);
    };

    const qUser = query(
      collection(db, 'notifications'),
      where('targetType', '==', 'USER'),
      where('targetId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    unsubs.push(
      onSnapshot(
        qUser,
        (snap) => {
          snap.docChanges().forEach((change) => {
            if (change.type === 'removed') map.delete(change.doc.id);
            else map.set(change.doc.id, { id: change.doc.id, ...change.doc.data() } as NotificationDoc);
          });
          updateState();
        },
        (err) => console.error('User notifications error:', err)
      )
    );

    if (batchIds.length > 0) {
      const qBatch = query(
        collection(db, 'notifications'),
        where('targetType', '==', 'BATCH'),
        where('targetId', 'in', batchIds.slice(0, 30)),
        orderBy('createdAt', 'desc'),
        limit(50)
      );

      unsubs.push(
        onSnapshot(
          qBatch,
          (snap) => {
            snap.docChanges().forEach((change) => {
              if (change.type === 'removed') map.delete(change.doc.id);
              else map.set(change.doc.id, { id: change.doc.id, ...change.doc.data() } as NotificationDoc);
            });
            updateState();
          },
          (err) => console.error('Batch notifications error:', err)
        )
      );
    }

    return () => unsubs.forEach((unsub) => unsub());
  }, [userId, JSON.stringify(batchIds)]);

  const unreadCount = notifications.filter(
    (n) => !userId || !n.readBy?.includes(userId)
  ).length;

  return {
    notifications,
    unreadCount,
    loading,
    markRead: (id: string) => userId && markAsRead(id, userId),
    markAllRead: async () => {
      if (!userId) return;
      const unread = notifications.filter((n) => !n.readBy?.includes(userId));
      await Promise.all(unread.map((n) => markAsRead(n.id, userId)));
    },
  };
};
