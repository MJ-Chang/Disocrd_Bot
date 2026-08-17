const { SlashCommandBuilder } = require('discord.js');
const { t } = require('../../utils/i18n');
const economy = require('../../features/economy');
const { formatNumber } = require('../../utils/format');
const { sendError, sendSuccess } = require('../../utils/embeds');

module.exports = {
  category: 'economy',
  adminOnly: true,
  data: new SlashCommandBuilder()
    .setName('economy')
    .setDescription(t('經濟系統管理（管理員）', 'Economy admin (admin only)'))
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('give')
        .setDescription(t('發送金錢給成員', 'Give money to a member'))
        .addUserOption((o) => o.setName('user').setDescription(t('目標成員', 'Target member')).setRequired(true))
        .addIntegerOption((o) => o.setName('amount').setDescription(t('金額', 'Amount')).setMinValue(1).setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('take')
        .setDescription(t('從成員扣除金錢', 'Take money from a member'))
        .addUserOption((o) => o.setName('user').setDescription(t('目標成員', 'Target member')).setRequired(true))
        .addIntegerOption((o) => o.setName('amount').setDescription(t('金額', 'Amount')).setMinValue(1).setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('reset')
        .setDescription(t('重設成員的經濟資料', "Reset a member's economy data"))
        .addUserOption((o) => o.setName('user').setDescription(t('目標成員', 'Target member')).setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('shop-add')
        .setDescription(t('新增商店商品', 'Add a shop item'))
        .addStringOption((o) => o.setName('name').setDescription(t('商品名稱', 'Item name')).setRequired(true))
        .addIntegerOption((o) => o.setName('price').setDescription(t('價格', 'Price')).setMinValue(0).setRequired(true))
        .addStringOption((o) => o.setName('description').setDescription(t('商品說明', 'Item description')))
        .addRoleOption((o) => o.setName('role').setDescription(t('購買後贈送的身分組', 'Role granted on purchase')))
    )
    .addSubcommand((sub) =>
      sub
        .setName('shop-remove')
        .setDescription(t('移除商店商品', 'Remove a shop item'))
        .addStringOption((o) => o.setName('id').setDescription(t('商品 ID', 'Item ID')).setRequired(true))
    ),
  cooldown: 3000,
  async run(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const s = await client.settings.get(guildId);
    const cur = s.economy.currency || '🪙';

    if (sub === 'give' || sub === 'take') {
      const target = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');
      if (sub === 'give') {
        await economy.addMoney(client, guildId, target.id, amount);
        return sendSuccess(interaction, t(`已給予 ${target} ${cur} **${formatNumber(amount)}**！`, `Gave ${target} ${cur} **${formatNumber(amount)}**!`));
      }
      const ok = await economy.addMoney(client, guildId, target.id, -amount);
      if (!ok) return sendError(interaction, t('該成員餘額不足，無法扣除那麼多！', "That member doesn't have enough balance for that!"));
      return sendSuccess(interaction, t(`已從 ${target} 扣除 ${cur} **${formatNumber(amount)}**！`, `Took ${cur} **${formatNumber(amount)}** from ${target}!`));
    }

    if (sub === 'reset') {
      const target = interaction.options.getUser('user');
      client.db.collection('economy').delete(`${guildId}:${target.id}`);
      client.db.collection('inventory').delete(`${guildId}:${target.id}`);
      return sendSuccess(interaction, t(`已重設 ${target} 的經濟與背包資料！`, `Reset ${target}'s economy and inventory data!`));
    }

    if (sub === 'shop-add') {
      const name = interaction.options.getString('name');
      const price = interaction.options.getInteger('price');
      const description = interaction.options.getString('description') || '';
      const role = interaction.options.getRole('role');
      const item = {
        id: `${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`,
        name,
        price,
        description,
        roleId: role ? role.id : null,
      };
      await client.settings.update(guildId, (gs) => {
        if (!Array.isArray(gs.economy.shop)) gs.economy.shop = [];
        gs.economy.shop.push(item);
      });
      return sendSuccess(interaction, t(`已新增商品 **${name}**（${cur} ${formatNumber(price)}）！\n🆔 商品 ID：\`${item.id}\``, `Added item **${name}** (${cur} ${formatNumber(price)})!\n🆔 Item ID: \`${item.id}\``));
    }

    if (sub === 'shop-remove') {
      const id = interaction.options.getString('id');
      let removed = false;
      await client.settings.update(guildId, (gs) => {
        if (Array.isArray(gs.economy.shop)) {
          const before = gs.economy.shop.length;
          gs.economy.shop = gs.economy.shop.filter((i) => String(i.id) !== String(id));
          removed = gs.economy.shop.length < before;
        }
      });
      if (!removed) return sendError(interaction, t('找不到該商品 ID。', 'Item ID not found.'));
      return sendSuccess(interaction, t('已移除該商品！', 'Item removed!'));
    }

    return sendError(interaction, t('未知的子指令。', 'Unknown subcommand.'));
  },
};
