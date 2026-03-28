const { MeetingRoom } = require("../Models/Meeting_Room_model");
const { Meeting } = require("../Models/Meeting_model");

class QueueService {
  constructor(io) {
    this.io = io;
    // Store active timers so we can cancel them if meeting ends early
    this.activeTimers = new Map(); // meetingId -> { warning, autoEnd }
  }

  // ─────────────────────────────────────────────
  //  TEACHER JOINS → create/get room, mark active
  // ─────────────────────────────────────────────
  async teacherJoin(roomId, teacherId, teacherEmail) {
    let room = await MeetingRoom.findOne({ meetingId: roomId });

    if (!room) {
      room = await MeetingRoom.create({
        meetingId: roomId,
        teacherId,
        teacherEmail,
        status: "active",
      });
    } else {
      room.teacherId = teacherId;
      room.teacherEmail = teacherEmail;
      room.status = "active";
      await room.save();
    }

    // Update your existing Meeting model status too
    await Meeting.findByIdAndUpdate(roomId, { status: "active" });

    // Notify room
    this.io.to(roomId).emit("teacher-ready", {
      teacherEmail,
      message: "Teacher has joined. Ready for parents.",
    });

    // If parents are already waiting in queue, notify teacher
    if (room.queue.length > 0) {
      this.io.to(roomId).emit("queue-updated", {
        queueLength: room.queue.length,
        queue: this._formatQueue(room.queue),
      });

      // If no parent is currently in meeting, auto-admit first
      if (!room.currentParentId) {
        await this._admitNextParent(roomId);
      }
    }

    return { success: true, room };
  }

  // ─────────────────────────────────────────────
  //  PARENT JOINS → admit or queue
  // ─────────────────────────────────────────────
  async parentJoin(roomId, parentId, parentEmail, parentName, studentName) {
    let room = await MeetingRoom.findOne({ meetingId: roomId });

    if (!room) {
      // Room not created yet (teacher hasn't joined)
      room = await MeetingRoom.create({
        meetingId: roomId,
        status: "waiting_for_teacher",
      });
    }

    // Already in meeting?
    if (room.currentParentId === parentId) {
      return {
        success: true,
        status: "already_in_meeting",
        message: "You are already in the meeting.",
      };
    }

    // Already in queue?
    const queueIndex = room.queue.findIndex((q) => q.parentId === parentId);
    if (queueIndex !== -1) {
      return {
        success: true,
        status: "already_in_queue",
        position: queueIndex + 1,
        estimatedWaitMinutes: (queueIndex + 1) * room.meetingDurationMinutes,
        message: `You are #${queueIndex + 1} in queue.`,
      };
    }

    // ── CASE 1: Room is free & teacher is present → admit directly ──
    if (!room.currentParentId && room.teacherId) {
      room.currentParentId = parentId;
      room.currentParentEmail = parentEmail;
      room.meetingStartedAt = new Date();
      room.status = "in_meeting";
      await room.save();

      this.io.to(roomId).emit("parent-admitted", {
        parentId,
        parentEmail,
        parentName,
        studentName,
        duration: room.meetingDurationMinutes,
        message: `Meeting started with ${parentName || parentEmail}.`,
      });

      // Start auto-end timer
      this._startMeetingTimer(roomId, room.meetingDurationMinutes);

      return {
        success: true,
        status: "admitted",
        message: "You have been admitted to the meeting.",
      };
    }

    // ── CASE 2: Teacher not here yet → queue but inform ──
    if (!room.teacherId) {
      room.queue.push({
        parentId,
        parentEmail,
        parentName,
        studentName,
        joinedQueueAt: new Date(),
      });
      await room.save();

      return {
        success: true,
        status: "waiting_for_teacher",
        position: room.queue.length,
        message: "Teacher has not joined yet. You are in the waiting queue.",
      };
    }

    // ── CASE 3: Another parent is in meeting → add to queue ──
    room.queue.push({
      parentId,
      parentEmail,
      parentName,
      studentName,
      joinedQueueAt: new Date(),
    });
    await room.save();

    const position = room.queue.length;
    const estimatedWait = position * room.meetingDurationMinutes;

    // Tell this parent they're queued
    this.io.to(roomId).emit("parent-queued", {
      parentId,
      parentEmail,
      position,
      estimatedWaitMinutes: estimatedWait,
      currentParentEmail: room.currentParentEmail,
      message: `Teacher is in a meeting. You are #${position} in queue. Wait ~${estimatedWait} min.`,
    });

    // Tell teacher about updated queue
    this.io.to(roomId).emit("queue-updated", {
      queueLength: room.queue.length,
      queue: this._formatQueue(room.queue),
    });

    return {
      success: true,
      status: "queued",
      position,
      estimatedWaitMinutes: estimatedWait,
    };
  }

  // ─────────────────────────────────────────────
  //  END CURRENT MEETING
  // ─────────────────────────────────────────────
  async endCurrentMeeting(roomId, endedBy = "system") {
    const room = await MeetingRoom.findOne({ meetingId: roomId });
    if (!room || !room.currentParentId) {
      return { success: false, error: "No active meeting to end." };
    }

    // Cancel any running timers
    this._clearTimers(roomId);

    // Save to history
    room.completedMeetings.push({
      parentId: room.currentParentId,
      parentEmail: room.currentParentEmail,
      startedAt: room.meetingStartedAt,
      endedAt: new Date(),
    });

    const previousParentEmail = room.currentParentEmail;

    // Clear current parent
    room.currentParentId = null;
    room.currentParentEmail = null;
    room.meetingStartedAt = null;
    room.status = "active";
    await room.save();

    // Notify everyone
    this.io.to(roomId).emit("meeting-ended", {
      previousParentEmail,
      endedBy,
      message: `Meeting with ${previousParentEmail} has ended.`,
    });

    // Auto-admit next from queue
    if (room.queue.length > 0) {
      await this._admitNextParent(roomId);
    } else {
      this.io.to(roomId).emit("room-free", {
        message: "No more parents in queue. Waiting for next parent.",
      });
    }

    return { success: true, previousParentEmail };
  }

  // ─────────────────────────────────────────────
  //  PARENT LEAVES (queue or meeting)
  // ─────────────────────────────────────────────
  async parentLeave(roomId, parentId) {
    const room = await MeetingRoom.findOne({ meetingId: roomId });
    if (!room) return { success: false, error: "Room not found." };

    // If currently in meeting → end it
    if (room.currentParentId === parentId) {
      return this.endCurrentMeeting(roomId, "parent_left");
    }

    // Remove from queue
    const before = room.queue.length;
    room.queue = room.queue.filter((q) => q.parentId !== parentId);
    if (room.queue.length === before) {
      return { success: false, error: "Parent not found." };
    }
    await room.save();

    // Notify updated positions
    this.io.to(roomId).emit("queue-updated", {
      queueLength: room.queue.length,
      queue: this._formatQueue(room.queue),
    });

    return { success: true };
  }

  // ─────────────────────────────────────────────
  //  GET ROOM STATUS
  // ─────────────────────────────────────────────
  async getRoomStatus(roomId) {
    const room = await MeetingRoom.findOne({ meetingId: roomId });
    if (!room) return null;

    let timeRemainingSeconds = null;
    if (room.meetingStartedAt) {
      const elapsed = (Date.now() - room.meetingStartedAt.getTime()) / 1000;
      timeRemainingSeconds = Math.max(
        0,
        room.meetingDurationMinutes * 60 - elapsed,
      );
    }

    return {
      meetingId: room.meetingId,
      status: room.status,
      teacherEmail: room.teacherEmail,
      currentParentEmail: room.currentParentEmail,
      timeRemainingSeconds,
      queueLength: room.queue.length,
      queue: this._formatQueue(room.queue),
      completedCount: room.completedMeetings.length,
    };
  }

  // ─────────────────────────────────────────────
  //  CLOSE ROOM (teacher ends PTM)
  // ─────────────────────────────────────────────
  async closeRoom(roomId) {
    this._clearTimers(roomId);

    const room = await MeetingRoom.findOne({ meetingId: roomId });
    if (!room) return { success: false };

    room.status = "closed";
    room.currentParentId = null;
    room.currentParentEmail = null;
    room.queue = [];
    await room.save();

    await Meeting.findByIdAndUpdate(roomId, { status: "closed" });

    this.io.to(roomId).emit("room-closed", {
      message: "Meeting room has been closed by the teacher.",
      completedCount: room.completedMeetings.length,
    });

    return { success: true };
  }

  // ═════════════════════════════════════════════
  //  PRIVATE HELPERS
  // ═════════════════════════════════════════════

  async _admitNextParent(roomId) {
    const room = await MeetingRoom.findOne({ meetingId: roomId });
    if (!room || room.queue.length === 0) return;

    const next = room.queue.shift();
    room.currentParentId = next.parentId;
    room.currentParentEmail = next.parentEmail;
    room.meetingStartedAt = new Date();
    room.status = "in_meeting";
    await room.save();

    // Notify: next parent admitted
    this.io.to(roomId).emit("next-parent-admitted", {
      parentId: next.parentId,
      parentEmail: next.parentEmail,
      parentName: next.parentName,
      studentName: next.studentName,
      duration: room.meetingDurationMinutes,
      message: `${next.parentName || next.parentEmail} has been admitted.`,
    });

    // Updated queue positions for remaining
    this.io.to(roomId).emit("queue-updated", {
      queueLength: room.queue.length,
      queue: this._formatQueue(room.queue),
    });

    this._startMeetingTimer(roomId, room.meetingDurationMinutes);
  }

  _startMeetingTimer(roomId, durationMinutes) {
    this._clearTimers(roomId);

    const durationMs = durationMinutes * 60 * 1000;
    const timers = {};

    // 1-minute warning
    if (durationMs > 60000) {
      timers.warning = setTimeout(() => {
        this.io.to(roomId).emit("meeting-warning", {
          message: "1 minute remaining.",
          remainingSeconds: 60,
        });
      }, durationMs - 60000);
    }

    // Auto-end
    timers.autoEnd = setTimeout(async () => {
      try {
        const room = await MeetingRoom.findOne({ meetingId: roomId });
        if (room && room.currentParentId && room.status === "in_meeting") {
          await this.endCurrentMeeting(roomId, "timer_expired");
        }
      } catch (err) {
        console.error("Auto-end error:", err);
      }
    }, durationMs);

    this.activeTimers.set(roomId, timers);
  }

  _clearTimers(roomId) {
    const timers = this.activeTimers.get(roomId);
    if (timers) {
      if (timers.warning) clearTimeout(timers.warning);
      if (timers.autoEnd) clearTimeout(timers.autoEnd);
      this.activeTimers.delete(roomId);
    }
  }

  _formatQueue(queue) {
    return queue.map((q, i) => ({
      position: i + 1,
      parentEmail: q.parentEmail,
      parentName: q.parentName,
      studentName: q.studentName,
      joinedAt: q.joinedQueueAt,
    }));
  }
}

module.exports = { QueueService };
