const { SlashCommandBuilder } = require('discord.js');
const { voiceChannelIds, approvedChannel } = require('../../config.json');
const { google } = require('googleapis');
const { GoogleAuth } = require('google-auth-library');
const fs = require('fs').promises;


module.exports = {
    data: new SlashCommandBuilder()
        .setName('dumpusers')
        .setDescription('Dump users tags and ids to logs channel'),
    async execute(interaction) { 
        if (approvedChannel !== interaction.channel.id) {
            await interaction.reply({ content: 'You are not allowed to use this command', ephemeral: true });
            return;
        }
        console.log('Dumping all users to logs channel...');

        const credentials = await fs.readFile('credentials.json', 'utf8');
        const auth = new GoogleAuth({ credentials: JSON.parse(credentials), scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
        const authClient = auth.fromJSON(JSON.parse(credentials));

        const sheets = google.sheets({ version: 'v4', auth: authClient });
        const range = '\'Roster Mk.II\'!AF:AF';

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: range,
        });

        const data = response.data.values;

        voiceChannelIds.forEach((channelId) => {
            const bigIntChannelId = BigInt(channelId);
            interaction.client.channels.fetch(bigIntChannelId).then((channel) => {
                channel.members.forEach(async (member) => {
                    const matchingRow = data.find(row => row[0] === member.id);
                    if (matchingRow) {
                        return;
                    } else {
                        interaction.channel.send(`${await interaction.guild.members.fetch(member.id)} : ${member.id}`);
                    }
                    
                });
            })
        });
    },
}