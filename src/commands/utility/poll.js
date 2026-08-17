const { SlashCommandBuilder } = require('discord.js');
const { sendError } = require('../../utils/embeds');
const pollsFeature = require('../../features/polls');

const OPTION_NAMES = ['option1', 'option2', 'option3', 'option4', 'option5', 'option6', 'option7', 'option8', 'option9', 'option10'];

module.exports = {
  category: 'utility',
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('建立投票（2-10 個選項）')
    .addStringOption((o) => o.setName('question').setDescription('投票主題').setRequired(true))
    .addStringOption((o) => o.setName('option1').setDescription('選項 1').setRequired(true))
    .addStringOption((o) => o.setName('option2').setDescription('選項 2').setRequired(true))
    .addStringOption((o) => o.setName('option3').setDescription('選項 3'))
    .addStringOption((o) => o.setName('option4').setDescription('選項 4'))
    .addStringOption((o) => o.setName('option5').setDescription('選項 5'))
    .addStringOption((o) => o.setName('option6').setDescription('選項 6'))
    .addStringOption((o) => o.setName('option7').setDescription('選項 7'))
    .addStringOption((o) => o.setName('option8').setDescription('選項 8'))
    .addStringOption((o) => o.setName('option9').setDescription('選項 9'))
    .addStringOption((o) => o.setName('option10').setDescription('選項 10')),
  async run(interaction, client) {
    const question = interaction.options.getString('question');
    const options = OPTION_NAMES.map((n) => interaction.options.getString(n)).filter((v) => v && v.trim());

    if (options.length < 2) return sendError(interaction, '至少需要 2 個選項。');
    if (options.length > 10) return sendError(interaction, '最多 10 個選項。');

    await interaction.deferReply();
    await pollsFeature.createPoll(client, interaction, question, options.map((o) => o.slice(0, 80)));
  },
};
