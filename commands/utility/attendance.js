const { SlashCommandBuilder, Client, GatewayIntentBits } = require('discord.js');
const { google } = require('googleapis');
const { GoogleAuth } = require('google-auth-library');
const fs = require('fs').promises;
const events = require('../../events.json');
const { spreadsheetId, approvedChannel, voiceChannelIds } = require('../../config.json');



module.exports = {
    data: new SlashCommandBuilder()
        .setName('attendance')
        .setDescription('Take attendance for the selected event')
        .addStringOption(option =>
            option.setName('event')
                .setDescription('The event to take attendance for')
                .setRequired(true)
                .setAutocomplete(true)),
    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const choices = Object.keys(events);
        const filtered = choices.filter(choice => choice.toLowerCase().startsWith(focusedValue));
		await interaction.respond(
			filtered.map(choice => ({ name: choice, value: choice })),
		);
    },
    async execute(interaction) {
        if (approvedChannel !== interaction.channel.id) {
            await interaction.reply({ content: 'You are not allowed to use this command', ephemeral: true });
            return;
        }
        console.log('Executing attendance command');
        
        const credentials = await fs.readFile('credentials.json', 'utf8');
        let credentials_parsed = JSON.parse(credentials);

        const event = interaction.options.getString('event');
        console.log(event);

        const allEvents = Object.keys(events);
        console.log(allEvents);
        let columnId;

        if (allEvents.includes(event)) {
            columnId = events[event];
        } else {
            await interaction.reply({ content: 'Invalid event', ephemeral: true });
            return;
        }

        const auth = new GoogleAuth({
            credentials: credentials_parsed,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const authClient = auth.fromJSON(credentials_parsed);

        const sheets = google.sheets({ version: 'v4', auth: authClient});
        const range = '\'Roster Mk.II\'!AF:AF';

        user_ids = [];

        //grab all user ids in each voice channel
        voiceChannelIds.forEach((channelId) => {
            const bigIntChannelId = BigInt(channelId);
            console.log(`Checking voice channel ${channelId}`);
            interaction.client.channels.fetch(bigIntChannelId).then((voiceChannel) => {
                voiceChannel.members.forEach((member) => {
                    user_ids.push(member.id);
                    console.log(`Found user ${member.id} in voice channel ${voiceChannel.name}`);
                });
            });
        });

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: range,
        });

        const data = response.data.values;

        user_ids.forEach((user_id) => {
            const matchingRow = data.find((row) => row[0] === user_id);
            if (matchingRow) {
                const rowIndex = data.indexOf(matchingRow);
                console.log(`User ${user_id} found in spreadsheet at row ${rowIndex + 1}`);

                sheets.spreadsheets.values.update({
                    spreadsheetId: spreadsheetId,
                    range: `\'Roster Mk.II\'!${columnId}${rowIndex + 1}`,
                    valueInputOption: 'RAW',
                    resource: {
                        values: [[1]],
                    },
                }, async (err, response) => {
                    if (err) {
                        console.error(err);
                    } else {
                        interaction.channel.send(`${await interaction.guild.members.fetch(user_id)} has been marked present for ${event}!`);
                        console.log(`Updated ${user_id} in spreadsheet`);
                    }
                });
            } else {
                console.log(`User ${user_id} not found in spreadsheet`);
            }
        });
    },
};