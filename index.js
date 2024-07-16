const fs = require('fs');
const { Client, EmbedBuilder } = require('discord.js');

class EasyMaker {
    constructor(token, giveawaysFile = 'giveaways.json') {
        this.client = new Client();
        this.token = token;
        this.giveawaysFile = giveawaysFile;
        this.giveawaysData = {};
        this.prefix = '!'; // Default prefix

        this.client.once('ready', this.onReady.bind(this));
        this.client.on('message', this.onMessage.bind(this));
    }

    start() {
        this.client.login(this.token);
    }

    onReady() {
        console.log('Giveaway Bot is online!');

        try {
            this.giveawaysData = JSON.parse(fs.readFileSync(this.giveawaysFile));
        } catch (err) {
            console.error('Error loading giveaways:', err);
        }
    }

    saveGiveaways() {
        fs.writeFileSync(this.giveawaysFile, JSON.stringify(this.giveawaysData, null, 4), (err) => {
            if (err) console.error('Error saving giveaways:', err);
        });
    }

    parseTime(timeString) {
        const timeUnits = {
            s: 1000,
            m: 60 * 1000,
            h: 60 * 60 * 1000,
        };

        const match = timeString.match(/^(\d+)([smh])$/);
        if (!match) return null;

        const value = parseInt(match[1]);
        const unit = match[2];

        return value * timeUnits[unit];
    }

    setPrefix(newPrefix) {
        this.prefix = newPrefix;
    }

    async onMessage(message) {
        if (message.author.bot) return;

        if (!message.content.startsWith(this.prefix)) return;

        const args = message.content.slice(this.prefix.length).trim().split(' ');

        if (args[0] === 'start') {
            const timeString = args[1];
            const winners = parseInt(args[2]);
            const prize = args.slice(3).join(' ');

            const time = this.parseTime(timeString);
            if (!time || isNaN(winners) || !prize) {
                message.channel.send(`Usage: ${this.prefix}start <time> <winners> <prize>`);
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle('🎉 Giveaway! 🎉')
                .setDescription(`Prize: **${prize}**\nReact with 🎉 to enter!\nTime: **${timeString}**\nWinners: **${winners}**`)
                .setTimestamp(Date.now() + time)
                .setColor('#7289da');

            const giveawayMessage = await message.channel.send(embed);

            const giveaway = {
                channelId: message.channel.id,
                endTime: Date.now() + time,
                winners: winners,
                prize: prize,
                participants: [],
            };

            this.giveawaysData[message.guild.id] = this.giveawaysData[message.guild.id] || {};
            this.giveawaysData[message.guild.id][giveawayMessage.id] = giveaway;
            this.saveGiveaways();

            giveawayMessage.react('🎉');

            giveaway.timeout = setTimeout(() => {
                this.endGiveaway(message.guild.id, giveawayMessage.id);
            }, time);
        }

        if (args[0] === 'end') {
            const giveawayId = args[1];
            this.endGiveaway(message.guild.id, giveawayId);
        }

        if (args[0] === 'setprefix') {
            if (args[1]) {
                this.setPrefix(args[1]);
                message.channel.send(`Prefix changed to: ${args[1]}`);
            } else {
                message.channel.send('Usage: setprefix <new_prefix>');
            }
        }
    }

    async endGiveaway(guildId, giveawayId) {
        const giveaway = this.giveawaysData[guildId][giveawayId];
        if (!giveaway) return;

        const channel = await this.client.channels.fetch(giveaway.channelId);
        const giveawayMessage = await channel.messages.fetch(giveawayId);

        const reactions = giveawayMessage.reactions.cache.get('🎉');
        if (!reactions) {
            channel.send('No one reacted to the giveaway message.');
            delete this.giveawaysData[guildId][giveawayId];
            this.saveGiveaways();
            return;
        }

        const users = await reactions.users.fetch();
        const participants = users.filter(user => !user.bot).array();

        if (participants.length === 0) {
            channel.send('No participants, giveaway cancelled.');
            delete this.giveawaysData[guildId][giveawayId];
            this.saveGiveaways();
            return;
        }

        const winners = participants.sort(() => Math.random() - Math.random()).slice(0, giveaway.winners);
        channel.send(`Congratulations ${winners.map(user => user.toString()).join(', ')}! You won **${giveaway.prize}**!`);

        delete this.giveawaysData[guildId][giveawayId];
        this.saveGiveaways();
    }
}

module.exports = EasyMaker;
