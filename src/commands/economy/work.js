const { SlashCommandBuilder } = require('discord.js');
const { t } = require('../../utils/i18n');
const economy = require('../../features/economy');
const { formatNumber, formatDuration } = require('../../utils/format');
const { sendError, sendSuccess } = require('../../utils/embeds');

module.exports = {
  category: 'economy',
  data: new SlashCommandBuilder()
    .setName('work')
    .setDescription(t('努力工作賺取金錢', 'Work hard to earn money'))
    .setDMPermission(false),
  cooldown: 3000,
  async run(interaction, client) {
    const result = await economy.work(client, interaction.guild.id, interaction.user.id);
    if (result && result.cooldown) return sendError(interaction, t(`請 ${formatDuration(result.cooldown)} 後再來！`, `Try again in ${formatDuration(result.cooldown)}!`));
    const s = await client.settings.get(interaction.guild.id);
    const cur = s.economy.currency || '🪙';
    return sendSuccess(interaction, t(`你努力工作賺到了 ${cur} **${formatNumber(result.amount)}**！`, `You earned ${cur} **${formatNumber(result.amount)}** from work!`));
  },
};
