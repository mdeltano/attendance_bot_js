const { SlashCommandBuilder, Client, GatewayIntentBits } = require('discord.js');
const { google } = require('googleapis');
const { GoogleAuth } = require('google-auth-library');
const fs = require('fs').promises;
const events = require('../../events.json');
const { spreadsheetId } = require('../../config.json');


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

        voice_channel_ids = [
            BigInt('685715754880073738'),
        ];

        user_ids = [];

        //grab all user ids in each voice channel
        voice_channel_ids.forEach((channelId) => {
            interaction.client.channels.fetch(channelId).then((voiceChannel) => {
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
                //TODO: column changes based on event
                const columnIndex = 0;

                sheets.spreadsheets.values.update({
                    spreadsheetId: spreadsheetId,
                    //update M dynamically based on event
                    range: `\'Roster Mk.II\'!${columnId}${rowIndex + 1}`,
                    valueInputOption: 'RAW',
                    resource: {
                        //TODO: update value for what officers normally enter
                        values: [[1]],
                    },
                }, (err, response) => {
                    if (err) {
                        console.error(err);
                    } else {
                        console.log(`Updated ${user_id} in spreadsheet`);
                    }
                });
            } else {
                console.log(`User ${user_id} not found in spreadsheet`);
            }
        });

        interaction.reply('Attendance taken!');
    },
};