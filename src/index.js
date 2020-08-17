require('dotenv').config()

const Discord = require("discord.js");
const prefix = '!!';

const token = process.env.TOKEN;
const ytoken = process.env.YTOKEN;

const ytdl = require("ytdl-core");
const client = new Discord.Client();
const queue = new Map();

const axios = require('axios');


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

    var serverQueue = queue.get(message.guild.id);

    if (message.content.startsWith(`${prefix}p`)) {
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
    }
    else if (message.content.startsWith(`${prefix}shuffle`)) {
        serverQueue.songs = shuffle(serverQueue.songs);
        return;
    }
    else if (message.content.startsWith(`${prefix}playlist`)) {
        if (serverQueue !== undefined)
            serverQueue.songs = [...serverQueue.songs, ...(await playlist(message, serverQueue))];
        else
            (await playlist(message, serverQueue))
        return;
    } else {
        message.channel.send("You need to enter a valid command!");
    }
});

async function execute(message, serverQueue) {

    const args = message.content.split(' ');
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

    let queryVideo = await getMusic(args);

    const songInfo = await ytdl.getInfo(queryVideo);

    const song = {
        title: songInfo.videoDetails.title,
        url: songInfo.videoDetails.video_url,
        username: message.author.username,
        discriminator: message.author.discriminator,
        thumbnail: songInfo.videoDetails.thumbnail.thumbnails[0].url,
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
                { name: 'Solicitada por:', value: song.username + "#" + song.discriminator, inline: true },
            )
            .setTimestamp()

        return message.channel.send(exampleEmbed);
    }
}

async function createServerQueue(message, musicList) {

    const voiceChannel = message.member.voice.channel;

    const queueContruct = {
        textChannel: message.channel,
        voiceChannel: voiceChannel,
        connection: null,
        songs: [],
        volume: 5,
        playing: true
    };

    queue.set(message.guild.id, queueContruct);

    queueContruct.songs = [...queueContruct.songs, ...musicList];

    try {
        var connection = await voiceChannel.join();
        queueContruct.connection = connection;
        play(message.guild, queueContruct.songs[0], message.author);
    } catch (err) {
        console.log(err);
        queue.delete(message.guild.id);
        return message.channel.send(err);
    }

}

async function getMusic(query) {

    query.shift();
    let videoName = query.join('_');

    if (videoName.includes('https://'))
        return videoName;

    try {
        const result = await axios.get(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${videoName}&type=video&key=${ytoken}`)
        let videoId = (result.data.items[0].id.videoId);
        return 'https://www.youtube.com/watch?v=' + videoId;
    } catch (error) {
        console.log(error);
    }
}

function queuee(message, serverQueue) {

    console.log(serverQueue.songs)

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

function shuffle(songs) {
    var currentIndex = songs.length, temporaryValue, randomIndex;
    while (0 !== currentIndex) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        if (randomIndex !== 0 && currentIndex !== 0) {
            temporaryValue = songs[currentIndex];
            songs[currentIndex] = songs[randomIndex];
            songs[randomIndex] = temporaryValue;
        }
    }
    return songs;
}

async function playlist(message, serverQueue) {

    let playlistUrl = message.content.split(' ')[1];

    playlistUrl = playlistUrl.split('&');
    playlistId = playlistUrl[1].split('=')[1];

    try {
        const result = await axios.get(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}&key=${ytoken}`)
        let musicArray = result.data.items;
        let auxArray = [];

        for (music of musicArray) {
            songInfo = music.snippet;
            let song = {
                title: songInfo.title,
                url: 'https://www.youtube.com/watch?v=' + songInfo.resourceId.videoId,
                username: message.author.username,
                discriminator: message.author.discriminator,
                thumbnail: songInfo.thumbnails.default.url,
            }
            auxArray.push(song);
        }

        if (serverQueue === undefined) {
            createServerQueue(message, auxArray);
            return [];
        }

        return auxArray;

    } catch (error) {
        console.log(error);
    }

    return []
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
            { name: 'Solicitada por:', value: song.username + "#" + song.discriminator, inline: true },
        )
        .setTimestamp()

    serverQueue.textChannel.send(exampleEmbed);
}

client.login(token);