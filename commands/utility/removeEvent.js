const { SlashCommandBuilder } = require('discord.js');
const events = require('../../events.json');
const fs = require('fs').promises;

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
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const choices = Object.keys(events);
        const filtered = choices.filter(choice => choice.toLowerCase().startsWith(focusedValue));
        await interaction.respond(
            filtered.map(choice => ({ name: choice, value: choice })),
        );
    },
    async execute(interaction) {
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
        await interaction.reply({ content: `Event ${eventName} removed`, ephemeral: true });
    },
};