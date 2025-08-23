const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs').promises;
let events = require('../../events.json');
const { approvedChannel } = require('../../config.json');
const { execSync } = require('child_process');


module.exports = {
    data: new SlashCommandBuilder()
        .setName('renameevent')
        .setDescription('Rename an event')
        .addStringOption(option =>
            option.setName('event')
                .setDescription('The event to rename')
                .setRequired(true)
                .setAutocomplete(true))
        .addStringOption(option =>
            option.setName('new_name')
                .setDescription('The new name of the event')
                .setRequired(true)),
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

        const currentEventName = interaction.options.getString('event');
        const newEventName = interaction.options.getString('newname');
        const newEvents = {};

        Object.entries(events).forEach(([key, value]) => {
            if (key === currentEventName) {
                newEvents[newEventName] = value;
            } else {
                newEvents[key] = value;
            }
        });

        await fs.writeFile('events.json', JSON.stringify(newEvents));
        await interaction.reply({ content: `Event ${currentEventName} has been renamed to ${newEventName}`, ephemeral: true });

        execSync('node deploy-commands.js');
        execSync('node index.js');

    }
}
