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
        //verify the command is executed in the approved channel
        if (approvedChannel !== interaction.channel.id) {
            await interaction.reply({ content: 'You are not allowed to use this command', ephemeral: true });
            return;
        }
        console.log('Executing attendance command');
        
        //get google credentials, event name, and the global event list
        const credentials = await fs.readFile('credentials.json', 'utf8');
        let credentials_parsed = JSON.parse(credentials);

        const event = interaction.options.getString('event');
        console.log(event);

        const allEvents = Object.keys(events);
        console.log(allEvents);
        let columnId;

        //check the event is valid, and if so get the column id for it
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

        //this allegedly prevents the api from timing out
        setGlobalDispatcher(new Agent({ connect: { timeout: 60_000 } }) );

        user_ids = [];
        const channels = await interaction.guild.channels.fetch();

        //grab all voice channel ids in the provided category
        voiceChannelIds = channels.filter((channel) => 
            channel.parentId === categoryId && 
            channel.type === ChannelType.GuildVoice)
        .map((channel) => channel.id);

        //grab all user ids in each voice channel in the provided category
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

        //get all the user ids currently in the spreadsheet
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: range,
        });

        const data = response.data.values;
        requests = [];
        
        interaction.channel.send(`${new Date(Date.now()).toLocaleDateString("en-US", {
            timeZone: "America/New_York"
        })} ${event}`);

        //take the found user ids and convert them to api requests to update the spreadsheet, if they are found in the spreadsheet
        await Promise.all(user_ids.map(async (user_id) => {
            //check if the user's id is in the spreadsheet
            const matchingRow = data.find((row) => row[0] === user_id);
            if (matchingRow) {
                //get the row index
                const rowIndex = data.indexOf(matchingRow);
                console.log(`User ${user_id} found in spreadsheet at row ${rowIndex + 1}`);
                //send a message to the channel 
                //TODO: group these messages, they sometimes fail to send
                interaction.channel.send(`${await interaction.guild.members.fetch(user_id)}`);
                // push google api request to list
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
                //if user is not found in spreadsheet, log it
                interaction.channel.send(`${await interaction.guild.members.fetch(user_id)} not found in spreadsheet : ID ${user_id}`);
                console.log(`User ${user_id} not found in spreadsheet`);
            }
        }));

        //format and send api request
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