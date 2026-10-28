import {
  collection,
  addDoc,
  doc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  type Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';

export interface NotificationPayload {
  targetType: 'BATCH' | 'USER';
  targetId: string;
  senderId: string;
  type: 'TEST' | 'MOCK' | 'CONTENT' | 'DOUBT';
  message: string;
  link?: string;
}

export interface NotificationDoc extends NotificationPayload {
  id: string;
  readBy: string[];
  createdAt: Timestamp | null;
}

export const sendNotification = async (payload: NotificationPayload) => {
  return await addDoc(collection(db, 'notifications'), {
    ...payload,
    readBy: [],
    createdAt: serverTimestamp(),
  });
};

export const markAsRead = async (notificationId: string, userId: string) => {
  return await updateDoc(doc(db, 'notifications', notificationId), {
    readBy: arrayUnion(userId),
  });
};
