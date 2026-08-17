const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { t } = require('../../utils/i18n');
const economy = require('../../features/economy');
const { Colors } = require('../../utils/constants');
const { formatNumber } = require('../../utils/format');
const { withFooter, sendError, sendSuccess } = require('../../utils/embeds');

module.exports = [
  {
    category: 'economy',
    data: new SlashCommandBuilder()
      .setName('shop')
      .setDescription(t('查看商店商品', 'View shop items'))
      .setDMPermission(false),
    cooldown: 3000,
    async run(interaction, client) {
      const items = await economy.getShop(client, interaction.guild.id);
      if (items.length === 0) return sendError(interaction, t('商店目前是空的，等待管理員上架商品。', 'The shop is empty, waiting for an admin to add items.'));
      const s = await client.settings.get(interaction.guild.id);
      const cur = s.economy.currency || '🪙';
      const lines = items.map((i) => {
        const tag = i.roleId ? t('（🎭 身分組商品）', ' (🎭 role item)') : '';
        return `\`${i.id}\` **${i.name}** — ${cur} ${formatNumber(i.price)}${tag}\n└ ${i.description || t('（無說明）', ' (no description)')}`;
      });
      const embed = new EmbedBuilder()
        .setColor(Colors.ECONOMY)
        .setTitle(t('🛒 商店', '🛒 Shop'))
        .setDescription(lines.join('\n\n'));
      withFooter(embed, client, t('使用 /buy 輸入商品 ID 購買', 'Use /buy with an item ID'));
      await interaction.reply({ embeds: [embed] });
    },
  },
  {
    category: 'economy',
    data: new SlashCommandBuilder()
      .setName('buy')
      .setDescription(t('購買商店商品', 'Buy a shop item'))
      .setDMPermission(false)
      .addStringOption((o) => o.setName('item').setDescription(t('商品 ID（可用 /shop 查看）', 'Item ID (see /shop)')).setRequired(true)),
    cooldown: 3000,
    async run(interaction, client) {
      const itemId = interaction.options.getString('item');
      const result = await economy.buy(client, interaction.guild.id, interaction.user.id, itemId);
      if (!result.ok) return sendError(interaction, result.reason);
      return sendSuccess(interaction, t(`你購買了 **${result.item.name}**！`, `You bought **${result.item.name}**!`));
    },
  },
];
