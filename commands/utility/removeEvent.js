const { SlashCommandBuilder } = require('discord.js');
let events = require('../../events.json');
const fs = require('fs').promises;
const { approvedChannel } = require('../../config.json');
const { exec } = require('child_process');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('removeevent')
        .setDescription('Remove an event')
        .addStringOption(option =>
            option.setName('event')
                .setDescription('Remove an event. All events to the right of the column entered are shifted left by one.')
                .setRequired(true)
                .setAutocomplete(true)),
    async autocomplete(interaction) {
        fs.readFile('events.json', 'utf8', async (err, data) => {
            if (err) {
                console.error(err);
                return;
            }
            events = JSON.parse(data);
        });

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

        fs.readFile('events.json', 'utf8', async (err, data) => {
            if (err) {
                console.error(err);
                return;
            }
            events = JSON.parse(data);
        });

        const eventName = interaction.options.getString('event');
        const column = events[eventName];
        const newEvents = {};

        Object.entries(events).forEach(([key, value]) => {
            if (value < column && !value.match(/A([A-Z])/)) {
                newEvents[key] = value;
            } else if (value === column) {
                return;
            } else {
                if (value === 'AA') {
                    newEvents[key] = 'Z';
                } else if (value.match(/A([A-Z])/)) {
                    newEvents[key] = String.fromCharCode(value.charCodeAt(1) - 1);
                } else {
                    newEvents[key] = String.fromCharCode(value.charCodeAt(0) - 1);
                }
            }
        });

        await fs.writeFile('events.json', JSON.stringify(newEvents, null, 2));
        await interaction.reply({ content: `Event ${eventName} removed, refreshing and restarting...`, ephemeral: true });

        //run deploy-commands.js to update commands
        execSync('node deploy-commands.js');
        //restart bot
        execSync('node index.js');
    },
};