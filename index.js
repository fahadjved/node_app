const express = require('express');
const bodyparser = require('body-parser');
//const serverless = require('serverless-http');
const http = require('http');
const { Server } = require('socket.io');
const { json } = require('express');
const PORT = process.env.PORT || 8080;
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const emailTosocketId = new Map();
const socketidtoemail = new Map();
io.on("connection", (socket) => {
    console.log(socket.id);

    // on room joined 
    socket.on("on-join", (data) => {
        const { email, roomId } = data;
        console.log(`User ${email} is joined the room ${roomId}`);
        emailTosocketId.set(email, socket.id);
        socketidtoemail.set(socket.id, email);

        // join the room id from 
        socket.join(roomId);

        // Broadcast the new user in all ready joined the room 
        socket.broadcast.to(roomId).emit("user-joined", { email });

    });
    socket.on("offer", (data) => {
        const { offer, email } = data;
        console.log(data);
        const socketid = emailTosocketId.get(email);
        const fromemail = socketidtoemail.get(socket.id);
        console.log("offer", JSON.stringify(data) + "\n");
        socket.to(socketid).emit("incoming-call", { from: fromemail, offer });
    });
    socket.on("call-accepected", (data) => {
        const { answer, from } = data;
        console.log("other user offer", data);
        const sockid = emailTosocketId.get(from);
        socket.to(sockid).emit("accept", { answer });
    })
});

app.get('/', (req, res) => {
    return res.send("Hello from server lambda function!");
})
server.listen(PORT,"0.0.0.0", (_) => console.log(`Server is started at Port ${PORT}`));

//module.exports.handler = serverless(app);