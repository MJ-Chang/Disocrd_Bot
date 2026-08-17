const { MessageFlags, SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { Colors } = require('../../utils/constants');
const { withFooter, sendError } = require('../../utils/embeds');
const { t } = require('../../utils/i18n');

module.exports = {
  category: 'utility',
  data: new SlashCommandBuilder()
    .setName('banner')
    .setDescription(t('查看用戶的橫幅', 'View user banner'))
    .addUserOption((o) => o.setName('user').setDescription(t('要查看的用戶（預設為自己）', 'User to view (default: you)'))),
  cooldown: 3000,
  async run(interaction, client) {
    try {
      const target = interaction.options.getUser('user') || interaction.user;
      // 強制重新拉取用戶資料，以取得完整的 banner 欄位
      const user = await client.users.fetch(target.id, { force: true });
      const banner = user.bannerURL({ size: 1024 });
      if (!banner) {
        return interaction.reply({ content: t(`🖼️ **${user.username}** 此用戶沒有設定橫幅。`, `🖼️ **${user.username}** has no banner set.`), flags: MessageFlags.Ephemeral });
      }

      const embed = new EmbedBuilder()
        .setColor(Colors.INFO)
        .setTitle(t(`🖼️ ${user.username} 的橫幅`, `🖼️ ${user.username}'s Banner`))
        .setImage(banner)
        .setDescription(t(`🔗 [查看原圖](${banner})`, `🔗 [View original](${banner})`))
        .setTimestamp();
      withFooter(embed, client);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel(t('查看原圖', 'View original')).setStyle(ButtonStyle.Link).setURL(banner)
      );
      await interaction.reply({ embeds: [embed], components: [row] });
    } catch (e) {
      return sendError(interaction, t('查詢橫幅時發生錯誤。', 'An error occurred while fetching the banner.'));
    }
  },
};
