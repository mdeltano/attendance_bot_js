const { SlashCommandBuilder } = require('discord.js');
let events = require('../../events.json');
const fs = require('fs').promises;
const { approvedChannel } = require('../../config.json');
const { exec } = require('child_process');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addevent')
        .setDescription(
            'Add an event. All events to the right of the column entered are shifted right by one.'
        )
        .addStringOption(option =>
            option.setName('event')
                .setDescription('The event to add')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('column')
                .setDescription('The column to add the event to')
                .setRequired(true)),
    async execute(interaction) {
        if (approvedChannel !== interaction.channel.id) {
            await interaction.reply({ content: 'You are not allowed to use this command', ephemeral: true });
            return;
        }

        fs.readFile('events.json', 'utf8', async (err, data) => {
            if (err) {
                console.error(err);
                return;
            }
            events = JSON.parse(data);
        });
        
        const eventName = interaction.options.getString('event');
        const column = interaction.options.getString('column');
        let newEvents = {};
        let found = 0;

        Object.entries(events).forEach(([key, value]) => {
            if (value < column) {
                newEvents[key] = value;
            } else if (value === column) {
                found = 1;
                newEvents[eventName] = column;
                if (value === 'Z') {
                    newEvents[key] = 'AA';
                } else if (value.match(/A([A-Z])/)) {
                    newEvents[key] = String.fromCharCode(value.charCodeAt(1) + 1);
                } else {
                    newEvents[key] = String.fromCharCode(value.charCodeAt(0) + 1);
                }
            } else {
                if (value === 'Z') {
                    newEvents[key] = 'AA';
                } else if (value.match(/A([A-Z])/)) {
                    newEvents[key] = String.fromCharCode(value.charCodeAt(1) + 1);
                } else {
                    newEvents[key] = String.fromCharCode(value.charCodeAt(0) + 1);
                }
            }
        });

        if (found === 0) {
            newEvents[eventName] = column;
        }

        await fs.writeFile('events.json', JSON.stringify(newEvents, null, 2));
        await interaction.reply({ content: `Event ${eventName} added to column ${column}, refreshing and restarting bot...`, ephemeral: true });

        //run deploy-commands.js to update commands
        exec('node deploy-commands.js');
        //restart bot
        exec('node index.js');

    }



}

        