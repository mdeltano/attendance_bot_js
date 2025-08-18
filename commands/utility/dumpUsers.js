const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { approvedChannel, spreadsheetId, categoryId } = require('../../config.json');
const { google } = require('googleapis');
const { GoogleAuth } = require('google-auth-library');
const fs = require('fs').promises;
const { fetch, setGlobalDispatcher, Agent } = require('undici');


module.exports = {
    data: new SlashCommandBuilder()
        .setName('dumpusers')
        .setDescription('Dump users not in spreadsheet\'s tags and ids to this channel'),
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
        const range = '\'Roster Mk.II\'!D:D';

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: range,
        });

        const data = response.data.values;

        const channels = await interaction.guild.channels.fetch();

        voiceChannelIds = channels.filter((channel) => 
            channel.parentId === categoryId && 
            channel.type === ChannelType.GuildVoice)
        .map((channel) => channel.id);

        voiceChannelIds.forEach((channelId) => {
            const bigIntChannelId = BigInt(channelId);
            setGlobalDispatcher(new Agent({ connect: { timeout: 60_000 } }) );
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
        interaction.reply({ content: 'All users not detected in spreadsheet dumped', ephemeral: true });
    },
}