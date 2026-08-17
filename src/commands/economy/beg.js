const { SlashCommandBuilder } = require('discord.js');
const { t } = require('../../utils/i18n');
const economy = require('../../features/economy');
const { formatNumber, formatDuration } = require('../../utils/format');
const { sendError, sendSuccess } = require('../../utils/embeds');

module.exports = {
  category: 'economy',
  data: new SlashCommandBuilder()
    .setName('beg')
    .setDescription(t('向路人乞討一點金錢', 'Beg for some money'))
    .setDMPermission(false),
  cooldown: 3000,
  async run(interaction, client) {
    const result = await economy.beg(client, interaction.guild.id, interaction.user.id);
    if (result && result.cooldown) return sendError(interaction, t(`請 ${formatDuration(result.cooldown)} 後再來！`, `Try again in ${formatDuration(result.cooldown)}!`));
    const s = await client.settings.get(interaction.guild.id);
    const cur = s.economy.currency || '🪙';
    return sendSuccess(interaction, t(`你乞討到了 ${cur} **${formatNumber(result.amount)}**！`, `You begged ${cur} **${formatNumber(result.amount)}**!`));
  },
};
