"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const app = express_1.default();
var http = require("http").createServer(app);
var path = require("path");
let io = require("socket.io")(http, {
    cors: {
        origin: "*",
        methods: ["GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS"],
    },
});
const adminNamespace = io.of("/admin");
app.get("/", (req, res) => res.sendfile(__dirname + "/index.html"));
app.get("/admin", (req, res) => res.sendfile(__dirname + "/index.html"));
app.get("/scores", (req, res) => res.sendfile(__dirname + "/index.html"));
app.get("/answers", (req, res) => res.sendfile(__dirname + "/index.html"));
app.use(express_1.default.static(__dirname + "/public"));
app.listen(8080, () => {
    console.log(`⚡️[server]: Server is running at https://localhost:${8080}`);
});
const port = 8000;
const state = {
    teams: [],
    currentRound: null,
    roundAnswers: [],
};
const mergeAnswers = (oldAnswers, newAnswers) => {
    if (oldAnswers == null)
        return newAnswers;
    return newAnswers.map((newAnswer, index) => {
        if (newAnswer === "") {
            return oldAnswers[index];
        }
        return newAnswer;
    });
};
io.listen(port);
const findTeamByUserId = (userId) => {
    const { teams } = state;
    return teams.find((team) => team.userId === userId);
};
const setTeamScore = (userId, score) => {
    findTeamByUserId(userId).score = score;
};
const addteam = (userId, teamName) => {
    state.teams = [...state.teams, { userId, name: teamName, score: 0 }];
    return { userId, name: teamName, score: 0 };
    console.log(state.teams);
};
const pushStateToAdmin = () => {
    pushTeamsToAdmin();
};
const pushRoundToClients = () => {
    io.emit("new-round", state.currentRound);
};
const pushTeamsToAdmin = () => {
    adminNamespace.emit("teams-update", state.teams);
};
const pushAnswersToAdmin = () => {
    adminNamespace.emit("answers-update", state.roundAnswers);
};
io.on("connection", (socket) => {
    const userId = socket.handshake.query["token"];
    console.log("a user connected ", userId);
    const teamExists = !!findTeamByUserId(userId);
    if (!teamExists) {
        console.log("Team does not exist for ", userId);
        socket.emit("register-team");
    }
    else {
        socket.emit("team-exists", findTeamByUserId(userId));
        if (state.currentRound != null) {
            socket.emit("new-round", state.currentRound);
            const thisRoundsAnswers = state.roundAnswers.find((roundAnswer) => roundAnswer.roundName === state.currentRound.name);
            socket.emit("client-update-answers", thisRoundsAnswers.answerRecords[userId]);
        }
    }
    socket.on("submit-team-name", (data) => {
        const team = addteam(userId, data.teamName);
        socket.emit("submit-team-name-complete", team);
        if (state.currentRound != null) {
            socket.emit("new-round", state.currentRound);
            const thisRoundsAnswers = state.roundAnswers.find((roundAnswer) => roundAnswer.roundName === state.currentRound.name);
            socket.emit("client-update-answers", thisRoundsAnswers.answerRecords[userId]);
        }
        pushTeamsToAdmin();
    });
    socket.on("submit-answers", (data) => {
        var _a;
        console.log(data);
        console.log("received answers from ", (_a = data.team) === null || _a === void 0 ? void 0 : _a.name);
        const thisRoundsAnswers = state.roundAnswers.find((roundAnswer) => roundAnswer.roundName === state.currentRound.name);
        thisRoundsAnswers.answerRecords[data.team.userId] = mergeAnswers(thisRoundsAnswers.answerRecords[data.team.userId], data.answers);
        pushAnswersToAdmin();
    });
    socket.prependAny((event, ...args) => {
        console.log(`got ${event}`);
    });
});
adminNamespace.on("connection", (socket) => {
    const userId = socket.handshake.query["token"];
    console.log("an admin connected ", userId);
    pushStateToAdmin();
    socket.on("change-score", (data) => {
        setTeamScore(data.teamID, data.newScore);
        pushTeamsToAdmin();
    });
    socket.on("get-answers", () => {
        pushAnswersToAdmin();
    });
    socket.on("set-round", (data) => {
        state.currentRound = {
            name: data.roundName,
            numberOfQuestions: data.numberOfQuestions,
        };
        state.roundAnswers = [
            ...state.roundAnswers,
            {
                roundName: data.roundName,
                answerRecords: {},
                numberOfQuestions: data.numberOfQuestions,
            },
        ];
        pushRoundToClients();
    });
});
//# sourceMappingURL=index.js.map