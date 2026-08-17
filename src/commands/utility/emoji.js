const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Colors } = require('../../utils/constants');
const { withFooter, sendError } = require('../../utils/embeds');
const { formatNumber } = require('../../utils/format');
const { t } = require('../../utils/i18n');

const MAX_PER_FIELD = 15; // 靜態 / 動態各顯示最多 15 個（合計 30）

module.exports = {
  category: 'utility',
  data: new SlashCommandBuilder().setName('emoji').setDescription(t('列出伺服器所有的自訂表情', 'List all custom emojis in the server')),
  cooldown: 5000,
  async run(interaction, client) {
    try {
      const emojis = [...interaction.guild.emojis.cache.values()];
      const animated = emojis.filter((e) => e.animated);
      const statics = emojis.filter((e) => !e.animated);

      const embed = new EmbedBuilder()
        .setColor(Colors.INFO)
        .setTitle(t('😀 伺服器表情', '😀 Server Emojis'))
        .setDescription(
          t(
            `共有 **${formatNumber(emojis.length)}** 個自訂表情\n靜態：**${formatNumber(statics.length)}** 個 ・ 動態：**${formatNumber(animated.length)}** 個`,
            `**${formatNumber(emojis.length)}** custom emojis total\nStatic: **${formatNumber(statics.length)}** ・ Animated: **${formatNumber(animated.length)}**`
          )
        )
        .setTimestamp();

      if (emojis.length === 0) {
        embed.addFields({ name: t('沒有表情', 'No emojis'), value: t('此伺服器還沒有自訂表情。', 'This server has no custom emojis yet.') });
      } else {
        const fmt = (list) =>
          list
            .slice(0, MAX_PER_FIELD)
            .map((e) => `${e} \`${e.name}\``)
            .join('\n') || t('（無）', 'None');
        embed.addFields(
          {
            name: t(`靜態表情（顯示 ${Math.min(statics.length, MAX_PER_FIELD)} / ${statics.length}）`, `Static emojis (showing ${Math.min(statics.length, MAX_PER_FIELD)} / ${statics.length})`),
            value: fmt(statics),
            inline: true,
          },
          {
            name: t(`動態表情（顯示 ${Math.min(animated.length, MAX_PER_FIELD)} / ${animated.length}）`, `Animated emojis (showing ${Math.min(animated.length, MAX_PER_FIELD)} / ${animated.length})`),
            value: fmt(animated),
            inline: true,
          }
        );
      }
      withFooter(embed, client, t('最多顯示前 30 個表情', 'Showing up to 30 emojis'));
      await interaction.reply({ embeds: [embed] });
    } catch (e) {
      return sendError(interaction, t('查詢表情時發生錯誤。', 'An error occurred while fetching emojis.'));
    }
  },
};
