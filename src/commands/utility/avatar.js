const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { Colors } = require('../../utils/constants');
const { withFooter, sendError } = require('../../utils/embeds');
const { t } = require('../../utils/i18n');

module.exports = {
  category: 'utility',
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription(t('查看用戶的大頭照', 'View user avatar'))
    .addUserOption((o) => o.setName('user').setDescription(t('要查看的用戶（預設為自己）', 'User to view (default: you)'))),
  cooldown: 3000,
  async run(interaction, client) {
    try {
      const target = interaction.options.getUser('user') || interaction.user;
      const isGif = typeof target.avatar === 'string' && target.avatar.startsWith('a_');
      const png = target.displayAvatarURL({ size: 1024, extension: 'png' });
      const gif = target.displayAvatarURL({ size: 1024, extension: 'gif' });
      const image = isGif ? gif : png;

      const embed = new EmbedBuilder()
        .setColor(Colors.INFO)
        .setTitle(t(`🖼️ ${target.username} 的大頭照`, `🖼️ ${target.username}'s Avatar`))
        .setImage(image)
        .setDescription(
          `🔗 [256px](${target.displayAvatarURL({ size: 256 })}) ・ [1024px](${target.displayAvatarURL({ size: 1024 })})` +
            (isGif ? '\n' + t('🎞️ 此頭貼為 **GIF 動圖**', '🎞️ This avatar is a **GIF**') : '')
        )
        .setTimestamp();
      withFooter(embed, client);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel(t('查看原圖', 'View original')).setStyle(ButtonStyle.Link).setURL(image)
      );
      await interaction.reply({ embeds: [embed], components: [row] });
    } catch (e) {
      return sendError(interaction, t('查詢大頭照時發生錯誤。', 'An error occurred while fetching the avatar.'));
    }
  },
};
