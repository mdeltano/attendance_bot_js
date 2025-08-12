const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { google } = require('googleapis');
const { GoogleAuth } = require('google-auth-library');
const fs = require('fs').promises;
const events = require('../../events.json');
const { spreadsheetId, approvedChannel, categoryId, sheetId } = require('../../config.json');
const { fetch, setGlobalDispatcher, Agent } = require('undici');

function columnLetterToNumber(columnId) {
    if (columnId.length === 2) {
        return columnId.toLowerCase().charCodeAt(1) - 97 + 26;
    } else {
        return columnId.toLowerCase().charCodeAt(0) - 97;
    }
}

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
        const range = '\'Roster Mk.II\'!D:D';

        setGlobalDispatcher(new Agent({ connect: { timeout: 60_000 } }) );

        user_ids = [];
        const channels = await interaction.guild.channels.fetch();

        voiceChannelIds = channels.filter((channel) => 
            channel.parentId === categoryId && 
            channel.type === ChannelType.GuildVoice)
        .map((channel) => channel.id);

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
        requests = [];
        
        interaction.channel.send(`${new Date(Date.now()).toLocaleDateString()} ${event}`);

        await Promise.all(user_ids.map(async (user_id) => {
            const matchingRow = data.find((row) => row[0] === user_id);
            if (matchingRow) {
                const rowIndex = data.indexOf(matchingRow);
                console.log(`User ${user_id} found in spreadsheet at row ${rowIndex + 1}`);
                interaction.channel.send(`${await interaction.guild.members.fetch(user_id)}`);
                requests.push({
                    updateCells: {
                        rows: [{ values: [{ userEnteredValue: { numberValue: 1 } }] }],
                        range: {
                            sheetId: sheetId,
                            startRowIndex: rowIndex,
                            endRowIndex: rowIndex + 1,
                            startColumnIndex: columnLetterToNumber(columnId),
                            endColumnIndex: columnLetterToNumber(columnId) + 1
                        },
                        fields: 'userEnteredValue'
                    }
                });
            } else {
                interaction.channel.send(`${await interaction.guild.members.fetch(user_id)} not found in spreadsheet : ID ${user_id}`);
                console.log(`User ${user_id} not found in spreadsheet`);
            }
        }));

        let body = { requests };
        sheets.spreadsheets.batchUpdate({
            spreadsheetId: spreadsheetId,
            resource: body
        }, (err, response) => {
            if (err) {
                console.error(err);
            } else {
                console.log("Spreadsheet updated successfully");
            }
        });

        interaction.reply({ content: 'Attendance successfully taken', ephemeral: true });
    },
};