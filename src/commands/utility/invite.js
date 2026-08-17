const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { Colors } = require('../../utils/constants');
const { withFooter, sendError } = require('../../utils/embeds');
const { t } = require('../../utils/i18n');

module.exports = {
  category: 'utility',
  data: new SlashCommandBuilder().setName('invite').setDescription(t('取得機器人的邀請連結', 'Get the bot invite link')),
  cooldown: 5000,
  async run(interaction, client) {
    try {
      const config = client.config || require('../../config');
      if (!config.clientId) {
        return sendError(interaction, t('尚未設定機器人的 Client ID（CLIENT_ID 環境變數）。', "The bot's Client ID is not set (CLIENT_ID env var)."));
      }
      const invite = `https://discord.com/oauth2/authorize?client_id=${config.clientId}&permissions=8&scope=bot%20applications.commands`;

      const embed = new EmbedBuilder()
        .setColor(Colors.INFO)
        .setTitle(t('🔗 邀請機器人', '🔗 Invite Bot'))
        .setDescription(
          t(
            `點擊下方按鈕或[此連結](${invite})邀請我加入你的伺服器！\n\n⚠️ 此邀請連結包含 **管理員權限**，請謹慎發送。`,
            `Click the button below or [this link](${invite}) to invite me to your server!\n\n⚠️ This invite grants **Administrator** permission — share carefully.`
          )
        )
        .setTimestamp();
      withFooter(embed, client);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel(t('邀請機器人', 'Invite Bot')).setStyle(ButtonStyle.Link).setURL(invite)
      );
      await interaction.reply({ embeds: [embed], components: [row] });
    } catch (e) {
      return sendError(interaction, t('產生邀請連結時發生錯誤。', 'An error occurred while generating the invite link.'));
    }
  },
};
