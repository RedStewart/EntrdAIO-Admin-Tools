require("dotenv").config();
const axios = require("axios");

const { Client, Intents } = require("discord.js");
let intents = new Intents(Intents.ALL);
intents.remove("GUILD_PRESENCES");

const client = new Client({ ws: { intents: intents } });

const prefix = "$";

client.login(process.env.DISCORDJS_BOT_TOKEN);

client.on("ready", () => console.log("Bot ready..."));

client.on("message", (message) => {
  if (message.author.bot) return;

  let authorisedUsers = process.env.AUTHORISED_USERS.split(" ");
  if (
    message.channel.id === process.env.CHANNEL_ID &&
    authorisedUsers.includes(message.author.id)
  ) {
    if (message.content.startsWith(prefix)) {
      const cmdName = message.content
        .trim()
        .substring(prefix.length)
        .split(/\s+/)[0];

      const user = message.content.substr(message.content.indexOf(" ") + 1);

      if (cmdName === "help") help(message);
      if (cmdName === "key") key(user, message);
    }
  }
});

const help = (message) => {
  message.channel.send(
    "**Commands**```$key Username#1234 => Send a fresh key to specified user```  "
  );
};

const key = async (user, message) => {
  // user object
  user = {
    username: user.split("#")[0],
    discriminator: user.split("#")[1]
  };
  console.log(user);

  // fetch all members in server
  let serverMembers = await message.guild.members.fetch();

  // return if no members are found
  if (!serverMembers) {
    message.channel.send("Failed to fetch server members");
    console.error("Failed to fetch server members");
    return;
  }

  // find the user the command has specified
  let userData = serverMembers.find(
    (el) =>
      el.user.username === user.username &&
      el.user.discriminator === user.discriminator
  );

  // return if no user is found
  if (!userData) {
    message.channel.send("User doesn't exist in this server");
    console.error("User doesn't exist in this server");
    return;
  }

  await sendKey(user, userData.id, message);

  console.log("--------------------------------------------");
};

const sendKey = async (user, id, message) => {
  try {
    let res = await axios({
      method: "GET",
      url: process.env.ENTRDAIO_USERS_ALL_URL,
      headers: {
        authorization: process.env.ENTRDAIO_AUTH
      }
    });

    // return if no keys are returned
    if (!res.data) {
      message.channel.send("Failed to retrieve EntrdAIO keys");
      console.error("Failed to retrieve EntrdAIO keys");
      return;
    }

    // get all the avaliable keys from our DB
    let data = res.data;
    data = res.data.filter((el) => el.activated === false && el.count === 0);

    if (data.length < 1) {
      message.channel.send("No available keys, please gen some more");
      console.error("No available keys, please gen some more");
      return;
    }

    // get random key
    let validKey = randomArrElement(data);
    console.log(validKey);

    // activate the key so its not picked up again when sending another key
    res = await axios({
      method: "POST",
      url: process.env.ENTRDAIO_ACTIVATE_KEY,
      headers: {
        "content-type": "application/json",
        authorization: process.env.ENTRDAIO_AUTH
      },
      data: {
        key: validKey.key
      }
    });

    res = await axios({
      method: "PUT",
      url: `${process.env.ENTRDAIO_UPDATE_KEY}/${validKey.key}`,
      headers: {
        "content-type": "application/json",
        authorization: process.env.ENTRDAIO_AUTH
      },
      data: {
        discordID: id
      }
    });

    // send key to user
    client.users.cache
      .get(id)
      .send(
        "Welcome to EntrdAIO! Please find your key below:\n```" +
          validKey.key +
          "```\nBefore starting the bot please DM EntrdAIO Server Tools with the command below to release your key\n```!deactivate " +
          validKey.key +
          "```"
      );

    // send verification message to channel
    message.channel.send(
      "**Key Successfully Sent!**\n```Key: " +
        validKey.key +
        "\nUser: " +
        user.username +
        "#" +
        user.discriminator +
        "\nRemaining Unused Keys: " +
        (data.length - 1) +
        "```"
    );
  } catch (err) {
    console.log(err);
    console.error("Failed to request EntrdAIO API");
    return;
  }
};

const randomArrElement = (arr) => {
  return arr[Math.floor(Math.random() * arr.length)];
};
