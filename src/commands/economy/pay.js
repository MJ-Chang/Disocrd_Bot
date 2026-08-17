const { SlashCommandBuilder } = require('discord.js');
const { t } = require('../../utils/i18n');
const economy = require('../../features/economy');
const { formatNumber } = require('../../utils/format');
const { sendError, sendSuccess } = require('../../utils/embeds');

module.exports = {
  category: 'economy',
  data: new SlashCommandBuilder()
    .setName('pay')
    .setDescription(t('轉帳金錢給其他成員', 'Transfer money to another member'))
    .setDMPermission(false)
    .addUserOption((o) => o.setName('user').setDescription(t('收款成員', 'Recipient')).setRequired(true))
    .addIntegerOption((o) => o.setName('amount').setDescription(t('金額', 'Amount')).setMinValue(1).setRequired(true)),
  cooldown: 3000,
  async run(interaction, client) {
    const target = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    if (target.id === interaction.user.id) return sendError(interaction, t('不能轉帳給自己！', "You can't transfer money to yourself!"));
    if (amount <= 0) return sendError(interaction, t('金額必須大於 0！', 'Amount must be greater than 0!'));

    const ok = await economy.addMoney(client, interaction.guild.id, interaction.user.id, -amount);
    if (!ok) return sendError(interaction, t('你的餘額不足！', 'Insufficient balance!'));
    await economy.addMoney(client, interaction.guild.id, target.id, amount);

    const s = await client.settings.get(interaction.guild.id);
    const cur = s.economy.currency || '🪙';
    return sendSuccess(interaction, t(`你已轉帳 ${cur} **${formatNumber(amount)}** 給 ${target}！`, `You transferred ${cur} **${formatNumber(amount)}** to ${target}!`));
  },
};
