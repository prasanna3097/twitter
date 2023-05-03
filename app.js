const express = require("express");
const path = require("path");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "twitterClone.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

app.post("/register/", async (request, response) => {
  const { username, name, password, gender } = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    const createUserQuery = `
      INSERT INTO 
        user (username, name, password, gender) 
      VALUES 
        (
          '${username}', 
          '${name}',
          '${hashedPassword}', 
          '${gender}'
        )`;
    const dbResponse = await db.run(createUserQuery);
    response.send("User created successfully");
  } else if (password.length < 6) {
    response.status(400);
    response.send("Password is too short");
  } else {
    response.status = 400;
    response.send("User already exists");
  }
});

app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid User");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid Password");
    }
  }
});

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid Access Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid Access Token");
      } else {
        next();
      }
    });
  }
};

app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const selectedTweetQuery = `
        SELECT T.username,
                T.tweet,
                T.date_time AS dateTime
        FROM (user INNER JOIN tweet ON user.user_id = tweet.user_id) AS T
        INNER JOIN follower ON follower.follower_user_id
        ORDER BY username
        LIMIT 4
        OFFSET 0;`;
  const tweetArray = await db.all(selectedTweetQuery);
  response.send(tweetArray);
});

app.get("/user/following/", async (request, response) => {
  const getFollowingQuery = `
    SELECT name
    FROM follower INNER JOIN user ON follower.follower_user_id = user.user_id
    WHERE follower.following_user_id `;
  const followingArray = await db.all(getFollowingQuery);
  response.send(followingArray);
});

app.get("/user/followers/", async (request, response) => {
  const getFollowerQuery = `
    SELECT name
    FROM follower INNER JOIN user ON follower.following_user_id = user.user_id
    WHERE follower.follower_user_id `;
  const followerArray = await db.all(getFollowerQuery);
  response.send(followerArray);
});

app.get("/tweets/:tweetId/", async (request, response) => {
  const { tweetId } = request.params;
  const getFollowingQuery = `
    SELECT name
    FROM follower INNER JOIN user ON follower.follower_user_id = user.user_id
    WHERE follower.following_user_id `;
  const followingArray = await db.all(getFollowingQuery);
  if (followingArray === undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    const selectTweetIdQuery = `
        SELECT T.tweet
                T.reply AS replies,
                T.date_time AS dateTime,
                count(like_id) AS likes
        FROM (tweet INNER JOIN reply ON tweet.tweet_id = reply.tweet_id) AS T
        INNER JOIN like ON like.tweet_id
        WHERE tweet_id = ${tweetId}`;
    const tweetIdArray = await db.all(selectTweetIdQuery);
    response.send(tweetIdArray);
  }
});

module.exports = app;
