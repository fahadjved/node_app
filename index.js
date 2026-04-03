const express = require("express");
const { setServers } = require("node:dns/promises");
const dotoenv = require("dotenv");
dotoenv.config();
const { Meeting } = require("./Models/Meeting_model");
const { MeetingRoom } = require("./Models/Meeting_Room_model");
const { QueueService } = require("./Models/Queue");
const bodyparser = require("body-parser");
//const serverless = require('serverless-http');
const http = require("http");
const { Server } = require("socket.io");
const { CheckAuth } = require("./Middlewares/Chech_Auth");
const PORT = process.env.PORT || 8080;
const app = express();
const DBurl = process.env.MONGODB_URI;

const userRouter = require("./routes/user");
const teacherRouter = require("./routes/Teacher");
const adminRouter = require("./routes/Admin");
const parentRouter = require("./routes/Parent");
const server = http.createServer(app);
setServers(["1.1.1.1", "8.8.8.8"]);

const { DBConnection } = require("./Connection");

// cors
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Initialize queue service
const queueService = new QueueService(io);

// connect to database
DBConnection(DBurl)
  .then((_) => {
    console.log(`Successfully Connected to Mongo DB `);
  })
  .catch((e) => {
    console.log(`Error in Connection ${e}`);
  });

// middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ============================================================
// SERVER SIDE — Socket.IO signaling + Queue Management
// ============================================================

const emailTosocketId = new Map();
const socketidtoemail = new Map();
// Track which room each socket is in (for disconnect cleanup)
const socketToRoom = new Map();

io.on("connection", (socket) => {
  console.log("New socket connected:", socket.id);

  // ─────────────────────────────────────────────
  //  ROOM JOIN (existing + queue logic)
  // ─────────────────────────────────────────────
  socket.on("on-join", async (data) => {
    const { email, roomId, role, parentName, studentName, userId } = data;
    // role = "teacher" | "parent"  ← send this from your frontend
    console.log(`User ${email} (${role || "unknown"}) joined room ${roomId}`);

    emailTosocketId.set(email, socket.id);
    socketidtoemail.set(socket.id, email);
    socketToRoom.set(socket.id, { roomId, email, role, userId });

    // Join socket.io room (needed for WebRTC signaling)
    socket.join(roomId);

    // ─── QUEUE LOGIC based on role ───
    if (role === "teacher") {
      // Teacher joins → room becomes active, queue starts processing
      const result = await queueService.teacherJoin(
        roomId,
        userId || email,
        email,
      );
      socket.emit("joined", { email, roomId, queueStatus: result.status });

      // Send current room status to teacher
      const status = await queueService.getRoomStatus(roomId);
      socket.emit("room-status", status);
    } else if (role === "parent") {
      // Parent joins → check if room is free or add to queue
      const result = await queueService.parentJoin(
        roomId,
        userId || email,
        email,
        parentName || "",
        studentName || "",
      );

      socket.emit("joined", { email, roomId, queueStatus: result.status });

      if (result.status === "admitted") {
        // Parent is admitted → tell teacher to start WebRTC
        socket.broadcast.to(roomId).emit("user-joined", { email });
      }
      // If "queued" → parent waits. When their turn comes,
      // "next-parent-admitted" event fires and frontend
      // should trigger the WebRTC offer/answer flow.
    } else {
      // Fallback: original behavior if role not sent
      await Meeting.findByIdAndUpdate(roomId, { status: "active" });
      socket.emit("joined", { email, roomId });
      socket.broadcast.to(roomId).emit("user-joined", { email });
    }
  });

  // ─────────────────────────────────────────────
  //  END MEETING (teacher or parent clicks "End")
  // ─────────────────────────────────────────────
  socket.on("end-meeting", async (data) => {
    const { roomId } = data;
    const info = socketToRoom.get(socket.id);
    const endedBy = info?.role === "teacher" ? "teacher" : "parent";

    try {
      const result = await queueService.endCurrentMeeting(roomId, endedBy);
      socket.emit("end-meeting-result", result);
    } catch (err) {
      console.error("end-meeting error:", err);
      socket.emit("error", { message: "Failed to end meeting." });
    }
  });

  // ─────────────────────────────────────────────
  //  PARENT LEAVES QUEUE
  // ─────────────────────────────────────────────
  socket.on("leave-queue", async (data) => {
    const { roomId, parentId } = data;
    try {
      const result = await queueService.parentLeave(roomId, parentId);
      socket.emit("leave-queue-result", result);
    } catch (err) {
      console.error("leave-queue error:", err);
    }
  });

  // ─────────────────────────────────────────────
  //  GET ROOM STATUS
  // ─────────────────────────────────────────────
  socket.on("get-room-status", async (data) => {
    const { roomId } = data;
    const status = await queueService.getRoomStatus(roomId);
    socket.emit("room-status", status);
  });

  // ─────────────────────────────────────────────
  //  TEACHER CLOSES PTM ENTIRELY
  // ─────────────────────────────────────────────
  socket.on("close-room", async (data) => {
    const { roomId } = data;
    const info = socketToRoom.get(socket.id);
    if (info?.role !== "teacher") {
      return socket.emit("error", {
        message: "Only teacher can close the room.",
      });
    }
    const result = await queueService.closeRoom(roomId);
    socket.emit("close-room-result", result);
  });

  // ─────────────────────────────────────────────
  //  WebRTC SIGNALING (your existing code, unchanged)
  // ─────────────────────────────────────────────

  // ─── Offer ───
  socket.on("offer", (data) => {
    const { offer, email } = data;
    const socketid = emailTosocketId.get(email);
    const fromemail = socketidtoemail.get(socket.id);
    console.log(`Offer from ${fromemail} to ${email}`);
    if (socketid) {
      socket.to(socketid).emit("incoming-call", { from: fromemail, offer });
    }
  });

  // ─── Answer ───
  socket.on("call-accepected", (data) => {
    const { answer, from } = data;
    const sockid = emailTosocketId.get(from);
    console.log(`Answer received for ${from}`);
    if (sockid) {
      socket.to(sockid).emit("accept", { answer });
    }
  });

  // ─── ICE Candidate Relay ───
  socket.on("ice-candidate", (data) => {
    const { candidate, email } = data;
    const socketid = emailTosocketId.get(email);
    const fromemail = socketidtoemail.get(socket.id);
    console.log(`ICE candidate from ${fromemail} to ${email}`);
    if (socketid) {
      socket.to(socketid).emit("ice-candidate", {
        candidate,
        from: fromemail,
      });
    }
  });

  // ─── Disconnect cleanup (updated with queue cleanup) ───
  socket.on("disconnect", async () => {
    const email = socketidtoemail.get(socket.id);
    const info = socketToRoom.get(socket.id);

    if (email) {
      console.log(`User ${email} disconnected`);
      emailTosocketId.delete(email);
      socketidtoemail.delete(socket.id);
    }

    // If parent disconnects, remove from queue or end their meeting
    if (info && info.role === "parent") {
      try {
        await queueService.parentLeave(info.roomId, info.userId || info.email);
      } catch (err) {
        console.error("Disconnect cleanup error:", err);
      }
    }

    socketToRoom.delete(socket.id);
  });
});

// ============================================================
// REST API — Room status endpoints
// ============================================================
app.get("/api/v1/meeting-room/:roomId/status", async (req, res) => {
  try {
    const status = await queueService.getRoomStatus(req.params.roomId);
    if (!status) {
      return res.status(404).json({ error: "Room not found." });
    }
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: "Internal server error." });
  }
});

app.get("/api/v1/meeting-room/:roomId/history", async (req, res) => {
  try {
    const room = await MeetingRoom.findOne({ meetingId: req.params.roomId });
    if (!room) {
      return res.status(404).json({ error: "Room not found." });
    }
    res.json({
      meetingId: room.meetingId,
      totalCompleted: room.completedMeetings.length,
      meetings: room.completedMeetings,
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error." });
  }
});

// test route
app.get("/", CheckAuth(), (req, res) => {
  return res.send("Hello from server lambda function for vide calling app!");
});

// routes
app.use("/api/v1/user", userRouter);
app.use("/api/v1/teacher", teacherRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/parent", parentRouter);

// start the server
server.listen(PORT, "0.0.0.0", (_) =>
  console.log(`Server is started at Port ${PORT}`),
);

//module.exports.handler = serverless(app);
