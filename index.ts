import express from "express";
const app = express();
var http = require("http").createServer(app);
import * as socketio from "socket.io";

let io = require("socket.io")(http, {
  cors: {
    origin: "*",
    methods: ["GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS"],
  },
});

const adminNamespace = io.of("/admin");

const port = 8000;
type Team = {
  userId: string;
  name: string;
  score: number;
};

type State = {
  teams: Array<Team>;
  currentRound: Round | null;
  roundAnswers: Array<RoundAnswerRecord>;
};

type Round = {
  name: string;
  numberOfQuestions: number;
};

type RoundAnswerRecord = {
  roundName: string;
  numberOfQuestions: number;
  answerRecords: {
    [userId: string]: Array<string>;
  };
};
const state: State = {
  teams: [],
  currentRound: null,
  roundAnswers: [],
};

const mergeAnswers = (
  oldAnswers: undefined | null | Array<string>,
  newAnswers: Array<string>
) => {
  if (oldAnswers == null) return newAnswers;
  return newAnswers.map((newAnswer, index) => {
    if (newAnswer === "") {
      return oldAnswers[index];
    }
    return newAnswer;
  });
};

io.listen(port);

const findTeamByUserId = (userId: string) => {
  const { teams } = state;
  return teams.find((team) => team.userId === userId);
};

const setTeamScore = (userId: string, score: number) => {
  findTeamByUserId(userId).score = score;
};

const addteam = (userId: string, teamName: string) => {
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

io.on("connection", (socket: socketio.Socket) => {
  const userId = socket.handshake.query["token"];
  console.log("a user connected ", userId);
  const teamExists = !!findTeamByUserId(userId);

  if (!teamExists) {
    console.log("Team does not exist for ", userId);
    socket.emit("register-team");
  } else {
    socket.emit("team-exists", findTeamByUserId(userId));
    if (state.currentRound != null) {
      socket.emit("new-round", state.currentRound);
      const thisRoundsAnswers = state.roundAnswers.find(
        (roundAnswer) => roundAnswer.roundName === state.currentRound.name
      );
      socket.emit(
        "client-update-answers",
        thisRoundsAnswers.answerRecords[userId]
      );
    }
  }

  socket.on("submit-team-name", (data) => {
    const team = addteam(userId, data.teamName);
    socket.emit("submit-team-name-complete", team);
    if (state.currentRound != null) {
      socket.emit("new-round", state.currentRound);
      const thisRoundsAnswers = state.roundAnswers.find(
        (roundAnswer) => roundAnswer.roundName === state.currentRound.name
      );
      socket.emit(
        "client-update-answers",
        thisRoundsAnswers.answerRecords[userId]
      );
    }
    pushTeamsToAdmin();
  });

  socket.on(
    "submit-answers",
    (data: { answers: Array<string>; team: Team }) => {
      console.log(data);
      console.log("received answers from ", data.team?.name);
      const thisRoundsAnswers = state.roundAnswers.find(
        (roundAnswer) => roundAnswer.roundName === state.currentRound.name
      );

      thisRoundsAnswers.answerRecords[data.team.userId] = mergeAnswers(
        thisRoundsAnswers.answerRecords[data.team.userId],
        data.answers
      );
      pushAnswersToAdmin();
    }
  );

  socket.prependAny((event, ...args) => {
    console.log(`got ${event}`);
  });
});

adminNamespace.on("connection", (socket: socketio.Socket) => {
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
