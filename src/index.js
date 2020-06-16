require('dotenv').config({path: '../.env'})

const Discord = require("discord.js");
const prefix = '!!';
const token = process.env.TOKEN;
const ytdl = require("ytdl-core");
const client = new Discord.Client();
const queue = new Map();

client.once("ready", () => {
    console.log("Ready!");
});

client.once("reconnecting", () => {
    console.log("Reconnecting!");
});

client.once("disconnect", () => {
    console.log("Disconnect!");
});

client.on("message", async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith(prefix)) return;

    const serverQueue = queue.get(message.guild.id);

    if (message.content.startsWith(`${prefix}play`)) {
        execute(message, serverQueue);
        return;
    } else if (message.content.startsWith(`${prefix}skip`)) {
        skip(message, serverQueue);
        return;
    } else if (message.content.startsWith(`${prefix}stop`)) {
        stop(message, serverQueue);
        return;
    }
    else if (message.content.startsWith(`${prefix}queue`)) {
        queuee(message, serverQueue);
        return;
    } else {
        message.channel.send("You need to enter a valid command!");
    }
});

async function execute(message, serverQueue) {
    const args = message.content.split(" ");
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel)
        return message.channel.send(
            "You need to be in a voice channel to play music!"
        );
    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
        return message.channel.send(
            "I need the permissions to join and speak in your voice channel!"
        );
    }

    const songInfo = await ytdl.getInfo(args[1]);

    console.log(songInfo.videoDetails);

    const dr = parseInt(songInfo.videoDetails.lengthSeconds);

    const song = {
        title: songInfo.videoDetails.title,
        url: songInfo.videoDetails.video_url,
        thumbnail: songInfo.videoDetails.thumbnail.thumbnails[0].url,
        duration: parseInt(dr / 60) + ':' + (dr % 60)
    };

    if (!serverQueue) {
        const queueContruct = {
            textChannel: message.channel,
            voiceChannel: voiceChannel,
            connection: null,
            songs: [],
            volume: 5,
            playing: true
        };

        queue.set(message.guild.id, queueContruct);

        queueContruct.songs.push(song);

        try {
            var connection = await voiceChannel.join();
            queueContruct.connection = connection;
            play(message.guild, queueContruct.songs[0], message.author);
        } catch (err) {
            console.log(err);
            queue.delete(message.guild.id);
            return message.channel.send(err);
        }
    } else {
        serverQueue.songs.push(song);

        const exampleEmbed = new Discord.MessageEmbed()
            .setColor('#0099ff')
            .setTitle(song.title)
            .setURL(song.url)
            .setAuthor("Música adicionada a fila")
            .setThumbnail(song.thumbnail)
            .addFields(
                { name: 'Duração:', value: song.duration, inline: true },
                { name: 'Solicitada por:', value: message.author.username + "#" + message.author.discriminator, inline: true },
            )
            .setTimestamp()

        return message.channel.send(exampleEmbed);
    }
}

function queuee(message, serverQueue) {
    var queueOutput = [];
    var count = 1;
    serverQueue.songs.forEach(function (entry) { // For each queue item
        queueOutput = [...queueOutput, { name: count + ". Música", value: entry.title, inline: false }];
        count++;
    });

    const exampleEmbed = new Discord.MessageEmbed()
        .setColor('#0099ff')
        .setTitle('Fila de músicas')
        .addFields(queueOutput)
        .setTimestamp()
    message.channel.send(exampleEmbed);
}

function skip(message, serverQueue) {
    if (!message.member.voice.channel)
        return message.channel.send(
            "You have to be in a voice channel to stop the music!"
        );
    if (!serverQueue)
        return message.channel.send("There is no song that I could skip!");
    serverQueue.connection.dispatcher.end();
}

function stop(message, serverQueue) {
    if (!message.member.voice.channel)
        return message.channel.send(
            "You have to be in a voice channel to stop the music!"
        );
    serverQueue.songs = [];
    serverQueue.connection.dispatcher.end();
}

function play(guild, song, author) {
    const serverQueue = queue.get(guild.id);
    if (!song) {
        serverQueue.voiceChannel.leave();
        queue.delete(guild.id);
        return;
    }

    const dispatcher = serverQueue.connection
        .play(ytdl(song.url))
        .on("finish", () => {
            serverQueue.songs.shift();
            play(guild, serverQueue.songs[0]);
        })
        .on("error", error => console.error(error));
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);

    const exampleEmbed = new Discord.MessageEmbed()
        .setColor('#0099ff')
        .setTitle(song.title)
        .setURL(song.url)
        .setAuthor("Tocando agora: ")
        .setThumbnail(song.thumbnail)
        .addFields(
            { name: 'Duração:', value: song.duration, inline: true },
            { name: 'Solicitada por:', value: author.username + "#" + author.discriminator, inline: true },
        )
        .setTimestamp()

    serverQueue.textChannel.send(exampleEmbed);
}

client.login(token);