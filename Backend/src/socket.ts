import { Server as SocketIOServer, Socket } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import { logger } from './lib/logger.js';
import {
  ticketsStore,
  saveTicketToDb,
  type DoubtTicket,
  type ChatMessage,
  getRelativeTime,
} from './routes/tickets.js';
import { corsOptions } from './middlewares/security.js';
import { verifyToken } from './middleware/auth.js';

let io: SocketIOServer | null = null;

// Track resolution request timers (1 hour = 3,600,000 ms)
const AUTO_CLOSE_MS = 60 * 60 * 1000;

export function getIO(): SocketIOServer | null {
  return io;
}

export function initSocket(httpServer: HttpServer): SocketIOServer {
  const securityCors = corsOptions();

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (typeof securityCors.origin === 'function') {
          securityCors.origin(origin, callback);
        } else {
          callback(null, true);
        }
      },
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
    maxHttpBufferSize: 5e6, // 5MB limit for compressed payloads
  });

  // Authenticate socket connection
  io.use(async (socket: Socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        (socket.handshake.headers.authorization?.startsWith('Bearer ')
          ? socket.handshake.headers.authorization.slice(7).trim()
          : null);

      if (token) {
        const reqMock = { headers: { authorization: `Bearer ${token}` } } as any;
        const decoded = await verifyToken(reqMock, false);
        if (decoded) {
          const role =
            decoded.admin || decoded.role === 'admin'
              ? 'admin'
              : decoded.faculty || decoded.role === 'faculty'
              ? 'faculty'
              : decoded.role === 'teacher_assistant'
              ? 'teacher_assistant'
              : decoded.role === 'mentor'
              ? 'mentor'
              : 'student';

          socket.data = {
            authenticated: true,
            user: decoded,
            uid: decoded.uid,
            email: decoded.email?.toLowerCase(),
            name: (decoded.name as string) || decoded.email?.split('@')[0] || 'User',
            role,
          };
          return next();
        }
      }

      socket.data = {
        authenticated: false,
        role: 'student',
      };
      next();
    } catch {
      next();
    }
  });

  io.on('connection', (socket: Socket) => {
    // Join room: ticket_${ticketId}
    socket.on('join_ticket', (payload: { ticketId: string; userId?: string; role?: 'student' | 'teacher' }) => {
      if (!payload || typeof payload.ticketId !== 'string' || !payload.ticketId) return;
      const room = `ticket_${payload.ticketId}`;
      socket.join(room);

      const isElevated =
        socket.data?.role === 'teacher_assistant' ||
        socket.data?.role === 'faculty' ||
        socket.data?.role === 'admin' ||
        payload.role === 'teacher';

      if (isElevated) {
        socket.join('ta_pool');
      }
      logger.info({ socketId: socket.id, room, role: payload.role }, 'User joined ticket room');
    });

    // Send message event (synchronous handler)
    socket.on('send_message', (payload: {
      ticketId: string;
      messageId?: string;
      senderId?: string;
      senderName?: string;
      role?: 'student' | 'ta';
      message: string;
      attachments?: string[];
    }) => {
      if (!payload || typeof payload.ticketId !== 'string' || !payload.ticketId) return;
      const { ticketId, message, attachments = [] } = payload;
      if (!message && attachments.length === 0) return;

      const ticket = ticketsStore.find((t) => t.id === ticketId || t.ticketNumber === ticketId);
      if (!ticket) return;

      if (ticket.status === 'resolved') {
        socket.emit('error_message', { message: 'Cannot send message to a resolved ticket.' });
        return;
      }

      // Check role authorization from socket session if present
      const role =
        socket.data?.role === 'teacher_assistant' ||
        socket.data?.role === 'faculty' ||
        socket.data?.role === 'admin'
          ? 'ta'
          : (payload.role || 'student');

      const senderName =
        socket.data?.name || payload.senderName || (role === 'student' ? ticket.studentName : 'Teacher Assistant');

      // Idempotency: skip if messageId already exists
      if (payload.messageId && ticket.messages.some((m) => m.id === payload.messageId)) {
        return;
      }

      // Turn-based check for student
      if (role === 'student') {
        const lastMsg = ticket.messages[ticket.messages.length - 1];
        if (lastMsg && lastMsg.sender === 'student') {
          socket.emit('error_message', { message: 'Wait for reply from Teacher Assistant before sending another message.' });
          return;
        }
      }

      const newMsg: ChatMessage = {
        id: payload.messageId || `m-${role}-${Date.now()}`,
        sender: role === 'student' ? 'student' : 'ta',
        senderName,
        text: message || '',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        attachmentUrls: attachments,
        attachmentUrl: attachments[0],
      };

      ticket.messages.push(newMsg);

      if (role === 'ta' && ticket.status === 'queue') {
        ticket.status = 'in_progress';
      }

      saveTicketToDb(ticket);

      const msgPayload = {
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        message: newMsg,
        ticket: { ...ticket, submittedAtRelative: getRelativeTime(ticket.submittedAt) },
      };

      // Room broadcast and TA pool broadcast only (not duplicate global io.emit)
      io?.to(`ticket_${ticket.id}`).to(`ticket_${ticket.ticketNumber}`).emit('new_message', msgPayload);
      io?.to('ta_pool').emit('new_message', msgPayload);
      io?.to(`ticket_${ticket.id}`).to(`ticket_${ticket.ticketNumber}`).emit('ticket_updated', {
        ticket: { ...ticket, submittedAtRelative: getRelativeTime(ticket.submittedAt) },
      });
      io?.to('ta_pool').emit('ticket_updated', {
        ticket: { ...ticket, submittedAtRelative: getRelativeTime(ticket.submittedAt) },
      });
    });

    // Request Resolution (synchronous handler)
    socket.on('request_resolution', (payload: { ticketId: string; resolvedBy?: string }) => {
      if (!payload || typeof payload.ticketId !== 'string' || !payload.ticketId) return;
      const { ticketId, resolvedBy } = payload;
      const ticket = ticketsStore.find((t) => t.id === ticketId || t.ticketNumber === ticketId);
      if (!ticket) return;

      if (socket.data?.role === 'student') {
        socket.emit('error_message', { message: 'Only teacher assistants or faculty can request resolution.' });
        return;
      }

      ticket.status = 'resolution_requested';
      ticket.resolutionRequestedAt = new Date().toISOString();
      ticket.resolutionRequestedBy = socket.data?.name || resolvedBy || ticket.assignedTo?.name || 'Teacher Assistant';

      saveTicketToDb(ticket);

      const resPayload = {
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        resolutionRequestedAt: ticket.resolutionRequestedAt,
        resolvedBy: ticket.resolutionRequestedBy,
        ticket: { ...ticket, submittedAtRelative: getRelativeTime(ticket.submittedAt) },
      };

      io?.to(`ticket_${ticket.id}`).to(`ticket_${ticket.ticketNumber}`).emit('resolution_requested', resPayload);
      io?.to('ta_pool').emit('resolution_requested', resPayload);
      io?.to(`ticket_${ticket.id}`).to(`ticket_${ticket.ticketNumber}`).emit('ticket_updated', {
        ticket: { ...ticket, submittedAtRelative: getRelativeTime(ticket.submittedAt) },
      });
      io?.to('ta_pool').emit('ticket_updated', {
        ticket: { ...ticket, submittedAtRelative: getRelativeTime(ticket.submittedAt) },
      });
    });

    // Ticket Action: 'solved' | 'followup' (synchronous handler)
    socket.on('ticket_action', (payload: { ticketId: string; action: 'solved' | 'followup'; message?: string; messageId?: string; attachments?: string[] }) => {
      if (!payload || typeof payload.ticketId !== 'string' || !payload.ticketId) return;
      const { ticketId, action, message, messageId, attachments } = payload;
      const ticket = ticketsStore.find((t) => t.id === ticketId || t.ticketNumber === ticketId);
      if (!ticket) return;

      if (action === 'solved') {
        ticket.status = 'resolved';
        ticket.resolvedAt = new Date().toISOString();
        if (!ticket.resolvedBy && ticket.resolutionRequestedBy) {
          ticket.resolvedBy = ticket.resolutionRequestedBy;
        }

        saveTicketToDb(ticket);

        const statusPayload = {
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          status: 'resolved',
          ticket: { ...ticket, submittedAtRelative: getRelativeTime(ticket.submittedAt) },
        };

        io?.to(`ticket_${ticket.id}`).to(`ticket_${ticket.ticketNumber}`).emit('ticket_status_updated', statusPayload);
        io?.to('ta_pool').emit('ticket_status_updated', statusPayload);

        io?.to(`ticket_${ticket.id}`).to(`ticket_${ticket.ticketNumber}`).emit('ticket_closed', {
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
        });
        io?.to('ta_pool').emit('ticket_closed', {
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
        });
      } else if (action === 'followup') {
        ticket.status = 'in_progress';
        ticket.resolutionRequestedAt = undefined;

        if (messageId && ticket.messages.some((m) => m.id === messageId)) {
          // Idempotency: skip duplicate message addition
        } else if (message || (attachments && attachments.length > 0)) {
          const followupMsg: ChatMessage = {
            id: messageId || `m-st-${Date.now()}`,
            sender: 'student',
            senderName: socket.data?.name || ticket.studentName,
            text: message || '',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            attachmentUrls: Array.isArray(attachments) ? attachments : [],
            attachmentUrl: Array.isArray(attachments) && attachments.length > 0 ? attachments[0] : undefined,
          };
          ticket.messages.push(followupMsg);

          const msgPayload = {
            ticketId: ticket.id,
            ticketNumber: ticket.ticketNumber,
            message: followupMsg,
            ticket: { ...ticket, submittedAtRelative: getRelativeTime(ticket.submittedAt) },
          };
          io?.to(`ticket_${ticket.id}`).to(`ticket_${ticket.ticketNumber}`).emit('new_message', msgPayload);
          io?.to('ta_pool').emit('new_message', msgPayload);
        }

        saveTicketToDb(ticket);

        const statusPayload = {
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          status: 'in_progress',
          ticket: { ...ticket, submittedAtRelative: getRelativeTime(ticket.submittedAt) },
        };
        io?.to(`ticket_${ticket.id}`).to(`ticket_${ticket.ticketNumber}`).emit('ticket_status_updated', statusPayload);
        io?.to('ta_pool').emit('ticket_status_updated', statusPayload);
      }

      io?.to(`ticket_${ticket.id}`).to(`ticket_${ticket.ticketNumber}`).emit('ticket_updated', {
        ticket: { ...ticket, submittedAtRelative: getRelativeTime(ticket.submittedAt) },
      });
      io?.to('ta_pool').emit('ticket_updated', {
        ticket: { ...ticket, submittedAtRelative: getRelativeTime(ticket.submittedAt) },
      });
    });

    // Claim Ticket (synchronous handler)
    socket.on('claim_ticket', (payload: { ticketId: string; taId?: string; taName?: string; taEmail?: string; ta?: any }) => {
      if (!payload || typeof payload.ticketId !== 'string' || !payload.ticketId) return;
      const { ticketId } = payload;
      const ticket = ticketsStore.find((t) => t.id === ticketId || t.ticketNumber === ticketId);
      if (!ticket) return;

      const effectiveEmail = (socket.data?.email || payload.taEmail || payload.ta?.email || 'ta@edurain.in').toLowerCase();
      const effectiveName = socket.data?.name || payload.taName || payload.ta?.name || 'Teacher Assistant';
      const effectiveId = socket.data?.uid || payload.taId || payload.ta?.id || effectiveEmail || 'ta-curr';

      if (ticket.status === 'resolved') {
        socket.emit('error_message', { message: 'Ticket is already resolved and cannot be claimed.' });
        return;
      }

      if (ticket.assignedTo && ticket.assignedTo.email && ticket.assignedTo.email.toLowerCase() !== effectiveEmail) {
        socket.emit('error_message', { message: `Ticket is already claimed by ${ticket.assignedTo.name || ticket.assignedTo.email}` });
        return;
      }

      ticket.assignedTo = { id: effectiveId, name: effectiveName, email: effectiveEmail };
      if (ticket.status === 'queue') ticket.status = 'in_progress';

      saveTicketToDb(ticket);

      const statusPayload = {
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        status: ticket.status,
        assignedTo: ticket.assignedTo,
        ticket: { ...ticket, submittedAtRelative: getRelativeTime(ticket.submittedAt) },
      };

      io?.to(`ticket_${ticket.id}`).to(`ticket_${ticket.ticketNumber}`).emit('ticket_status_updated', statusPayload);
      io?.to('ta_pool').emit('ticket_status_updated', statusPayload);
      io?.to(`ticket_${ticket.id}`).to(`ticket_${ticket.ticketNumber}`).emit('ticket_updated', {
        ticket: { ...ticket, submittedAtRelative: getRelativeTime(ticket.submittedAt) },
      });
      io?.to('ta_pool').emit('ticket_updated', {
        ticket: { ...ticket, submittedAtRelative: getRelativeTime(ticket.submittedAt) },
      });
    });

    // Release Ticket (synchronous handler)
    socket.on('release_ticket', (payload: { ticketId: string }) => {
      if (!payload || typeof payload.ticketId !== 'string' || !payload.ticketId) return;
      const { ticketId } = payload;
      const ticket = ticketsStore.find((t) => t.id === ticketId || t.ticketNumber === ticketId);
      if (!ticket) return;

      ticket.assignedTo = null;
      ticket.status = 'queue';

      saveTicketToDb(ticket);

      const statusPayload = {
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        status: 'queue',
        assignedTo: null,
        ticket: { ...ticket, submittedAtRelative: getRelativeTime(ticket.submittedAt) },
      };

      io?.to(`ticket_${ticket.id}`).to(`ticket_${ticket.ticketNumber}`).emit('ticket_status_updated', statusPayload);
      io?.to('ta_pool').emit('ticket_status_updated', statusPayload);
      io?.to(`ticket_${ticket.id}`).to(`ticket_${ticket.ticketNumber}`).emit('ticket_updated', {
        ticket: { ...ticket, submittedAtRelative: getRelativeTime(ticket.submittedAt) },
      });
      io?.to('ta_pool').emit('ticket_updated', {
        ticket: { ...ticket, submittedAtRelative: getRelativeTime(ticket.submittedAt) },
      });
    });
  });

  // Background 1-hour Auto-Close Cron Check (every 60 seconds)
  setInterval(() => {
    const now = Date.now();
    for (const ticket of ticketsStore) {
      if (ticket.status === 'resolution_requested' && ticket.resolutionRequestedAt) {
        const diff = now - new Date(ticket.resolutionRequestedAt).getTime();
        if (diff >= AUTO_CLOSE_MS) {
          ticket.status = 'resolved';
          ticket.resolvedAt = new Date().toISOString();
          ticket.resolvedBy = ticket.resolutionRequestedBy || ticket.assignedTo?.name || 'Auto-Closed';
          saveTicketToDb(ticket);

          logger.info({ ticketNumber: ticket.ticketNumber }, 'Auto-closed ticket after 1 hour timeout');

          const closedPayload = {
            ticketId: ticket.id,
            ticketNumber: ticket.ticketNumber,
            status: 'resolved',
            ticket: { ...ticket, submittedAtRelative: getRelativeTime(ticket.submittedAt) },
          };

          io?.to(`ticket_${ticket.id}`).to(`ticket_${ticket.ticketNumber}`).emit('ticket_status_updated', closedPayload);
          io?.to('ta_pool').emit('ticket_status_updated', closedPayload);

          io?.to(`ticket_${ticket.id}`).to(`ticket_${ticket.ticketNumber}`).emit('ticket_closed', {
            ticketId: ticket.id,
            ticketNumber: ticket.ticketNumber,
          });
          io?.to('ta_pool').emit('ticket_closed', {
            ticketId: ticket.id,
            ticketNumber: ticket.ticketNumber,
          });

          io?.to(`ticket_${ticket.id}`).to(`ticket_${ticket.ticketNumber}`).emit('ticket_updated', {
            ticket: { ...ticket, submittedAtRelative: getRelativeTime(ticket.submittedAt) },
          });
          io?.to('ta_pool').emit('ticket_updated', {
            ticket: { ...ticket, submittedAtRelative: getRelativeTime(ticket.submittedAt) },
          });
        }
      }
    }
  }, 60000);

  return io;
}
