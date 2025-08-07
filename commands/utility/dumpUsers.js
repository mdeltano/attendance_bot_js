const { SlashCommandBuilder } = require('discord.js');
const { voiceChannelIds, logChannel } = require('../../config.json');


module.exports = {
    data: new SlashCommandBuilder()
        .setName('dumpusers')
        .setDescription('Dump users tags and ids to logs channel'),
    async execute(interaction) { 
        if (logChannel !== interaction.channel.id) {
            await interaction.reply({ content: 'You are not allowed to use this command', ephemeral: true });
            return;
        }
        console.log('Dumping all users to logs channel...');

        voiceChannelIds.forEach((channelId) => {
            const bigIntChannelId = BigInt(channelId);
            interaction.client.channels.fetch(bigIntChannelId).then((channel) => {
                channel.members.forEach(async (member) => {
                    interaction.channel.send(`${await interaction.guild.members.fetch(member.id)} : ${member.id}`);
                });
            })
        });
    },
}