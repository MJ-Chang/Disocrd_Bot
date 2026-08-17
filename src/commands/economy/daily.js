const { SlashCommandBuilder } = require('discord.js');
const { t } = require('../../utils/i18n');
const economy = require('../../features/economy');
const { formatNumber } = require('../../utils/format');
const { sendError, sendSuccess } = require('../../utils/embeds');

module.exports = {
  category: 'economy',
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription(t('領取每日獎勵', 'Claim your daily reward'))
    .setDMPermission(false),
  cooldown: 3000,
  async run(interaction, client) {
    const result = await economy.daily(client, interaction.guild.id, interaction.user.id);
    if (!result) return sendError(interaction, t('今天的每日獎勵已經領過了，請明天再來！', "You've already claimed today's daily reward, come back tomorrow!"));
    const s = await client.settings.get(interaction.guild.id);
    const cur = s.economy.currency || '🪙';
    const desc = t(
      `你領取了 ${cur} **${formatNumber(result.amount)}**！${result.streak ? `\n🔥 連續領取 **${result.streak}** 天！` : ''}`,
      `You claimed ${cur} **${formatNumber(result.amount)}**!${result.streak ? `\n🔥 ${result.streak}-day streak!` : ''}`
    );
    return sendSuccess(interaction, desc);
  },
};
